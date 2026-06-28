import type {
  LlmChatCompletionInput,
  LlmChatCompletionResult,
  LlmClient,
  LlmCompletionError,
  LlmResponseFormat,
  LlmTokenUsage,
} from "./types";
import { LlmConfigurationError } from "./types";

export type FetchImplementation = (url: string, init: RequestInit) => Promise<Response>;

export type OpenAICompatibleClientConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImplementation?: FetchImplementation;
};

type OpenAIChatRequestBody = {
  model: string;
  messages: LlmChatCompletionInput["messages"];
  temperature?: number;
  max_tokens?: number;
  response_format?: LlmResponseFormat;
};

export class OpenAICompatibleClient implements LlmClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImplementation: FetchImplementation;

  constructor(config: OpenAICompatibleClientConfig) {
    this.baseUrl = requireNonEmpty("baseUrl", config.baseUrl).replace(/\/+$/g, "");
    this.apiKey = requireNonEmpty("apiKey", config.apiKey);
    this.model = requireNonEmpty("model", config.model);

    const fetchImplementation = config.fetchImplementation ?? globalThis.fetch?.bind(globalThis);

    if (!fetchImplementation) {
      throw new LlmConfigurationError(
        "OpenAICompatibleClient requires a fetch implementation in this runtime.",
      );
    }

    this.fetchImplementation = fetchImplementation;
  }

  async complete(input: LlmChatCompletionInput): Promise<LlmChatCompletionResult> {
    if (input.messages.length === 0) {
      return completionFailure({
        code: "invalid_request",
        message: "LLM completion requires at least one chat message.",
      });
    }

    const requestBody = buildRequestBody(input, this.model);

    let response: Response;

    try {
      response = await this.fetchImplementation(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      return completionFailure({
        code: "transport_error",
        message: "LLM completion request failed before a response was received.",
        details: getErrorMessage(error),
      });
    }

    if (!response.ok) {
      return completionFailure({
        code: "http_error",
        message: `LLM provider returned HTTP ${response.status}.`,
        status: response.status,
        details: { providerError: true },
      });
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch (error) {
      return completionFailure({
        code: "invalid_response",
        message: "LLM provider response was not valid JSON.",
        details: getErrorMessage(error),
      });
    }

    return parseOpenAIChatCompletion(payload);
  }
}

function buildRequestBody(
  input: LlmChatCompletionInput,
  defaultModel: string,
): OpenAIChatRequestBody {
  const requestBody: OpenAIChatRequestBody = {
    model: normalizeModel(input.model) ?? defaultModel,
    messages: input.messages,
  };

  if (input.temperature !== undefined) {
    requestBody.temperature = input.temperature;
  }

  if (input.maxTokens !== undefined) {
    requestBody.max_tokens = input.maxTokens;
  }

  if (input.responseFormat !== undefined) {
    requestBody.response_format = input.responseFormat;
  }

  return requestBody;
}

function parseOpenAIChatCompletion(payload: unknown): LlmChatCompletionResult {
  if (!isRecord(payload)) {
    return invalidProviderResponse("LLM provider response must be a JSON object.", payload);
  }

  const choices = payload.choices;

  if (!Array.isArray(choices) || choices.length === 0 || !isRecord(choices[0])) {
    return invalidProviderResponse("LLM provider response did not include choices.", payload);
  }

  const [firstChoice] = choices;
  const message = firstChoice.message;

  if (!isRecord(message) || typeof message.content !== "string") {
    return invalidProviderResponse(
      "LLM provider response did not include assistant text content.",
      payload,
    );
  }

  const model = typeof payload.model === "string" && payload.model.trim().length > 0
    ? payload.model
    : "unknown";
  const finishReason = typeof firstChoice.finish_reason === "string"
    ? firstChoice.finish_reason
    : undefined;

  return {
    ok: true,
    content: message.content,
    model,
    finishReason,
    usage: parseUsage(payload.usage),
    raw: payload,
  };
}

function parseUsage(value: unknown): LlmTokenUsage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const usage: LlmTokenUsage = {
    promptTokens: optionalNumber(value.prompt_tokens),
    completionTokens: optionalNumber(value.completion_tokens),
    totalTokens: optionalNumber(value.total_tokens),
  };

  if (
    usage.promptTokens === undefined &&
    usage.completionTokens === undefined &&
    usage.totalTokens === undefined
  ) {
    return undefined;
  }

  return usage;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function invalidProviderResponse(
  message: string,
  payload: unknown,
): LlmChatCompletionResult {
  return completionFailure(
    {
      code: "invalid_response",
      message,
    },
    payload,
  );
}

function completionFailure(
  error: LlmCompletionError,
  raw?: unknown,
): LlmChatCompletionResult {
  return {
    ok: false,
    error,
    raw,
  };
}

function requireNonEmpty(name: keyof OpenAICompatibleClientConfig, value: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new LlmConfigurationError(`OpenAICompatibleClient requires ${name}.`);
  }

  return normalized;
}

function normalizeModel(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
