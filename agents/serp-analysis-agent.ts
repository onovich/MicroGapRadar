import { z } from "zod";

import { safeJsonCompletion } from "../services/llm";
import type { LlmChatMessage, LlmClient } from "../services/llm";
import { SERP_RESULT_TYPES } from "../services/serp";
import type { SerpResult } from "../services/serp";

export const SERP_ANALYSIS_PROMPT_VERSION = "2026-06-28-v1";

export const SERP_WEAK_SIGNAL_TYPES = [
  "generic_articles",
  "forum_or_community",
  "pdf_or_static_document",
  "government_or_official_page",
  "old_or_outdated_page",
  "poor_ux_page",
  "missing_interactive_tool",
  "broad_or_outdated_tools",
  "specific_intent_not_task_completing",
  "empty_results",
] as const;

export const SERP_STRONG_SIGNAL_TYPES = [
  "mature_saas_competition",
  "official_documentation_satisfies",
  "high_authority_specialized_tools",
  "multiple_specialized_tools",
  "search_snippet_satisfies",
  "established_domain",
  "ad_or_commercial_competition",
] as const;

export const SerpResultInputSchema = z.object({
  position: z.number().finite().transform((position) =>
    Math.max(1, Math.trunc(position)),
  ),
  title: z.string().trim().min(1),
  url: z.string().trim().min(1),
  domain: z.string().trim().min(1),
  snippet: z.string().trim().optional(),
  resultType: z.enum(SERP_RESULT_TYPES).optional(),
}).strict();

export const SerpAnalysisInputSchema = z.object({
  keyword: z.string().trim().min(1),
  country: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional(),
  serpResults: z.array(SerpResultInputSchema),
}).strict();

export const SerpWeakSignalSchema = z.object({
  type: z.enum(SERP_WEAK_SIGNAL_TYPES),
  strength: z.number().finite().transform(normalizeSerpSignalStrength),
  evidence: z.string().trim().min(1),
}).strict();

export const SerpStrongSignalSchema = z.object({
  type: z.enum(SERP_STRONG_SIGNAL_TYPES),
  strength: z.number().finite().transform(normalizeSerpSignalStrength),
  evidence: z.string().trim().min(1),
}).strict();

export const SerpAnalysisOutputSchema = z.object({
  serpWeaknessSummary: z.string().trim().min(1),
  weakSignals: z.array(SerpWeakSignalSchema).transform(dedupeSignalList),
  strongSignals: z.array(SerpStrongSignalSchema).transform(dedupeSignalList),
  serpWeaknessScoreHint: z.number().finite().transform(normalizeSerpWeaknessScoreHint),
}).strict();

export const SerpAnalysisResponseSchema = SerpAnalysisOutputSchema;

export type SerpAnalysisInput = z.infer<typeof SerpAnalysisInputSchema>;
export type SerpAnalysisOutput = z.infer<typeof SerpAnalysisOutputSchema>;
export type SerpAnalysisResponse = SerpAnalysisOutput;
export type SerpWeakSignal = z.infer<typeof SerpWeakSignalSchema>;
export type SerpStrongSignal = z.infer<typeof SerpStrongSignalSchema>;
export type SerpWeakSignalType = (typeof SERP_WEAK_SIGNAL_TYPES)[number];
export type SerpStrongSignalType = (typeof SERP_STRONG_SIGNAL_TYPES)[number];

