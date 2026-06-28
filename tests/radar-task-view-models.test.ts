import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createRadarTaskFromForm,
  deactivateRadarTaskFromForm,
  updateRadarTaskFromForm,
} from "../app/radar-tasks/action-handlers";
import {
  buildRadarTaskDetailViewModel,
  buildRadarTaskListViewModel,
  parseRadarTaskFormData,
  parseRadarTaskUpdateFormData,
  serializeRadarTask,
  toRadarTaskFormValues,
  type OpportunityRow,
  type RadarTaskRow,
  type SearchRunRow,
} from "../lib/radar-task-view-models";
import {
  buildRunScanPayload,
  isRunScanDisabled,
  serializeRunScanResult,
} from "../lib/radar-task-run-scan";

describe("radar task view models", () => {
  it("filters inactive tasks by default and exposes active/inactive labels", () => {
    const model = buildRadarTaskListViewModel([
      radarTaskRow({ id: "active", name: "Active Radar", isActive: true }),
      radarTaskRow({ id: "inactive", name: "Inactive Radar", isActive: false }),
    ]);
    const withInactive = buildRadarTaskListViewModel(
      [
        radarTaskRow({ id: "active", name: "Active Radar", isActive: true }),
        radarTaskRow({ id: "inactive", name: "Inactive Radar", isActive: false }),
      ],
      { showInactive: true },
    );

    assert.deepEqual(model.items.map((task) => task.id), ["active"]);
    assert.equal(model.activeCount, 1);
    assert.equal(model.inactiveCount, 1);
    assert.equal(withInactive.total, 2);
    assert.equal(withInactive.items[1].statusLabel, "Inactive");
  });

  it("serializes detail context with string dates, recent runs, and latest opportunities", () => {
    const detail = buildRadarTaskDetailViewModel({
      task: radarTaskRow({ id: "task_1" }),
      recentRuns: [searchRunRow({ id: "run_1" })],
      latestOpportunities: [opportunityRow({ id: "opp_1" })],
    });

    assert.equal(detail.id, "task_1");
    assert.equal(typeof detail.createdAt, "string");
    assert.equal(detail.recentRuns[0].statusLabel, "Completed");
    assert.equal(typeof detail.recentRuns[0].startedAt, "string");
    assert.equal(detail.latestOpportunities[0].detailHref, "/opportunities/opp_1");
    assert.equal(detail.latestOpportunities[0].marketLabel, "EN / US");
    assert.doesNotThrow(() => JSON.stringify(detail));
  });

  it("round-trips form values and maps textarea/comma fields to Zod-aligned payloads", () => {
    const task = serializeRadarTask(radarTaskRow({
      id: "task_form",
      seedExamples: ["steam launch planner", "unity checklist"],
      countries: ["US", "JP"],
      languages: ["en", "ja"],
    }));
    const values = toRadarTaskFormValues(task);
    const formData = new FormData();

    formData.set("name", "GameDev Microtools");
    formData.set("domainDescription", "Steam, Unity, indie game launch microtools");
    formData.set("seedExamples", "steam launch planner\nunity checklist");
    formData.set("countries", "US, JP, DE");
    formData.set("languages", "en, ja, de");
    formData.set("userAdvantages", "GameDev, Unity, AI automation");
    formData.set("monetizationPreferences", "ads, affiliate, paid_export");
    formData.set("excludedTopics", "medical, adult, gambling");
    formData.set("maxRisk", "medium");
    formData.set("avoidYMYLConclusions", "on");
    formData.set("dailyLimit", "12");
    formData.set("isActive", "on");

    const createPayload = parseRadarTaskFormData(formData);
    const updatePayload = parseRadarTaskUpdateFormData(formData);

    assert.equal(values.seedExamplesText, "steam launch planner\nunity checklist");
    assert.deepEqual(createPayload.seedExamples, [
      "steam launch planner",
      "unity checklist",
    ]);
    assert.deepEqual(createPayload.countries, ["US", "JP", "DE"]);
    assert.deepEqual(createPayload.riskPreferences, {
      maxRisk: "medium",
      avoidYMYLConclusions: true,
    });
    assert.equal(createPayload.dailyLimit, 12);
    assert.equal("userId" in createPayload, false);
    assert.equal(updatePayload.name, "GameDev Microtools");
    assert.equal("userId" in updatePayload, false);
  });

  it("builds local mock run-scan payloads and serializes result counts", () => {
    const payload = buildRunScanPayload("task_1", {
      keywordLimit: 99,
      serpLimit: "3",
    });
    const result = serializeRunScanResult({
      data: {
        searchRunId: "run_1",
        status: "completed",
        counts: {
          keywordCandidates: 50,
          serpSuccesses: 30,
          opportunities: 12,
        },
        errors: [{ message: "one keyword failed" }],
      },
    });

    assert.deepEqual(payload, {
      radarTaskId: "task_1",
      useMockSerp: true,
      keywordLimit: 50,
      serpLimit: 3,
    });
    assert.equal(isRunScanDisabled({ isActive: false }), true);
    assert.equal(isRunScanDisabled({ isActive: true }), false);
    assert.deepEqual(result, {
      searchRunId: "run_1",
      status: "completed",
      keywordCandidates: 50,
      serpSuccesses: 30,
      opportunities: 12,
      errors: ["one keyword failed"],
    });
  });

  it("routes create, update, and deactivate actions through admin-checked mutation boundaries", async () => {
    const formData = validRadarTaskFormData();
    const createCalls: unknown[] = [];
    const updateCalls: Array<{ id: string; input: unknown }> = [];
    const deleteCalls: string[] = [];
    const revalidated: string[] = [];
    const authChecks: string[] = [];
    const deps = {
      requireLocalAdmin: async () => {
        authChecks.push("checked");
      },
      createRadarTask: async (input: unknown) => {
        createCalls.push(input);
        return { id: "created_task" };
      },
      updateRadarTask: async (id: string, input: unknown) => {
        updateCalls.push({ id, input });
        return { id };
      },
      deleteRadarTask: async (id: string) => {
        deleteCalls.push(id);
      },
      revalidatePath: (path: string) => {
        revalidated.push(path);
      },
      redirect: redirectRecorder(),
    };

    await assert.rejects(
      createRadarTaskFromForm(formData, deps),
      /REDIRECT:\/radar-tasks\/created_task/,
    );
    await assert.rejects(
      updateRadarTaskFromForm("task_1", formData, deps),
      /REDIRECT:\/radar-tasks\/task_1/,
    );

    const deactivateForm = new FormData();
    deactivateForm.set("confirmDeactivate", "on");

    await assert.rejects(
      deactivateRadarTaskFromForm("task_1", deactivateForm, deps),
      /REDIRECT:\/radar-tasks$/,
    );

    assert.deepEqual(authChecks, ["checked", "checked", "checked"]);
    assert.equal(createCalls.length, 1);
    assert.equal(updateCalls.length, 1);
    assert.deepEqual(deleteCalls, ["task_1"]);
    assert.deepEqual(revalidated, [
      "/radar-tasks",
      "/radar-tasks",
      "/radar-tasks/task_1",
      "/radar-tasks",
      "/radar-tasks/task_1",
    ]);
    assert.equal((createCalls[0] as { userId?: string }).userId, undefined);
    assert.equal(updateCalls[0].id, "task_1");
  });

  it("checks admin auth before deactivation confirmation redirects", async () => {
    const authChecks: string[] = [];
    const deleteCalls: string[] = [];
    const formData = new FormData();
    const deps = {
      requireLocalAdmin: async () => {
        authChecks.push("checked");
      },
      createRadarTask: async () => ({ id: "unused" }),
      updateRadarTask: async (id: string) => ({ id }),
      deleteRadarTask: async (id: string) => {
        deleteCalls.push(id);
      },
      revalidatePath: () => {},
      redirect: redirectRecorder(),
    };

    await assert.rejects(
      deactivateRadarTaskFromForm("task_1", formData, deps),
      /REDIRECT:\/radar-tasks\/task_1/,
    );

    assert.deepEqual(authChecks, ["checked"]);
    assert.deepEqual(deleteCalls, []);
  });
});

