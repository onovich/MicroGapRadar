import type { Prisma } from "@prisma/client";

import {
  analyzeOpportunity,
  analyzeSerpResults,
  generateKeywordCandidates,
} from "../agents";
import type {
  KeywordExpansionCandidate,
  OpportunityAnalysisOutput,
  OpportunityRadarTask,
  OpportunityRiskLevel,
  SerpAnalysisOutput,
} from "../agents";
import { calculateOpportunityScore } from "../lib/scoring";
import {
  runScanInputSchema,
  type ParsedRunScanInput,
  type ScoreBreakdown,
  type RunScanInput,
} from "../lib/schemas";
import type { LlmClient } from "./llm";
import { MockSerpProvider, type SerpProvider, type SerpResult } from "./serp";

export type RunScanStatus = "completed" | "partial_failed" | "failed";

export type RunScanErrorStage =
  | "load_task"
  | "configure_serp"
  | "keyword_expansion"
  | "keyword_persistence"
  | "serp_search"
  | "serp_persistence"
  | "serp_analysis"
  | "opportunity_analysis"
  | "opportunity_persistence"
  | "run_finalization";

export type RunScanError = {
  stage: RunScanErrorStage;
  message: string;
  keyword?: string;
};

export type RunScanCounts = {
  keywordCandidates: number;
  serpSuccesses: number;
  opportunities: number;
};

export type RunScanOpportunity = {
  id: string;
  keyword: string;
  country: string;
  language: string;
  title: string;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  scoreExplanation: Record<keyof ScoreBreakdown, string>;
};

export type RunScanResult = {
  searchRunId: string;
  radarTaskId: string;
  status: RunScanStatus;
  useMockSerp: boolean;
  counts: RunScanCounts;
  errors: RunScanError[];
  opportunities: RunScanOpportunity[];
};

export type ScanRadarTask = {
  id: string;
  name: string;
  domainDescription: string;
  seedExamples: unknown;
  countries: unknown;
  languages: unknown;
  userAdvantages: unknown;
  monetizationPreferences: unknown;
  riskPreferences: unknown;
  excludedTopics: unknown;
  dailyLimit: number;
  isActive: boolean;
};

export type PersistedSearchRun = {
  id: string;
};

export type PersistedKeywordCandidate = {
  id: string;
};

export type PersistedOpportunity = RunScanOpportunity;

export type CreateKeywordCandidateInput = KeywordExpansionCandidate & {
  searchRunId: string;
};

export type CreateSerpResultInput = SerpResult & {
  keywordCandidateId: string;
  provider: string;
};

export type CreateOpportunityInput = {
  searchRunId: string;
  radarTaskId: string;
  keyword: string;
  country: string;
  language: string;
  title: string;
  summary: string;
  toolType: string;
  targetUser: string;
  searchIntent: string;
  serpWeaknessSummary: string;
  monetizationSummary: string;
  riskSummary: string;
  buildComplexity: string;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  scoreExplanation: Record<keyof ScoreBreakdown, string>;
  rawAnalysis: Prisma.InputJsonValue;
  killCriteria: Prisma.InputJsonValue;
};

export type UpdateSearchRunInput = {
  status: "running" | RunScanStatus;
  keywordCount?: number;
  serpSuccessCount?: number;
  opportunityCount?: number;
  completedAt?: Date;
  errorMessage?: string | null;
};

export type ScanRepository = {
  findRadarTask(id: string): Promise<ScanRadarTask | null>;
  createSearchRun(input: { radarTaskId: string }): Promise<PersistedSearchRun>;
  updateSearchRun(id: string, input: UpdateSearchRunInput): Promise<void>;
  createKeywordCandidate(
    input: CreateKeywordCandidateInput,
  ): Promise<PersistedKeywordCandidate>;
  updateKeywordCandidate(
    id: string,
    input: { status: "pending" | "searched" | "failed" },
  ): Promise<void>;
  createSerpResult(input: CreateSerpResultInput): Promise<void>;
  createOpportunity(input: CreateOpportunityInput): Promise<PersistedOpportunity>;
};

