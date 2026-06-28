import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { runScanInputSchema } from "@/lib/schemas";
import {
  runScan,
  RunScanRadarTaskInactiveError,
  RunScanRadarTaskNotFoundError,
  RunScanUnsupportedProviderError,
} from "@/services/scan-orchestrator";

type RunScanHandler = typeof runScan;

type ApiErrorCode =
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INACTIVE_RADAR_TASK"
  | "UNSUPPORTED_SERP_PROVIDER"
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

export function handleRunScanApiError(error: unknown): NextResponse {
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

  if (error instanceof RunScanRadarTaskNotFoundError) {
    return jsonError(404, "NOT_FOUND", "Radar task was not found.");
  }

  if (error instanceof RunScanRadarTaskInactiveError) {
    return jsonError(
      409,
      "INACTIVE_RADAR_TASK",
      "Radar task is inactive and cannot be scanned.",
    );
  }

  if (error instanceof RunScanUnsupportedProviderError) {
    return jsonError(
      400,
      "UNSUPPORTED_SERP_PROVIDER",
      "Only the mock SERP provider is available for this local MVP scan.",
    );
  }

  console.error("Unexpected run scan API failure", error);

  return jsonError(
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred while running the scan.",
  );
}

export function createRunScanPostHandler(scan: RunScanHandler = runScan) {
  return async function POST(request: NextRequest) {
    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    try {
      const result = await scan(runScanInputSchema.parse(body.data));

      return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) {
      return handleRunScanApiError(error);
    }
  };
}
