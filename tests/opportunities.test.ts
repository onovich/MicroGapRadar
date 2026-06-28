import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { createOpportunityStatusPatchHandler } from "../app/api/opportunities/[id]/_api";
import { OpportunityCard } from "../components/OpportunityCard";
import { OpportunityDetail } from "../components/OpportunityDetail";
import { getScoreTone, ScoreBadge } from "../components/ScoreBadge";
import {
  buildDashboardViewModel,
  buildOpportunityListViewModel,
  normalizeOpportunityFilters,
  OpportunityNotFoundError,
  OpportunityStatusValidationError,
  parseOpportunityStatusUpdate,
  serializeOpportunityDetail,
  serializeOpportunity,
  type OpportunityRow,
  type SearchRunRow,
} from "../lib/opportunities";

describe("opportunity dashboard and list view models", () => {
  it("selects today's Top 5 opportunities by total score descending", () => {
    const now = new Date("2026-06-28T08:00:00.000Z");
    const rows = [
      opportunityRow({ id: "old_high", totalScore: 99, createdAt: "2026-06-27T08:00:00.000Z" }),
      opportunityRow({ id: "score_90", totalScore: 90 }),
      opportunityRow({ id: "score_75", totalScore: 75 }),
      opportunityRow({ id: "score_95", totalScore: 95 }),
      opportunityRow({ id: "score_65", totalScore: 65 }),
      opportunityRow({ id: "score_85", totalScore: 85 }),
      opportunityRow({ id: "score_80", totalScore: 80 }),
    ];
    const model = buildDashboardViewModel({
      opportunities: rows,
      searchRuns: [
        searchRunRow({ id: "run_today", status: "completed" }),
        searchRunRow({ id: "run_partial", status: "partial_failed" }),
      ],
      now,
      opportunityCountToday: 61,
      averageScoreToday: 77.4,
      runCountToday: 12,
      completedRunCountToday: 9,
    });

    assert.deepEqual(
      model.topOpportunities.map((opportunity) => opportunity.totalScore),
      [95, 90, 85, 80, 75],
    );
    assert.equal(model.opportunityCountToday, 61);
    assert.equal(model.metrics.find((metric) => metric.label === "Top score")?.value, "95");
    assert.equal(model.metrics.find((metric) => metric.label === "New opps")?.value, "61");
    assert.equal(model.metrics.find((metric) => metric.label === "Avg score")?.value, "77");
    assert.equal(model.metrics.find((metric) => metric.label === "Runs")?.value, "12");
    assert.equal(
      model.metrics.find((metric) => metric.label === "Runs")?.detail,
      "9 completed or partial",
    );
  });

  it("normalizes query filters and applies task, score, tool, risk, and status filters", () => {
    const model = buildOpportunityListViewModel({
      opportunities: [
        opportunityRow({
          id: "keep",
          radarTaskId: "task_shop",
          radarTaskName: "Shopify Radar",
          totalScore: 82,
          toolType: "checker",
          status: "saved",
          riskLevel: "medium",
        }),
        opportunityRow({
          id: "wrong_task",
          radarTaskId: "task_game",
          radarTaskName: "GameDev Radar",
          totalScore: 88,
          toolType: "checker",
          status: "saved",
          riskLevel: "medium",
        }),
        opportunityRow({
          id: "wrong_risk",
          radarTaskId: "task_shop",
          radarTaskName: "Shopify Radar",
          totalScore: 90,
          toolType: "checker",
          status: "saved",
          riskLevel: "low",
        }),
        opportunityRow({
          id: "too_low",
          radarTaskId: "task_shop",
          radarTaskName: "Shopify Radar",
          totalScore: 60,
          toolType: "checker",
          status: "saved",
          riskLevel: "medium",
        }),
      ],
      rawFilters: {
        task: "task_shop",
        minScore: "80",
        toolType: "checker",
        risk: "medium",
        status: "saved",
      },
    });

    assert.deepEqual(model.items.map((opportunity) => opportunity.id), ["keep"]);
    assert.deepEqual(model.filters, {
      radarTaskId: "task_shop",
      minScore: 80,
      toolType: "checker",
      riskLevel: "medium",
      status: "saved",
    });
    assert.equal(model.hasActiveFilters, true);
  });

  it("returns plain serializable opportunity view models", () => {
    const serialized = serializeOpportunity(opportunityRow({
      id: "serial",
      totalScore: 87,
      riskLevel: "low",
      monetizationPrimary: "paid_export",
      monetizationSecondary: ["ads", "affiliate"],
    }));

    assert.equal(serialized.detailHref, "/opportunities/serial");
    assert.equal(serialized.riskLevel, "low");
    assert.deepEqual(serialized.monetizationTypes, [
      "Paid Export",
      "Ads",
      "Affiliate",
    ]);
    assert.equal(typeof serialized.createdAt, "string");
    assert.equal(typeof serialized.searchRun.startedAt, "string");
    assert.doesNotThrow(() => JSON.stringify(serialized));
  });

  it("returns plain detail view models with persisted score and analysis context", () => {
    const detail = serializeOpportunityDetail(opportunityRow({
      id: "detail",
      title: "Shopify Accessibility Checklist",
      keyword: "shopify accessibility checklist",
      toolType: "checklist",
      riskLevel: "medium",
      monetizationPrimary: "lead_gen",
      monetizationSecondary: ["paid_export"],
    }));

    assert.equal(detail.detailHref, "/opportunities/detail");
    assert.equal(detail.serpWeaknessSummary, "Top results are generic articles.");
    assert.equal(detail.scoreExplanation.intentScore, "Search intent is explicit and task oriented.");
    assert.deepEqual(
      detail.scoreBreakdownItems.map((item) => item.key),
      [
        "intentScore",
        "monetizationScore",
        "serpWeaknessScore",
        "toolabilityScore",
        "userFitScore",
        "buildSpeedScore",
        "riskPenalty",
        "totalScore",
      ],
    );
    assert.equal(detail.toolConcept?.oneLiner, "Generate a focused implementation checklist from a store URL.");
    assert.deepEqual(detail.toolConcept?.inputFields, ["Store URL", "Theme name"]);
    assert.deepEqual(detail.toolConcept?.outputModules, ["Checklist", "CSV export"]);
    assert.equal(detail.toolabilitySummary, "Generate a focused implementation checklist from a store URL.");
    assert.deepEqual(detail.killCriteria, [
      "Discard if SERP is already dominated by focused tools.",
    ]);
    assert.doesNotThrow(() => JSON.stringify(detail));
  });

  it("handles empty list inputs and ignores invalid query values", () => {
    const filters = normalizeOpportunityFilters({
      minScore: "not-a-number",
      riskLevel: "unknown",
      status: "archived",
    });
    const model = buildOpportunityListViewModel({
      opportunities: [],
      rawFilters: filters,
    });

    assert.deepEqual(filters, {});
    assert.deepEqual(model.items, []);
    assert.deepEqual(model.filterOptions.radarTasks, []);
    assert.equal(model.hasActiveFilters, false);
  });
});