export type RunScanDependencies = {
  repository?: ScanRepository;
  serpProvider?: SerpProvider;
  llmClient?: LlmClient;
};

export class RunScanRadarTaskNotFoundError extends Error {
  readonly code = "RADAR_TASK_NOT_FOUND";

  constructor(id: string) {
    super(`Radar task was not found: ${id}`);
    this.name = "RunScanRadarTaskNotFoundError";
  }
}

export class RunScanRadarTaskInactiveError extends Error {
  readonly code = "RADAR_TASK_INACTIVE";

  constructor(id: string) {
    super(`Radar task is inactive: ${id}`);
    this.name = "RunScanRadarTaskInactiveError";
  }
}

export class RunScanUnsupportedProviderError extends Error {
  readonly code = "UNSUPPORTED_SERP_PROVIDER";

  constructor() {
    super("Only the mock SERP provider is available in this MVP slice.");
    this.name = "RunScanUnsupportedProviderError";
  }
}

const DEFAULT_SERP_LIMIT = 10;
const DEFAULT_KEYWORD_LIMIT = 10;
const ERROR_MESSAGE_MAX_LENGTH = 240;
const SEARCH_RUN_ERROR_MAX_LENGTH = 1000;

export async function runScan(
  input: RunScanInput,
  dependencies: RunScanDependencies = {},
): Promise<RunScanResult> {
  const parsedInput = runScanInputSchema.parse(input);
  const repository = dependencies.repository ?? await createPrismaScanRepository();
  const radarTask = await loadActiveRadarTask(repository, parsedInput.radarTaskId);
  const serpProvider = resolveSerpProvider(parsedInput, dependencies);
  const searchRun = await repository.createSearchRun({
    radarTaskId: radarTask.id,
  });
  const errors: RunScanError[] = [];
  const opportunities: RunScanOpportunity[] = [];
  const counts: RunScanCounts = {
    keywordCandidates: 0,
    serpSuccesses: 0,
    opportunities: 0,
  };

  try {
    const keywordCandidates = await expandKeywords({
      radarTask,
      parsedInput,
      llmClient: dependencies.llmClient,
    });

    if (keywordCandidates.length === 0) {
      errors.push({
        stage: "keyword_expansion",
        message: "Keyword expansion returned no candidates.",
      });
    }

    for (const candidate of keywordCandidates) {
      const opportunity = await processKeywordCandidate({
        candidate,
        radarTask,
        searchRunId: searchRun.id,
        serpProvider,
        llmClient: dependencies.llmClient,
        serpLimit: normalizeLimit(parsedInput.serpLimit, DEFAULT_SERP_LIMIT),
        repository,
        errors,
        counts,
      });

      if (opportunity) {
        opportunities.push(opportunity);
      }
    }
  } catch (error) {
    errors.push({
      stage: "keyword_expansion",
      message: sanitizeScanErrorMessage(error),
    });
  }

  counts.opportunities = opportunities.length;

  const status = resolveTerminalStatus(counts.opportunities, errors);

  try {
    await repository.updateSearchRun(searchRun.id, {
      status,
      keywordCount: counts.keywordCandidates,
      serpSuccessCount: counts.serpSuccesses,
      opportunityCount: counts.opportunities,
      completedAt: new Date(),
      errorMessage: summarizeRunErrors(errors),
    });
  } catch (error) {
    errors.push({
      stage: "run_finalization",
      message: sanitizeScanErrorMessage(error),
    });
  }

  return {
    searchRunId: searchRun.id,
    radarTaskId: radarTask.id,
    status: resolveTerminalStatus(counts.opportunities, errors),
    useMockSerp: parsedInput.useMockSerp,
    counts,
    errors,
    opportunities,
  };
}

