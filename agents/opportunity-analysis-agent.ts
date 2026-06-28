import { z } from "zod";

import { safeJsonCompletion } from "../services/llm";
import type { LlmChatMessage, LlmClient } from "../services/llm";
import type { SerpResult } from "../services/serp";
import {
  KEYWORD_INTENT_TYPES,
  KEYWORD_TOOL_TYPE_GUESSES,
} from "./keyword-expansion-agent";
import type {
  KeywordIntentType,
  KeywordToolTypeGuess,
} from "./keyword-expansion-agent";
import {
  SerpAnalysisOutputSchema,
  SerpResultInputSchema,
} from "./serp-analysis-agent";
import type { SerpAnalysisOutput } from "./serp-analysis-agent";

export const OPPORTUNITY_ANALYSIS_PROMPT_VERSION = "2026-06-28-v1";

export const OPPORTUNITY_TOOL_TYPES = KEYWORD_TOOL_TYPE_GUESSES;

export const OPPORTUNITY_MONETIZATION_TYPES = [
  "ads",
  "affiliate",
  "paid_export",
  "lead_gen",
  "subscription",
  "none",
] as const;

export const OPPORTUNITY_SECONDARY_MONETIZATION_TYPES = [
  "ads",
  "affiliate",
  "paid_export",
  "lead_gen",
  "subscription",
] as const;

export const OPPORTUNITY_RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "excluded",
] as const;

export const OPPORTUNITY_BUILD_COMPLEXITIES = [
  "low",
  "medium",
  "high",
] as const;

export const OpportunityRiskPreferencesSchema = z
  .object({
    maxRisk: z.enum(["low", "medium", "high"]).optional(),
    avoidYMYLConclusions: z.boolean().optional(),
  })
  .passthrough();

export const OpportunityRadarTaskSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    domainDescription: z.string().trim().min(1),
    seedExamples: z.array(z.string()).optional(),
    countries: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    userAdvantages: z.array(z.string()).optional(),
    monetizationPreferences: z.array(z.string()).optional(),
    riskPreferences: OpportunityRiskPreferencesSchema.optional(),
    excludedTopics: z.array(z.string()).optional(),
  })
  .passthrough();

export const OpportunityKeywordCandidateSchema = z
  .object({
    keyword: z.string().trim().min(1),
    country: z.string().trim().min(1).optional(),
    language: z.string().trim().min(1).optional(),
    intentType: z.enum(KEYWORD_INTENT_TYPES).optional(),
    toolTypeGuess: z.enum(KEYWORD_TOOL_TYPE_GUESSES).optional(),
    rationale: z.string().trim().min(1).optional(),
  })
  .passthrough();

export const OpportunityAnalysisInputSchema = z
  .object({
    radarTask: OpportunityRadarTaskSchema,
    keywordCandidate: OpportunityKeywordCandidateSchema,
    serpAnalysis: SerpAnalysisOutputSchema,
    serpResults: z.array(SerpResultInputSchema),
  })
  .strict();

const NonEmptyTextSchema = z.string().trim().min(1).transform(normalizeText);
const RequiredTextListSchema = z
  .array(NonEmptyTextSchema)
  .min(1)
  .transform(dedupeStringList);
const OptionalTextListSchema = z
  .array(NonEmptyTextSchema)
  .transform(dedupeStringList);

export const OpportunityToolConceptSchema = z
  .object({
    oneLiner: NonEmptyTextSchema,
    inputFields: RequiredTextListSchema,
    outputModules: RequiredTextListSchema,
  })
  .strict();

export const OpportunityMonetizationSchema = z
  .object({
    primary: z.enum(OPPORTUNITY_MONETIZATION_TYPES),
    secondary: z
      .array(z.enum(OPPORTUNITY_SECONDARY_MONETIZATION_TYPES))
      .transform(dedupeMonetizationList),
    paidExportIdea: NonEmptyTextSchema,
  })
  .strict();

export const OpportunityRiskSchema = z
  .object({
    level: z.enum(OPPORTUNITY_RISK_LEVELS),
    notes: NonEmptyTextSchema,
  })
  .strict();

export const OpportunityScoreHintsSchema = z
  .object({
    intentScore: z.number().finite().transform(normalizeOpportunityScoreHint),
    monetizationScore: z.number().finite().transform(normalizeOpportunityScoreHint),
    toolabilityScore: z.number().finite().transform(normalizeOpportunityScoreHint),
    userFitScore: z.number().finite().transform(normalizeOpportunityScoreHint),
    buildSpeedScore: z.number().finite().transform(normalizeOpportunityScoreHint),
    riskPenalty: z.number().finite().transform(normalizeOpportunityScoreHint),
  })
  .strict();

export const OpportunityAnalysisOutputSchema = z
  .object({
    title: NonEmptyTextSchema,
    summary: NonEmptyTextSchema,
    targetUser: NonEmptyTextSchema,
    searchIntent: NonEmptyTextSchema,
    recommendedToolType: z.enum(OPPORTUNITY_TOOL_TYPES),
    toolConcept: OpportunityToolConceptSchema,
    monetization: OpportunityMonetizationSchema,
    risk: OpportunityRiskSchema,
    buildComplexity: z.enum(OPPORTUNITY_BUILD_COMPLEXITIES),
    scoreHints: OpportunityScoreHintsSchema,
    killCriteria: RequiredTextListSchema,
  })
  .strict();

export const OpportunityAnalysisResponseSchema = OpportunityAnalysisOutputSchema;

export type OpportunityRiskPreference = z.infer<typeof OpportunityRiskPreferencesSchema>;
export type OpportunityRadarTask = z.infer<typeof OpportunityRadarTaskSchema>;
export type OpportunityKeywordCandidate = z.infer<typeof OpportunityKeywordCandidateSchema>;
export type OpportunityAnalysisInput = z.infer<typeof OpportunityAnalysisInputSchema>;
export type OpportunityToolType = (typeof OPPORTUNITY_TOOL_TYPES)[number];
export type OpportunityMonetizationType = (typeof OPPORTUNITY_MONETIZATION_TYPES)[number];
export type OpportunitySecondaryMonetizationType =
  (typeof OPPORTUNITY_SECONDARY_MONETIZATION_TYPES)[number];
export type OpportunityRiskLevel = (typeof OPPORTUNITY_RISK_LEVELS)[number];
export type OpportunityBuildComplexity =
  (typeof OPPORTUNITY_BUILD_COMPLEXITIES)[number];
export type OpportunityToolConcept = z.infer<typeof OpportunityToolConceptSchema>;
export type OpportunityMonetization = z.infer<typeof OpportunityMonetizationSchema>;
export type OpportunityRisk = z.infer<typeof OpportunityRiskSchema>;
export type OpportunityScoreHints = z.infer<typeof OpportunityScoreHintsSchema>;
export type OpportunityAnalysisOutput = z.infer<typeof OpportunityAnalysisOutputSchema>;
export type OpportunityAnalysisResponse = OpportunityAnalysisOutput;