function validRadarTaskFormData(): FormData {
  const formData = new FormData();

  formData.set("name", "GameDev Microtools");
  formData.set("domainDescription", "Steam, Unity, indie game launch microtools");
  formData.set("seedExamples", "steam launch planner\nunity checklist");
  formData.set("countries", "US, JP, DE");
  formData.set("languages", "en, ja, de");
  formData.set("userAdvantages", "GameDev, Unity, AI automation");
  formData.set("monetizationPreferences", "ads, affiliate, paid_export");
  formData.set("excludedTopics", "medical, adult, gambling");
  formData.set("maxRisk", "medium");
  formData.set("avoidYMYLConclusions", "on");
  formData.set("dailyLimit", "12");
  formData.set("isActive", "on");

  return formData;
}

function redirectRecorder(): (path: string) => never {
  return (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  };
}

function radarTaskRow(overrides: Partial<RadarTaskRow> = {}): RadarTaskRow {
  return {
    id: overrides.id ?? "task_1",
    userId: null,
    name: overrides.name ?? "GameDev Radar",
    domainDescription:
      overrides.domainDescription ??
      "Steam, Unity, indie game launch microtools",
    seedExamples: overrides.seedExamples ?? ["steam launch planner"],
    countries: overrides.countries ?? ["US"],
    languages: overrides.languages ?? ["en"],
    userAdvantages: overrides.userAdvantages ?? ["GameDev"],
    monetizationPreferences: overrides.monetizationPreferences ?? ["paid_export"],
    riskPreferences:
      overrides.riskPreferences ?? {
        maxRisk: "medium",
        avoidYMYLConclusions: true,
      },
    excludedTopics: overrides.excludedTopics ?? ["medical"],
    dailyLimit: overrides.dailyLimit ?? 10,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date("2026-06-29T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-06-29T01:00:00.000Z"),
  };
}

