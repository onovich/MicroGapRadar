import { NextResponse } from "next/server";
import { z } from "zod";

import { RadarTaskNotFoundError } from "@/lib/radar-tasks";

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

export async function readJsonBody(request: Request): Promise<
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

export function handleRadarTaskApiError(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed.",
      error.issues.map((issue) => ({
        path: issue.path.map((part) =>
          typeof part === "symbol" ? part.toString() : part,
        ),
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  if (error instanceof RadarTaskNotFoundError) {
    return jsonError(404, "NOT_FOUND", "Radar task was not found.");
  }

  console.error("Unexpected radar task API failure", error);

  return jsonError(
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred while handling the radar task request.",
  );
}
