import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeOpportunity,
  generateHeuristicOpportunityAnalysis,
  normalizeOpportunityScoreHint,
} from "../agents";
import type {
  OpportunityAnalysisInput,
  OpportunityAnalysisOutput,
  SerpAnalysisOutput,
} from "../agents";
import type {
  LlmChatCompletionInput,
  LlmChatCompletionResult,
  LlmClient,
} from "../services/llm";
import type { SerpResult } from "../services/serp";

const weakSerpResults: SerpResult[] = [
  {
    position: 1,
    title: "How to write a Steam page short description",
    url: "https://example.com/steam-description-guide",
    domain: "example.com",
    snippet: "A generic how-to article with manual copywriting tips.",
    resultType: "organic",
  },
  {
    position: 2,
    title: "Steam page tips discussion",
    url: "https://reddit.com/r/gamedev/comments/steam_page_tips",
    domain: "reddit.com",
    snippet: "Developers discuss examples but there is no interactive generator.",
    resultType: "forum",
  },
];

const weakSerpAnalysis: SerpAnalysisOutput = {
  serpWeaknessSummary: "Top results are generic articles and community threads; no focused generator appears.",
  weakSignals: [
    {
      type: "generic_articles",
      strength: 0.75,
      evidence: "Most top results are how-to guides.",
    },
    {
      type: "missing_interactive_tool",
      strength: 0.9,
      evidence: "No focused interactive generator appears in the supplied results.",
    },
  ],
  strongSignals: [],
  serpWeaknessScoreHint: 82,
};

const baseInput: OpportunityAnalysisInput = {
  radarTask: {
    id: "task_steam",
    name: "GameDev Microtools",
    domainDescription: "Steam, Unity, indie game launch microtools",
    seedExamples: ["steam short description generator"],
    countries: ["us"],
    languages: ["EN"],
    userAdvantages: ["GameDev", "Unity", "AI automation"],
    monetizationPreferences: ["ads", "paid_export", "affiliate"],
    riskPreferences: {
      maxRisk: "high",
      avoidYMYLConclusions: true,
    },
    excludedTopics: ["adult", "gambling", "gray market"],
  },
  keywordCandidate: {
    keyword: "steam short description generator",
    country: "us",
    language: "EN",
    intentType: "generator",
    toolTypeGuess: "generator",
    rationale: "Strong task keyword for indie developers preparing Steam pages.",
  },
  serpAnalysis: weakSerpAnalysis,
  serpResults: weakSerpResults,
};