function searchRunRow(overrides: Partial<SearchRunRow> = {}): SearchRunRow {
  return {
    id: overrides.id ?? "run_1",
    radarTaskId: overrides.radarTaskId ?? "task_1",
    status: overrides.status ?? "completed",
    startedAt: overrides.startedAt ?? new Date("2026-06-29T01:00:00.000Z"),
    completedAt: overrides.completedAt ?? new Date("2026-06-29T01:02:00.000Z"),
    keywordCount: overrides.keywordCount ?? 10,
    serpSuccessCount: overrides.serpSuccessCount ?? 9,
    opportunityCount: overrides.opportunityCount ?? 8,
    estimatedCost: null,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-06-29T01:00:00.000Z"),
    radarTask: {
      id: "task_1",
      name: "GameDev Radar",
    },
  } as SearchRunRow;
}

function opportunityRow(overrides: Partial<OpportunityRow> = {}): OpportunityRow {
  return {
    id: overrides.id ?? "opp_1",
    searchRunId: overrides.searchRunId ?? "run_1",
    radarTaskId: overrides.radarTaskId ?? "task_1",
    keyword: overrides.keyword ?? "steam launch checklist",
    country: overrides.country ?? "US",
    language: overrides.language ?? "en",
    title: overrides.title ?? "Steam Launch Checklist",
    summary: overrides.summary ?? "A focused checklist opportunity.",
    toolType: overrides.toolType ?? "checklist",
    targetUser: "Solo game developers",
    searchIntent: "Find a launch checklist",
    serpWeaknessSummary: "Top results are generic.",
    monetizationSummary: "Primary: paid_export.",
    riskSummary: overrides.riskSummary ?? "medium: review before publishing.",
    buildComplexity: "low",
    status: overrides.status ?? "new",
    totalScore: overrides.totalScore ?? 82,
    scoreBreakdown: {},
    scoreExplanation: {},
    rawAnalysis: null,
    killCriteria: null,
    createdAt: overrides.createdAt ?? new Date("2026-06-29T02:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-06-29T02:00:00.000Z"),
    radarTask: {
      id: "task_1",
      name: "GameDev Radar",
    },
    searchRun: {
      id: "run_1",
      status: "completed",
      startedAt: new Date("2026-06-29T01:00:00.000Z"),
      completedAt: new Date("2026-06-29T01:02:00.000Z"),
    },
  } as OpportunityRow;
}
