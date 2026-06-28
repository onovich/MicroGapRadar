import { z } from "zod";

import { safeJsonCompletion } from "../services/llm";
import type { LlmChatMessage, LlmClient } from "../services/llm";

export const KEYWORD_EXPANSION_DEFAULT_COUNT = 20;
export const KEYWORD_EXPANSION_MAX_COUNT = 50;

export const KEYWORD_INTENT_TYPES = [
  "generator",
  "checker",
  "calculator",
  "template",
  "checklist",
  "audit",
  "estimator",
  "other",
] as const;

export const KEYWORD_TOOL_TYPE_GUESSES = [
  "generator",
  "checker",
  "calculator",
  "template",
  "checklist",
  "audit",
  "directory",
  "other",
] as const;

export const KeywordExpansionInputSchema = z.object({
  domainDescription: z.string().trim().min(1),
  seedExamples: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  userAdvantages: z.array(z.string()).optional(),
  monetizationPreferences: z.array(z.string()).optional(),
  excludedTopics: z.array(z.string()).optional(),
  requestedCount: z.number().finite().optional(),
}).strict();

export const KeywordExpansionCandidateSchema = z.object({
  keyword: z.string().trim().min(1),
  country: z.string().trim().min(1),
  language: z.string().trim().min(1),
  intentType: z.enum(KEYWORD_INTENT_TYPES),
  toolTypeGuess: z.enum(KEYWORD_TOOL_TYPE_GUESSES),
  rationale: z.string().trim().min(1),
}).strict();

export const KeywordExpansionResponseSchema = z.object({
  candidates: z.array(KeywordExpansionCandidateSchema),
}).strict();

export type KeywordExpansionInput = z.infer<typeof KeywordExpansionInputSchema>;
export type KeywordExpansionCandidate = z.infer<typeof KeywordExpansionCandidateSchema>;
export type KeywordExpansionResponse = z.infer<typeof KeywordExpansionResponseSchema>;
export type KeywordIntentType = (typeof KEYWORD_INTENT_TYPES)[number];
export type KeywordToolTypeGuess = (typeof KEYWORD_TOOL_TYPE_GUESSES)[number];