async function createPrismaScanRepository(): Promise<ScanRepository> {
  const { db } = await import("../lib/db");

  return {
    async findRadarTask(id) {
      return db.radarTask.findUnique({ where: { id } });
    },

    async createSearchRun(input) {
      return db.searchRun.create({
        data: {
          radarTaskId: input.radarTaskId,
          status: "running",
          startedAt: new Date(),
        },
        select: { id: true },
      });
    },

    async updateSearchRun(id, input) {
      await db.searchRun.update({
        where: { id },
        data: input,
      });
    },

    async createKeywordCandidate(input) {
      return db.keywordCandidate.create({
        data: {
          searchRunId: input.searchRunId,
          keyword: input.keyword,
          country: input.country,
          language: input.language,
          intentType: input.intentType,
          rationale: input.rationale,
          status: "pending",
        },
        select: { id: true },
      });
    },

    async updateKeywordCandidate(id, input) {
      await db.keywordCandidate.update({
        where: { id },
        data: input,
      });
    },

    async createSerpResult(input) {
      await db.serpResult.create({
        data: {
          keywordCandidateId: input.keywordCandidateId,
          provider: input.provider,
          position: input.position,
          title: input.title,
          url: input.url,
          domain: input.domain,
          snippet: input.snippet,
          resultType: input.resultType ?? "unknown",
          rawJson: toInputJson(input),
        },
      });
    },

    async createOpportunity(input) {
      const opportunity = await db.opportunity.create({
        data: {
          searchRunId: input.searchRunId,
          radarTaskId: input.radarTaskId,
          keyword: input.keyword,
          country: input.country,
          language: input.language,
          title: input.title,
          summary: input.summary,
          toolType: input.toolType,
          targetUser: input.targetUser,
          searchIntent: input.searchIntent,
          serpWeaknessSummary: input.serpWeaknessSummary,
          monetizationSummary: input.monetizationSummary,
          riskSummary: input.riskSummary,
          buildComplexity: input.buildComplexity,
          totalScore: input.totalScore,
          scoreBreakdown: input.scoreBreakdown,
          scoreExplanation: input.scoreExplanation,
          rawAnalysis: input.rawAnalysis,
          killCriteria: input.killCriteria,
        },
        select: {
          id: true,
          keyword: true,
          country: true,
          language: true,
          title: true,
          totalScore: true,
          scoreBreakdown: true,
          scoreExplanation: true,
        },
      });

      return {
        id: opportunity.id,
        keyword: opportunity.keyword,
        country: opportunity.country,
        language: opportunity.language,
        title: opportunity.title,
        totalScore: opportunity.totalScore,
        scoreBreakdown: opportunity.scoreBreakdown as ScoreBreakdown,
        scoreExplanation: opportunity.scoreExplanation as Record<keyof ScoreBreakdown, string>,
      };
    },
  };
}

async function loadActiveRadarTask(
  repository: ScanRepository,
  radarTaskId: string,
): Promise<ScanRadarTask> {
  const radarTask = await repository.findRadarTask(radarTaskId);

  if (!radarTask) {
    throw new RunScanRadarTaskNotFoundError(radarTaskId);
  }

  if (!radarTask.isActive) {
    throw new RunScanRadarTaskInactiveError(radarTaskId);
  }

  return radarTask;
}

function resolveSerpProvider(
  input: ParsedRunScanInput,
  dependencies: RunScanDependencies,
): SerpProvider {
  if (dependencies.serpProvider) {
    return dependencies.serpProvider;
  }

  if (input.useMockSerp) {
    return new MockSerpProvider();
  }

  throw new RunScanUnsupportedProviderError();
}

async function expandKeywords({
  radarTask,
  parsedInput,
  llmClient,
}: {
  radarTask: ScanRadarTask;
  parsedInput: ParsedRunScanInput;
  llmClient?: LlmClient;
}): Promise<KeywordExpansionCandidate[]> {
  const agentRadarTask = toAgentRadarTask(radarTask);
  const keywordLimit = normalizeLimit(
    parsedInput.keywordLimit ?? radarTask.dailyLimit,
    DEFAULT_KEYWORD_LIMIT,
  );

  return generateKeywordCandidates(
    {
      domainDescription: agentRadarTask.domainDescription,
      seedExamples: agentRadarTask.seedExamples,
      countries: agentRadarTask.countries,
      languages: agentRadarTask.languages,
      userAdvantages: agentRadarTask.userAdvantages,
      monetizationPreferences: agentRadarTask.monetizationPreferences,
      excludedTopics: agentRadarTask.excludedTopics,
      requestedCount: keywordLimit,
    },
    { llmClient },
  );
}