export type OpportunityAnalysisAgentOptions = {
  llmClient?: LlmClient;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

type NormalizedRiskPreferences = {
  maxRisk: "low" | "medium" | "high";
  avoidYMYLConclusions: boolean;
};

type NormalizedRadarTask = {
  id?: string;
  name?: string;
  domainDescription: string;
  seedExamples: string[];
  countries: string[];
  languages: string[];
  userAdvantages: string[];
  monetizationPreferences: OpportunitySecondaryMonetizationType[];
  riskPreferences: NormalizedRiskPreferences;
  excludedTopics: string[];
};

type NormalizedKeywordCandidate = {
  keyword: string;
  country: string;
  language: string;
  intentType?: KeywordIntentType;
  toolTypeGuess?: KeywordToolTypeGuess;
  rationale: string;
};

type NormalizedOpportunityAnalysisInput = {
  radarTask: NormalizedRadarTask;
  keywordCandidate: NormalizedKeywordCandidate;
  serpAnalysis: SerpAnalysisOutput;
  serpResults: SerpResult[];
};

type RiskContext = {
  policyLevel: OpportunityRiskLevel;
  excludedReasons: string[];
  regulatedReasons: string[];
  promiseReasons: string[];
  requiresChecklist: boolean;
};

type ExcludedPattern = {
  label: string;
  pattern: RegExp;
};

const OPPORTUNITY_ANALYSIS_SCHEMA_DESCRIPTION = `{
  "title": "string",
  "summary": "string",
  "targetUser": "string",
  "searchIntent": "string",
  "recommendedToolType": "generator|checker|calculator|template|checklist|audit|directory|other",
  "toolConcept": {
    "oneLiner": "string",
    "inputFields": ["string"],
    "outputModules": ["string"]
  },
  "monetization": {
    "primary": "ads|affiliate|paid_export|lead_gen|subscription|none",
    "secondary": ["ads|affiliate|paid_export|lead_gen|subscription"],
    "paidExportIdea": "string"
  },
  "risk": {
    "level": "low|medium|high|excluded",
    "notes": "string"
  },
  "buildComplexity": "low|medium|high",
  "scoreHints": {
    "intentScore": number,
    "monetizationScore": number,
    "toolabilityScore": number,
    "userFitScore": number,
    "buildSpeedScore": number,
    "riskPenalty": number
  },
  "killCriteria": ["string"]
}`;

const BUILT_IN_EXCLUDED_PATTERNS: ExcludedPattern[] = [
  {
    label: "adult or sexually explicit content",
    pattern: /\b(adult|nsfw|porn|xxx|escort|sex work|explicit sexual)\b/i,
  },
  {
    label: "gambling or betting",
    pattern: /\b(gambling|casino|betting|sportsbook|lottery|odds maker)\b/i,
  },
  {
    label: "gray-market or deceptive commerce",
    pattern: /\b(gray market|grey market|black market|counterfeit|fake reviews?|fake id|piracy|cracked software)\b/i,
  },
  {
    label: "harmful or abusive activity",
    pattern: /\b(malware|phishing|credential stuffing|doxx|stalking|explosive|weaponized|evade law enforcement|self-harm|suicide method)\b/i,
  },
];

const REGULATED_PATTERNS: ExcludedPattern[] = [
  {
    label: "legal",
    pattern: /\b(legal|lawyer|attorney|lawsuit|liability|contract compliance|gdpr|copyright|trademark)\b/i,
  },
  {
    label: "tax",
    pattern: /\b(tax|irs|vat|sales tax|income tax|deduction|filing status)\b/i,
  },
  {
    label: "medical",
    pattern: /\b(medical|clinical|symptom|diagnosis|treatment|dosage|therapy|patient|health outcome)\b/i,
  },
  {
    label: "financial",
    pattern: /\b(financial|investment|stock|crypto|loan|mortgage|credit score|debt|retirement|insurance claim)\b/i,
  },
];

const PROMISE_PATTERNS: ExcludedPattern[] = [
  {
    label: "assured revenue or income claim",
    pattern: /\b(guarantee|guaranteed|assure|assured|ensure|will)\b[^.?!;]{0,80}\b(revenue|income|profit|sales)\b/i,
  },
  {
    label: "assured search ranking claim",
    pattern: /\b(guarantee|guaranteed|assure|assured|ensure|will|rank)\b[^.?!;]{0,80}\b(rankings?|rank #?1|google position|seo results?)\b/i,
  },
  {
    label: "assured compliance or outcome claim",
    pattern: /\b(guarantee|guaranteed|assure|assured|ensure|will)\b[^.?!;]{0,80}\b(compliance|medical outcomes?|health outcomes?|financial outcomes?|business results?)\b/i,
  },
  {
    label: "growth promise claim",
    pattern: /\b(will|guaranteed to|proven to)\b[^.?!;]{0,50}\b(increase|boost|grow|improve)\b[^.?!;]{0,50}\b(revenue|sales|profit|rankings?|traffic|wishlists?)\b/i,
  },
];

const TOOL_TYPE_BY_KEYWORD: Array<{ type: OpportunityToolType; pattern: RegExp }> = [
  { type: "generator", pattern: /\b(generator|generate|writer|copy)\b/i },
  { type: "checker", pattern: /\b(checker|check|validator|validation)\b/i },
  { type: "calculator", pattern: /\b(calculator|calculate|cost|roi|estimate|estimator|pricing)\b/i },
  { type: "template", pattern: /\b(template|sample|outline|brief)\b/i },
  { type: "checklist", pattern: /\b(checklist|requirements?|readiness|steps)\b/i },
  { type: "audit", pattern: /\b(audit|scorecard|review|assessment)\b/i },
  { type: "directory", pattern: /\b(directory|list|finder|database)\b/i },
];

export async function analyzeOpportunity(
  input: OpportunityAnalysisInput,
  options: OpportunityAnalysisAgentOptions = {},
): Promise<OpportunityAnalysisOutput> {
  const parsedInput = OpportunityAnalysisInputSchema.parse(input);
  const fallback = () => generateHeuristicOpportunityAnalysis(parsedInput);

  if (!options.llmClient) {
    return fallback();
  }

  try {
    const result = await safeJsonCompletion({
      client: options.llmClient,
      model: options.model,
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxTokens ?? 2200,
      responseFormat: { type: "json_object" },
      schema: OpportunityAnalysisOutputSchema,
      schemaDescription: OPPORTUNITY_ANALYSIS_SCHEMA_DESCRIPTION,
      messages: buildOpportunityAnalysisMessages(parsedInput),
    });

    if (!result.ok) {
      return fallback();
    }

    return applyOpportunityRiskGuardrails(result.data, parsedInput);
  } catch {
    return fallback();
  }
}

export function buildOpportunityAnalysisMessages(
  input: OpportunityAnalysisInput,
): LlmChatMessage[] {
  const normalizedInput = normalizeOpportunityAnalysisInput(
    OpportunityAnalysisInputSchema.parse(input),
  );

  return [
    {
      role: "system",
      content: "You are an AI microtool opportunity analyst.",
    },
    {
      role: "user",
      content: [
        "Your task is to decide whether this keyword is worth turning into a lightweight web product.",
        "",
        "Radar task:",
        formatPromptJson(formatRadarTaskForPrompt(normalizedInput.radarTask)),
        "",
        "Keyword candidate:",
        formatPromptJson(normalizedInput.keywordCandidate),
        "",
        "SERP weakness analysis:",
        formatPromptJson(normalizedInput.serpAnalysis),
        "",
        "SERP results:",
        formatPromptJson(formatSerpResultsForPrompt(normalizedInput.serpResults)),
        "",
        "Evaluate the opportunity by these criteria:",
        "1. Search intent: Does the user want to complete a task?",
        "2. Toolability: Can this be solved by a small web tool with form input and personalized output?",
        "3. Monetization: Can it support ads, affiliate, paid export, lead-gen, or subscription?",
        "4. SERP weakness: Are current results weak or non-interactive?",
        "5. User fit: Does this match the user's advantages and preferences?",
        "6. Build speed: Can a useful MVP be built within 48 hours?",
        "7. Risk: Does it involve regulated or high-stakes advice?",
        "",
        "Important constraints:",
        "- Do not promise revenue, rankings, legal compliance, medical outcomes, financial outcomes, or guaranteed business results.",
        "- For legal/tax/medical/financial topics, recommend checklist/self-assessment only, not definitive advice.",
        "- Avoid adult, gambling, gray-market, or harmful topics.",
        "- Exclude opportunities that match configured excluded topics or the built-in unsafe topic policy.",
        "- Output valid JSON only.",
        "",
        `Prompt version: ${OPPORTUNITY_ANALYSIS_PROMPT_VERSION}`,
        `Use recommendedToolType values from: ${OPPORTUNITY_TOOL_TYPES.join(", ")}.`,
        `Use monetization.primary values from: ${OPPORTUNITY_MONETIZATION_TYPES.join(", ")}.`,
        `Use risk.level values from: ${OPPORTUNITY_RISK_LEVELS.join(", ")}.`,
        "Return schema:",
        OPPORTUNITY_ANALYSIS_SCHEMA_DESCRIPTION,
      ].join("\n"),
    },
  ];
}

export function generateHeuristicOpportunityAnalysis(
  input: OpportunityAnalysisInput,
): OpportunityAnalysisOutput {
  const parsedInput = OpportunityAnalysisInputSchema.parse(input);
  const normalizedInput = normalizeOpportunityAnalysisInput(parsedInput);
  const riskContext = classifyRisk(normalizedInput);
  const inferredToolType = inferRecommendedToolType(normalizedInput);
  const recommendedToolType = riskContext.requiresChecklist
    ? "checklist"
    : inferredToolType;
  const title = buildOpportunityTitle(normalizedInput, recommendedToolType, riskContext);
  const targetUser = inferTargetUser(normalizedInput);
  const searchIntent = buildSearchIntent(
    normalizedInput,
    recommendedToolType,
    riskContext,
  );
  const toolConcept = buildToolConcept({
    input: normalizedInput,
    title,
    targetUser,
    toolType: recommendedToolType,
    riskContext,
  });
  const monetization = inferMonetization({
    input: normalizedInput,
    title,
    toolType: recommendedToolType,
    riskContext,
  });
  const risk = buildRisk(riskContext, normalizedInput);
  const buildComplexity = inferBuildComplexity({
    input: normalizedInput,
    toolType: recommendedToolType,
    riskLevel: risk.level,
  });
  const scoreHints = buildScoreHints({
    input: normalizedInput,
    monetization,
    riskLevel: risk.level,
    toolType: recommendedToolType,
    buildComplexity,
  });
  const opportunity = {
    title,
    summary: buildSummary({ title, targetUser, toolType: recommendedToolType, riskContext }),
    targetUser,
    searchIntent,
    recommendedToolType,
    toolConcept,
    monetization,
    risk,
    buildComplexity,
    scoreHints,
    killCriteria: buildKillCriteria(normalizedInput, riskContext),
  };

  return applyOpportunityRiskGuardrails(opportunity, parsedInput);
}

export function normalizeOpportunityScoreHint(score: number): number {
  const normalizedScore = score >= 0 && score <= 1
    ? score * 100
    : score;

  return Math.max(0, Math.min(100, Math.round(normalizedScore)));
}

export function applyOpportunityRiskGuardrails(
  output: OpportunityAnalysisOutput,
  input: OpportunityAnalysisInput,
): OpportunityAnalysisOutput {
  const parsedOutput = OpportunityAnalysisOutputSchema.parse(output);
  const normalizedInput = normalizeOpportunityAnalysisInput(
    OpportunityAnalysisInputSchema.parse(input),
  );
  const riskContext = classifyRisk(normalizedInput, parsedOutput);
  const baseRiskLevel = mergeRiskLevels(
    parsedOutput.risk.level,
    riskContext.policyLevel,
    normalizedInput.radarTask.riskPreferences.maxRisk,
  );
  const sanitizedOutput = sanitizeOpportunityOutput(parsedOutput);
  const guardedOutput: OpportunityAnalysisOutput = {
    ...sanitizedOutput,
    risk: {
      ...sanitizedOutput.risk,
      level: baseRiskLevel,
      notes: sanitizeClaimText(joinSentences([
        sanitizedOutput.risk.notes,
        riskContext.promiseReasons.length > 0
          ? "Guardrail: avoid assured income, rankings, compliance, outcomes, or business-result claims."
          : undefined,
      ])),
    },
    killCriteria: mergeTextLists(
      sanitizedOutput.killCriteria,
      riskContext.promiseReasons.length > 0
        ? [
            "Discard copy that relies on assured income, search rankings, compliance, outcomes, or business-result claims.",
          ]
        : [],
    ),
  };

  if (baseRiskLevel === "excluded") {
    return OpportunityAnalysisOutputSchema.parse({
      ...guardedOutput,
      recommendedToolType: "other",
      toolConcept: {
        oneLiner: `Excluded opportunity: ${guardedOutput.title} should not be built under the current radar policy.`,
        inputFields: ["manual review topic", "policy reason"],
        outputModules: ["exclusion decision", "safer alternative notes"],
      },
      monetization: {
        primary: "none",
        secondary: [],
        paidExportIdea: "No paid export recommendation for excluded topics.",
      },
      risk: {
        level: "excluded",
        notes: buildExcludedRiskNotes(riskContext),
      },
      buildComplexity: "high",
      scoreHints: {
        intentScore: Math.min(guardedOutput.scoreHints.intentScore, 10),
        monetizationScore: 0,
        toolabilityScore: 0,
        userFitScore: Math.min(guardedOutput.scoreHints.userFitScore, 10),
        buildSpeedScore: 0,
        riskPenalty: 100,
      },
      killCriteria: mergeTextLists(guardedOutput.killCriteria, [
        "Discard because the topic is excluded by the radar risk policy.",
        "Do not build or monetize opportunities in excluded categories.",
      ]),
    });
  }

  if (riskContext.requiresChecklist) {
    return OpportunityAnalysisOutputSchema.parse({
      ...guardedOutput,
      recommendedToolType: "checklist",
      toolConcept: {
        oneLiner: toSelfAssessmentOneLiner(guardedOutput.toolConcept.oneLiner),
        inputFields: mergeTextLists(guardedOutput.toolConcept.inputFields, [
          "jurisdiction or personal context",
          "uncertainty to review",
          "professional review needed",
        ]),
        outputModules: mergeTextLists(guardedOutput.toolConcept.outputModules, [
          "non-advice self-assessment checklist",
          "questions for a qualified professional",
        ]),
      },
      risk: {
        level: "high",
        notes: sanitizeClaimText(joinSentences([
          guardedOutput.risk.notes,
          "Regulated topic; frame outputs as checklist or self-assessment only and avoid definitive advice.",
        ])),
      },
      buildComplexity: maxBuildComplexity(guardedOutput.buildComplexity, "medium"),
      scoreHints: {
        ...guardedOutput.scoreHints,
        toolabilityScore: Math.min(guardedOutput.scoreHints.toolabilityScore, 70),
        buildSpeedScore: Math.min(guardedOutput.scoreHints.buildSpeedScore, 65),
        riskPenalty: Math.max(guardedOutput.scoreHints.riskPenalty, 60),
      },
      killCriteria: mergeTextLists(guardedOutput.killCriteria, [
        "Do not provide definitive legal, tax, medical, or financial advice.",
        "Discard if the concept cannot stay in checklist or self-assessment framing.",
      ]),
    });
  }

  if (riskContext.promiseReasons.length > 0 || guardedOutput.risk.level === "medium") {
    return OpportunityAnalysisOutputSchema.parse({
      ...guardedOutput,
      risk: {
        ...guardedOutput.risk,
        level: maxRiskLevel(guardedOutput.risk.level, "medium"),
      },
      scoreHints: {
        ...guardedOutput.scoreHints,
        riskPenalty: Math.max(guardedOutput.scoreHints.riskPenalty, 25),
      },
    });
  }

  return OpportunityAnalysisOutputSchema.parse(guardedOutput);
}

function normalizeOpportunityAnalysisInput(
  input: OpportunityAnalysisInput,
): NormalizedOpportunityAnalysisInput {
  const parsedInput = OpportunityAnalysisInputSchema.parse(input);
  const radarTask = normalizeRadarTask(parsedInput.radarTask);
  const keywordCandidate = normalizeKeywordCandidate(
    parsedInput.keywordCandidate,
    radarTask,
  );

  return {
    radarTask,
    keywordCandidate,
    serpAnalysis: parsedInput.serpAnalysis,
    serpResults: parsedInput.serpResults
      .map(normalizeSerpResult)
      .sort((left, right) => left.position - right.position),
  };
}

function normalizeRadarTask(task: OpportunityRadarTask): NormalizedRadarTask {
  const riskPreferences = task.riskPreferences ?? {};

  return {
    id: normalizeOptionalText(task.id),
    name: normalizeOptionalText(task.name),
    domainDescription: normalizeText(task.domainDescription),
    seedExamples: normalizeStringList(task.seedExamples),
    countries: normalizeMarketList(task.countries, "US", "upper"),
    languages: normalizeMarketList(task.languages, "en", "lower"),
    userAdvantages: normalizeStringList(task.userAdvantages),
    monetizationPreferences: normalizeStringList(task.monetizationPreferences)
      .map(normalizeMonetizationToken)
      .filter(isOpportunitySecondaryMonetizationType),
    riskPreferences: {
      maxRisk: riskPreferences.maxRisk ?? "medium",
      avoidYMYLConclusions: riskPreferences.avoidYMYLConclusions ?? true,
    },
    excludedTopics: normalizeStringList(task.excludedTopics),
  };
}

function normalizeKeywordCandidate(
  candidate: OpportunityKeywordCandidate,
  radarTask: NormalizedRadarTask,
): NormalizedKeywordCandidate {
  return {
    keyword: compactWhitespace(candidate.keyword.toLowerCase()),
    country: normalizeMarketToken(candidate.country, radarTask.countries[0] ?? "US").toUpperCase(),
    language: normalizeMarketToken(candidate.language, radarTask.languages[0] ?? "en").toLowerCase(),
    intentType: candidate.intentType,
    toolTypeGuess: candidate.toolTypeGuess,
    rationale: normalizeText(candidate.rationale ?? "Task-oriented keyword candidate from the radar pipeline."),
  };
}

function normalizeSerpResult(result: SerpResult): SerpResult {
  return {
    position: Math.max(1, Math.trunc(result.position)),
    title: normalizeText(result.title),
    url: normalizeText(result.url),
    domain: normalizeDomain(result.domain),
    snippet: normalizeText(result.snippet ?? ""),
    resultType: result.resultType,
  };
}

function inferRecommendedToolType(
  input: NormalizedOpportunityAnalysisInput,
): OpportunityToolType {
  const toolTypeGuess = input.keywordCandidate.toolTypeGuess;

  if (toolTypeGuess && toolTypeGuess !== "other") {
    return toolTypeGuess;
  }

  for (const mapping of TOOL_TYPE_BY_KEYWORD) {
    if (mapping.pattern.test(input.keywordCandidate.keyword)) {
      return mapping.type;
    }
  }

  if (input.keywordCandidate.intentType === "estimator") {
    return "calculator";
  }

  if (
    input.keywordCandidate.intentType &&
    input.keywordCandidate.intentType !== "other"
  ) {
    return input.keywordCandidate.intentType;
  }

  return "checklist";
}

function buildOpportunityTitle(
  input: NormalizedOpportunityAnalysisInput,
  toolType: OpportunityToolType,
  riskContext: RiskContext,
): string {
  const baseTitle = toTitleCase(input.keywordCandidate.keyword);

  if (riskContext.requiresChecklist && !/\b(checklist|self-assessment)\b/i.test(baseTitle)) {
    return `${baseTitle} Self-Assessment Checklist`;
  }

  if (toolType === "other" && !/\btool\b/i.test(baseTitle)) {
    return `${baseTitle} Tool`;
  }

  return baseTitle;
}

function inferTargetUser(input: NormalizedOpportunityAnalysisInput): string {
  const text = searchableInputText(input);

  if (/\b(steam|unity|unreal|gamedev|game dev|indie game|itch\.io)\b/i.test(text)) {
    return "Solo indie developers preparing a game launch or store page.";
  }

  if (/\b(localization|translation|locale|l10n)\b/i.test(text)) {
    return "Creators and operators preparing localized launch materials.";
  }

  if (/\b(newsletter|sponsor|creator|course|template)\b/i.test(text)) {
    return "Independent creators turning repeatable publishing work into a tool-assisted workflow.";
  }

  if (/\b(local service|quote|intake|small business|agency|client)\b/i.test(text)) {
    return "Small business operators who need a faster intake or quoting workflow.";
  }

  const advantage = input.radarTask.userAdvantages[0];

  if (advantage) {
    return `Builders with ${advantage} experience who need a focused task-completion tool.`;
  }

  return "Niche operators searching for a faster way to complete this task.";
}

function buildSearchIntent(
  input: NormalizedOpportunityAnalysisInput,
  toolType: OpportunityToolType,
  riskContext: RiskContext,
): string {
  const subject = stripToolSuffix(input.keywordCandidate.keyword);

  if (riskContext.requiresChecklist) {
    return `The user wants a cautious ${subject} self-assessment checklist, not definitive professional advice.`;
  }

  if (toolType === "calculator") {
    return `The user wants to estimate ${subject} with their own inputs rather than read a generic guide.`;
  }

  if (toolType === "checker") {
    return `The user wants to check ${subject} against concrete criteria rather than inspect scattered examples manually.`;
  }

  if (toolType === "generator") {
    return `The user wants usable ${subject} output, not a generic how-to article.`;
  }

  if (toolType === "template") {
    return `The user wants a ready-to-adapt ${subject} template rather than starting from a blank page.`;
  }

  return `The user wants to complete the ${subject} task through a compact interactive workflow.`;
}

function buildToolConcept({
  input,
  title,
  targetUser,
  toolType,
  riskContext,
}: {
  input: NormalizedOpportunityAnalysisInput;
  title: string;
  targetUser: string;
  toolType: OpportunityToolType;
  riskContext: RiskContext;
}): OpportunityToolConcept {
  const subject = stripToolSuffix(input.keywordCandidate.keyword);

  if (riskContext.requiresChecklist) {
    return {
      oneLiner: `Input your ${subject} context and get a non-advice self-assessment checklist for review.`,
      inputFields: [
        "country or jurisdiction",
        "personal context",
        "main uncertainty",
        "documents or facts to review",
      ],
      outputModules: [
        "self-assessment checklist",
        "risk flags to review",
        "questions for a qualified professional",
      ],
    };
  }

  if (toolType === "generator") {
    return {
      oneLiner: `Input your context and constraints, get multiple ${title} drafts ready for review.`,
      inputFields: ["goal", "audience", "tone", "constraints", "example details"],
      outputModules: ["3 draft options", "best-fit recommendation", "common mistakes", "export-ready summary"],
    };
  }

  if (toolType === "calculator") {
    return {
      oneLiner: `Enter your assumptions and get a lightweight ${title} estimate with caveats.`,
      inputFields: ["baseline values", "assumptions", "country or market", "timeframe", "constraints"],
      outputModules: ["estimate table", "assumption notes", "scenario comparison", "next-step checklist"],
    };
  }

  if (toolType === "checker") {
    return {
      oneLiner: `Paste your details and get a ${title} pass/fail review with improvement steps.`,
      inputFields: ["current draft or URL", "target audience", "requirements", "country or language"],
      outputModules: ["check result", "issue list", "priority fixes", "copy-ready checklist"],
    };
  }

  if (toolType === "template") {
    return {
      oneLiner: `Answer a short intake and get a ${title} tailored to your workflow.`,
      inputFields: ["use case", "audience", "format", "must-include items"],
      outputModules: ["filled template", "editable sections", "example wording", "export notes"],
    };
  }

  if (toolType === "audit") {
    return {
      oneLiner: `Submit the current asset and get a focused ${title} with prioritized fixes.`,
      inputFields: ["asset or URL", "target user", "success criteria", "known constraints"],
      outputModules: ["audit summary", "scored checklist", "top fixes", "follow-up test plan"],
    };
  }

  return {
    oneLiner: `Help ${targetUser.replace(/\.$/, "")} complete the ${subject} task through a small guided workflow.`,
    inputFields: ["goal", "context", "constraints", "preferred output format"],
    outputModules: ["guided result", "checklist", "next actions"],
  };
}

function inferMonetization({
  input,
  title,
  toolType,
  riskContext,
}: {
  input: NormalizedOpportunityAnalysisInput;
  title: string;
  toolType: OpportunityToolType;
  riskContext: RiskContext;
}): OpportunityMonetization {
  if (riskContext.policyLevel === "excluded") {
    return {
      primary: "none",
      secondary: [],
      paidExportIdea: "No paid export recommendation for excluded topics.",
    };
  }

  const preferences = input.radarTask.monetizationPreferences;
  const preferredOrder = preferredMonetizationOrder(toolType, riskContext);
  const primary = preferredOrder.find((candidate) => preferences.includes(candidate)) ??
    preferences[0] ??
    preferredOrder[0] ??
    "none";
  const secondary = mergeMonetizationLists(
    preferences.filter((candidate) => candidate !== primary),
    preferredOrder.filter((candidate) => candidate !== primary),
  ).slice(0, 3);

  return {
    primary,
    secondary,
    paidExportIdea: primary === "paid_export" || secondary.includes("paid_export")
      ? `${title} action pack with exportable examples and a review checklist.`
      : `Optional ${title} export pack if users want a saved checklist or report.`,
  };
}

function buildRisk(
  riskContext: RiskContext,
  input: NormalizedOpportunityAnalysisInput,
): OpportunityRisk {
  if (riskContext.policyLevel === "excluded") {
    return {
      level: "excluded",
      notes: buildExcludedRiskNotes(riskContext),
    };
  }

  if (riskContext.requiresChecklist) {
    return {
      level: "high",
      notes: "Regulated topic. Keep output to checklist or self-assessment framing and avoid definitive advice.",
    };
  }

  if (riskContext.promiseReasons.length > 0) {
    return {
      level: "medium",
      notes: "Avoid assured income, ranking, compliance, outcome, or business-result claims.",
    };
  }

  if (input.serpAnalysis.strongSignals.length >= 3) {
    return {
      level: "medium",
      notes: "Competitive SERP pressure may limit the opportunity, so claims should stay cautious.",
    };
  }

  return {
    level: "low",
    notes: "No regulated advice detected. Keep product copy cautious and avoid outcome promises.",
  };
}

function inferBuildComplexity({
  input,
  toolType,
  riskLevel,
}: {
  input: NormalizedOpportunityAnalysisInput;
  toolType: OpportunityToolType;
  riskLevel: OpportunityRiskLevel;
}): OpportunityBuildComplexity {
  if (riskLevel === "excluded" || riskLevel === "high") {
    return "high";
  }

  if (
    toolType === "calculator" ||
    input.serpAnalysis.strongSignals.length >= 3 ||
    input.serpResults.length > 8
  ) {
    return "medium";
  }

  return "low";
}

function buildScoreHints({
  input,
  monetization,
  riskLevel,
  toolType,
  buildComplexity,
}: {
  input: NormalizedOpportunityAnalysisInput;
  monetization: OpportunityMonetization;
  riskLevel: OpportunityRiskLevel;
  toolType: OpportunityToolType;
  buildComplexity: OpportunityBuildComplexity;
}): OpportunityScoreHints {
  const toolIntentScore = hasToolIntent(input.keywordCandidate.keyword) ? 90 : 70;
  const weaknessBonus = Math.round((input.serpAnalysis.serpWeaknessScoreHint - 50) * 0.25);
  const intentScore = normalizeOpportunityScoreHint(toolIntentScore + weaknessBonus);
  const toolabilityScore = normalizeOpportunityScoreHint(
    toolType === "directory" || toolType === "other" ? 68 : 88,
  );
  const monetizationScore = monetization.primary === "none"
    ? 0
    : normalizeOpportunityScoreHint(
        68 +
        (monetization.primary === "paid_export" ? 10 : 0) +
        (input.radarTask.monetizationPreferences.includes(monetization.primary) ? 8 : 0),
      );
  const userFitScore = inferUserFitScore(input);
  const buildSpeedScore = buildComplexity === "low"
    ? 92
    : buildComplexity === "medium"
      ? 68
      : 35;

  return OpportunityScoreHintsSchema.parse({
    intentScore,
    monetizationScore,
    toolabilityScore,
    userFitScore,
    buildSpeedScore,
    riskPenalty: riskPenaltyForLevel(riskLevel),
  });
}

function buildSummary({
  title,
  targetUser,
  toolType,
  riskContext,
}: {
  title: string;
  targetUser: string;
  toolType: OpportunityToolType;
  riskContext: RiskContext;
}): string {
  if (riskContext.policyLevel === "excluded") {
    return `${title} is excluded by the radar risk policy and should not move into scoring or build planning.`;
  }

  if (riskContext.requiresChecklist) {
    return `${title} is only viable as a cautious checklist or self-assessment for ${targetUser.toLowerCase()}`;
  }

  return `A narrow ${toolType} for ${targetUser.toLowerCase()}`;
}

function buildKillCriteria(
  input: NormalizedOpportunityAnalysisInput,
  riskContext: RiskContext,
): string[] {
  const criteria = [
    "Discard if manual SERP review finds three or more strong specialized tools already satisfying the query.",
    "Discard if the MVP cannot be useful within a 48-hour build window.",
    "Avoid copy that claims assured income, search rankings, compliance, outcomes, or business results.",
  ];

  if (input.serpAnalysis.strongSignals.length > 0) {
    criteria.push("Discard if strong competition signals dominate after a fresh SERP review.");
  }

  if (riskContext.requiresChecklist) {
    criteria.push("Discard if the topic cannot stay in checklist or self-assessment framing.");
  }

  if (riskContext.policyLevel === "excluded") {
    criteria.push("Discard because the topic is excluded by the radar risk policy.");
  }

  return dedupeStringList(criteria);
}

function classifyRisk(
  input: NormalizedOpportunityAnalysisInput,
  output?: OpportunityAnalysisOutput,
): RiskContext {
  const topicText = searchableInputText(input);
  const outputTopicTexts = output ? searchableOutputTopicTexts(output) : [];
  const promiseText = output
    ? `${topicText} ${outputTopicTexts.join(" ")}`.toLowerCase()
    : topicText;
  const userExcludedMatches = input.radarTask.excludedTopics
    .filter((topic) =>
      topicMatchesText(topic, topicText) ||
      outputTopicTexts.some((text) => policyTopicMatchesText(topic, text)),
    )
    .map((topic) => `configured excluded topic: ${topic}`);
  const builtInExcludedMatches = [
    ...findPatternMatches(topicText, BUILT_IN_EXCLUDED_PATTERNS),
    ...findPolicyPatternMatches(outputTopicTexts, BUILT_IN_EXCLUDED_PATTERNS),
  ];
  const regulatedMatches = [
    ...findPatternMatches(topicText, REGULATED_PATTERNS),
    ...findPolicyPatternMatches(outputTopicTexts, REGULATED_PATTERNS),
  ];
  const promiseMatches = findPromiseMatches(promiseText);
  const excludedReasons = dedupeStringList([
    ...userExcludedMatches,
    ...builtInExcludedMatches,
  ]);
  const regulatedReasons = dedupeStringList(regulatedMatches);
  const promiseReasons = dedupeStringList(promiseMatches);
  let policyLevel: OpportunityRiskLevel = "low";

  if (excludedReasons.length > 0 || output?.risk.level === "excluded") {
    policyLevel = "excluded";
  } else if (regulatedReasons.length > 0) {
    policyLevel = "high";
  } else if (promiseReasons.length > 0) {
    policyLevel = "medium";
  }

  if (
    policyLevel !== "excluded" &&
    isRiskAboveMax(policyLevel, input.radarTask.riskPreferences.maxRisk)
  ) {
    policyLevel = "excluded";
  }

  return {
    policyLevel,
    excludedReasons,
    regulatedReasons,
    promiseReasons,
    requiresChecklist: policyLevel !== "excluded" && regulatedReasons.length > 0,
  };
}

function sanitizeOpportunityOutput(
  output: OpportunityAnalysisOutput,
): OpportunityAnalysisOutput {
  return OpportunityAnalysisOutputSchema.parse({
    title: sanitizeClaimText(output.title),
    summary: sanitizeClaimText(output.summary),
    targetUser: sanitizeClaimText(output.targetUser),
    searchIntent: sanitizeClaimText(output.searchIntent),
    recommendedToolType: output.recommendedToolType,
    toolConcept: {
      oneLiner: sanitizeClaimText(output.toolConcept.oneLiner),
      inputFields: output.toolConcept.inputFields.map(sanitizeClaimText),
      outputModules: output.toolConcept.outputModules.map(sanitizeClaimText),
    },
    monetization: {
      primary: output.monetization.primary,
      secondary: output.monetization.secondary,
      paidExportIdea: sanitizeClaimText(output.monetization.paidExportIdea),
    },
    risk: {
      level: output.risk.level,
      notes: sanitizeClaimText(output.risk.notes),
    },
    buildComplexity: output.buildComplexity,
    scoreHints: output.scoreHints,
    killCriteria: output.killCriteria.map(sanitizeClaimText),
  });
}

function sanitizeClaimText(value: string): string {
  const sanitized = normalizeText(value)
    .replace(/\b(guarantee|guaranteed|assure|assured|ensure|will)\b[^.?!;]{0,90}\b(revenue|income|profit|sales|rankings?|rank #?1|google position|legal compliance|compliance|medical outcomes?|health outcomes?|financial outcomes?|business results?)\b/gi, "support a cautious review")
    .replace(/\b(will|guaranteed to|proven to)\b[^.?!;]{0,50}\b(increase|boost|grow|improve)\b[^.?!;]{0,50}\b(revenue|sales|profit|rankings?|traffic|wishlists?)\b/gi, "can help organize review inputs")
    .replace(/\brank\s*#?\s*1\b/gi, "review search ranking factors")
    .replace(/\bguarantee(?:d|s)?\b/gi, "support");

  return normalizeText(sanitized) || "Cautious review required.";
}

function searchableInputText(
  input: NormalizedOpportunityAnalysisInput,
  output?: OpportunityAnalysisOutput,
): string {
  return [
    input.radarTask.name,
    input.radarTask.domainDescription,
    ...input.radarTask.seedExamples,
    ...input.radarTask.userAdvantages,
    input.keywordCandidate.keyword,
    input.keywordCandidate.rationale,
    input.serpAnalysis.serpWeaknessSummary,
    ...input.serpAnalysis.weakSignals.map((signal) => `${signal.type} ${signal.evidence}`),
    ...input.serpAnalysis.strongSignals.map((signal) => `${signal.type} ${signal.evidence}`),
    ...input.serpResults.map((result) =>
      `${result.title} ${result.domain} ${result.snippet ?? ""}`,
    ),
    output ? JSON.stringify(output) : "",
  ].filter(Boolean).join(" ").toLowerCase();
}

function searchableOutputTopicTexts(output: OpportunityAnalysisOutput): string[] {
  return [
    output.title,
    output.summary,
    output.targetUser,
    output.searchIntent,
    output.recommendedToolType,
    output.toolConcept.oneLiner,
    ...output.toolConcept.inputFields,
    ...output.toolConcept.outputModules,
    output.monetization.primary,
    ...output.monetization.secondary,
    output.monetization.paidExportIdea,
    output.risk.level,
    output.risk.notes,
    output.buildComplexity,
    ...output.killCriteria,
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean);
}

function formatRadarTaskForPrompt(task: NormalizedRadarTask) {
  return {
    id: task.id,
    name: task.name,
    domainDescription: task.domainDescription,
    seedExamples: task.seedExamples,
    countries: task.countries,
    languages: task.languages,
    userAdvantages: task.userAdvantages,
    monetizationPreferences: task.monetizationPreferences,
    riskPreferences: task.riskPreferences,
    excludedTopics: task.excludedTopics,
  };
}

function formatSerpResultsForPrompt(results: SerpResult[]) {
  return results.map((result) => ({
    position: result.position,
    title: result.title,
    url: result.url,
    domain: result.domain,
    snippet: result.snippet ?? "",
    resultType: result.resultType ?? "unknown",
  }));
}

function preferredMonetizationOrder(
  toolType: OpportunityToolType,
  riskContext: RiskContext,
): OpportunitySecondaryMonetizationType[] {
  if (riskContext.requiresChecklist) {
    return ["lead_gen", "paid_export", "affiliate", "ads", "subscription"];
  }

  if (toolType === "generator" || toolType === "template" || toolType === "audit") {
    return ["paid_export", "lead_gen", "affiliate", "ads", "subscription"];
  }

  if (toolType === "calculator" || toolType === "checker") {
    return ["lead_gen", "affiliate", "paid_export", "ads", "subscription"];
  }

  return ["ads", "affiliate", "paid_export", "lead_gen", "subscription"];
}

function inferUserFitScore(input: NormalizedOpportunityAnalysisInput): number {
  const keywordTokens = Array.from(tokenize(input.keywordCandidate.keyword));
  const fitText = [
    input.radarTask.domainDescription,
    ...input.radarTask.seedExamples,
    ...input.radarTask.userAdvantages,
  ].join(" ");
  const fitTokens = tokenize(fitText);
  const overlap = keywordTokens.filter((token) => fitTokens.has(token)).length;

  if (overlap >= 3) {
    return 92;
  }

  if (overlap >= 1) {
    return 82;
  }

  if (input.radarTask.userAdvantages.length > 0) {
    return 68;
  }

  return 58;
}

function riskPenaltyForLevel(level: OpportunityRiskLevel): number {
  if (level === "excluded") {
    return 100;
  }

  if (level === "high") {
    return 65;
  }

  if (level === "medium") {
    return 25;
  }

  return 8;
}

function buildExcludedRiskNotes(riskContext: RiskContext): string {
  const reasons = mergeTextLists(
    riskContext.excludedReasons,
    riskContext.regulatedReasons.length > 0
      ? riskContext.regulatedReasons.map((reason) => `regulated topic above max risk: ${reason}`)
      : [],
  );

  return reasons.length > 0
    ? `Excluded because it matches ${reasons.join(", ")}. Do not build or monetize this opportunity.`
    : "Excluded by the radar risk policy. Do not build or monetize this opportunity.";
}

function mergeRiskLevels(
  outputLevel: OpportunityRiskLevel,
  policyLevel: OpportunityRiskLevel,
  maxAllowed: "low" | "medium" | "high",
): OpportunityRiskLevel {
  const merged = maxRiskLevel(outputLevel, policyLevel);

  if (merged !== "excluded" && isRiskAboveMax(merged, maxAllowed)) {
    return "excluded";
  }

  return merged;
}

function maxRiskLevel(
  left: OpportunityRiskLevel,
  right: OpportunityRiskLevel,
): OpportunityRiskLevel {
  return riskSeverity(left) >= riskSeverity(right) ? left : right;
}

function riskSeverity(level: OpportunityRiskLevel): number {
  if (level === "excluded") {
    return 4;
  }

  if (level === "high") {
    return 3;
  }

  if (level === "medium") {
    return 2;
  }

  return 1;
}

function isRiskAboveMax(
  level: OpportunityRiskLevel,
  maxAllowed: "low" | "medium" | "high",
): boolean {
  if (level === "excluded") {
    return true;
  }

  return riskSeverity(level) > riskSeverity(maxAllowed);
}

function maxBuildComplexity(
  left: OpportunityBuildComplexity,
  right: OpportunityBuildComplexity,
): OpportunityBuildComplexity {
  return buildComplexitySeverity(left) >= buildComplexitySeverity(right)
    ? left
    : right;
}

function buildComplexitySeverity(level: OpportunityBuildComplexity): number {
  if (level === "high") {
    return 3;
  }

  if (level === "medium") {
    return 2;
  }

  return 1;
}

function findPatternMatches(text: string, patterns: ExcludedPattern[]): string[] {
  return patterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label);
}

function findPolicyPatternMatches(
  texts: string[],
  patterns: ExcludedPattern[],
): string[] {
  const matches = new Set<string>();

  for (const text of texts) {
    if (hasNegatedPolicyCue(text)) {
      continue;
    }

    for (const { label, pattern } of patterns) {
      if (pattern.test(text)) {
        matches.add(label);
      }
    }
  }

  return Array.from(matches);
}

function findPromiseMatches(text: string): string[] {
  const matches = new Set<string>();
  const sentences = text
    .split(/[\r\n]+|[.?!;]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    if (hasNegatedPromiseCue(sentence)) {
      continue;
    }

    for (const { label, pattern } of PROMISE_PATTERNS) {
      if (pattern.test(sentence)) {
        matches.add(label);
      }
    }
  }

  return Array.from(matches);
}

function hasNegatedPromiseCue(sentence: string): boolean {
  const normalizedSentence = normalizeText(sentence).toLowerCase();

  return /\b(?:avoid|do not|don't|does not|should not|cannot|can't|must not|never|without)\b/i.test(normalizedSentence) ||
    /\bno(?![-\s]?code\b)\b/i.test(normalizedSentence);
}

function topicMatchesText(topic: string, text: string): boolean {
  const normalizedTopic = normalizeText(topic).toLowerCase();

  if (!normalizedTopic) {
    return false;
  }

  return text.includes(normalizedTopic);
}

function policyTopicMatchesText(topic: string, text: string): boolean {
  return !hasNegatedPolicyCue(text) && topicMatchesText(topic, text);
}

function hasNegatedPolicyCue(text: string): boolean {
  const normalizedText = normalizeText(text).toLowerCase();
  const policyTopicPattern = "(?:adult|nsfw|porn|xxx|escort|sex work|gambling|betting|casino|sportsbook|lottery|gray market|grey market|black market|counterfeit|malware|phishing|harmful|legal|lawyer|attorney|compliance|tax|medical|clinical|diagnosis|treatment|financial|investment|regulated|professional|definitive)";

  return new RegExp(`\\b(?:avoid|do not|don't|does not|should not|cannot|can't|must not|never)\\b[^.?!;]{0,80}\\b${policyTopicPattern}\\b`, "i").test(normalizedText) ||
    new RegExp(`\\bwithout\\s+${policyTopicPattern}\\b`, "i").test(normalizedText) ||
    new RegExp(`\\bnot\\s+${policyTopicPattern}\\b`, "i").test(normalizedText) ||
    new RegExp(`\\bno(?![-\\s]?code\\b)\\s+${policyTopicPattern}\\b`, "i").test(normalizedText);
}

function hasToolIntent(keyword: string): boolean {
  return /\b(generator|checker|calculator|estimator|template|checklist|audit|validator|analyzer|planner|builder)\b/i.test(keyword);
}

function stripToolSuffix(value: string): string {
  return normalizeText(value)
    .replace(/\b(web\s*)?(microtools?|tools?|apps?)\b/gi, " ")
    .replace(/\b(generator|checker|calculator|estimator|template|checklist|audit|directory|form|tool)\b/gi, " ")
    .trim() || normalizeText(value);
}

function toSelfAssessmentOneLiner(oneLiner: string): string {
  const sanitized = sanitizeClaimText(oneLiner);

  if (/\b(self-assessment|checklist|non-advice)\b/i.test(sanitized)) {
    return sanitized;
  }

  return `Self-assessment checklist: ${sanitized}`;
}

function toTitleCase(value: string): string {
  const acronyms = new Set(["ai", "api", "seo", "serp", "mvp", "roi", "url", "ui", "ux"]);

  return normalizeText(value)
    .split(" ")
    .map((word) => {
      const cleaned = word.toLowerCase();

      if (acronyms.has(cleaned)) {
        return cleaned.toUpperCase();
      }

      return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`;
    })
    .join(" ");
}

function normalizeStringList(values: string[] | undefined): string[] {
  return dedupeStringList((values ?? []).map(normalizeText).filter(Boolean));
}

function normalizeMarketList(
  values: string[] | undefined,
  fallback: string,
  casing: "lower" | "upper",
): string[] {
  const normalizedValues = normalizeStringList(values).map((value) =>
    normalizeMarketToken(value, fallback),
  );
  const withFallback = normalizedValues.length > 0
    ? normalizedValues
    : [fallback];
  const casedValues = withFallback.map((value) =>
    casing === "upper" ? value.toUpperCase() : value.toLowerCase(),
  );

  return Array.from(new Set(casedValues));
}

function normalizeMarketToken(value: string | undefined, fallback: string): string {
  const normalizedValue = normalizeText(value ?? "").replace(/\s+/g, "-");

  return normalizedValue || fallback;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalizedValue = normalizeText(value ?? "");

  return normalizedValue || undefined;
}

function normalizeText(value: string): string {
  return compactWhitespace(value);
}

function compactWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeDomain(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function normalizeMonetizationToken(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isOpportunitySecondaryMonetizationType(
  value: string,
): value is OpportunitySecondaryMonetizationType {
  return OPPORTUNITY_SECONDARY_MONETIZATION_TYPES.includes(
    value as OpportunitySecondaryMonetizationType,
  );
}

function dedupeStringList(values: string[]): string[] {
  const seen = new Set<string>();
  const dedupedValues: string[] = [];

  for (const value of values) {
    const normalizedValue = normalizeText(value);
    const key = normalizedValue.toLowerCase();

    if (!normalizedValue || seen.has(key)) {
      continue;
    }

    seen.add(key);
    dedupedValues.push(normalizedValue);
  }

  return dedupedValues;
}

function dedupeMonetizationList(
  values: OpportunitySecondaryMonetizationType[],
): OpportunitySecondaryMonetizationType[] {
  return Array.from(new Set(values));
}

function mergeTextLists(left: string[], right: string[]): string[] {
  return dedupeStringList([...left, ...right]);
}

function mergeMonetizationLists(
  left: OpportunitySecondaryMonetizationType[],
  right: OpportunitySecondaryMonetizationType[],
): OpportunitySecondaryMonetizationType[] {
  return Array.from(new Set([...left, ...right]));
}

function joinSentences(values: Array<string | undefined>): string {
  return values
    .map((value) => normalizeText(value ?? ""))
    .filter(Boolean)
    .join(" ");
}

function tokenize(value: string): Set<string> {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "for",
    "in",
    "of",
    "or",
    "the",
    "to",
    "with",
  ]);

  return new Set(
    normalizeText(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3 && !stopWords.has(token)),
  );
}

function formatPromptJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
