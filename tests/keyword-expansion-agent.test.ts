import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateKeywordCandidates,
  generateMockKeywordCandidates,
  KEYWORD_EXPANSION_DEFAULT_COUNT,
  KEYWORD_EXPANSION_MAX_COUNT,
} from "../agents";
import type { KeywordExpansionInput } from "../agents";
import type {
  LlmChatCompletionInput,
  LlmChatCompletionResult,
  LlmClient,
} from "../services/llm";

const baseInput: KeywordExpansionInput = {
  domainDescription: "Steam, Unity, indie game launch microtools",
  seedExamples: [
    "steam description generator",
    "game localization cost calculator",
  ],
  countries: ["us"],
  languages: ["EN"],
  userAdvantages: ["GameDev", "AI automation"],
  monetizationPreferences: ["ads", "affiliate"],
  excludedTopics: ["medical", "adult", "gambling"],
};

describe("Keyword Expansion Agent", () => {
  it("uses safe JSON completion through an injected LLM client and normalizes valid candidates", async () => {
    const client = new QueueLlmClient([
      completionSuccess(JSON.stringify({
        candidates: [
          {
            keyword: "  Steam Short Description Generator  ",
            country: "us",
            language: "EN",
            intentType: "generator",
            toolTypeGuess: "generator",
            rationale: "  Strong task keyword for indie developers preparing Steam pages.  ",
          },
          {
            keyword: "Unity localization checklist",
            country: "JP",
            language: "ja",
            intentType: "checklist",
            toolTypeGuess: "checklist",
            rationale: "Localized launch workflow that can become a compact checklist.",
          },
        ],
      })),
    ]);

    const candidates = await generateKeywordCandidates(
      { ...baseInput, requestedCount: 2 },
      { llmClient: client },
    );

    assert.equal(candidates.length, 2);
    assert.deepEqual(candidates[0], {
      keyword: "steam short description generator",
      country: "US",
      language: "en",
      intentType: "generator",
      toolTypeGuess: "generator",
      rationale: "Strong task keyword for indie developers preparing Steam pages.",
    });
    assert.equal(candidates[1]?.keyword, "unity localization checklist");

    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0]?.responseFormat?.type, "json_object");
    assert.match(client.calls[0]?.messages[0]?.content ?? "", /search opportunity researcher/);
    assert.match(client.calls[0]?.messages[1]?.content ?? "", /Return 2 candidates/);
    assert.match(client.calls[0]?.messages[1]?.content ?? "", /Avoid excluded topics/);
  });

  it("falls back to deterministic mock candidates when LLM output cannot be repaired", async () => {
    const client = new QueueLlmClient([
      completionSuccess('{"candidates": ['),
      completionSuccess('{"candidates":[{"keyword":"adult calculator"}]}'),
    ]);

    const candidates = await generateKeywordCandidates(
      { ...baseInput, requestedCount: KEYWORD_EXPANSION_DEFAULT_COUNT },
      { llmClient: client },
    );

    assert.equal(client.calls.length, 2);
    assert.equal(candidates.length, KEYWORD_EXPANSION_DEFAULT_COUNT);
    assert.deepEqual(candidates[0], {
      keyword: "steam description generator",
      country: "US",
      language: "en",
      intentType: "generator",
      toolTypeGuess: "generator",
      rationale: "Task-oriented generator keyword for US/en searchers that can become a focused generator microtool within 48 hours.",
    });
  });

  it("filters configured excluded topics with a case-insensitive guard", async () => {
    const client = new QueueLlmClient([
      completionSuccess(JSON.stringify({
        candidates: [
          {
            keyword: "Adult policy generator",
            country: "US",
            language: "en",
            intentType: "generator",
            toolTypeGuess: "generator",
            rationale: "Unsafe adult topic should be removed.",
          },
          {
            keyword: "gambling odds calculator",
            country: "US",
            language: "en",
            intentType: "calculator",
            toolTypeGuess: "calculator",
            rationale: "Gambling topic should be removed.",
          },
          {
            keyword: "steam festival checklist",
            country: "US",
            language: "en",
            intentType: "checklist",
            toolTypeGuess: "checklist",
            rationale: "Safe launch workflow for a focused microtool.",
          },
        ],
      })),
    ]);

    const candidates = await generateKeywordCandidates(
      {
        ...baseInput,
        excludedTopics: ["ADULT", "Gambling"],
        requestedCount: 3,
      },
      { llmClient: client },
    );

    assert.equal(candidates.length, 3);
    assert.equal(candidates[0]?.keyword, "steam festival checklist");

    for (const candidate of candidates) {
      const searchable = `${candidate.keyword} ${candidate.rationale}`;

      assert.doesNotMatch(searchable, /adult/i);
      assert.doesNotMatch(searchable, /gambling/i);
    }
  });

  it("returns deterministic fallback output without an LLM client", async () => {
    const firstRun = await generateKeywordCandidates(baseInput);
    const secondRun = await generateKeywordCandidates(baseInput);
    const directMockRun = generateMockKeywordCandidates(baseInput);

    assert.equal(firstRun.length, KEYWORD_EXPANSION_DEFAULT_COUNT);
    assert.deepEqual(secondRun, firstRun);
    assert.deepEqual(directMockRun, firstRun);
  });

  it("honors requested count limits for generated candidates", async () => {
    const threeCandidates = await generateKeywordCandidates({
      ...baseInput,
      requestedCount: 3,
    });
    const zeroCandidates = await generateKeywordCandidates({
      ...baseInput,
      requestedCount: 0,
    });
    const cappedCandidates = generateMockKeywordCandidates(baseInput, 999);

    assert.equal(threeCandidates.length, 3);
    assert.equal(zeroCandidates.length, 0);
    assert.equal(cappedCandidates.length, KEYWORD_EXPANSION_MAX_COUNT);
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
