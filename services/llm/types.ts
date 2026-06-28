export const LLM_CHAT_ROLES = ["system", "user", "assistant"] as const;

export type LlmChatRole = (typeof LLM_CHAT_ROLES)[number];

export type LlmChatMessage = {
  role: LlmChatRole;
  content: string;
  name?: string;
};

export type LlmResponseFormat = {
  type: "json_object" | "text";
};

export type LlmChatCompletionInput = {
  messages: LlmChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: LlmResponseFormat;
};

export type LlmTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type LlmCompletionErrorCode =
  | "invalid_request"
  | "transport_error"
  | "http_error"
  | "invalid_response";

export type LlmCompletionError = {
  code: LlmCompletionErrorCode;
  message: string;
  status?: number;
  details?: unknown;
};

export type LlmChatCompletionSuccess = {
  ok: true;
  content: string;
  model: string;
  finishReason?: string;
  usage?: LlmTokenUsage;
  raw: unknown;
};

export type LlmChatCompletionFailure = {
  ok: false;
  error: LlmCompletionError;
  raw?: unknown;
};

export type LlmChatCompletionResult =
  | LlmChatCompletionSuccess
  | LlmChatCompletionFailure;

export interface LlmClient {
  complete(input: LlmChatCompletionInput): Promise<LlmChatCompletionResult>;
}

export class LlmConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigurationError";
  }
}