describe("opportunity components", () => {
  it("renders score badge tone and score text", () => {
    const html = renderToStaticMarkup(createElement(ScoreBadge, { score: 88 }));

    assert.equal(getScoreTone(88), "strong");
    assert.match(html, /88/);
    assert.match(html, /Score 88 out of 100/);
  });

  it("renders opportunity risk and monetization cues", () => {
    const opportunity = serializeOpportunity(opportunityRow({
      id: "card",
      title: "Shopify Accessibility Checklist",
      keyword: "shopify accessibility checklist",
      toolType: "checklist",
      riskLevel: "medium",
      monetizationPrimary: "lead_gen",
      monetizationSecondary: ["paid_export"],
    }));
    const html = renderToStaticMarkup(
      createElement(OpportunityCard, { opportunity, rank: 1 }),
    );

    assert.match(html, /Shopify Accessibility Checklist/);
    assert.match(html, /Medium risk/);
    assert.match(html, /Lead Gen/);
    assert.match(html, /Paid Export/);
    assert.match(html, /View brief/);
    assert.match(html, /\/opportunities\/card/);
  });

  it("renders opportunity detail score, risk, monetization, status, and run context", () => {
    const opportunity = serializeOpportunityDetail(opportunityRow({
      id: "detail_component",
      title: "Shopify Accessibility Checklist",
      keyword: "shopify accessibility checklist",
      toolType: "checklist",
      riskLevel: "medium",
      monetizationPrimary: "lead_gen",
      monetizationSecondary: ["paid_export"],
    }));
    const html = renderToStaticMarkup(
      createElement(OpportunityDetail, { opportunity }),
    );

    assert.match(html, /Back to opportunities/);
    assert.match(html, /Shopify Accessibility Checklist/);
    assert.match(html, /Score breakdown/);
    assert.match(html, /Search intent is explicit and task oriented/);
    assert.match(html, /Top results are generic articles/);
    assert.match(html, /Generate a focused implementation checklist/);
    assert.match(html, /Store URL/);
    assert.match(html, /Lead Gen/);
    assert.match(html, /Medium risk/);
    assert.match(html, /Build: Low/);
    assert.match(html, /Discard if SERP is already dominated/);
    assert.match(html, /Status/);
    assert.match(html, /Build next/);
    assert.match(html, /GameDev Radar/);
  });
});

