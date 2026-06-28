import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import {
  extractJsonText,
  LlmConfigurationError,
  OpenAICompatibleClient,
  safeJsonCompletion,
} from "../services/llm";
import type {
  FetchImplementation,
  LlmChatCompletionInput,
  LlmChatCompletionResult,
  LlmClient,
} from "../services/llm";

const opportunitySchema = z.object({
  title: z.string(),
  score: z.number(),
});

describe("safeJsonCompletion", () => {
  it("returns validated data for valid assistant JSON", async () => {
    const client = new QueueLlmClient([
      completionSuccess('{"title":"Steam Tool","score":91}'),
    ]);

    const result = await safeJsonCompletion({
      client,
      schema: opportunitySchema,
      messages: [{ role: "user", content: "Return JSON." }],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.deepEqual(result.data, {
        title: "Steam Tool",
        score: 91,
      });
      assert.equal(result.repaired, false);
      assert.equal(result.jsonText, '{"title":"Steam Tool","score":91}');
    }

    assert.equal(client.calls.length, 1);
  });

  it("extracts plain JSON and single fenced JSON while rejecting prose-wrapped output", () => {
    assert.deepEqual(extractJsonText('{"ok":true}'), {
      ok: true,
      jsonText: '{"ok":true}',
    });
    assert.deepEqual(extractJsonText('```json\n{"ok":true}\n```'), {
      ok: true,
      jsonText: '{"ok":true}',
    });

    const proseWrapped = extractJsonText('Here is the JSON:\n```json\n{"ok":true}\n```');

    assert.equal(proseWrapped.ok, false);
  });

  it("repairs malformed JSON with one follow-up completion", async () => {
    const client = new QueueLlmClient([
      completionSuccess('{"title":"Broken",'),
      completionSuccess('```json\n{"title":"Fixed","score":88}\n```'),
    ]);

    const result = await safeJsonCompletion({
      client,
      schema: opportunitySchema,
      schemaDescription: '{ "title": "string", "score": number }',
      messages: [{ role: "user", content: "Return opportunity JSON." }],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.deepEqual(result.data, {
        title: "Fixed",
        score: 88,
      });
      assert.equal(result.repaired, true);
      assert.equal(result.rawText, '{"title":"Broken",');
      assert.equal(result.repairRawText, '```json\n{"title":"Fixed","score":88}\n```');
    }

    assert.equal(client.calls.length, 2);
    assert.match(client.calls[1]?.messages[1]?.content ?? "", /Invalid output:\n\{"title":"Broken",/);
  });

  it("returns structured failure when validation and repair both fail", async () => {
    const client = new QueueLlmClient([
      completionSuccess('{"title":"Missing score"}'),
      completionSuccess('{"title":10,"score":"high"}'),
    ]);

    const result = await safeJsonCompletion({
      client,
      schema: opportunitySchema,
      messages: [{ role: "user", content: "Return opportunity JSON." }],
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, "repair_failed");
      assert.equal(result.error.initialFailure?.code, "schema_validation_failed");
      assert.equal(result.error.repairFailure?.code, "schema_validation_failed");
      assert.equal(result.repairAttempted, true);
      assert.equal(result.rawText, '{"title":"Missing score"}');
      assert.equal(result.repairRawText, '{"title":10,"score":"high"}');
    }

    assert.equal(client.calls.length, 2);
  });
});

describe("OpenAICompatibleClient", () => {
  it("fails fast when explicit configuration is missing", () => {
    assert.throws(
      () => new OpenAICompatibleClient({ baseUrl: "", apiKey: "key", model: "model" }),
      LlmConfigurationError,
    );
    assert.throws(
      () => new OpenAICompatibleClient({ baseUrl: "https://example.test/v1", apiKey: "", model: "model" }),
      LlmConfigurationError,
    );
    assert.throws(
      () => new OpenAICompatibleClient({ baseUrl: "https://example.test/v1", apiKey: "key", model: "" }),
      LlmConfigurationError,
    );
  });

  it("sends OpenAI-compatible chat request shape through injected fetch only", async () => {
    const fetchCalls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch: FetchImplementation = async (url, init) => {
      fetchCalls.push({ url, init });

      return new Response(JSON.stringify({
        id: "chatcmpl_test",
        model: "test-model",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: '{"ok":true}',
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 4,
          completion_tokens: 6,
          total_tokens: 10,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = new OpenAICompatibleClient({
      baseUrl: "https://llm.example.test/v1/",
      apiKey: "test-api-key",
      model: "test-model",
      fetchImplementation: fakeFetch,
    });

    const result = await client.complete({
      messages: [{ role: "user", content: "Return JSON." }],
      temperature: 0.2,
      maxTokens: 128,
      responseFormat: { type: "json_object" },
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.content, '{"ok":true}');
      assert.equal(result.model, "test-model");
      assert.equal(result.finishReason, "stop");
      assert.deepEqual(result.usage, {
        promptTokens: 4,
        completionTokens: 6,
        totalTokens: 10,
      });
    }

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0]?.url, "https://llm.example.test/v1/chat/completions");
    assert.equal(fetchCalls[0]?.init.method, "POST");
    assert.deepEqual(fetchCalls[0]?.init.headers, {
      Authorization: "Bearer test-api-key",
      "Content-Type": "application/json",
    });
    assert.deepEqual(JSON.parse(String(fetchCalls[0]?.init.body)), {
      model: "test-model",
      messages: [{ role: "user", content: "Return JSON." }],
      temperature: 0.2,
      max_tokens: 128,
      response_format: { type: "json_object" },
    });
  });

  it("does not expose provider HTTP error bodies in structured errors", async () => {
    const leakedProviderBody = JSON.stringify({
      error: "invalid_api_key",
      apiKey: "sk-test-secret-do-not-leak",
      prompt: "request material should stay private",
    });
    const fakeFetch: FetchImplementation = async () => new Response(leakedProviderBody, {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
    const client = new OpenAICompatibleClient({
      baseUrl: "https://llm.example.test/v1",
      apiKey: "test-api-key",
      model: "test-model",
      fetchImplementation: fakeFetch,
    });

    const result = await client.complete({
      messages: [{ role: "user", content: "Do not leak this request material." }],
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, "http_error");
      assert.equal(result.error.status, 401);
      assert.deepEqual(result.error.details, { providerError: true });

      const serializedError = JSON.stringify(result.error);

      assert.doesNotMatch(serializedError, /sk-test-secret-do-not-leak/);
      assert.doesNotMatch(serializedError, /request material should stay private/);
      assert.doesNotMatch(serializedError, /invalid_api_key/);
    }
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