export type SerpAnalysisAgentOptions = {
  llmClient?: LlmClient;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

type NormalizedSerpAnalysisInput = {
  keyword: string;
  country: string;
  language: string;
  serpResults: SerpResult[];
};

type ResultEvidence = {
  total: number;
  genericArticleCount: number;
  forumOrCommunityCount: number;
  pdfOrStaticCount: number;
  governmentOrOfficialCount: number;
  oldOrOutdatedCount: number;
  poorUxCount: number;
  interactiveToolCount: number;
  broadOrOutdatedToolCount: number;
  matureSaasCount: number;
  officialDocsCount: number;
  establishedDomainCount: number;
  specializedToolCount: number;
  snippetSatisfiesCount: number;
  adOrCommercialCount: number;
};

const SERP_ANALYSIS_SCHEMA_DESCRIPTION = `{
  "serpWeaknessSummary": "string",
  "weakSignals": [
    { "type": "string", "strength": number, "evidence": "string" }
  ],
  "strongSignals": [
    { "type": "string", "strength": number, "evidence": "string" }
  ],
  "serpWeaknessScoreHint": number
}`;

const WEAK_SIGNAL_SCORE_WEIGHTS: Record<SerpWeakSignalType, number> = {
  generic_articles: 18,
  forum_or_community: 12,
  pdf_or_static_document: 8,
  government_or_official_page: 7,
  old_or_outdated_page: 8,
  poor_ux_page: 8,
  missing_interactive_tool: 20,
  broad_or_outdated_tools: 9,
  specific_intent_not_task_completing: 11,
  empty_results: 12,
};

const STRONG_SIGNAL_SCORE_WEIGHTS: Record<SerpStrongSignalType, number> = {
  mature_saas_competition: 24,
  official_documentation_satisfies: 16,
  high_authority_specialized_tools: 18,
  multiple_specialized_tools: 18,
  search_snippet_satisfies: 12,
  established_domain: 8,
  ad_or_commercial_competition: 8,
};

const MATURE_SAAS_DOMAINS = [
  "adobe.com",
  "ahrefs.com",
  "airtable.com",
  "asana.com",
  "canva.com",
  "hubspot.com",
  "mailchimp.com",
  "monday.com",
  "notion.so",
  "salesforce.com",
  "semrush.com",
  "shopify.com",
  "squarespace.com",
  "typeform.com",
  "webflow.com",
  "wix.com",
  "zapier.com",
] as const;

const ESTABLISHED_DOMAINS = [
  ...MATURE_SAAS_DOMAINS,
  "developer.mozilla.org",
  "docs.github.com",
  "github.com",
  "google.com",
  "microsoft.com",
  "reddit.com",
  "stackoverflow.com",
  "wikipedia.org",
] as const;

export async function analyzeSerpResults(
  input: SerpAnalysisInput,
  options: SerpAnalysisAgentOptions = {},
): Promise<SerpAnalysisOutput> {
  const parsedInput = SerpAnalysisInputSchema.parse(input);
  const fallback = () => generateHeuristicSerpAnalysis(parsedInput);

  if (!options.llmClient) {
    return fallback();
  }

  try {
    const result = await safeJsonCompletion({
      client: options.llmClient,
      model: options.model,
      temperature: options.temperature ?? 0.1,
      maxTokens: options.maxTokens ?? 1800,
      responseFormat: { type: "json_object" },
      schema: SerpAnalysisOutputSchema,
      schemaDescription: SERP_ANALYSIS_SCHEMA_DESCRIPTION,
      messages: buildSerpAnalysisMessages(parsedInput),
    });

    if (!result.ok) {
      return fallback();
    }

    return SerpAnalysisOutputSchema.parse(result.data);
  } catch {
    return fallback();
  }
}

export function buildSerpAnalysisMessages(
  input: SerpAnalysisInput,
): LlmChatMessage[] {
  const normalizedInput = normalizeSerpAnalysisInput(
    SerpAnalysisInputSchema.parse(input),
  );

  return [
    {
      role: "system",
      content: "You are a SERP weakness analyst.",
    },
    {
      role: "user",
      content: [
        "Analyze whether a keyword has a low-competition opportunity for a lightweight AI web tool.",
        "",
        `Keyword: ${normalizedInput.keyword}`,
        `Country: ${normalizedInput.country}`,
        `Language: ${normalizedInput.language}`,
        "SERP results:",
        formatSerpResultsForPrompt(normalizedInput.serpResults),
        "",
        "Look for weak signals:",
        "- Top results are generic articles instead of tools.",
        "- Forums, Reddit, Quora, old pages, PDFs, government pages, or poor UX pages appear in top results.",
        "- Existing tools are broad, outdated, or not specialized.",
        "- There is no interactive calculator/checker/generator.",
        "- Search intent is specific but results are not task-completing.",
        "",
        "Look for strong competition signals:",
        "- Mature SaaS tools dominate.",
        "- Official platform documentation fully satisfies the query.",
        "- Multiple high-authority specialized tools rank.",
        "- Query likely answered completely by a search snippet.",
        "",
        `Use weak signal types from: ${SERP_WEAK_SIGNAL_TYPES.join(", ")}.`,
        `Use strong signal types from: ${SERP_STRONG_SIGNAL_TYPES.join(", ")}.`,
        "Return JSON only:",
        SERP_ANALYSIS_SCHEMA_DESCRIPTION,
      ].join("\n"),
    },
  ];
}

export function generateHeuristicSerpAnalysis(
  input: SerpAnalysisInput,
): SerpAnalysisOutput {
  const normalizedInput = normalizeSerpAnalysisInput(
    SerpAnalysisInputSchema.parse(input),
  );
  const total = normalizedInput.serpResults.length;

  if (total === 0) {
    return SerpAnalysisOutputSchema.parse({
      serpWeaknessSummary: `No SERP results were provided for "${normalizedInput.keyword}", so competition appears unproven and should be treated as a low-evidence weak SERP.`,
      weakSignals: [
        {
          type: "empty_results",
          strength: 0.55,
          evidence: "The supplied SERP result list is empty.",
        },
      ],
      strongSignals: [],
      serpWeaknessScoreHint: 60,
    });
  }

  const evidence = collectResultEvidence(normalizedInput.serpResults);
  const weakSignals = buildWeakSignals(normalizedInput, evidence);
  const strongSignals = buildStrongSignals(evidence);
  const score = calculateHeuristicScore(weakSignals, strongSignals);

  return SerpAnalysisOutputSchema.parse({
    serpWeaknessSummary: buildHeuristicSummary({
      keyword: normalizedInput.keyword,
      weakSignals,
      strongSignals,
    }),
    weakSignals,
    strongSignals,
    serpWeaknessScoreHint: score,
  });
}

export function normalizeSerpWeaknessScoreHint(score: number): number {
  const normalizedScore = score >= 0 && score <= 1
    ? score * 100
    : score;

  return Math.max(0, Math.min(100, Math.round(normalizedScore)));
}

export function normalizeSerpSignalStrength(strength: number): number {
  const normalizedStrength = strength > 10 && strength <= 100
    ? strength / 100
    : strength;
  const clampedStrength = Math.max(0, Math.min(1, normalizedStrength));

  return Math.round(clampedStrength * 100) / 100;
}

function buildWeakSignals(
  input: NormalizedSerpAnalysisInput,
  evidence: ResultEvidence,
): SerpWeakSignal[] {
  const signals: SerpWeakSignal[] = [];
  const total = evidence.total;

  if (evidence.genericArticleCount > 0) {
    signals.push({
      type: "generic_articles",
      strength: ratioStrength(evidence.genericArticleCount, total),
      evidence: `${evidence.genericArticleCount} of ${total} top results read like guides, articles, tutorials, or reference pages rather than focused tools.`,
    });
  }

  if (evidence.forumOrCommunityCount > 0) {
    signals.push({
      type: "forum_or_community",
      strength: ratioStrength(evidence.forumOrCommunityCount, total, 0.4, 0.9),
      evidence: `${evidence.forumOrCommunityCount} of ${total} top results are forums, community threads, Reddit, Quora, or discussion pages.`,
    });
  }

  if (evidence.pdfOrStaticCount > 0) {
    signals.push({
      type: "pdf_or_static_document",
      strength: ratioStrength(evidence.pdfOrStaticCount, total, 0.35, 0.85),
      evidence: `${evidence.pdfOrStaticCount} of ${total} top results are PDFs, downloads, reference sheets, or static documents.`,
    });
  }

  if (evidence.governmentOrOfficialCount > 0) {
    signals.push({
      type: "government_or_official_page",
      strength: ratioStrength(evidence.governmentOrOfficialCount, total, 0.3, 0.75),
      evidence: `${evidence.governmentOrOfficialCount} of ${total} top results are government or official-agency pages, which are often static rather than task-completing tools.`,
    });
  }

  if (evidence.oldOrOutdatedCount > 0) {
    signals.push({
      type: "old_or_outdated_page",
      strength: ratioStrength(evidence.oldOrOutdatedCount, total, 0.35, 0.85),
      evidence: `${evidence.oldOrOutdatedCount} of ${total} top results look old, archived, legacy, or explicitly outdated.`,
    });
  }

  if (evidence.poorUxCount > 0) {
    signals.push({
      type: "poor_ux_page",
      strength: ratioStrength(evidence.poorUxCount, total, 0.35, 0.8),
      evidence: `${evidence.poorUxCount} of ${total} top results mention manual steps, downloads, static PDFs, paywalls, popups, or other poor-UX cues.`,
    });
  }

  if (evidence.interactiveToolCount === 0) {
    signals.push({
      type: "missing_interactive_tool",
      strength: 0.9,
      evidence: "No top result appears to be an interactive calculator, checker, generator, estimator, analyzer, or builder.",
    });
  }

  if (evidence.broadOrOutdatedToolCount > 0) {
    signals.push({
      type: "broad_or_outdated_tools",
      strength: ratioStrength(evidence.broadOrOutdatedToolCount, total, 0.35, 0.8),
      evidence: `${evidence.broadOrOutdatedToolCount} of ${total} top results look like broad, all-in-one, generic, legacy, or unspecialized tools.`,
    });
  }

  if (hasSpecificToolIntent(input.keyword) && (
    evidence.interactiveToolCount === 0 ||
    evidence.genericArticleCount >= Math.max(1, evidence.interactiveToolCount * 2)
  )) {
    signals.push({
      type: "specific_intent_not_task_completing",
      strength: evidence.interactiveToolCount === 0 ? 0.85 : 0.65,
      evidence: `The keyword "${input.keyword}" has task/tool intent, but the current results are not consistently task-completing.`,
    });
  }

  return dedupeSignalList(signals);
}

function buildStrongSignals(evidence: ResultEvidence): SerpStrongSignal[] {
  const signals: SerpStrongSignal[] = [];
  const total = evidence.total;

  if (evidence.matureSaasCount > 0) {
    signals.push({
      type: "mature_saas_competition",
      strength: ratioStrength(evidence.matureSaasCount, total, 0.45, 0.95),
      evidence: `${evidence.matureSaasCount} of ${total} top results look like mature SaaS, software platforms, enterprise products, or sponsored tools.`,
    });
  }

  if (evidence.officialDocsCount > 0) {
    signals.push({
      type: "official_documentation_satisfies",
      strength: ratioStrength(evidence.officialDocsCount, total, 0.35, 0.85),
      evidence: `${evidence.officialDocsCount} of ${total} top results are official documentation, developer docs, help center, or support pages.`,
    });
  }

  if (evidence.establishedDomainCount > 0 && evidence.specializedToolCount > 0) {
    signals.push({
      type: "high_authority_specialized_tools",
      strength: ratioStrength(
        Math.min(evidence.establishedDomainCount, evidence.specializedToolCount),
        total,
        0.4,
        0.9,
      ),
      evidence: `${Math.min(evidence.establishedDomainCount, evidence.specializedToolCount)} top results combine established domains with specialized tool intent.`,
    });
  }

  if (evidence.specializedToolCount >= 2) {
    signals.push({
      type: "multiple_specialized_tools",
      strength: ratioStrength(evidence.specializedToolCount, total, 0.55, 0.95),
      evidence: `${evidence.specializedToolCount} of ${total} top results appear to be specialized interactive tools.`,
    });
  }

  if (evidence.snippetSatisfiesCount > 0) {
    signals.push({
      type: "search_snippet_satisfies",
      strength: ratioStrength(evidence.snippetSatisfiesCount, total, 0.35, 0.75),
      evidence: `${evidence.snippetSatisfiesCount} of ${total} top snippets appear to answer the query directly.`,
    });
  }

  if (evidence.establishedDomainCount > 0) {
    signals.push({
      type: "established_domain",
      strength: ratioStrength(evidence.establishedDomainCount, total, 0.3, 0.75),
      evidence: `${evidence.establishedDomainCount} of ${total} top results are from established domains.`,
    });
  }

  if (evidence.adOrCommercialCount > 0) {
    signals.push({
      type: "ad_or_commercial_competition",
      strength: ratioStrength(evidence.adOrCommercialCount, total, 0.3, 0.8),
      evidence: `${evidence.adOrCommercialCount} of ${total} top results are ads or strongly commercial pages.`,
    });
  }

  return dedupeSignalList(signals);
}

function collectResultEvidence(results: SerpResult[]): ResultEvidence {
  const evidence: ResultEvidence = {
    total: results.length,
    genericArticleCount: 0,
    forumOrCommunityCount: 0,
    pdfOrStaticCount: 0,
    governmentOrOfficialCount: 0,
    oldOrOutdatedCount: 0,
    poorUxCount: 0,
    interactiveToolCount: 0,
    broadOrOutdatedToolCount: 0,
    matureSaasCount: 0,
    officialDocsCount: 0,
    establishedDomainCount: 0,
    specializedToolCount: 0,
    snippetSatisfiesCount: 0,
    adOrCommercialCount: 0,
  };

  for (const result of results) {
    const text = searchableText(result);
    const domain = normalizeDomain(result.domain);
    const interactiveTool = hasInteractiveToolCue(result, text);
    const matureSaas = hasMatureSaasCue(result, text, domain);
    const establishedDomain = isKnownEstablishedDomain(domain);

    if (hasGenericArticleCue(result, text) && !interactiveTool) {
      evidence.genericArticleCount += 1;
    }

    if (hasForumOrCommunityCue(result, text, domain)) {
      evidence.forumOrCommunityCount += 1;
    }

    if (hasPdfOrStaticCue(result, text)) {
      evidence.pdfOrStaticCount += 1;
    }

    if (isGovernmentOrOfficialAgencyPage(text, domain)) {
      evidence.governmentOrOfficialCount += 1;
    }

    if (hasOldOrOutdatedCue(text)) {
      evidence.oldOrOutdatedCount += 1;
    }

    if (hasPoorUxCue(text)) {
      evidence.poorUxCount += 1;
    }

    if (interactiveTool) {
      evidence.interactiveToolCount += 1;
    }

    if (interactiveTool && hasBroadOrOutdatedToolCue(text)) {
      evidence.broadOrOutdatedToolCount += 1;
    }

    if (matureSaas) {
      evidence.matureSaasCount += 1;
    }

    if (hasOfficialDocumentationCue(text, domain)) {
      evidence.officialDocsCount += 1;
    }

    if (establishedDomain) {
      evidence.establishedDomainCount += 1;
    }

    if (interactiveTool && !hasBroadOrOutdatedToolCue(text)) {
      evidence.specializedToolCount += 1;
    }

    if (hasSnippetSatisfiesCue(result.snippet ?? "")) {
      evidence.snippetSatisfiesCount += 1;
    }

    if (result.resultType === "ad" || hasCommercialCue(text)) {
      evidence.adOrCommercialCount += 1;
    }
  }

  return evidence;
}

function calculateHeuristicScore(
  weakSignals: SerpWeakSignal[],
  strongSignals: SerpStrongSignal[],
): number {
  const weakScore = weakSignals.reduce(
    (sum, signal) => sum + WEAK_SIGNAL_SCORE_WEIGHTS[signal.type] * signal.strength,
    0,
  );
  const strongPenalty = strongSignals.reduce(
    (sum, signal) => sum + STRONG_SIGNAL_SCORE_WEIGHTS[signal.type] * signal.strength,
    0,
  );

  return normalizeSerpWeaknessScoreHint(45 + weakScore - strongPenalty);
}

function buildHeuristicSummary({
  keyword,
  weakSignals,
  strongSignals,
}: {
  keyword: string;
  weakSignals: SerpWeakSignal[];
  strongSignals: SerpStrongSignal[];
}): string {
  const weakSummary = weakSignals.slice(0, 3).map((signal) =>
    humanizeSignalType(signal.type),
  ).join(", ");
  const strongSummary = strongSignals.slice(0, 2).map((signal) =>
    humanizeSignalType(signal.type),
  ).join(", ");

  if (weakSignals.length > 0 && strongSignals.length > 0) {
    return `Top results for "${keyword}" show weak SERP signals such as ${weakSummary}, but competition pressure is present from ${strongSummary}.`;
  }

  if (weakSignals.length > 0) {
    return `Top results for "${keyword}" look weak because of ${weakSummary}.`;
  }

  if (strongSignals.length > 0) {
    return `Top results for "${keyword}" show strong competition from ${strongSummary}.`;
  }

  return `Top results for "${keyword}" are mixed, with no dominant weak or strong SERP signal detected by the deterministic fallback.`;
}

function normalizeSerpAnalysisInput(
  input: SerpAnalysisInput,
): NormalizedSerpAnalysisInput {
  return {
    keyword: normalizeText(input.keyword),
    country: normalizeMarketToken(input.country, "US").toUpperCase(),
    language: normalizeMarketToken(input.language, "en").toLowerCase(),
    serpResults: input.serpResults
      .map(normalizeSerpResult)
      .sort((left, right) => left.position - right.position),
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

function formatSerpResultsForPrompt(results: SerpResult[]): string {
  return JSON.stringify(
    results.map((result) => ({
      position: result.position,
      title: result.title,
      url: result.url,
      domain: result.domain,
      snippet: result.snippet ?? "",
      resultType: result.resultType ?? "unknown",
    })),
    null,
    2,
  );
}

function dedupeSignalList<TSignal extends { type: string; strength: number; evidence: string }>(
  signals: TSignal[],
): TSignal[] {
  const byType = new Map<string, TSignal>();

  for (const signal of signals) {
    const existingSignal = byType.get(signal.type);

    if (!existingSignal || signal.strength > existingSignal.strength) {
      byType.set(signal.type, signal);
    }
  }

  return Array.from(byType.values());
}

function ratioStrength(
  count: number,
  total: number,
  minStrength = 0.35,
  maxStrength = 0.95,
): number {
  if (total <= 0 || count <= 0) {
    return 0;
  }

  const ratio = Math.min(1, count / total);

  return normalizeSerpSignalStrength(minStrength + ratio * (maxStrength - minStrength));
}

function searchableText(result: SerpResult): string {
  return [
    result.title,
    result.url,
    result.domain,
    result.snippet ?? "",
    result.resultType ?? "",
  ].join(" ").toLowerCase();
}

function hasGenericArticleCue(result: SerpResult, text: string): boolean {
  if (result.resultType === "video") {
    return true;
  }

  return /\b(how to|guide|tutorial|overview|article|blog|tips|ideas|best practices|what is|comparison|reference sheet|step-by-step|templates? and workflow ideas)\b/i.test(text);
}

function hasForumOrCommunityCue(
  result: SerpResult,
  text: string,
  domain: string,
): boolean {
  return result.resultType === "forum" ||
    /\b(reddit|quora|forum|community|discussion|thread|stackoverflow|stack exchange)\b/i.test(text) ||
    domain.includes("reddit.") ||
    domain.includes("quora.") ||
    domain.includes("stackoverflow.");
}

function hasPdfOrStaticCue(result: SerpResult, text: string): boolean {
  return result.resultType === "pdf" ||
    /\.pdf(?:[?#]|$)/i.test(result.url) ||
    /\b(pdf|downloadable|download|reference sheet|whitepaper|static document|printable|worksheet)\b/i.test(text);
}

function isGovernmentOrOfficialAgencyPage(text: string, domain: string): boolean {
  return /(^|\.)gov(?:\.|$)/i.test(domain) ||
    /(^|\.)mil(?:\.|$)/i.test(domain) ||
    /\b(government|official agency|federal|state department|municipal|europa\.eu|gov\.uk)\b/i.test(text);
}

function hasOldOrOutdatedCue(text: string): boolean {
  return /\b(outdated|archived|legacy|old page|unmaintained)\b/i.test(text) ||
    /\b(19\d{2}|200\d|201\d|2020|2021|2022)\b/.test(text);
}

function hasPoorUxCue(text: string): boolean {
  return /\b(manual steps|manual process|copy[ -]?paste|download|downloadable|spreadsheet|static|pdf|paywall|popup|pop-up|ads?|clunky|printable|worksheet|reference sheet|sign[ -]?up required)\b/i.test(text);
}

function hasInteractiveToolCue(result: SerpResult, text: string): boolean {
  const title = result.title.toLowerCase();
  const snippet = (result.snippet ?? "").toLowerCase();
  const hasNegatedInteractiveCue = /\b(no|not|without)\s+interactive\b/i.test(snippet);

  return /\b(generator|calculator|checker|estimator|builder|analyzer|validator|planner|wizard)\b/i.test(text) ||
    /\b(tool|software|platform|app|dashboard|suite)\b/i.test(title) ||
    (!hasNegatedInteractiveCue &&
      /\b(interactive|upload your|enter your|generate|calculate|check your|estimate your)\b/i.test(snippet));
}

function hasBroadOrOutdatedToolCue(text: string): boolean {
  return /\b(all-in-one|suite|platform for everything|general purpose|generic|not specialized|broad|legacy|outdated|unmaintained)\b/i.test(text);
}

function hasMatureSaasCue(
  result: SerpResult,
  text: string,
  domain: string,
): boolean {
  return result.resultType === "ad" ||
    isKnownMatureSaasDomain(domain) ||
    /\b(saas|enterprise|pricing|book a demo|request demo|sales team|software platform|sponsored|crm|suite|workflow platform)\b/i.test(text);
}

function hasOfficialDocumentationCue(text: string, domain: string): boolean {
  return /^(docs|developer|developers|help|support)\./i.test(domain) ||
    /\b(official documentation|developer docs|api reference|help center|support article|platform documentation|user guide)\b/i.test(text);
}

function hasSnippetSatisfiesCue(snippet: string): boolean {
  return /\b(the answer is|formula is|equals|is defined as|definition:|in short,|simply means)\b/i.test(snippet);
}

function hasCommercialCue(text: string): boolean {
  return /\b(pricing|plans|book a demo|request demo|free trial|buy now|sponsored|enterprise|sales team)\b/i.test(text);
}

function hasSpecificToolIntent(keyword: string): boolean {
  return /\b(generator|checker|calculator|estimator|template|checklist|audit|validator|analyzer|planner|builder)\b/i.test(keyword);
}

function isKnownMatureSaasDomain(domain: string): boolean {
  return MATURE_SAAS_DOMAINS.some((knownDomain) =>
    domain === knownDomain || domain.endsWith(`.${knownDomain}`),
  );
}

function isKnownEstablishedDomain(domain: string): boolean {
  return ESTABLISHED_DOMAINS.some((knownDomain) =>
    domain === knownDomain || domain.endsWith(`.${knownDomain}`),
  );
}

function humanizeSignalType(type: SerpWeakSignalType | SerpStrongSignalType): string {
  return type.replace(/_/g, " ");
}

function normalizeDomain(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function normalizeMarketToken(value: string | undefined, fallback: string): string {
  const normalizedValue = normalizeText(value ?? "").replace(/\s+/g, "-");

  return normalizedValue || fallback;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
