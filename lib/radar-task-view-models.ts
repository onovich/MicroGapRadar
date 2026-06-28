import { Prisma } from "@prisma/client";

import {
  radarTaskInputSchema,
  radarTaskUpdateInputSchema,
  type RadarTaskInput,
  type RadarTaskUpdateInput,
} from "@/lib/schemas";

const searchRunInclude = {
  radarTask: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.SearchRunInclude;

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

const RADAR_TASK_LIST_LIMIT = 100;
const RECENT_RUN_LIMIT = 6;
const LATEST_OPPORTUNITY_LIMIT = 5;
const DEFAULT_RISK_MAX = "medium";

export type RadarTaskRow = {
  id: string;
  userId?: string | null;
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
  createdAt: Date;
  updatedAt: Date;
};

export type SearchRunRow = Prisma.SearchRunGetPayload<{
  include: typeof searchRunInclude;
}>;

export type OpportunityRow = Prisma.OpportunityGetPayload<{
  include: typeof opportunityInclude;
}>;

export type RadarTaskCardViewModel = {
  id: string;
  name: string;
  detailHref: string;
  editHref: string;
  domainDescription: string;
  seedExamples: string[];
  countries: string[];
  languages: string[];
  userAdvantages: string[];
  monetizationPreferences: string[];
  excludedTopics: string[];
  riskPreferences: {
    maxRisk: "low" | "medium" | "high";
    avoidYMYLConclusions: boolean;
  };
  riskLabel: string;
  dailyLimit: number;
  isActive: boolean;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type RadarTaskRunViewModel = {
  id: string;
  status: string;
  statusLabel: string;
  startedAt: string;
  completedAt: string | null;
  keywordCount: number;
  serpSuccessCount: number;
  opportunityCount: number;
  errorMessage: string | null;
};

export type RadarTaskOpportunityViewModel = {
  id: string;
  detailHref: string;
  title: string;
  keyword: string;
  toolType: string;
  toolTypeLabel: string;
  marketLabel: string;
  totalScore: number;
  status: string;
  statusLabel: string;
  riskSummary: string;
  createdAt: string;
};

export type RadarTaskDetailViewModel = RadarTaskCardViewModel & {
  recentRuns: RadarTaskRunViewModel[];
  latestOpportunities: RadarTaskOpportunityViewModel[];
};

export type RadarTaskListViewModel = {
  items: RadarTaskCardViewModel[];
  total: number;
  activeCount: number;
  inactiveCount: number;
  showInactive: boolean;
  hasItems: boolean;
};

export type RadarTaskFormValues = {
  name: string;
  domainDescription: string;
  seedExamplesText: string;
  countriesText: string;
  languagesText: string;
  userAdvantagesText: string;
  monetizationPreferencesText: string;
  excludedTopicsText: string;
  maxRisk: "low" | "medium" | "high";
  avoidYMYLConclusions: boolean;
  dailyLimit: number;
  isActive: boolean;
};

export function buildRadarTaskListViewModel(
  rows: RadarTaskRow[],
  options: {
    showInactive?: boolean;
  } = {},
): RadarTaskListViewModel {
  const showInactive = Boolean(options.showInactive);
  const filtered = showInactive ? rows : rows.filter((row) => row.isActive);
  const items = filtered.map(serializeRadarTask);

  return {
    items,
    total: items.length,
    activeCount: rows.filter((row) => row.isActive).length,
    inactiveCount: rows.filter((row) => !row.isActive).length,
    showInactive,
    hasItems: items.length > 0,
  };
}

export function serializeRadarTask(row: RadarTaskRow): RadarTaskCardViewModel {
  const riskPreferences = normalizeRiskPreferences(row.riskPreferences);

  return {
    id: row.id,
    name: row.name,
    detailHref: `/radar-tasks/${row.id}`,
    editHref: `/radar-tasks/${row.id}/edit`,
    domainDescription: row.domainDescription,
    seedExamples: normalizeStringArray(row.seedExamples),
    countries: normalizeStringArray(row.countries),
    languages: normalizeStringArray(row.languages),
    userAdvantages: normalizeStringArray(row.userAdvantages),
    monetizationPreferences: normalizeStringArray(row.monetizationPreferences),
    excludedTopics: normalizeStringArray(row.excludedTopics),
    riskPreferences,
    riskLabel: `${formatTokenLabel(riskPreferences.maxRisk)} max risk`,
    dailyLimit: row.dailyLimit,
    isActive: row.isActive,
    statusLabel: row.isActive ? "Active" : "Inactive",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function buildRadarTaskDetailViewModel(input: {
  task: RadarTaskRow;
  recentRuns?: SearchRunRow[];
  latestOpportunities?: OpportunityRow[];
}): RadarTaskDetailViewModel {
  return {
    ...serializeRadarTask(input.task),
    recentRuns: (input.recentRuns ?? []).map(serializeSearchRun),
    latestOpportunities: (input.latestOpportunities ?? []).map(
      serializeOpportunitySummary,
    ),
  };
}

export function toRadarTaskFormValues(
  task?: RadarTaskCardViewModel,
): RadarTaskFormValues {
  return {
    name: task?.name ?? "",
    domainDescription: task?.domainDescription ?? "",
    seedExamplesText: formatMultiline(task?.seedExamples ?? []),
    countriesText: formatCommaList(task?.countries ?? []),
    languagesText: formatCommaList(task?.languages ?? []),
    userAdvantagesText: formatCommaList(task?.userAdvantages ?? []),
    monetizationPreferencesText: formatCommaList(
      task?.monetizationPreferences ?? [],
    ),
    excludedTopicsText: formatCommaList(task?.excludedTopics ?? []),
    maxRisk: task?.riskPreferences.maxRisk ?? DEFAULT_RISK_MAX,
    avoidYMYLConclusions: task?.riskPreferences.avoidYMYLConclusions ?? true,
    dailyLimit: task?.dailyLimit ?? 10,
    isActive: task?.isActive ?? true,
  };
}

export function parseRadarTaskFormData(formData: FormData): RadarTaskInput {
  return radarTaskInputSchema.parse({
    name: getFormString(formData, "name"),
    domainDescription: getFormString(formData, "domainDescription"),
    seedExamples: parseListText(getFormString(formData, "seedExamples")),
    countries: parseListText(getFormString(formData, "countries")),
    languages: parseListText(getFormString(formData, "languages")),
    userAdvantages: parseListText(getFormString(formData, "userAdvantages")),
    monetizationPreferences: parseListText(
      getFormString(formData, "monetizationPreferences"),
    ),
    excludedTopics: parseListText(getFormString(formData, "excludedTopics")),
    riskPreferences: {
      maxRisk: getFormString(formData, "maxRisk") || DEFAULT_RISK_MAX,
      avoidYMYLConclusions: formData.get("avoidYMYLConclusions") === "on",
    },
    dailyLimit: getFormString(formData, "dailyLimit"),
    isActive: formData.get("isActive") === "on",
  });
}

export function parseRadarTaskUpdateFormData(
  formData: FormData,
): RadarTaskUpdateInput {
  return radarTaskUpdateInputSchema.parse(parseRadarTaskFormData(formData));
}

export async function getRadarTaskListData(options: {
  showInactive?: boolean;
} = {}): Promise<RadarTaskListViewModel> {
  const { listRadarTasks } = await import("@/lib/radar-tasks");
  const result = await listRadarTasks({
    ...(options.showInactive ? {} : { isActive: true }),
    limit: RADAR_TASK_LIST_LIMIT,
  });

  return buildRadarTaskListViewModel(
    result.items.map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    })),
    options,
  );
}

export async function getRadarTaskDetailData(
  id: string,
): Promise<RadarTaskDetailViewModel> {
  const { getRadarTask } = await import("@/lib/radar-tasks");
  const { db } = await import("@/lib/db");
  const [taskDto, recentRuns, latestOpportunities] = await Promise.all([
    getRadarTask(id),
    db.searchRun.findMany({
      where: { radarTaskId: id },
      include: searchRunInclude,
      orderBy: [{ startedAt: "desc" }, { id: "asc" }],
      take: RECENT_RUN_LIMIT,
    }),
    db.opportunity.findMany({
      where: { radarTaskId: id },
      include: opportunityInclude,
      orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      take: LATEST_OPPORTUNITY_LIMIT,
    }),
  ]);

  return buildRadarTaskDetailViewModel({
    task: {
      ...taskDto,
      createdAt: new Date(taskDto.createdAt),
      updatedAt: new Date(taskDto.updatedAt),
    },
    recentRuns,
    latestOpportunities,
  });
}

function serializeSearchRun(row: SearchRunRow): RadarTaskRunViewModel {
  return {
    id: row.id,
    status: row.status,
    statusLabel: formatTokenLabel(row.status),
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    keywordCount: row.keywordCount,
    serpSuccessCount: row.serpSuccessCount,
    opportunityCount: row.opportunityCount,
    errorMessage: row.errorMessage,
  };
}

function serializeOpportunitySummary(
  row: OpportunityRow,
): RadarTaskOpportunityViewModel {
  return {
    id: row.id,
    detailHref: `/opportunities/${row.id}`,
    title: row.title,
    keyword: row.keyword,
    toolType: row.toolType,
    toolTypeLabel: formatTokenLabel(row.toolType),
    marketLabel: `${row.language.toUpperCase()} / ${row.country.toUpperCase()}`,
    totalScore: row.totalScore,
    status: row.status,
    statusLabel: formatTokenLabel(row.status),
    riskSummary: row.riskSummary,
    createdAt: row.createdAt.toISOString(),
  };
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function normalizeRiskPreferences(value: unknown): {
  maxRisk: "low" | "medium" | "high";
  avoidYMYLConclusions: boolean;
} {
  if (!isObject(value)) {
    return {
      maxRisk: DEFAULT_RISK_MAX,
      avoidYMYLConclusions: true,
    };
  }

  const maxRisk = value.maxRisk;

  return {
    maxRisk: maxRisk === "low" || maxRisk === "high" ? maxRisk : "medium",
    avoidYMYLConclusions: value.avoidYMYLConclusions !== false,
  };
}

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function parseListText(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatCommaList(items: string[]): string {
  return items.join(", ");
}

function formatMultiline(items: string[]): string {
  return items.join("\n");
}

function formatTokenLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
