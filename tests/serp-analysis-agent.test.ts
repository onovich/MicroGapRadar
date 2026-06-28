import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeSerpResults,
  generateHeuristicSerpAnalysis,
  normalizeSerpSignalStrength,
  normalizeSerpWeaknessScoreHint,
} from "../agents";
import type { SerpAnalysisInput, SerpAnalysisOutput } from "../agents";
import type {
  LlmChatCompletionInput,
  LlmChatCompletionResult,
  LlmClient,
} from "../services/llm";
import type { SerpResult } from "../services/serp";

const weakSerpResults: SerpResult[] = [
  {
    position: 1,
    title: "How to write a Steam short description in 2020",
    url: "https://example.com/guides/steam-description",
    domain: "example.com",
    snippet: "A generic how-to guide with manual steps and copy paste examples.",
    resultType: "organic",
  },
  {
    position: 2,
    title: "Discussion: best Steam page description tips",
    url: "https://reddit.com/r/gamedev/comments/steam-description",
    domain: "reddit.com",
    snippet: "Community thread where users ask for a better workflow.",
    resultType: "forum",
  },
  {
    position: 3,
    title: "Steam page checklist PDF",
    url: "https://resources.example.org/steam-page-checklist.pdf",
    domain: "resources.example.org",
    snippet: "Downloadable reference sheet and printable PDF.",
    resultType: "pdf",
  },
  {
    position: 4,
    title: "Government digital publishing manual 2018",
    url: "https://agency.gov/publishing/manual",
    domain: "agency.gov",
    snippet: "Official agency manual with static guidance and no interactive workflow.",
    resultType: "organic",
  },
];

const baseInput: SerpAnalysisInput = {
  keyword: "steam short description generator",
  country: "us",
  language: "EN",
  serpResults: weakSerpResults,
};

