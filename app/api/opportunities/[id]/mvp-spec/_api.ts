import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  generateAndPersistMvpSpec,
  MvpSpecGenerationValidationError,
  OpportunityNotFoundError,
  parseOpportunityId,
} from "@/lib/opportunities";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type GenerateMvpSpecHandler = typeof generateAndPersistMvpSpec;

type ApiErrorCode =
  | "AGENT_VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

type ApiErrorIssue = {
  path: Array<string | number>;
  code: string;
  message: string;
};

function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
  issues?: ApiErrorIssue[],
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(issues ? { issues } : {}),
      },
    },
    { status },
  );
}

export function handleMvpSpecApiError(error: unknown): NextResponse {
  if (error instanceof OpportunityNotFoundError) {
    return jsonError(404, "NOT_FOUND", "Opportunity was not found.");
  }

  if (error instanceof MvpSpecGenerationValidationError) {
    return jsonError(
      422,
      "AGENT_VALIDATION_ERROR",
      "MVP Spec generation produced invalid output.",
    );
  }

  if (error instanceof z.ZodError) {
    return jsonError(
      422,
      "AGENT_VALIDATION_ERROR",
      "MVP Spec generation input failed validation.",
      error.issues.map((issue) => ({
        path: issue.path.map((part) =>
          typeof part === "symbol" ? part.toString() : part,
        ),
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  console.error("Unexpected MVP Spec API failure", error);

  return jsonError(
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred while generating the MVP Spec.",
  );
}

export function createMvpSpecPostHandler(
  generateSpec: GenerateMvpSpecHandler = generateAndPersistMvpSpec,
) {
  return async function POST(_request: NextRequest, context: RouteContext) {
    try {
      const { id } = await context.params;
      const opportunityId = parseOpportunityId(id);
      const result = await generateSpec(opportunityId);

      return NextResponse.json({ data: result });
    } catch (error) {
      return handleMvpSpecApiError(error);
    }
  };
}