async function processKeywordCandidate({
  candidate,
  radarTask,
  searchRunId,
  serpProvider,
  llmClient,
  serpLimit,
  repository,
  errors,
  counts,
}: {
  candidate: KeywordExpansionCandidate;
  radarTask: ScanRadarTask;
  searchRunId: string;
  serpProvider: SerpProvider;
  llmClient?: LlmClient;
  serpLimit: number;
  repository: ScanRepository;
  errors: RunScanError[];
  counts: RunScanCounts;
}): Promise<RunScanOpportunity | null> {
  let persistedKeyword: PersistedKeywordCandidate | null = null;

  try {
    persistedKeyword = await repository.createKeywordCandidate({
      searchRunId,
      ...candidate,
    });
    counts.keywordCandidates += 1;
  } catch (error) {
    errors.push({
      stage: "keyword_persistence",
      keyword: candidate.keyword,
      message: sanitizeScanErrorMessage(error),
    });

    return null;
  }

  let failureStage: RunScanErrorStage = "serp_search";

  try {
    const serpResults = await serpProvider.search({
      keyword: candidate.keyword,
      country: candidate.country,
      language: candidate.language,
      limit: serpLimit,
    });

    failureStage = "serp_persistence";
    await persistSerpResults({
      repository,
      keywordCandidateId: persistedKeyword.id,
      serpResults,
    });
    counts.serpSuccesses += 1;
    await repository.updateKeywordCandidate(persistedKeyword.id, {
      status: "searched",
    });

    failureStage = "serp_analysis";
    const serpAnalysis = await analyzeSerpResults(
      {
        keyword: candidate.keyword,
        country: candidate.country,
        language: candidate.language,
        serpResults,
      },
      { llmClient },
    );
    failureStage = "opportunity_analysis";
    const opportunityAnalysis = await analyzeOpportunity(
      {
        radarTask: toAgentRadarTask(radarTask),
        keywordCandidate: candidate,
        serpAnalysis,
        serpResults,
      },
      { llmClient },
    );

    failureStage = "opportunity_persistence";
    return persistOpportunity({
      repository,
      searchRunId,
      radarTaskId: radarTask.id,
      candidate,
      serpResults,
      serpAnalysis,
      opportunityAnalysis,
    });
  } catch (error) {
    await markKeywordFailed(repository, persistedKeyword.id);
    errors.push({
      stage: failureStage,
      keyword: candidate.keyword,
      message: sanitizeScanErrorMessage(error),
    });

    return null;
  }
}

async function persistSerpResults({
  repository,
  keywordCandidateId,
  serpResults,
}: {
  repository: ScanRepository;
  keywordCandidateId: string;
  serpResults: SerpResult[];
}): Promise<void> {
  for (const result of serpResults) {
    await repository.createSerpResult({
      keywordCandidateId,
      provider: "mock",
      ...result,
    });
  }
}

async function persistOpportunity({
  repository,
  searchRunId,
  radarTaskId,
  candidate,
  serpResults,
  serpAnalysis,
  opportunityAnalysis,
}: {
  repository: ScanRepository;
  searchRunId: string;
  radarTaskId: string;
  candidate: KeywordExpansionCandidate;
  serpResults: SerpResult[];
  serpAnalysis: SerpAnalysisOutput;
  opportunityAnalysis: OpportunityAnalysisOutput;
}): Promise<RunScanOpportunity> {
  const score = calculateOpportunityScore({
    scoreHints: opportunityAnalysis.scoreHints,
    serpWeaknessScoreHint: serpAnalysis.serpWeaknessScoreHint,
    riskLevel: opportunityAnalysis.risk.level as OpportunityRiskLevel,
  });

  return repository.createOpportunity({
    searchRunId,
    radarTaskId,
    keyword: candidate.keyword,
    country: candidate.country,
    language: candidate.language,
    title: opportunityAnalysis.title,
    summary: opportunityAnalysis.summary,
    toolType: opportunityAnalysis.recommendedToolType,
    targetUser: opportunityAnalysis.targetUser,
    searchIntent: opportunityAnalysis.searchIntent,
    serpWeaknessSummary: serpAnalysis.serpWeaknessSummary,
    monetizationSummary: formatMonetizationSummary(opportunityAnalysis),
    riskSummary: formatRiskSummary(opportunityAnalysis),
    buildComplexity: opportunityAnalysis.buildComplexity,
    totalScore: score.totalScore,
    scoreBreakdown: score.scoreBreakdown,
    scoreExplanation: score.scoreExplanation,
    rawAnalysis: toInputJson({
      keywordCandidate: candidate,
      serpAnalysis,
      opportunityAnalysis,
      serpResults,
    }),
    killCriteria: toInputJson(opportunityAnalysis.killCriteria),
  });
}

