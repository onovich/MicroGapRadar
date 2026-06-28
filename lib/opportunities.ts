import type { Prisma } from "@prisma/client";

const opportunityInclude = {
  radarTask: {
    select: {
      id: true,
      name: true,
    },
  },
  searchRun: {
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
    },
  },
} satisfies Prisma.OpportunityInclude;

const searchRunInclude = {
  radarTask: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.SearchRunInclude;

const DASHBOARD_OPPORTUNITY_LIMIT = 50;
const OPPORTUNITY_LIST_LIMIT = 100;
const FILTER_OPTION_LIMIT = 500;
const RECENT_RUN_LIMIT = 8;

export const RISK_LEVELS = ["low", "medium", "high", "excluded"] as const;
export const OPPORTUNITY_STATUSES = [
  "new",
  "saved",
  "discarded",
  "build_next",
  "built",
] as const;
export const TOOL_TYPES = [
  "generator",
  "checker",
  "calculator",
  "template",
  "checklist",
  "audit",
  "directory",
  "other",
] as const;

export type OpportunityRow = Prisma.OpportunityGetPayload<{
  include: typeof opportunityInclude;
}>;

export type SearchRunRow = Prisma.SearchRunGetPayload<{
  include: typeof searchRunInclude;
}>;

export type RadarTaskOption = {
  id: string;
  name: string;
};

export type RiskLevel = (typeof RISK_LEVELS)[number];
export type RiskDisplayLevel = RiskLevel | "unknown";
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];
export type ToolType = (typeof TOOL_TYPES)[number];

export type OpportunityFilters = {
  radarTaskId?: string;
  minScore?: number;
  toolType?: string;
  riskLevel?: RiskLevel;
  status?: OpportunityStatus;
};

export type OpportunityFilterOptions = {
  radarTasks: RadarTaskOption[];
  toolTypes: string[];
  riskLevels: RiskLevel[];
  statuses: OpportunityStatus[];
};

export type ScoreBreakdownViewModel = {
  intentScore?: number;
  monetizationScore?: number;
  serpWeaknessScore?: number;
  toolabilityScore?: number;
  userFitScore?: number;
  buildSpeedScore?: number;
  riskPenalty?: number;
  totalScore?: number;
};

