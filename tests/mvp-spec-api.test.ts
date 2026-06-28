import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createMvpSpecPostHandler,
} from "../app/api/opportunities/[id]/mvp-spec/_api";
import { MvpSpecOpportunityInputSchema } from "../agents";
import {
  MvpSpecGenerationValidationError,
  OpportunityNotFoundError,
} from "../lib/opportunities";

describe("POST /api/opportunities/[id]/mvp-spec", () => {
  it("calls the generation boundary and returns a safe success envelope", async () => {
    const calls: unknown[] = [];
    const handler = createMvpSpecPostHandler(async (id) => {
      calls.push(id);

      return mvpSpecResponse();
    });
    const response = await handler(
      new Request("http://localhost/api/opportunities/opportunity_1/mvp-spec", {
        method: "POST",
      }) as Parameters<typeof handler>[0],
      routeContext("opportunity_1"),
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, ["opportunity_1"]);
    assert.deepEqual(payload, {
      data: mvpSpecResponse(),
    });
  });

  it("returns safe not-found errors for missing IDs and missing opportunities", async () => {
    const calls: unknown[] = [];
    const handler = createMvpSpecPostHandler(async (id) => {
      calls.push(id);
      throw new OpportunityNotFoundError("secret-opportunity-id");
    });
    const missingIdResponse = await handler(
      new Request("http://localhost/api/opportunities//mvp-spec", {
        method: "POST",
      }) as Parameters<typeof handler>[0],
      routeContext(""),
    );
    const missingIdPayload = await missingIdResponse.json();
    const missingOpportunityResponse = await handler(
      new Request("http://localhost/api/opportunities/missing/mvp-spec", {
        method: "POST",
      }) as Parameters<typeof handler>[0],
      routeContext("missing-opportunity"),
    );
    const missingOpportunityPayload = await missingOpportunityResponse.json();

    assert.equal(missingIdResponse.status, 404);
    assert.deepEqual(missingIdPayload, {
      error: {
        code: "NOT_FOUND",
        message: "Opportunity was not found.",
      },
    });
    assert.equal(missingOpportunityResponse.status, 404);
    assert.deepEqual(missingOpportunityPayload, {
      error: {
        code: "NOT_FOUND",
        message: "Opportunity was not found.",
      },
    });
    assert.deepEqual(calls, ["missing-opportunity"]);
    assert.equal(JSON.stringify(missingOpportunityPayload).includes("secret"), false);
  });

  it("returns sanitized agent validation errors", async () => {
    const handler = createMvpSpecPostHandler(async () => {
      throw new MvpSpecGenerationValidationError();
    });
    const response = await handler(
      new Request("http://localhost/api/opportunities/opportunity_1/mvp-spec", {
        method: "POST",
      }) as Parameters<typeof handler>[0],
      routeContext("opportunity_1"),
    );
    const payload = await response.json();

    assert.equal(response.status, 422);
    assert.deepEqual(payload, {
      error: {
        code: "AGENT_VALIDATION_ERROR",
        message: "MVP Spec generation produced invalid output.",
      },
    });
  });

  it("returns sanitized Zod issues without raw prompt material", async () => {
    const handler = createMvpSpecPostHandler(async () => {
      MvpSpecOpportunityInputSchema.parse({
        id: "",
        rawPrompt: "secret prompt text",
      });

      throw new Error("unreachable");
    });
    const response = await handler(
      new Request("http://localhost/api/opportunities/opportunity_1/mvp-spec", {
        method: "POST",
      }) as Parameters<typeof handler>[0],
      routeContext("opportunity_1"),
    );
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    assert.equal(response.status, 422);
    assert.equal(payload.error.code, "AGENT_VALIDATION_ERROR");
    assert.equal(payload.error.message, "MVP Spec generation input failed validation.");
    assert.ok(Array.isArray(payload.error.issues));
    assert.doesNotMatch(serialized, /secret prompt text/);
  });

  it("returns sanitized unexpected errors", async () => {
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      const handler = createMvpSpecPostHandler(async () => {
        throw new Error("database secret stack trace");
      });
      const response = await handler(
        new Request("http://localhost/api/opportunities/opportunity_1/mvp-spec", {
          method: "POST",
        }) as Parameters<typeof handler>[0],
        routeContext("opportunity_1"),
      );
      const payload = await response.json();
      const serialized = JSON.stringify(payload);

      assert.equal(response.status, 500);
      assert.deepEqual(payload, {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred while generating the MVP Spec.",
        },
      });
      assert.doesNotMatch(serialized, /database secret|stack trace/);
    } finally {
      console.error = originalConsoleError;
    }
  });
});

function mvpSpecResponse() {
  return {
    id: "spec_1",
    opportunityId: "opportunity_1",
    markdown: "# MVP Spec\n\n## Page Structure\n- `/`",
    generatedByModel: "deterministic-mvp-spec-agent-2026-06-28-v1",
    createdAt: "2026-06-28T08:00:00.000Z",
    updatedAt: "2026-06-28T08:01:00.000Z",
  };
}

function routeContext(id: string): {
  params: Promise<{
    id: string;
  }>;
} {
  return {
    params: Promise.resolve({ id }),
  };
}
