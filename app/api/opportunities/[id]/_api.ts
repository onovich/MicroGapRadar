import { NextResponse, type NextRequest } from "next/server";

import {
  OpportunityNotFoundError,
  OpportunityStatusValidationError,
  parseOpportunityId,
  parseOpportunityStatusUpdate,
  updateOpportunityStatus,
  type OpportunityStatusUpdate,
} from "@/lib/opportunities";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateOpportunityStatusHandler = typeof updateOpportunityStatus;

type ApiErrorCode =
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
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

async function readJsonBody(request: Request): Promise<
  | {
      ok: true;
      data: unknown;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return {
      ok: false,
      response: jsonError(
        400,
        "INVALID_JSON",
        "Request body must be valid JSON.",
      ),
    };
  }
}

function parseStatusBody(body: unknown): OpportunityStatusUpdate {
  if (!isRecord(body)) {
    throw new OpportunityStatusValidationError();
  }

  return parseOpportunityStatusUpdate(body.status);
}

export function handleOpportunityStatusApiError(error: unknown): NextResponse {
  if (error instanceof OpportunityStatusValidationError) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "Status must be one of saved, discarded, or build_next.",
      [{
        path: ["status"],
        code: "invalid_status",
        message: "Unsupported opportunity status.",
      }],
    );
  }

  if (error instanceof OpportunityNotFoundError) {
    return jsonError(404, "NOT_FOUND", "Opportunity was not found.");
  }

  console.error("Unexpected opportunity status API failure", error);

  return jsonError(
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred while updating the opportunity status.",
  );
}

export function createOpportunityStatusPatchHandler(
  updateStatus: UpdateOpportunityStatusHandler = updateOpportunityStatus,
) {
  return async function PATCH(request: NextRequest, context: RouteContext) {
    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    try {
      const { id } = await context.params;
      const opportunityId = parseOpportunityId(id);
      const status = parseStatusBody(body.data);
      const result = await updateStatus(opportunityId, status);

      return NextResponse.json({ data: result });
    } catch (error) {
      return handleOpportunityStatusApiError(error);
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
