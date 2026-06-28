import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMvpSpecMessages,
  generateMvpSpec,
  MVP_SPEC_LOCAL_MODEL,
} from "../agents";
import type {
  MvpSpecOpportunityInput,
  MvpSpecSafeJsonCompletion,
} from "../agents";
import type {
  LlmChatCompletionInput,
  LlmChatCompletionResult,
  LlmClient,
} from "../services/llm";

const opportunity: MvpSpecOpportunityInput = {
  id: "opportunity_1",
  keyword: "steam short description generator",
  title: "Steam Short Description Generator",
  summary: "A narrow generator for indie developers preparing Steam store pages.",
  toolType: "generator",
  toolTypeLabel: "Generator",
  marketLabel: "EN / US",
  targetUser: "Solo indie developers",
  searchIntent: "The user wants usable Steam short description copy, not a generic guide.",
  serpWeaknessSummary: "Top results are generic articles and community threads; no focused generator appears.",
  monetizationSummary: "Primary: paid_export. Secondary options: ads and affiliate.",
  monetizationTypes: ["Paid Export", "Ads", "Affiliate"],
  riskSummary: "Low: No regulated advice detected. Avoid outcome promises.",
  riskLabel: "Low risk",
  buildComplexityLabel: "Low",
  totalScore: 88,
  radarTask: {
    id: "task_game",
    name: "GameDev Microtools",
  },
  scoreBreakdownItems: [
    {
      label: "Intent",
      value: 92,
      explanation: "Search intent is explicit and task oriented.",
    },
  ],
  toolConcept: {
    oneLiner: "Input your game hook and genre, get Steam-ready short descriptions.",
    inputFields: ["Game genre", "Gameplay hook", "Tone"],
    outputModules: ["Description variants", "Tagline", "Common mistakes"],
  },
  toolabilitySummary: "Generate a focused copy draft from simple launch inputs.",
  killCriteria: [
    "Discard if manual SERP review finds 3+ strong existing generators.",
  ],
};

describe("MVP Spec Agent", () => {
  it("generates deterministic Codex-ready Markdown from an opportunity detail view model", async () => {
    const result = await generateMvpSpec(opportunity);

    assert.equal(result.generatedByModel, MVP_SPEC_LOCAL_MODEL);
    assert.match(result.markdown, /^# MVP Spec: Steam Short Description Generator/);
    assert.match(result.markdown, /## Page Structure/);
    assert.match(result.markdown, /## Form Fields/);
    assert.match(result.markdown, /Game genre \(text, required\)/);
    assert.match(result.markdown, /## Data Model/);
    assert.match(result.markdown, /Input payload/);
    assert.match(result.markdown, /## API Routes/);
    assert.match(result.markdown, /POST \/api\/steam-short-description-generator\/generate/);
    assert.match(result.markdown, /## Monetization Entry Points/);
    assert.match(result.markdown, /Paid export/);
    assert.match(result.markdown, /## Risk Notes/);
    assert.match(result.markdown, /Low risk/);
    assert.match(result.markdown, /## 48-Hour Build Checklist/);
    assert.match(result.markdown, /## Acceptance Criteria/);
    assert.match(result.markdown, /## Kill Criteria/);
    assert.match(result.markdown, /48-hour MVP scope/);
  });

  it("builds LLM messages without requiring provider configuration", () => {
    const messages = buildMvpSpecMessages(opportunity);

    assert.equal(messages[0]?.role, "system");
    assert.match(messages[0]?.content ?? "", /senior product spec writer/);
    assert.match(messages[1]?.content ?? "", /Opportunity detail view model/);
    assert.match(messages[1]?.content ?? "", /Page Structure/);
    assert.match(messages[1]?.content ?? "", /Data Model/);
    assert.match(messages[1]?.content ?? "", /48-Hour Build Checklist/);
    assert.match(messages[1]?.content ?? "", /Do not promise revenue/);
    assert.match(messages[1]?.content ?? "", /Prompt version: 2026-06-28-v1/);
  });

  it("uses injected safe JSON completion when an LLM client is supplied", async () => {
    const client = new QueueLlmClient([]);
    const calls: unknown[] = [];
    const safeJson: MvpSpecSafeJsonCompletion = async (input) => {
      calls.push(input);

      return {
        ok: true,
        data: {
          markdown: injectedMarkdown(),
        },
        rawText: JSON.stringify({ markdown: injectedMarkdown() }),
        jsonText: JSON.stringify({ markdown: injectedMarkdown() }),
        repaired: false,
      };
    };

    const result = await generateMvpSpec(opportunity, {
      llmClient: client,
      safeJsonCompletion: safeJson,
      model: "fake-mvp-model",
    });
    const firstCall = calls[0] as {
      client: LlmClient;
      model?: string;
      responseFormat?: { type: string };
    };

    assert.equal(result.generatedByModel, "fake-mvp-model");
    assert.match(result.markdown, /Injected MVP Spec/);
    assert.equal(calls.length, 1);
    assert.equal(firstCall.client, client);
    assert.equal(firstCall.model, "fake-mvp-model");
    assert.deepEqual(firstCall.responseFormat, { type: "json_object" });
    assert.equal(client.calls.length, 0);
  });

  it("falls back to deterministic local generation when injected completion fails", async () => {
    const safeJson: MvpSpecSafeJsonCompletion = async () => ({
      ok: false,
      error: {
        code: "completion_failed",
        message: "provider failed with sk-secret and raw prompt",
      },
      repairAttempted: false,
    });

    const result = await generateMvpSpec(opportunity, {
      llmClient: new QueueLlmClient([]),
      safeJsonCompletion: safeJson,
    });

    assert.equal(result.generatedByModel, MVP_SPEC_LOCAL_MODEL);
    assert.match(result.markdown, /Steam Short Description Generator/);
    assert.doesNotMatch(result.markdown, /sk-secret|raw prompt/);
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

function injectedMarkdown(): string {
  return [
    "# Injected MVP Spec",
    "",
    "## Opportunity Context",
    "- Keyword: steam short description generator",
    "",
    "## Page Structure",
    "- `/`: Tool workspace.",
    "",
    "## Form Fields",
    "- Game genre (text, required)",
    "",
    "## Data Model",
    "- Input payload: `gameGenre`.",
    "- Result modules: `descriptionVariants`.",
    "",
    "## API Routes",
    "- `POST /api/steam-short-description-generator/generate`: Generate output.",
    "",
    "## Result Behavior",
    "- Render variants.",
    "",
    "## Monetization Entry Points",
    "- Paid export after useful free result.",
    "",
    "## Risk Notes",
    "- Avoid outcome promises.",
    "",
    "## 48-Hour Build Checklist",
    "- Build the form, API route, tests, and smoke sample.",
    "",
    "## Acceptance Criteria",
    "- Form renders and returns generated results.",
    "",
    "## Kill Criteria",
    "- Kill if focused tools already dominate the SERP.",
  ].join("\n");
}
