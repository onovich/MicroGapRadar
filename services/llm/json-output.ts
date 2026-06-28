import type { z } from "zod";

import type {
  LlmChatCompletionInput,
  LlmChatMessage,
  LlmClient,
  LlmCompletionError,
} from "./types";

export type JsonExtractionResult =
  | {
      ok: true;
      jsonText: string;
    }
  | {
      ok: false;
      message: string;
    };

export type JsonOutputFailureCode =
  | "json_extraction_failed"
  | "json_parse_failed"
  | "schema_validation_failed";

export type JsonOutputFailure = {
  code: JsonOutputFailureCode;
  message: string;
  rawText: string;
  jsonText?: string;
  issues?: z.ZodIssue[];
};

export type SafeJsonCompletionErrorCode =
  | "completion_failed"
  | "repair_completion_failed"
  | "repair_failed";

export type SafeJsonCompletionSuccess<TData> = {
  ok: true;
  data: TData;
  rawText: string;
  jsonText: string;
  repaired: boolean;
  repairRawText?: string;
};

export type SafeJsonCompletionFailure = {
  ok: false;
  error: {
    code: SafeJsonCompletionErrorCode;
    message: string;
    initialFailure?: JsonOutputFailure;
    repairFailure?: JsonOutputFailure;
    completionError?: LlmCompletionError;
  };
  rawText?: string;
  repairRawText?: string;
  repairAttempted: boolean;
};

export type SafeJsonCompletionResult<TData> =
  | SafeJsonCompletionSuccess<TData>
  | SafeJsonCompletionFailure;

export type SafeJsonCompletionInput<TSchema extends z.ZodType> =
  Omit<LlmChatCompletionInput, "messages"> & {
    client: LlmClient;
    messages: LlmChatMessage[];
    schema: TSchema;
    schemaDescription?: string;
    repairTemperature?: number;
  };

type JsonValidationResult<TData> =
  | {
      ok: true;
      data: TData;
      jsonText: string;
    }
  | {
      ok: false;
      error: JsonOutputFailure;
    };

export async function safeJsonCompletion<TSchema extends z.ZodType>(
  input: SafeJsonCompletionInput<TSchema>,
): Promise<SafeJsonCompletionResult<z.infer<TSchema>>> {
  const initialCompletion = await safeComplete(input.client, {
    messages: input.messages,
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    responseFormat: input.responseFormat,
  });

  if (!initialCompletion.ok) {
    return {
      ok: false,
      error: {
        code: "completion_failed",
        message: "LLM completion failed before JSON could be parsed.",
        completionError: initialCompletion.error,
      },
      repairAttempted: false,
    };
  }

  const initialValidation = parseAndValidateJson(initialCompletion.content, input.schema);

  if (initialValidation.ok) {
    return {
      ok: true,
      data: initialValidation.data,
      rawText: initialCompletion.content,
      jsonText: initialValidation.jsonText,
      repaired: false,
    };
  }

  const repairCompletion = await safeComplete(input.client, {
    messages: buildRepairMessages({
      rawText: initialCompletion.content,
      failure: initialValidation.error,
      schemaDescription: input.schemaDescription,
    }),
    model: input.model,
    temperature: input.repairTemperature ?? 0,
    maxTokens: input.maxTokens,
    responseFormat: input.responseFormat,
  });

  if (!repairCompletion.ok) {
    return {
      ok: false,
      error: {
        code: "repair_completion_failed",
        message: "LLM JSON repair request failed.",
        initialFailure: initialValidation.error,
        completionError: repairCompletion.error,
      },
      rawText: initialCompletion.content,
      repairAttempted: true,
    };
  }

  const repairValidation = parseAndValidateJson(repairCompletion.content, input.schema);

  if (repairValidation.ok) {
    return {
      ok: true,
      data: repairValidation.data,
      rawText: initialCompletion.content,
      jsonText: repairValidation.jsonText,
      repaired: true,
      repairRawText: repairCompletion.content,
    };
  }

  return {
    ok: false,
    error: {
      code: "repair_failed",
      message: "LLM JSON repair output still failed parsing or schema validation.",
      initialFailure: initialValidation.error,
      repairFailure: repairValidation.error,
    },
    rawText: initialCompletion.content,
    repairRawText: repairCompletion.content,
    repairAttempted: true,
  };
}

export function extractJsonText(output: string): JsonExtractionResult {
  const trimmed = output.trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      message: "Assistant output was empty.",
    };
  }

  if (hasJsonBoundary(trimmed)) {
    return {
      ok: true,
      jsonText: trimmed,
    };
  }

  const fencedMatch = trimmed.match(/^```(?:json)?[ \t]*\r?\n?([\s\S]*?)\r?\n?```$/i);

  if (fencedMatch) {
    const fencedContent = fencedMatch[1]?.trim() ?? "";

    if (hasJsonBoundary(fencedContent)) {
      return {
        ok: true,
        jsonText: fencedContent,
      };
    }
  }

  return {
    ok: false,
    message: "Assistant output must be plain JSON or a single fenced JSON block.",
  };
}

function parseAndValidateJson<TSchema extends z.ZodType>(
  output: string,
  schema: TSchema,
): JsonValidationResult<z.infer<TSchema>> {
  const extracted = extractJsonText(output);

  if (!extracted.ok) {
    return {
      ok: false,
      error: {
        code: "json_extraction_failed",
        message: extracted.message,
        rawText: output,
      },
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(extracted.jsonText);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "json_parse_failed",
        message: error instanceof Error ? error.message : String(error),
        rawText: output,
        jsonText: extracted.jsonText,
      },
    };
  }

  try {
    const validation = schema.safeParse(parsed);

    if (!validation.success) {
      return {
        ok: false,
        error: {
          code: "schema_validation_failed",
          message: "Parsed JSON did not match the requested schema.",
          rawText: output,
          jsonText: extracted.jsonText,
          issues: validation.error.issues,
        },
      };
    }

    return {
      ok: true,
      data: validation.data,
      jsonText: extracted.jsonText,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "schema_validation_failed",
        message: error instanceof Error ? error.message : String(error),
        rawText: output,
        jsonText: extracted.jsonText,
      },
    };
  }
}

async function safeComplete(
  client: LlmClient,
  input: LlmChatCompletionInput,
) {
  try {
    return await client.complete(input);
  } catch (error) {
    return {
      ok: false as const,
      error: {
        code: "transport_error" as const,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function buildRepairMessages({
  rawText,
  failure,
  schemaDescription,
}: {
  rawText: string;
  failure: JsonOutputFailure;
  schemaDescription?: string;
}): LlmChatMessage[] {
  const schema = schemaDescription?.trim() || "Caller-provided Zod schema.";
  const failureDetails = [
    `Failure code: ${failure.code}`,
    `Failure message: ${failure.message}`,
    failure.issues ? `Validation issues: ${JSON.stringify(failure.issues)}` : undefined,
  ].filter(Boolean).join("\n");

  return [
    {
      role: "system",
      content: "You repair malformed LLM JSON. Return corrected JSON only.",
    },
    {
      role: "user",
      content: [
        "The following output was supposed to be valid JSON matching this schema, but it failed to parse or validate.",
        "",
        "Schema:",
        schema,
        "",
        "Failure:",
        failureDetails,
        "",
        "Invalid output:",
        rawText,
        "",
        "Return corrected JSON only. Do not add comments or markdown.",
      ].join("\n"),
    },
  ];
}

function hasJsonBoundary(value: string): boolean {
  return (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  );
}