describe("Opportunity Analysis Agent", () => {
  it("uses safe JSON completion through an injected LLM client", async () => {
    const client = new QueueLlmClient([
      completionSuccess(JSON.stringify(validLlmOpportunity())),
    ]);

    const opportunity = await analyzeOpportunity(baseInput, { llmClient: client });

    assert.equal(opportunity.title, "Steam Short Description Generator");
    assert.equal(opportunity.recommendedToolType, "generator");
    assert.equal(opportunity.monetization.primary, "paid_export");
    assert.equal(opportunity.scoreHints.intentScore, 92);
    assert.equal(opportunity.risk.level, "low");

    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0]?.responseFormat?.type, "json_object");
    assert.match(client.calls[0]?.messages[0]?.content ?? "", /AI microtool opportunity analyst/);
    assert.match(client.calls[0]?.messages[1]?.content ?? "", /SERP weakness analysis/);
    assert.match(client.calls[0]?.messages[1]?.content ?? "", /Do not promise revenue/);
    assert.match(client.calls[0]?.messages[1]?.content ?? "", /legal\/tax\/medical\/financial/);
    assert.match(client.calls[0]?.messages[1]?.content ?? "", /Prompt version: 2026-06-28-v1/);
  });

  it("falls back to deterministic heuristics when LLM output cannot be repaired", async () => {
    const client = new QueueLlmClient([
      completionSuccess('{"title":'),
      completionSuccess('{"title":"Missing required fields"}'),
    ]);

    const opportunity = await analyzeOpportunity(baseInput, { llmClient: client });
    const fallback = generateHeuristicOpportunityAnalysis(baseInput);

    assert.equal(client.calls.length, 2);
    assert.deepEqual(opportunity, fallback);
    assert.equal(opportunity.title, "Steam Short Description Generator");
    assert.equal(opportunity.recommendedToolType, "generator");
  });

  it("clamps and normalizes score hints from LLM output", async () => {
    const client = new QueueLlmClient([
      completionSuccess(JSON.stringify(validLlmOpportunity({
        scoreHints: {
          intentScore: 0.92,
          monetizationScore: 140,
          toolabilityScore: -10,
          userFitScore: 0.5,
          buildSpeedScore: 65.4,
          riskPenalty: 200,
        },
      }))),
    ]);

    const opportunity = await analyzeOpportunity(baseInput, { llmClient: client });

    assert.equal(normalizeOpportunityScoreHint(0.78), 78);
    assert.equal(normalizeOpportunityScoreHint(-25), 0);
    assert.equal(normalizeOpportunityScoreHint(140), 100);
    assert.deepEqual(opportunity.scoreHints, {
      intentScore: 92,
      monetizationScore: 100,
      toolabilityScore: 0,
      userFitScore: 50,
      buildSpeedScore: 65,
      riskPenalty: 100,
    });
  });

  it("sanitizes LLM output that promises revenue, ranking, compliance, or business results", async () => {
    const client = new QueueLlmClient([
      completionSuccess(JSON.stringify(validLlmOpportunity({
        summary: "This will guarantee revenue and rank #1 in Google for indie developers.",
        toolConcept: {
          ...validLlmOpportunity().toolConcept,
          oneLiner: "Generate copy that will ensure business results.",
        },
        risk: {
          level: "low",
          notes: "This will guarantee business results.",
        },
      }))),
    ]);

    const opportunity = await analyzeOpportunity(baseInput, { llmClient: client });
    const serialized = JSON.stringify(opportunity);

    assert.equal(opportunity.risk.level, "medium");
    assert.doesNotMatch(serialized, /guarantee/i);
    assert.doesNotMatch(serialized, /rank #?1/i);
    assert.doesNotMatch(serialized, /will[^.]*revenue/i);
    assert.doesNotMatch(serialized, /will[^.]*business results/i);
  });

  it("applies excluded and regulated-topic risk guardrails", async () => {
    const gamblingOpportunity = await analyzeOpportunity({
      ...baseInput,
      keywordCandidate: {
        ...baseInput.keywordCandidate,
        keyword: "sports betting odds calculator",
        intentType: "calculator",
        toolTypeGuess: "calculator",
      },
    });

    assert.equal(gamblingOpportunity.risk.level, "excluded");
    assert.equal(gamblingOpportunity.recommendedToolType, "other");
    assert.equal(gamblingOpportunity.monetization.primary, "none");
    assert.equal(gamblingOpportunity.scoreHints.riskPenalty, 100);
    assert.match(gamblingOpportunity.killCriteria.join(" "), /excluded/);

    const taxOpportunity = await analyzeOpportunity({
      ...baseInput,
      radarTask: {
        ...baseInput.radarTask,
        excludedTopics: ["adult", "gambling"],
        riskPreferences: {
          maxRisk: "high",
          avoidYMYLConclusions: true,
        },
      },
      keywordCandidate: {
        ...baseInput.keywordCandidate,
        keyword: "sales tax compliance calculator",
        intentType: "calculator",
        toolTypeGuess: "calculator",
      },
    });

    assert.equal(taxOpportunity.risk.level, "high");
    assert.equal(taxOpportunity.recommendedToolType, "checklist");
    assert.match(taxOpportunity.toolConcept.oneLiner, /self-assessment|checklist|non-advice/i);
    assert.match(taxOpportunity.toolConcept.outputModules.join(" "), /non-advice self-assessment checklist/);
    assert.match(taxOpportunity.killCriteria.join(" "), /Do not provide definitive legal, tax, medical, or financial advice/);
  });

  it("applies guardrails to unsafe or regulated topics introduced only by LLM output", async () => {
    const gamblingClient = new QueueLlmClient([
      completionSuccess(JSON.stringify(validLlmOpportunity({
        title: "Sports Betting Odds Calculator",
        summary: "A calculator for comparing sports betting odds.",
        recommendedToolType: "calculator",
        toolConcept: {
          ...validLlmOpportunity().toolConcept,
          oneLiner: "Enter odds and get a betting comparison table.",
        },
        risk: {
          level: "low",
          notes: "No regulated advice detected.",
        },
      }))),
    ]);

    const gamblingOpportunity = await analyzeOpportunity(baseInput, {
      llmClient: gamblingClient,
    });

    assert.equal(gamblingOpportunity.risk.level, "excluded");
    assert.equal(gamblingOpportunity.recommendedToolType, "other");
    assert.equal(gamblingOpportunity.monetization.primary, "none");
    assert.equal(gamblingOpportunity.scoreHints.riskPenalty, 100);
    assert.match(gamblingOpportunity.risk.notes, /gambling|betting/i);

    const regulatedClient = new QueueLlmClient([
      completionSuccess(JSON.stringify(validLlmOpportunity({
        title: "Website Legal Compliance Checker",
        summary: "A checker for website legal compliance tasks.",
        recommendedToolType: "checker",
        toolConcept: {
          ...validLlmOpportunity().toolConcept,
          oneLiner: "Paste website details and check legal compliance requirements.",
        },
        risk: {
          level: "low",
          notes: "No regulated advice detected.",
        },
      }))),
    ]);

    const regulatedOpportunity = await analyzeOpportunity(baseInput, {
      llmClient: regulatedClient,
    });

    assert.equal(regulatedOpportunity.risk.level, "high");
    assert.equal(regulatedOpportunity.recommendedToolType, "checklist");
    assert.match(regulatedOpportunity.toolConcept.oneLiner, /self-assessment|checklist|non-advice/i);
    assert.ok(regulatedOpportunity.scoreHints.riskPenalty >= 60);
    assert.match(regulatedOpportunity.killCriteria.join(" "), /Do not provide definitive legal, tax, medical, or financial advice/);
  });

  it("does not let no-code product phrasing suppress output-only unsafe or regulated topics", async () => {
    const noCodeGamblingClient = new QueueLlmClient([
      completionSuccess(JSON.stringify(validLlmOpportunity({
        title: "No-code Sports Betting Odds Calculator",
        summary: "A no-code calculator for sports betting odds comparisons.",
        recommendedToolType: "calculator",
        toolConcept: {
          ...validLlmOpportunity().toolConcept,
          oneLiner: "Build a no-code betting odds calculator from simple inputs.",
        },
        risk: {
          level: "low",
          notes: "No regulated advice detected.",
        },
      }))),
    ]);

    const noCodeGamblingOpportunity = await analyzeOpportunity(baseInput, {
      llmClient: noCodeGamblingClient,
    });

    assert.equal(noCodeGamblingOpportunity.risk.level, "excluded");
    assert.equal(noCodeGamblingOpportunity.recommendedToolType, "other");
    assert.equal(noCodeGamblingOpportunity.monetization.primary, "none");
    assert.match(noCodeGamblingOpportunity.risk.notes, /gambling|betting/i);

    const noCodeLegalClient = new QueueLlmClient([
      completionSuccess(JSON.stringify(validLlmOpportunity({
        title: "No-code Legal Compliance Checker",
        summary: "A no-code checker for legal compliance workflows.",
        recommendedToolType: "checker",
        toolConcept: {
          ...validLlmOpportunity().toolConcept,
          oneLiner: "Create a no-code legal compliance checker from site details.",
        },
        risk: {
          level: "low",
          notes: "No regulated advice detected.",
        },
      }))),
    ]);

    const noCodeLegalOpportunity = await analyzeOpportunity(baseInput, {
      llmClient: noCodeLegalClient,
    });

    assert.equal(noCodeLegalOpportunity.risk.level, "high");
    assert.equal(noCodeLegalOpportunity.recommendedToolType, "checklist");
    assert.match(noCodeLegalOpportunity.toolConcept.oneLiner, /self-assessment|checklist|non-advice/i);
    assert.ok(noCodeLegalOpportunity.scoreHints.riskPenalty >= 60);
  });

  it("ignores explicit safety-policy topic mentions without treating no-code as negation", async () => {
    const client = new QueueLlmClient([
      completionSuccess(JSON.stringify(validLlmOpportunity({
        killCriteria: [
          "Do not build gambling tools.",
          "Avoid legal compliance guarantees.",
        ],
      }))),
    ]);

    const opportunity = await analyzeOpportunity(baseInput, { llmClient: client });

    assert.equal(opportunity.risk.level, "low");
    assert.equal(opportunity.recommendedToolType, "generator");
  });

  it("infers monetization and user fit from the radar profile", async () => {
    const opportunity = await analyzeOpportunity(baseInput);

    assert.equal(opportunity.monetization.primary, "paid_export");
    assert.ok(opportunity.monetization.secondary.includes("ads"));
    assert.ok(opportunity.monetization.secondary.includes("affiliate"));
    assert.match(opportunity.targetUser, /indie developers/i);
    assert.ok(opportunity.scoreHints.userFitScore >= 82);
  });

  it("returns deterministic fallback output without an LLM client", async () => {
    const firstRun = await analyzeOpportunity(baseInput);
    const secondRun = await analyzeOpportunity(baseInput);
    const directFallback = generateHeuristicOpportunityAnalysis(baseInput);

    assert.deepEqual(secondRun, firstRun);
    assert.deepEqual(directFallback, firstRun);
    assert.equal(firstRun.title, "Steam Short Description Generator");
    assert.equal(firstRun.summary.length > 0, true);
    assert.equal(firstRun.toolConcept.inputFields.length > 0, true);
    assert.equal(firstRun.killCriteria.length > 0, true);
  });
});

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