export type OpportunityCardViewModel = {
  id: string;
  detailHref: string;
  keyword: string;
  title: string;
  summary: string;
  toolType: string;
  toolTypeLabel: string;
  country: string;
  language: string;
  marketLabel: string;
  monetizationSummary: string;
  monetizationTypes: string[];
  riskSummary: string;
  riskLevel: RiskDisplayLevel;
  riskLabel: string;
  buildComplexity: string;
  buildComplexityLabel: string;
  status: string;
  statusLabel: string;
  totalScore: number;
  scoreBreakdown: ScoreBreakdownViewModel;
  radarTask: RadarTaskOption;
  searchRun: {
    id: string;
    status: string;
    statusLabel: string;
    startedAt: string;
    completedAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type OpportunityListViewModel = {
  items: OpportunityCardViewModel[];
  filters: OpportunityFilters;
  filterOptions: OpportunityFilterOptions;
  totalBeforeFilters: number;
  totalAfterFilters: number;
  hasActiveFilters: boolean;
};

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
};

export type RecentRunViewModel = {
  id: string;
  radarTaskId: string;
  radarTaskName: string;
  status: string;
  statusLabel: string;
  startedAt: string;
  completedAt: string | null;
  keywordCount: number;
  serpSuccessCount: number;
  opportunityCount: number;
};

export type DashboardViewModel = {
  generatedAt: string;
  todayLabel: string;
  topOpportunities: OpportunityCardViewModel[];
  metrics: DashboardMetric[];
  recentRuns: RecentRunViewModel[];
  opportunityCountToday: number;
  runCountToday: number;
  hasOpportunitiesToday: boolean;
};

type BuildOpportunityListInput = {
  opportunities: OpportunityRow[];
  rawFilters?: Record<string, unknown> | OpportunityFilters;
  radarTasks?: RadarTaskOption[];
  optionOpportunities?: OpportunityRow[];
};

type BuildDashboardInput = {
  opportunities: OpportunityRow[];
  searchRuns: SearchRunRow[];
  now?: Date;
  opportunityCountToday?: number;
  averageScoreToday?: number | null;
  runCountToday?: number;
  completedRunCountToday?: number;
};

export async function getDashboardData(
  now: Date = new Date(),
): Promise<DashboardViewModel> {
  const { db } = await import("@/lib/db");
  const startOfToday = getStartOfLocalDay(now);
  const endOfToday = getNextLocalDay(startOfToday);
  const todayOpportunityWhere: Prisma.OpportunityWhereInput = {
    createdAt: {
      gte: startOfToday,
      lt: endOfToday,
    },
  };
  const todayRunWhere: Prisma.SearchRunWhereInput = {
    startedAt: {
      gte: startOfToday,
      lt: endOfToday,
    },
  };

  const [
    opportunities,
    searchRuns,
    opportunityCountToday,
    scoreAggregate,
    runCountToday,
    completedRunCountToday,
  ] = await Promise.all([
    db.opportunity.findMany({
      where: todayOpportunityWhere,
      include: opportunityInclude,
      orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      take: DASHBOARD_OPPORTUNITY_LIMIT,
    }),
    db.searchRun.findMany({
      where: todayRunWhere,
      include: searchRunInclude,
      orderBy: [{ startedAt: "desc" }, { id: "asc" }],
      take: RECENT_RUN_LIMIT,
    }),
    db.opportunity.count({
      where: todayOpportunityWhere,
    }),
    db.opportunity.aggregate({
      where: todayOpportunityWhere,
      _avg: {
        totalScore: true,
      },
    }),
    db.searchRun.count({
      where: todayRunWhere,
    }),
    db.searchRun.count({
      where: {
        ...todayRunWhere,
        status: {
          in: ["completed", "partial_failed"],
        },
      },
    }),
  ]);

  return buildDashboardViewModel({
    opportunities,
    searchRuns,
    now,
    opportunityCountToday,
    averageScoreToday: scoreAggregate._avg.totalScore,
    runCountToday,
    completedRunCountToday,
  });
}

export async function getOpportunityListData(
  rawFilters: Record<string, unknown> = {},
): Promise<OpportunityListViewModel> {
  const { db } = await import("@/lib/db");
  const filters = normalizeOpportunityFilters(rawFilters);
  const where = toPrismaOpportunityWhere(filters);
  const opportunityQueryLimit = filters.riskLevel
    ? FILTER_OPTION_LIMIT
    : OPPORTUNITY_LIST_LIMIT;

  const [opportunities, optionOpportunities, radarTasks] = await Promise.all([
    db.opportunity.findMany({
      where,
      include: opportunityInclude,
      orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      take: opportunityQueryLimit,
    }),
    db.opportunity.findMany({
      include: opportunityInclude,
      orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      take: FILTER_OPTION_LIMIT,
    }),
    db.radarTask.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);

  return buildOpportunityListViewModel({
    opportunities,
    rawFilters: filters,
    radarTasks,
    optionOpportunities,
  });
}

export function buildDashboardViewModel({
  opportunities,
  searchRuns,
  now = new Date(),
  opportunityCountToday,
  averageScoreToday,
  runCountToday,
  completedRunCountToday,
}: BuildDashboardInput): DashboardViewModel {
  const todayOpportunities = opportunities
    .filter((opportunity) => isSameLocalDay(opportunity.createdAt, now))
    .map(serializeOpportunity)
    .sort(compareOpportunitiesByScore);
  const topOpportunities = todayOpportunities.slice(0, 5);
  const todayRuns = searchRuns
    .filter((run) => isSameLocalDay(run.startedAt, now))
    .map(serializeSearchRun);
  const completedRunsFromRows = todayRuns.filter((run) =>
    run.status === "completed" || run.status === "partial_failed",
  ).length;
  const totalOpportunityCount = opportunityCountToday ?? todayOpportunities.length;
  const totalRunCount = runCountToday ?? todayRuns.length;
  const completedRuns = completedRunCountToday ?? completedRunsFromRows;
  const topScore = topOpportunities[0]?.totalScore;
  const averageScore = normalizeAverageScore(
    averageScoreToday,
    todayOpportunities.map((opportunity) => opportunity.totalScore),
  );
  const averageRisk = averageRiskLabel(
    todayOpportunities.map((opportunity) => opportunity.riskLevel),
  );

  return {
    generatedAt: now.toISOString(),
    todayLabel: formatDateLabel(now),
    topOpportunities,
    metrics: [
      {
        label: "Top score",
        value: topScore === undefined ? "-" : String(topScore),
        detail: "Highest opportunity score today",
      },
      {
        label: "New opps",
        value: String(totalOpportunityCount),
        detail: "Opportunities created today",
      },
      {
        label: "Avg score",
        value: averageScore === null ? "-" : String(averageScore),
        detail: "Mean score across today's opportunities",
      },
      {
        label: "Avg risk",
        value: averageRisk,
        detail: "Risk cue across visible top opportunities",
      },
      {
        label: "Runs",
        value: String(totalRunCount),
        detail: `${completedRuns} completed or partial`,
      },
    ],
    recentRuns: todayRuns,
    opportunityCountToday: totalOpportunityCount,
    runCountToday: totalRunCount,
    hasOpportunitiesToday: totalOpportunityCount > 0,
  };
}

export function buildOpportunityListViewModel({
  opportunities,
  rawFilters = {},
  radarTasks = [],
  optionOpportunities = opportunities,
}: BuildOpportunityListInput): OpportunityListViewModel {
  const filters = normalizeOpportunityFilters(rawFilters);
  const serializedItems = opportunities
    .map(serializeOpportunity)
    .sort(compareOpportunitiesByScore);
  const filteredItems = filterOpportunityViewModels(serializedItems, filters);

  return {
    items: filteredItems,
    filters,
    filterOptions: buildFilterOptions(
      optionOpportunities.map(serializeOpportunity),
      radarTasks,
      filters,
    ),
    totalBeforeFilters: opportunities.length,
    totalAfterFilters: filteredItems.length,
    hasActiveFilters: Object.values(filters).some((value) => value !== undefined),
  };
}

export function serializeOpportunity(
  opportunity: OpportunityRow,
): OpportunityCardViewModel {
  const scoreBreakdown = normalizeScoreBreakdown(opportunity.scoreBreakdown);
  const riskLevel = deriveRiskLevel({
    rawAnalysis: opportunity.rawAnalysis,
    riskSummary: opportunity.riskSummary,
    scoreBreakdown,
  });
  const status = normalizeStatus(opportunity.status) ?? "new";
  const toolType = normalizeText(opportunity.toolType) || "other";
  const buildComplexity = normalizeText(opportunity.buildComplexity) || "unknown";

  return {
    id: opportunity.id,
    detailHref: `/opportunities/${encodeURIComponent(opportunity.id)}`,
    keyword: opportunity.keyword,
    title: opportunity.title,
    summary: opportunity.summary,
    toolType,
    toolTypeLabel: formatTokenLabel(toolType),
    country: opportunity.country,
    language: opportunity.language,
    marketLabel: formatMarketLabel(opportunity.country, opportunity.language),
    monetizationSummary: opportunity.monetizationSummary,
    monetizationTypes: deriveMonetizationTypes({
      rawAnalysis: opportunity.rawAnalysis,
      monetizationSummary: opportunity.monetizationSummary,
    }),
    riskSummary: opportunity.riskSummary,
    riskLevel,
    riskLabel: formatRiskLabel(riskLevel),
    buildComplexity,
    buildComplexityLabel: formatTokenLabel(buildComplexity),
    status,
    statusLabel: formatStatusLabel(status),
    totalScore: opportunity.totalScore,
    scoreBreakdown,
    radarTask: {
      id: opportunity.radarTask.id,
      name: opportunity.radarTask.name,
    },
    searchRun: {
      id: opportunity.searchRun.id,
      status: opportunity.searchRun.status,
      statusLabel: formatStatusLabel(opportunity.searchRun.status),
      startedAt: opportunity.searchRun.startedAt.toISOString(),
      completedAt: opportunity.searchRun.completedAt?.toISOString() ?? null,
    },
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
  };
}

export function filterOpportunityViewModels(
  opportunities: OpportunityCardViewModel[],
  filters: OpportunityFilters,
): OpportunityCardViewModel[] {
  return opportunities.filter((opportunity) => {
    if (filters.radarTaskId && opportunity.radarTask.id !== filters.radarTaskId) {
      return false;
    }

    if (
      filters.minScore !== undefined &&
      opportunity.totalScore < filters.minScore
    ) {
      return false;
    }

    if (filters.toolType && opportunity.toolType !== filters.toolType) {
      return false;
    }

    if (filters.riskLevel && opportunity.riskLevel !== filters.riskLevel) {
      return false;
    }

    if (filters.status && opportunity.status !== filters.status) {
      return false;
    }

    return true;
  });
}

export function normalizeOpportunityFilters(
  rawFilters: Record<string, unknown> | OpportunityFilters = {},
): OpportunityFilters {
  const filterRecord = rawFilters as Record<string, unknown>;
  const radarTaskId =
    firstParam(filterRecord.radarTaskId) ?? firstParam(filterRecord.task);
  const minScore = normalizeMinScore(firstParam(filterRecord.minScore));
  const toolType = firstParam(filterRecord.toolType);
  const riskLevel = normalizeRiskLevel(
    firstParam(filterRecord.riskLevel) ?? firstParam(filterRecord.risk),
  );
  const status = normalizeStatus(firstParam(filterRecord.status));

  return {
    ...(radarTaskId ? { radarTaskId } : {}),
    ...(minScore === undefined ? {} : { minScore }),
    ...(toolType ? { toolType } : {}),
    ...(riskLevel ? { riskLevel } : {}),
    ...(status ? { status } : {}),
  };
}

export function deriveRiskLevel({
  rawAnalysis,
  riskSummary,
  scoreBreakdown,
}: {
  rawAnalysis: unknown;
  riskSummary?: string | null;
  scoreBreakdown?: ScoreBreakdownViewModel;
}): RiskDisplayLevel {
  const rawRiskLevel = getNestedString(rawAnalysis, [
    "opportunityAnalysis",
    "risk",
    "level",
  ]);
  const normalizedRawRiskLevel = normalizeRiskLevel(rawRiskLevel);

  if (normalizedRawRiskLevel) {
    return normalizedRawRiskLevel;
  }

  const summaryRiskLevel = normalizeRiskLevel(
    normalizeText(riskSummary ?? "").split(/[\s:.]+/)[0],
  );

  if (summaryRiskLevel) {
    return summaryRiskLevel;
  }

  const penalty = scoreBreakdown?.riskPenalty;

  if (typeof penalty === "number") {
    if (penalty <= 10) {
      return "low";
    }

    if (penalty <= 35) {
      return "medium";
    }

    if (penalty <= 70) {
      return "high";
    }

    return "excluded";
  }

  return "unknown";
}

export function formatRiskLabel(level: RiskDisplayLevel): string {
  if (level === "unknown") {
    return "Risk unknown";
  }

  return `${formatTokenLabel(level)} risk`;
}

function toPrismaOpportunityWhere(
  filters: OpportunityFilters,
): Prisma.OpportunityWhereInput {
  const where: Prisma.OpportunityWhereInput = {};

  if (filters.radarTaskId) {
    where.radarTaskId = filters.radarTaskId;
  }

  if (filters.minScore !== undefined) {
    where.totalScore = {
      gte: filters.minScore,
    };
  }

  if (filters.toolType) {
    where.toolType = filters.toolType;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

function buildFilterOptions(
  opportunities: OpportunityCardViewModel[],
  radarTasks: RadarTaskOption[],
  filters: OpportunityFilters,
): OpportunityFilterOptions {
  return {
    radarTasks: uniqueRadarTasks([
      ...radarTasks,
      ...opportunities.map((opportunity) => opportunity.radarTask),
    ]),
    toolTypes: uniqueStrings([
      ...opportunities.map((opportunity) => opportunity.toolType),
      ...(filters.toolType ? [filters.toolType] : []),
    ]),
    riskLevels: uniqueRisks([
      ...opportunities
        .map((opportunity) => opportunity.riskLevel)
        .filter((level): level is RiskLevel => level !== "unknown"),
      ...(filters.riskLevel ? [filters.riskLevel] : []),
    ]),
    statuses: uniqueStatuses([
      ...opportunities
        .map((opportunity) => opportunity.status)
        .map((status) => normalizeStatus(status))
        .filter((status): status is OpportunityStatus => Boolean(status)),
      ...(filters.status ? [filters.status] : []),
    ]),
  };
}

function serializeSearchRun(run: SearchRunRow): RecentRunViewModel {
  return {
    id: run.id,
    radarTaskId: run.radarTaskId,
    radarTaskName: run.radarTask.name,
    status: run.status,
    statusLabel: formatStatusLabel(run.status),
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    keywordCount: run.keywordCount,
    serpSuccessCount: run.serpSuccessCount,
    opportunityCount: run.opportunityCount,
  };
}

function compareOpportunitiesByScore(
  left: OpportunityCardViewModel,
  right: OpportunityCardViewModel,
): number {
  const scoreDiff = right.totalScore - left.totalScore;

  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  const dateDiff =
    Date.parse(right.createdAt) - Date.parse(left.createdAt);

  if (dateDiff !== 0) {
    return dateDiff;
  }

  return left.id.localeCompare(right.id);
}

function normalizeScoreBreakdown(value: unknown): ScoreBreakdownViewModel {
  if (!isRecord(value)) {
    return {};
  }

  const entries: Array<[keyof ScoreBreakdownViewModel, unknown]> = [
    ["intentScore", value.intentScore],
    ["monetizationScore", value.monetizationScore],
    ["serpWeaknessScore", value.serpWeaknessScore],
    ["toolabilityScore", value.toolabilityScore],
    ["userFitScore", value.userFitScore],
    ["buildSpeedScore", value.buildSpeedScore],
    ["riskPenalty", value.riskPenalty],
    ["totalScore", value.totalScore],
  ];
  const normalized: ScoreBreakdownViewModel = {};

  for (const [key, rawValue] of entries) {
    const numericValue = normalizeNumber(rawValue);

    if (numericValue !== undefined) {
      normalized[key] = numericValue;
    }
  }

  return normalized;
}

function deriveMonetizationTypes({
  rawAnalysis,
  monetizationSummary,
}: {
  rawAnalysis: unknown;
  monetizationSummary: string;
}): string[] {
  const primary = getNestedString(rawAnalysis, [
    "opportunityAnalysis",
    "monetization",
    "primary",
  ]);
  const secondary = getNestedArray(rawAnalysis, [
    "opportunityAnalysis",
    "monetization",
    "secondary",
  ]);
  const fromRaw = uniqueStringsInOrder([
    ...(primary ? [primary] : []),
    ...secondary.filter((value): value is string => typeof value === "string"),
  ]);

  if (fromRaw.length > 0) {
    return fromRaw.map(formatTokenLabel);
  }

  const lowerSummary = monetizationSummary.toLowerCase();
  const knownTypes = [
    "ads",
    "affiliate",
    "paid_export",
    "lead_gen",
    "subscription",
  ];

  return knownTypes
    .filter((type) => lowerSummary.includes(type.replace("_", " ")) ||
      lowerSummary.includes(type))
    .map(formatTokenLabel);
}

function normalizeMinScore(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  const score = Number(value);

  if (!Number.isFinite(score)) {
    return undefined;
  }

  return Math.max(0, Math.min(100, Math.trunc(score)));
}

function normalizeRiskLevel(value: string | undefined): RiskLevel | undefined {
  const normalized = normalizeText(value ?? "").toLowerCase();

  return RISK_LEVELS.includes(normalized as RiskLevel)
    ? normalized as RiskLevel
    : undefined;
}

function normalizeStatus(value: string | undefined): OpportunityStatus | undefined {
  const normalized = normalizeText(value ?? "").toLowerCase();

  return OPPORTUNITY_STATUSES.includes(normalized as OpportunityStatus)
    ? normalized as OpportunityStatus
    : undefined;
}

function formatStatusLabel(status: string): string {
  return formatTokenLabel(status);
}

function formatMarketLabel(country: string, language: string): string {
  return [language.toUpperCase(), country.toUpperCase()]
    .filter(Boolean)
    .join(" / ");
}

function formatTokenLabel(value: string): string {
  return normalizeText(value)
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function averageNumber(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizeAverageScore(
  averageScoreToday: number | null | undefined,
  fallbackValues: number[],
): number | null {
  if (averageScoreToday === undefined) {
    return averageNumber(fallbackValues);
  }

  return averageScoreToday === null ? null : Math.round(averageScoreToday);
}

function averageRiskLabel(levels: RiskDisplayLevel[]): string {
  const severities = levels
    .map((level) => riskSeverity(level))
    .filter((severity) => severity > 0);

  if (severities.length === 0) {
    return "-";
  }

  const averageSeverity = Math.round(
    severities.reduce((sum, value) => sum + value, 0) / severities.length,
  );

  if (averageSeverity <= 1) {
    return "Low";
  }

  if (averageSeverity === 2) {
    return "Medium";
  }

  if (averageSeverity === 3) {
    return "High";
  }

  return "Excluded";
}

function riskSeverity(level: RiskDisplayLevel): number {
  if (level === "low") {
    return 1;
  }

  if (level === "medium") {
    return 2;
  }

  if (level === "high") {
    return 3;
  }

  if (level === "excluded") {
    return 4;
  }

  return 0;
}

function firstParam(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return firstParam(value[0]);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = normalizeText(value);

  return normalized || undefined;
}

function getNestedString(value: unknown, path: string[]): string | undefined {
  const nested = getNestedValue(value, path);

  return typeof nested === "string" ? nested : undefined;
}

function getNestedArray(value: unknown, path: string[]): unknown[] {
  const nested = getNestedValue(value, path);

  return Array.isArray(nested) ? nested : [];
}

function getNestedValue(value: unknown, path: string[]): unknown {
  let current = value;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

function uniqueRadarTasks(tasks: RadarTaskOption[]): RadarTaskOption[] {
  const seen = new Set<string>();
  const dedupedTasks: RadarTaskOption[] = [];

  for (const task of tasks) {
    if (seen.has(task.id)) {
      continue;
    }

    seen.add(task.id);
    dedupedTasks.push(task);
  }

  return dedupedTasks.sort((left, right) =>
    left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right),
  );
}

function uniqueStringsInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const dedupedValues: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    dedupedValues.push(normalized);
  }

  return dedupedValues;
}

function uniqueRisks(values: RiskLevel[]): RiskLevel[] {
  const set = new Set(values);

  return RISK_LEVELS.filter((level) => set.has(level));
}

function uniqueStatuses(values: OpportunityStatus[]): OpportunityStatus[] {
  const set = new Set(values);

  return OPPORTUNITY_STATUSES.filter((status) => set.has(status));
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

function isSameLocalDay(date: Date, day: Date): boolean {
  const start = getStartOfLocalDay(day).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  const time = date.getTime();

  return time >= start && time < end;
}

function getStartOfLocalDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  return start;
}

function getNextLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);

  return next;
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