describe("SERP Analysis Agent", () => {
  it("uses safe JSON completion through an injected LLM client", async () => {
    const client = new QueueLlmClient([
      completionSuccess(JSON.stringify({
        serpWeaknessSummary: " Top results are mostly generic articles; no focused AI generator appears. ",
        weakSignals: [
          {
            type: "generic_articles",
            strength: 0.8,
            evidence: " Most top results are how-to guides. ",
          },
        ],
        strongSignals: [
          {
            type: "established_domain",
            strength: 0.4,
            evidence: "One established community site appears in the top results.",
          },
        ],
        serpWeaknessScoreHint: 78,
      })),
    ]);

    const analysis = await analyzeSerpResults(baseInput, { llmClient: client });

    assert.equal(analysis.serpWeaknessSummary, "Top results are mostly generic articles; no focused AI generator appears.");
    assert.deepEqual(analysis.weakSignals, [
      {
        type: "generic_articles",
        strength: 0.8,
        evidence: "Most top results are how-to guides.",
      },
    ]);
    assert.equal(analysis.strongSignals[0]?.type, "established_domain");
    assert.equal(analysis.serpWeaknessScoreHint, 78);

    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0]?.responseFormat?.type, "json_object");
    assert.match(client.calls[0]?.messages[0]?.content ?? "", /SERP weakness analyst/);
    assert.match(client.calls[0]?.messages[1]?.content ?? "", /Analyze whether a keyword/);
    assert.match(client.calls[0]?.messages[1]?.content ?? "", /steam short description generator/);
    assert.match(client.calls[0]?.messages[1]?.content ?? "", /generic articles instead of tools/);
  });

  it("falls back to deterministic heuristics when LLM output cannot be repaired", async () => {
    const client = new QueueLlmClient([
      completionSuccess('{"serpWeaknessSummary":'),
      completionSuccess('{"serpWeaknessSummary":"bad","weakSignals":[{"type":"unknown"}]}'),
    ]);

    const analysis = await analyzeSerpResults(baseInput, { llmClient: client });
    const weakTypes = signalTypes(analysis.weakSignals);

    assert.equal(client.calls.length, 2);
    assert.ok(weakTypes.includes("generic_articles"));
    assert.ok(weakTypes.includes("missing_interactive_tool"));
    assert.ok(analysis.serpWeaknessScoreHint > 70);
  });

  it("clamps and normalizes LLM score and signal strengths", async () => {
    const client = new QueueLlmClient([
      completionSuccess(JSON.stringify({
        serpWeaknessSummary: "Score needs normalization.",
        weakSignals: [
          {
            type: "generic_articles",
            strength: 80,
            evidence: "Percentage-style strength should normalize.",
          },
        ],
        strongSignals: [
          {
            type: "mature_saas_competition",
            strength: -2,
            evidence: "Negative strength should clamp.",
          },
        ],
        serpWeaknessScoreHint: 140,
      })),
    ]);

    const analysis = await analyzeSerpResults(baseInput, { llmClient: client });

    assert.equal(normalizeSerpWeaknessScoreHint(0.78), 78);
    assert.equal(normalizeSerpWeaknessScoreHint(-25), 0);
    assert.equal(normalizeSerpWeaknessScoreHint(140), 100);
    assert.equal(normalizeSerpSignalStrength(80), 0.8);
    assert.equal(normalizeSerpSignalStrength(2), 1);
    assert.equal(analysis.weakSignals[0]?.strength, 0.8);
    assert.equal(analysis.strongSignals[0]?.strength, 0);
    assert.equal(analysis.serpWeaknessScoreHint, 100);
  });

  it("detects generic article, no-tool, static, old, government, and poor-UX weak signals", () => {
    const analysis = generateHeuristicSerpAnalysis(baseInput);
    const weakTypes = signalTypes(analysis.weakSignals);

    assert.ok(weakTypes.includes("generic_articles"));
    assert.ok(weakTypes.includes("forum_or_community"));
    assert.ok(weakTypes.includes("pdf_or_static_document"));
    assert.ok(weakTypes.includes("government_or_official_page"));
    assert.ok(weakTypes.includes("old_or_outdated_page"));
    assert.ok(weakTypes.includes("poor_ux_page"));
    assert.ok(weakTypes.includes("missing_interactive_tool"));
    assert.ok(weakTypes.includes("specific_intent_not_task_completing"));
    assert.ok(analysis.serpWeaknessScoreHint > 70);
    assert.match(analysis.serpWeaknessSummary, /look weak|weak SERP/);
  });

  it("detects mature SaaS and specialized tool competition", () => {
    const analysis = generateHeuristicSerpAnalysis({
      keyword: "landing page copy generator",
      country: "US",
      language: "en",
      serpResults: [
        {
          position: 1,
          title: "HubSpot AI Landing Page Generator",
          url: "https://hubspot.com/products/landing-page-generator",
          domain: "hubspot.com",
          snippet: "Enterprise software platform with pricing and demo options.",
          resultType: "organic",
        },
        {
          position: 2,
          title: "Canva Landing Page Copy Generator App",
          url: "https://canva.com/tools/landing-page-copy-generator",
          domain: "canva.com",
          snippet: "Interactive app that generates copy from your inputs.",
          resultType: "organic",
        },
        {
          position: 3,
          title: "Sponsored landing page generator software",
          url: "https://ads.example.com/landing-page-generator",
          domain: "ads.example.com",
          snippet: "Sponsored software with free trial and pricing.",
          resultType: "ad",
        },
      ],
    });
    const strongTypes = signalTypes(analysis.strongSignals);

    assert.ok(strongTypes.includes("mature_saas_competition"));
    assert.ok(strongTypes.includes("high_authority_specialized_tools"));
    assert.ok(strongTypes.includes("multiple_specialized_tools"));
    assert.ok(strongTypes.includes("ad_or_commercial_competition"));
    assert.ok(analysis.serpWeaknessScoreHint < 50);
  });

  it("handles empty SERP results deterministically", () => {
    const firstRun = generateHeuristicSerpAnalysis({
      keyword: "unity localization checklist",
      country: "DE",
      language: "en",
      serpResults: [],
    });
    const secondRun = generateHeuristicSerpAnalysis({
      keyword: "unity localization checklist",
      country: "DE",
      language: "en",
      serpResults: [],
    });

    assert.deepEqual(secondRun, firstRun);
    assert.equal(firstRun.weakSignals[0]?.type, "empty_results");
    assert.deepEqual(firstRun.strongSignals, []);
    assert.equal(firstRun.serpWeaknessScoreHint, 60);
    assert.match(firstRun.serpWeaknessSummary, /No SERP results/);
  });
});

function signalTypes(
  signals: SerpAnalysisOutput["weakSignals"] | SerpAnalysisOutput["strongSignals"],
): string[] {
  return signals.map((signal) => signal.type);
}

class QueueLlmClient implements LlmClient {
  readonly calls: LlmChatCompletionInput[] = [];

  constructor(private readonly results: LlmChatCompletionResult[]) {}

  async complete(input: LlmChatCompletionInput): Promise<LlmChatCompletionResult> {
    this.calls.push(input);

    return this.results.shift() ?? {
      ok: false,
      error: {
        code: "invalid_response",
        message: "No queued fake LLM result.",
      },
    };
  }
}

function completionSuccess(content: string): LlmChatCompletionResult {
  return {
    ok: true,
    content,
    model: "fake-model",
    raw: {},
  };
}
