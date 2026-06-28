import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OpportunityCard } from "../components/OpportunityCard";
import { getScoreTone, ScoreBadge } from "../components/ScoreBadge";
import {
  buildDashboardViewModel,
  buildOpportunityListViewModel,
  normalizeOpportunityFilters,
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
});

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
    scoreExplanation: {},
    rawAnalysis: {
      opportunityAnalysis: {
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