describe("opportunity status updates", () => {
  it("accepts only saved, discarded, and build_next as mutable statuses", () => {
    assert.equal(parseOpportunityStatusUpdate("saved"), "saved");
    assert.equal(parseOpportunityStatusUpdate("discarded"), "discarded");
    assert.equal(parseOpportunityStatusUpdate("build_next"), "build_next");
    assert.throws(
      () => parseOpportunityStatusUpdate("built"),
      OpportunityStatusValidationError,
    );
    assert.throws(
      () => parseOpportunityStatusUpdate("new"),
      OpportunityStatusValidationError,
    );
  });

  it("persists valid status requests through the injected update boundary", async () => {
    const calls: Array<{ id: unknown; status: unknown }> = [];
    const handler = createOpportunityStatusPatchHandler(async (id, status) => {
      calls.push({ id, status });
      const parsedStatus = parseOpportunityStatusUpdate(status);

      return {
        id: String(id),
        status: parsedStatus,
        statusLabel: "Build Next",
        updatedAt: "2026-06-28T08:00:00.000Z",
      };
    });
    const response = await handler(
      statusRequest({ status: "build_next" }) as Parameters<typeof handler>[0],
      routeContext("opportunity_1"),
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      {
        id: "opportunity_1",
        status: "build_next",
      },
    ]);
    assert.deepEqual(payload, {
      data: {
        id: "opportunity_1",
        status: "build_next",
        statusLabel: "Build Next",
        updatedAt: "2026-06-28T08:00:00.000Z",
      },
    });
  });

  it("ignores extra request fields and passes only status to the update boundary", async () => {
    const calls: Array<{ id: unknown; status: unknown }> = [];
    const handler = createOpportunityStatusPatchHandler(async (id, status) => {
      calls.push({ id, status });

      return {
        id: String(id),
        status: parseOpportunityStatusUpdate(status),
        statusLabel: "Saved",
        updatedAt: "2026-06-28T08:00:00.000Z",
      };
    });
    const response = await handler(
      statusRequest({
        status: "saved",
        title: "Do not update me",
        totalScore: 0,
      }) as Parameters<typeof handler>[0],
      routeContext("opportunity_1"),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      {
        id: "opportunity_1",
        status: "saved",
      },
    ]);
  });

  it("rejects invalid status requests before the update boundary", async () => {
    const calls: unknown[] = [];
    const handler = createOpportunityStatusPatchHandler(async (id, status) => {
      calls.push({ id, status });
      throw new Error("should not update");
    });
    const response = await handler(
      statusRequest({ status: "built" }) as Parameters<typeof handler>[0],
      routeContext("opportunity_1"),
    );
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
    assert.equal(payload.error.message, "Status must be one of saved, discarded, or build_next.");
    assert.deepEqual(calls, []);

    const newStatusResponse = await handler(
      statusRequest({ status: "new" }) as Parameters<typeof handler>[0],
      routeContext("opportunity_1"),
    );

    assert.equal(newStatusResponse.status, 400);
    assert.deepEqual(calls, []);
  });

  it("returns safe errors for malformed JSON status requests", async () => {
    const calls: unknown[] = [];
    const handler = createOpportunityStatusPatchHandler(async (id, status) => {
      calls.push({ id, status });
      throw new Error("should not update");
    });
    const response = await handler(
      new Request("http://localhost/api/opportunities/opportunity_1", {
        method: "PATCH",
        body: "{not-json",
      }) as Parameters<typeof handler>[0],
      routeContext("opportunity_1"),
    );
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(payload, {
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
    });
    assert.deepEqual(calls, []);
  });

  it("returns safe not-found errors for missing IDs and missing opportunities", async () => {
    const calls: unknown[] = [];
    const handler = createOpportunityStatusPatchHandler(async (id) => {
      calls.push(id);
      throw new OpportunityNotFoundError("secret-opportunity-id");
    });
    const missingIdResponse = await handler(
      statusRequest({ status: "saved" }) as Parameters<typeof handler>[0],
      routeContext(""),
    );
    const missingIdPayload = await missingIdResponse.json();
    const missingOpportunityResponse = await handler(
      statusRequest({ status: "saved" }) as Parameters<typeof handler>[0],
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
});

function statusRequest(body: unknown): Request {
  return new Request("http://localhost/api/opportunities/opportunity_1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
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

function opportunityRow(overrides: {
  id?: string;
  radarTaskId?: string;
  radarTaskName?: string;
  searchRunId?: string;
  keyword?: string;
  title?: string;
  summary?: string;
  toolType?: string;
  country?: string;
  language?: string;
  status?: string;
  totalScore?: number;
  riskLevel?: "low" | "medium" | "high" | "excluded";
  monetizationPrimary?: string;
  monetizationSecondary?: string[];
  createdAt?: string;
} = {}): OpportunityRow {
  const riskLevel = overrides.riskLevel ?? "low";
  const totalScore = overrides.totalScore ?? 80;
  const createdAt = new Date(overrides.createdAt ?? "2026-06-28T07:00:00.000Z");
  const searchRunStartedAt = new Date("2026-06-28T06:30:00.000Z");
  const radarTaskId = overrides.radarTaskId ?? "task_game";
  const searchRunId = overrides.searchRunId ?? "run_1";

  return {
    id: overrides.id ?? "opportunity_1",
    searchRunId,
    radarTaskId,
    keyword: overrides.keyword ?? "steam short description generator",
    country: overrides.country ?? "US",
    language: overrides.language ?? "en",
    title: overrides.title ?? "Steam Short Description Generator",
    summary: overrides.summary ?? "A narrow generator for a task-oriented search gap.",
    toolType: overrides.toolType ?? "generator",
    targetUser: "Solo builders",
    searchIntent: "The searcher wants a concrete output.",
    serpWeaknessSummary: "Top results are generic articles.",
    monetizationSummary: "Primary: paid_export. Secondary options: ads.",
    riskSummary: `${riskLevel}: Risk notes for this opportunity.`,
    buildComplexity: "low",
    status: overrides.status ?? "new",
    totalScore,
    scoreBreakdown: {
      intentScore: 90,
      monetizationScore: 80,
      serpWeaknessScore: 75,
      toolabilityScore: 90,
      userFitScore: 80,
      buildSpeedScore: 92,
      riskPenalty: riskPenaltyFor(riskLevel),
      totalScore,
    },
    scoreExplanation: {
      intentScore: "Search intent is explicit and task oriented.",
      monetizationScore: "Monetization cues are present but need validation.",
      serpWeaknessScore: "SERP weakness comes from generic competing pages.",
      toolabilityScore: "The workflow can become an interactive checklist.",
      userFitScore: "The target user has a repeatable operational task.",
      buildSpeedScore: "The first version can stay narrow.",
      riskPenalty: "Risk penalty reflects local review cues.",
      totalScore: `${totalScore}/100 overall opportunity score.`,
    },
    rawAnalysis: {
      opportunityAnalysis: {
        toolConcept: {
          oneLiner: "Generate a focused implementation checklist from a store URL.",
          inputFields: ["Store URL", "Theme name"],
          outputModules: ["Checklist", "CSV export"],
        },
        risk: {
          level: riskLevel,
        },
        monetization: {
          primary: overrides.monetizationPrimary ?? "paid_export",
          secondary: overrides.monetizationSecondary ?? ["ads"],
        },
      },
    },
    killCriteria: ["Discard if SERP is already dominated by focused tools."],
    createdAt,
    updatedAt: createdAt,
    radarTask: {
      id: radarTaskId,
      name: overrides.radarTaskName ?? "GameDev Radar",
    },
    searchRun: {
      id: searchRunId,
      status: "completed",
      startedAt: searchRunStartedAt,
      completedAt: new Date("2026-06-28T06:40:00.000Z"),
    },
  } as OpportunityRow;
}

function searchRunRow(overrides: {
  id?: string;
  radarTaskId?: string;
  radarTaskName?: string;
  status?: string;
  startedAt?: string;
} = {}): SearchRunRow {
  const radarTaskId = overrides.radarTaskId ?? "task_game";
  const startedAt = new Date(overrides.startedAt ?? "2026-06-28T07:00:00.000Z");

  return {
    id: overrides.id ?? "run_1",
    radarTaskId,
    status: overrides.status ?? "completed",
    startedAt,
    completedAt: new Date("2026-06-28T07:10:00.000Z"),
    keywordCount: 10,
    serpSuccessCount: 9,
    opportunityCount: 8,
    estimatedCost: null,
    errorMessage: null,
    createdAt: startedAt,
    radarTask: {
      id: radarTaskId,
      name: overrides.radarTaskName ?? "GameDev Radar",
    },
  } as SearchRunRow;
}

function riskPenaltyFor(level: "low" | "medium" | "high" | "excluded"): number {
  if (level === "excluded") {
    return 100;
  }

  if (level === "high") {
    return 65;
  }

  if (level === "medium") {
    return 25;
  }

  return 8;
}