function validLlmOpportunity(
  overrides: Partial<OpportunityAnalysisOutput> = {},
): OpportunityAnalysisOutput {
  const base: OpportunityAnalysisOutput = {
    title: "  Steam Short Description Generator  ",
    summary: "A focused generator for indie developers preparing Steam store pages.",
    targetUser: "Solo indie developers preparing a Steam page.",
    searchIntent: "The user wants usable Steam short description copy, not a generic guide.",
    recommendedToolType: "generator",
    toolConcept: {
      oneLiner: "Input your game hook and genre, get 3 Steam-ready short descriptions.",
      inputFields: ["game genre", "gameplay hook", "tone", "target audience", "word limit"],
      outputModules: ["3 short description versions", "tagline", "tag suggestions", "common mistakes"],
    },
    monetization: {
      primary: "paid_export",
      secondary: ["ads", "affiliate"],
      paidExportIdea: "Steam Page Fix Pack export.",
    },
    risk: {
      level: "low",
      notes: "No regulated advice. Avoid outcome claims.",
    },
    buildComplexity: "low",
    scoreHints: {
      intentScore: 0.92,
      monetizationScore: 76,
      toolabilityScore: 95,
      userFitScore: 90,
      buildSpeedScore: 95,
      riskPenalty: 8,
    },
    killCriteria: [
      "Discard if manual SERP review finds 3+ strong existing generators.",
      "Do not claim assured wishlist or ranking results.",
    ],
  };

  return {
    ...base,
    ...overrides,
    toolConcept: {
      ...base.toolConcept,
      ...overrides.toolConcept,
    },
    monetization: {
      ...base.monetization,
      ...overrides.monetization,
    },
    risk: {
      ...base.risk,
      ...overrides.risk,
    },
    scoreHints: {
      ...base.scoreHints,
      ...overrides.scoreHints,
    },
  };
}
