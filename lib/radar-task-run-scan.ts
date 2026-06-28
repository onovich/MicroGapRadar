import { runScanInputSchema } from "@/lib/schemas";

export type RunScanResultViewModel = {
  searchRunId?: string;
  status?: string;
  keywordCandidates: number;
  serpSuccesses: number;
  opportunities: number;
  errors: string[];
};

export function buildRunScanPayload(
  radarTaskId: string,
  options: {
    keywordLimit?: number | string | null;
    serpLimit?: number | string | null;
  } = {},
) {
  const input = {
    radarTaskId,
    useMockSerp: true,
    keywordLimit: normalizeOptionalLimit(options.keywordLimit, 50),
    serpLimit: normalizeOptionalLimit(options.serpLimit, 50),
  };

  return runScanInputSchema.parse(dropUndefined(input));
}

export function serializeRunScanResult(input: unknown): RunScanResultViewModel {
  const data = isObject(input) && isObject(input.data) ? input.data : input;
  const counts = isObject(data) && isObject(data.counts) ? data.counts : {};
  const errors = isObject(data) && Array.isArray(data.errors)
    ? data.errors.map((error) =>
        typeof error === "string"
          ? error
          : isObject(error) && typeof error.message === "string"
            ? error.message
            : "Unknown scan warning",
      )
    : [];

  return {
    searchRunId: isObject(data) && typeof data.searchRunId === "string"
      ? data.searchRunId
      : undefined,
    status: isObject(data) && typeof data.status === "string"
      ? data.status
      : undefined,
    keywordCandidates: getNumber(counts, "keywordCandidates"),
    serpSuccesses: getNumber(counts, "serpSuccesses"),
    opportunities: getNumber(counts, "opportunities"),
    errors,
  };
}

export function isRunScanDisabled(task: {
  isActive: boolean;
}): boolean {
  return !task.isActive;
}

function normalizeOptionalLimit(
  value: number | string | null | undefined,
  max: number,
): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.max(1, Math.min(max, Math.trunc(parsed)));
}

function dropUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

function getNumber(source: object, key: string): number {
  const value = (source as Record<string, unknown>)[key];

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
