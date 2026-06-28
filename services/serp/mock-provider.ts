import type { SerpProvider, SerpResult, SerpResultType, SerpSearchInput } from "./types";

export const MOCK_SERP_DEFAULT_LIMIT = 10;
export const MOCK_SERP_MAX_LIMIT = 50;

type ResultTemplate = {
  resultType: SerpResultType;
  title: (keyword: string) => string;
  path: string;
  snippet: (keyword: string, country: string, language: string) => string;
};

const DOMAIN_ROOTS = [
  "microtoolindex",
  "builderstack",
  "indiegrowth",
  "workflowbench",
  "keywordlab",
  "launchreview",
  "nichefinder",
  "toolsmith",
] as const;

const DOMAIN_TLDS = ["com", "io", "dev", "app", "tools"] as const;

const RESULT_TEMPLATES: ResultTemplate[] = [
  {
    resultType: "organic",
    title: (keyword) => `${toTitleCase(keyword)} - Templates and Workflow Ideas`,
    path: "guides",
    snippet: (keyword, country, language) =>
      `A practical ${language} overview for ${country} searchers comparing ${keyword} workflows, templates, and lightweight tool options.`,
  },
  {
    resultType: "forum",
    title: (keyword) => `Discussion: what is the fastest way to handle ${keyword}?`,
    path: "community",
    snippet: (keyword, country, language) =>
      `Community thread with recurring questions from ${country}/${language} users about manual steps, missing automation, and tool gaps for ${keyword}.`,
  },
  {
    resultType: "organic",
    title: (keyword) => `${toTitleCase(keyword)} Checklist for Small Teams`,
    path: "checklists",
    snippet: (keyword, country, language) =>
      `Step-by-step checklist showing common friction points and buying signals around ${keyword} in ${country} ${language} search results.`,
  },
  {
    resultType: "ad",
    title: (keyword) => `Sponsored ${toTitleCase(keyword)} Software`,
    path: "compare",
    snippet: (keyword, country, language) =>
      `Paid result aimed at ${country} visitors, suggesting there may be commercial demand for a focused ${language} ${keyword} tool.`,
  },
  {
    resultType: "video",
    title: (keyword) => `How to solve ${keyword} in under 10 minutes`,
    path: "videos",
    snippet: (keyword, country, language) =>
      `Tutorial-style ${language} result for ${country} users, useful as evidence that the task can be explained and productized.`,
  },
  {
    resultType: "pdf",
    title: (keyword) => `${toTitleCase(keyword)} Reference Sheet`,
    path: "resources",
    snippet: (keyword, country, language) =>
      `Downloadable reference result from ${country}/${language}, hinting that users may want a reusable artifact instead of another article about ${keyword}.`,
  },
];

export class MockSerpProvider implements SerpProvider {
  async search(input: SerpSearchInput): Promise<SerpResult[]> {
    const keyword = normalizeKeyword(input.keyword);

    if (keyword.length === 0) {
      throw new Error("MockSerpProvider requires a non-empty keyword.");
    }

    const country = normalizeMarketToken(input.country, "US").toUpperCase();
    const language = normalizeMarketToken(input.language, "en").toLowerCase();
    const limit = normalizeLimit(input.limit);

    return Array.from({ length: limit }, (_, index) =>
      buildMockResult({ keyword, country, language, index }),
    );
  }
}

function buildMockResult({
  keyword,
  country,
  language,
  index,
}: {
  keyword: string;
  country: string;
  language: string;
  index: number;
}): SerpResult {
  const position = index + 1;
  const seed = stableHash(`${keyword}|${country}|${language}|${position}`);
  const template = RESULT_TEMPLATES[(seed + index) % RESULT_TEMPLATES.length];
  const domainRoot = DOMAIN_ROOTS[(seed >>> 3) % DOMAIN_ROOTS.length];
  const domainTld = DOMAIN_TLDS[(seed >>> 7) % DOMAIN_TLDS.length];
  const marketSlug = slugify(`${country}-${language}`) || "global-en";
  const keywordSlug = slugify(keyword) || "keyword";
  const domain = `${marketSlug}.${domainRoot}.${domainTld}`;

  return {
    position,
    title: template.title(keyword),
    url: `https://${domain}/${template.path}/${keywordSlug}-${position}`,
    domain,
    snippet: template.snippet(keyword, country, language),
    resultType: template.resultType,
  };
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim().replace(/\s+/g, " ");
}

function normalizeMarketToken(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().replace(/\s+/g, "-");

  return normalized && normalized.length > 0 ? normalized : fallback;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return MOCK_SERP_DEFAULT_LIMIT;
  }

  if (!Number.isFinite(limit)) {
    return MOCK_SERP_DEFAULT_LIMIT;
  }

  return Math.max(0, Math.min(MOCK_SERP_MAX_LIMIT, Math.trunc(limit)));
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function toTitleCase(value: string): string {
  return value.replace(/\w\S*/g, (word) => {
    const [first = "", ...rest] = word;

    return `${first.toUpperCase()}${rest.join("").toLowerCase()}`;
  });
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