export type KeywordExpansionAgentOptions = {
  llmClient?: LlmClient;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

type NormalizedKeywordExpansionInput = {
  domainDescription: string;
  seedExamples: string[];
  countries: string[];
  languages: string[];
  userAdvantages: string[];
  monetizationPreferences: string[];
  excludedTopics: string[];
};

type MockKeywordTemplate = {
  suffix: string;
  intentType: KeywordIntentType;
  toolTypeGuess: KeywordToolTypeGuess;
};

const KEYWORD_EXPANSION_SCHEMA_DESCRIPTION = `{
  "candidates": [
    {
      "keyword": "string",
      "country": "string",
      "language": "string",
      "intentType": "generator|checker|calculator|template|checklist|audit|estimator|other",
      "toolTypeGuess": "generator|checker|calculator|template|checklist|audit|directory|other",
      "rationale": "string"
    }
  ]
}`;

const MOCK_KEYWORD_TEMPLATES: MockKeywordTemplate[] = [
  { suffix: "generator", intentType: "generator", toolTypeGuess: "generator" },
  { suffix: "checker", intentType: "checker", toolTypeGuess: "checker" },
  { suffix: "calculator", intentType: "calculator", toolTypeGuess: "calculator" },
  { suffix: "template", intentType: "template", toolTypeGuess: "template" },
  { suffix: "checklist", intentType: "checklist", toolTypeGuess: "checklist" },
  { suffix: "audit", intentType: "audit", toolTypeGuess: "audit" },
  { suffix: "cost estimator", intentType: "estimator", toolTypeGuess: "calculator" },
  { suffix: "requirements checker", intentType: "checker", toolTypeGuess: "checker" },
  { suffix: "form template", intentType: "template", toolTypeGuess: "template" },
  { suffix: "policy checklist", intentType: "checklist", toolTypeGuess: "checklist" },
  { suffix: "launch checklist", intentType: "checklist", toolTypeGuess: "checklist" },
  { suffix: "copy generator", intentType: "generator", toolTypeGuess: "generator" },
  { suffix: "pricing calculator", intentType: "calculator", toolTypeGuess: "calculator" },
  { suffix: "readiness audit", intentType: "audit", toolTypeGuess: "audit" },
  { suffix: "scorecard template", intentType: "template", toolTypeGuess: "template" },
  { suffix: "brief generator", intentType: "generator", toolTypeGuess: "generator" },
  { suffix: "intake form template", intentType: "template", toolTypeGuess: "template" },
  { suffix: "comparison checklist", intentType: "checklist", toolTypeGuess: "checklist" },
  { suffix: "setup cost calculator", intentType: "calculator", toolTypeGuess: "calculator" },
  { suffix: "localization checklist", intentType: "checklist", toolTypeGuess: "checklist" },
  { suffix: "metadata generator", intentType: "generator", toolTypeGuess: "generator" },
  { suffix: "export checklist", intentType: "checklist", toolTypeGuess: "checklist" },
  { suffix: "qa checklist", intentType: "checklist", toolTypeGuess: "checklist" },
  { suffix: "review audit", intentType: "audit", toolTypeGuess: "audit" },
];

const DEFAULT_MOCK_BASES = [
  "indie launch",
  "creator workflow",
  "small business intake",
  "solo founder planning",
  "local service quote",
  "digital product listing",
  "newsletter sponsor",
  "course outline",
  "support ticket triage",
  "marketplace listing",
] as const;

export async function generateKeywordCandidates(
  input: KeywordExpansionInput,
  options: KeywordExpansionAgentOptions = {},
): Promise<KeywordExpansionCandidate[]> {
  const parsedInput = KeywordExpansionInputSchema.parse(input);
  const requestedCount = normalizeRequestedCount(parsedInput.requestedCount);

  if (requestedCount === 0) {
    return [];
  }

  const fallback = () => generateMockKeywordCandidates(parsedInput, requestedCount);

  if (!options.llmClient) {
    return fallback();
  }

  try {
    const result = await safeJsonCompletion({
      client: options.llmClient,
      model: options.model,
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxTokens ?? 3000,
      responseFormat: { type: "json_object" },
      schema: KeywordExpansionResponseSchema,
      schemaDescription: KEYWORD_EXPANSION_SCHEMA_DESCRIPTION,
      messages: buildKeywordExpansionMessages(parsedInput, requestedCount),
    });

    if (!result.ok) {
      return fallback();
    }

    const normalizedLlmCandidates = normalizeCandidateList(
      result.data.candidates,
      parsedInput,
      requestedCount,
    );

    if (normalizedLlmCandidates.length >= requestedCount) {
      return normalizedLlmCandidates;
    }

    return mergeCandidateLists(
      normalizedLlmCandidates,
      fallback(),
      requestedCount,
    );
  } catch {
    return fallback();
  }
}

export function buildKeywordExpansionMessages(
  input: KeywordExpansionInput,
  requestedCount = normalizeRequestedCount(input.requestedCount),
): LlmChatMessage[] {
  const normalizedInput = normalizeAgentInput(KeywordExpansionInputSchema.parse(input));
  const count = normalizeRequestedCount(requestedCount);

  return [
    {
      role: "system",
      content: "You are a search opportunity researcher for AI microtools.",
    },
    {
      role: "user",
      content: [
        "Your job is to generate narrow, high-intent search keywords that can potentially be turned into lightweight web tools such as calculators, checkers, generators, templates, estimators, audits, or checklists.",
        "",
        "User radar profile:",
        `- Domain: ${normalizedInput.domainDescription}`,
        `- Seed examples: ${formatPromptList(normalizedInput.seedExamples)}`,
        `- Target countries: ${formatPromptList(normalizedInput.countries)}`,
        `- Target languages: ${formatPromptList(normalizedInput.languages)}`,
        `- User advantages: ${formatPromptList(normalizedInput.userAdvantages)}`,
        `- Monetization preferences: ${formatPromptList(normalizedInput.monetizationPreferences)}`,
        `- Excluded topics: ${formatPromptList(normalizedInput.excludedTopics)}`,
        "",
        "Rules:",
        "1. Prefer task-oriented keywords with words like generator, checker, calculator, estimator, template, checklist, audit, cost, requirements, policy, form.",
        "2. Prefer vertical and specific keywords over broad keywords.",
        "3. Include country/language-specific variants when useful.",
        "4. Avoid excluded topics.",
        "5. Avoid generic startup ideas.",
        "6. Each keyword should be potentially buildable as a web microtool within 48 hours.",
        "7. Output valid JSON only.",
        "",
        `Return ${count} candidates using this schema:`,
        KEYWORD_EXPANSION_SCHEMA_DESCRIPTION,
      ].join("\n"),
    },
  ];
}

export function generateMockKeywordCandidates(
  input: KeywordExpansionInput,
  requestedCount = KEYWORD_EXPANSION_DEFAULT_COUNT,
): KeywordExpansionCandidate[] {
  const parsedInput = KeywordExpansionInputSchema.parse(input);
  const normalizedInput = normalizeAgentInput(parsedInput);
  const count = normalizeRequestedCount(requestedCount);

  if (count === 0) {
    return [];
  }

  const excludedTopics = normalizeExcludedTopics(normalizedInput.excludedTopics);
  const bases = buildMockBasePhrases(normalizedInput, excludedTopics);
  const rawCandidates: KeywordExpansionCandidate[] = [];

  for (const country of normalizedInput.countries) {
    for (const language of normalizedInput.languages) {
      for (const base of bases) {
        for (const template of MOCK_KEYWORD_TEMPLATES) {
          rawCandidates.push(buildMockCandidate({
            base,
            country,
            language,
            template,
          }));
        }
      }
    }
  }

  return normalizeCandidateList(rawCandidates, parsedInput, count);
}

export function normalizeRequestedCount(requestedCount: number | undefined): number {
  if (requestedCount === undefined || !Number.isFinite(requestedCount)) {
    return KEYWORD_EXPANSION_DEFAULT_COUNT;
  }

  return Math.max(
    0,
    Math.min(KEYWORD_EXPANSION_MAX_COUNT, Math.trunc(requestedCount)),
  );
}

function buildMockCandidate({
  base,
  country,
  language,
  template,
}: {
  base: string;
  country: string;
  language: string;
  template: MockKeywordTemplate;
}): KeywordExpansionCandidate {
  const keyword = compactKeyword(`${base} ${template.suffix}`);

  return {
    keyword,
    country,
    language,
    intentType: template.intentType,
    toolTypeGuess: template.toolTypeGuess,
    rationale: [
      "Task-oriented",
      template.intentType,
      `keyword for ${country}/${language} searchers`,
      `that can become a focused ${template.toolTypeGuess} microtool within 48 hours.`,
    ].join(" "),
  };
}

function normalizeCandidateList(
  candidates: KeywordExpansionCandidate[],
  input: KeywordExpansionInput,
  limit: number,
): KeywordExpansionCandidate[] {
  const normalizedInput = normalizeAgentInput(input);
  const excludedTopics = normalizeExcludedTopics(normalizedInput.excludedTopics);
  const seen = new Set<string>();
  const normalizedCandidates: KeywordExpansionCandidate[] = [];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeCandidate(
      candidate,
      normalizedInput,
      excludedTopics,
    );

    if (!normalizedCandidate) {
      continue;
    }

    const key = [
      normalizedCandidate.keyword,
      normalizedCandidate.country,
      normalizedCandidate.language,
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedCandidates.push(normalizedCandidate);

    if (normalizedCandidates.length >= limit) {
      break;
    }
  }

  return normalizedCandidates;
}

function normalizeCandidate(
  candidate: KeywordExpansionCandidate,
  input: NormalizedKeywordExpansionInput,
  excludedTopics: string[],
): KeywordExpansionCandidate | null {
  const keyword = compactKeyword(candidate.keyword);
  const rationale = normalizeText(candidate.rationale);

  if (!keyword || !rationale) {
    return null;
  }

  if (containsExcludedTopic(`${keyword} ${rationale}`, excludedTopics)) {
    return null;
  }

  return {
    keyword,
    country: normalizeMarketToken(candidate.country, input.countries[0] ?? "US").toUpperCase(),
    language: normalizeMarketToken(candidate.language, input.languages[0] ?? "en").toLowerCase(),
    intentType: candidate.intentType,
    toolTypeGuess: candidate.toolTypeGuess,
    rationale,
  };
}

function mergeCandidateLists(
  preferredCandidates: KeywordExpansionCandidate[],
  fallbackCandidates: KeywordExpansionCandidate[],
  limit: number,
): KeywordExpansionCandidate[] {
  const seen = new Set<string>();
  const merged: KeywordExpansionCandidate[] = [];

  for (const candidate of [...preferredCandidates, ...fallbackCandidates]) {
    const key = [candidate.keyword, candidate.country, candidate.language].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(candidate);

    if (merged.length >= limit) {
      break;
    }
  }

  return merged;
}

function normalizeAgentInput(input: KeywordExpansionInput): NormalizedKeywordExpansionInput {
  return {
    domainDescription: normalizeText(input.domainDescription),
    seedExamples: normalizeStringList(input.seedExamples),
    countries: normalizeMarketList(input.countries, "US", "upper"),
    languages: normalizeMarketList(input.languages, "en", "lower"),
    userAdvantages: normalizeStringList(input.userAdvantages),
    monetizationPreferences: normalizeStringList(input.monetizationPreferences),
    excludedTopics: normalizeStringList(input.excludedTopics),
  };
}

function buildMockBasePhrases(
  input: NormalizedKeywordExpansionInput,
  excludedTopics: string[],
): string[] {
  const rawPhrases = [
    ...input.seedExamples,
    ...extractDomainPhrases(input.domainDescription),
    ...DEFAULT_MOCK_BASES,
  ];
  const seen = new Set<string>();
  const bases: string[] = [];

  for (const rawPhrase of rawPhrases) {
    const base = stripToolSuffix(compactKeyword(rawPhrase));

    if (!base || containsExcludedTopic(base, excludedTopics) || seen.has(base)) {
      continue;
    }

    seen.add(base);
    bases.push(base);
  }

  if (bases.length > 0) {
    return bases;
  }

  return ["focused workflow"];
}

function extractDomainPhrases(domainDescription: string): string[] {
  return normalizeText(domainDescription)
    .split(/[,;|/]+|\s+\+\s+|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeStringList(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const normalizedValues: string[] = [];

  for (const value of values ?? []) {
    const normalizedValue = normalizeText(value);
    const key = normalizedValue.toLowerCase();

    if (!normalizedValue || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedValues.push(normalizedValue);
  }

  return normalizedValues;
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

function normalizeExcludedTopics(excludedTopics: string[]): string[] {
  return excludedTopics
    .map((topic) => normalizeText(topic).toLowerCase())
    .filter(Boolean);
}

function containsExcludedTopic(value: string, excludedTopics: string[]): boolean {
  const searchableValue = value.toLowerCase();

  return excludedTopics.some((topic) => searchableValue.includes(topic));
}

function stripToolSuffix(value: string): string {
  return normalizeText(value)
    .replace(/\b(web\s*)?(microtools?|tools?|apps?)\b/gi, " ")
    .replace(/\b(generator|checker|calculator|estimator|template|checklist|audit|directory|form)\b$/i, " ")
    .trim();
}

function compactKeyword(value: string): string {
  const words = normalizeText(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
  const compactedWords = words.filter((word, index) => word !== words[index - 1]);

  return compactedWords.join(" ");
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function formatPromptList(values: string[]): string {
  return values.length > 0 ? JSON.stringify(values) : "[]";
}