async function markKeywordFailed(
  repository: ScanRepository,
  keywordCandidateId: string,
): Promise<void> {
  try {
    await repository.updateKeywordCandidate(keywordCandidateId, {
      status: "failed",
    });
  } catch {
    // The keyword processing error is already recorded; avoid masking it.
  }
}

function toAgentRadarTask(task: ScanRadarTask): OpportunityRadarTask {
  return {
    id: task.id,
    name: task.name,
    domainDescription: task.domainDescription,
    seedExamples: toStringArray(task.seedExamples),
    countries: toStringArray(task.countries, ["US"]),
    languages: toStringArray(task.languages, ["en"]),
    userAdvantages: toStringArray(task.userAdvantages),
    monetizationPreferences: toStringArray(task.monetizationPreferences),
    riskPreferences: toRiskPreferences(task.riskPreferences),
    excludedTopics: toStringArray(task.excludedTopics),
  };
}

function toStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const values = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return values.length > 0 ? values : fallback;
}

function toRiskPreferences(value: unknown): OpportunityRadarTask["riskPreferences"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      maxRisk: "medium",
      avoidYMYLConclusions: true,
    };
  }

  const riskPreferences = value as Record<string, unknown>;
  const maxRisk = riskPreferences.maxRisk === "low" ||
    riskPreferences.maxRisk === "medium" ||
    riskPreferences.maxRisk === "high"
    ? riskPreferences.maxRisk
    : "medium";

  return {
    ...riskPreferences,
    maxRisk,
    avoidYMYLConclusions:
      typeof riskPreferences.avoidYMYLConclusions === "boolean"
        ? riskPreferences.avoidYMYLConclusions
        : true,
  };
}

function formatMonetizationSummary(
  opportunity: OpportunityAnalysisOutput,
): string {
  const secondary = opportunity.monetization.secondary.length > 0
    ? ` Secondary options: ${opportunity.monetization.secondary.join(", ")}.`
    : "";

  return [
    `Primary: ${opportunity.monetization.primary}.`,
    opportunity.monetization.paidExportIdea,
    secondary,
  ].join(" ").replace(/\s+/g, " ").trim();
}

function formatRiskSummary(opportunity: OpportunityAnalysisOutput): string {
  return `${opportunity.risk.level}: ${opportunity.risk.notes}`;
}

function resolveTerminalStatus(
  opportunityCount: number,
  errors: RunScanError[],
): RunScanStatus {
  if (opportunityCount > 0 && errors.length === 0) {
    return "completed";
  }

  if (opportunityCount > 0) {
    return "partial_failed";
  }

  return "failed";
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(50, Math.trunc(value)));
}

export function sanitizeScanErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "Unknown scan failure.";
  const sanitizedMessage = rawMessage
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(api[_-]?key|token|secret)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim();

  return (sanitizedMessage || "Unknown scan failure.").slice(
    0,
    ERROR_MESSAGE_MAX_LENGTH,
  );
}

function summarizeRunErrors(errors: RunScanError[]): string | null {
  if (errors.length === 0) {
    return null;
  }

  return errors
    .map((error) =>
      [error.keyword, error.stage, error.message].filter(Boolean).join(": "),
    )
    .join(" | ")
    .slice(0, SEARCH_RUN_ERROR_MAX_LENGTH);
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
