import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createRunScanPostHandler,
} from "../app/api/scans/run/_api";
import { POST } from "../app/api/scans/run/route";
import { RunScanRadarTaskNotFoundError } from "../services/scan-orchestrator";

describe("POST /api/scans/run", () => {
  it("returns the shared invalid JSON error shape", async () => {
    const response = await POST(new Request("http://localhost/api/scans/run", {
      method: "POST",
      body: "{",
    }) as Parameters<typeof POST>[0]);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(payload, {
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
    });
  });

  it("returns validation issues without running a scan", async () => {
    const response = await POST(new Request("http://localhost/api/scans/run", {
      method: "POST",
      body: JSON.stringify({ keywordLimit: 0 }),
    }) as Parameters<typeof POST>[0]);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
    assert.equal(payload.error.message, "Request validation failed.");
    assert.ok(Array.isArray(payload.error.issues));
    assert.ok(payload.error.issues.length >= 1);
    assert.ok(
      payload.error.issues.some((issue: { path: string[] }) =>
        issue.path.includes("radarTaskId") || issue.path.includes("keywordLimit"),
      ),
    );
  });

  it("calls runScan and returns the shared success envelope", async () => {
    const calls: unknown[] = [];
    const handler = createRunScanPostHandler(async (input) => {
      calls.push(input);

      return {
        searchRunId: "run_1",
        radarTaskId: input.radarTaskId,
        status: "completed",
        useMockSerp: input.useMockSerp ?? true,
        counts: {
          keywordCandidates: 10,
          serpSuccesses: 10,
          opportunities: 10,
        },
        errors: [],
        opportunities: [],
      };
    });
    const response = await handler(new Request("http://localhost/api/scans/run", {
      method: "POST",
      body: JSON.stringify({
        radarTaskId: "task_game",
        keywordLimit: 10,
      }),
    }) as Parameters<typeof handler>[0]);
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(calls, [
      {
        radarTaskId: "task_game",
        useMockSerp: true,
        keywordLimit: 10,
      },
    ]);
    assert.deepEqual(payload, {
      data: {
        searchRunId: "run_1",
        radarTaskId: "task_game",
        status: "completed",
        useMockSerp: true,
        counts: {
          keywordCandidates: 10,
          serpSuccesses: 10,
          opportunities: 10,
        },
        errors: [],
        opportunities: [],
      },
    });
  });

  it("returns sanitized not-found errors from runScan", async () => {
    const handler = createRunScanPostHandler(async () => {
      throw new RunScanRadarTaskNotFoundError("missing-secret-id");
    });
    const response = await handler(new Request("http://localhost/api/scans/run", {
      method: "POST",
      body: JSON.stringify({ radarTaskId: "missing-secret-id" }),
    }) as Parameters<typeof handler>[0]);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(payload, {
      error: {
        code: "NOT_FOUND",
        message: "Radar task was not found.",
      },
    });
  });
});
