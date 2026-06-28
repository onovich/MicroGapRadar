import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateMvpSpec,
  MVP_SPEC_LOCAL_MODEL,
} from "../agents";
import {
  createRadarTaskFromForm,
  deactivateRadarTaskFromForm,
  updateRadarTaskFromForm,
} from "../app/radar-tasks/action-handlers";
import {
  createAdminSessionToken,
  isAdminAuthConfigured,
  shouldProtectPathname,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "../lib/auth";
import {
  serializeOpportunityDetail,
  type OpportunityDetailRow,
} from "../lib/opportunities";
import {
  buildRadarTaskDetailViewModel,
  buildRadarTaskListViewModel,
  parseRadarTaskFormData,
  parseRadarTaskUpdateFormData,
  type OpportunityRow,
  type RadarTaskRow,
  type SearchRunRow,
} from "../lib/radar-task-view-models";
import {
  buildRunScanPayload,
  isRunScanDisabled,
  serializeRunScanResult,
} from "../lib/radar-task-run-scan";
import {
  runScan,
  type CreateKeywordCandidateInput,
  type CreateOpportunityInput,
  type CreateSerpResultInput,
  type PersistedKeywordCandidate,
  type PersistedSearchRun,
  type RunScanOpportunity,
  type ScanRadarTask,
  type ScanRepository,
  type UpdateSearchRunInput,
} from "../services/scan-orchestrator";

describe("48-hour MVP local release smoke", () => {
  it("covers local admin gate and Radar Task UI helpers without network", async () => {
    const originalFetch = globalThis.fetch;
    let blockedNetworkAttempts = 0;

    globalThis.fetch = (async () => {
      blockedNetworkAttempts += 1;
      throw new Error("Network is blocked for the local release smoke.");
    }) as typeof fetch;

    try {
      const authConfig = {
        adminEmail: "admin@example.com",
        adminPassword: "correct-local-password",
        sessionSecret: "test-session-secret-with-at-least-32-chars",
        nodeEnv: "development",
      };
      const now = new Date("2026-06-29T00:00:00.000Z");
      const token = await createAdminSessionToken(authConfig, {
        now,
        maxAgeSeconds: 120,
      });

      assert.equal(isAdminAuthConfigured(authConfig), true);
      assert.equal(
        isAdminAuthConfigured({
          adminPassword: "change-me-local-only",
          sessionSecret: authConfig.sessionSecret,
        }),
        false,
      );
      assert.equal(
        await verifyAdminPassword("correct-local-password", authConfig),
        true,
      );
      assert.equal(
        await verifyAdminSessionToken(token, authConfig, {
          now: new Date("2026-06-29T00:01:00.000Z"),
        }),
        true,
      );
      assert.equal(
        await verifyAdminSessionToken(`${token}tampered`, authConfig, { now }),
        false,
      );
      assert.equal(shouldProtectPathname("/dashboard"), true);
      assert.equal(shouldProtectPathname("/radar-tasks/task_game/edit"), true);
      assert.equal(shouldProtectPathname("/api/scans/run"), true);
      assert.equal(shouldProtectPathname("/login"), false);

      const activeTask = radarTaskRow({ id: "task_game", name: "GameDev Radar" });
      const inactiveTask = radarTaskRow({
        id: "task_archive",
        name: "Archived Radar",
        isActive: false,
      });
      const list = buildRadarTaskListViewModel([activeTask, inactiveTask]);
      const listWithInactive = buildRadarTaskListViewModel(
        [activeTask, inactiveTask],
        { showInactive: true },
      );
      const detail = buildRadarTaskDetailViewModel({
        task: activeTask,
        recentRuns: [searchRunRow({ id: "run_game", radarTaskId: "task_game" })],
        latestOpportunities: [
          opportunityRow({
            id: "opp_game",
            radarTaskId: "task_game",
            searchRunId: "run_game",
          }),
        ],
      });

      assert.deepEqual(
        list.items.map((item) => item.id),
        ["task_game"],
      );
      assert.equal(list.activeCount, 1);
      assert.equal(list.inactiveCount, 1);
      assert.equal(listWithInactive.total, 2);
      assert.equal(detail.detailHref, "/radar-tasks/task_game");
      assert.equal(detail.editHref, "/radar-tasks/task_game/edit");
      assert.equal(detail.recentRuns[0].statusLabel, "Completed");
      assert.equal(detail.latestOpportunities[0].detailHref, "/opportunities/opp_game");

      const formData = validRadarTaskFormData();
      const createPayload = parseRadarTaskFormData(formData);
      const updatePayload = parseRadarTaskUpdateFormData(formData);

      assert.equal(createPayload.name, "GameDev Microtools");
      assert.deepEqual(createPayload.countries, ["US", "JP"]);
      assert.equal(createPayload.riskPreferences.maxRisk, "medium");
      assert.equal(updatePayload.dailyLimit, 12);
      assert.equal("userId" in createPayload, false);

      const authChecks: string[] = [];
      const createCalls: unknown[] = [];
      const updateCalls: Array<{ id: string; input: unknown }> = [];
      const deleteCalls: string[] = [];
      const revalidated: string[] = [];
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
        updateRadarTaskFromForm("task_game", formData, deps),
        /REDIRECT:\/radar-tasks\/task_game/,
      );

      const deactivateForm = new FormData();
      deactivateForm.set("confirmDeactivate", "on");

      await assert.rejects(
        deactivateRadarTaskFromForm("task_game", deactivateForm, deps),
        /REDIRECT:\/radar-tasks$/,
      );

      assert.deepEqual(authChecks, ["checked", "checked", "checked"]);
      assert.equal(createCalls.length, 1);
      assert.deepEqual(updateCalls.map((call) => call.id), ["task_game"]);
      assert.deepEqual(deleteCalls, ["task_game"]);
      assert.deepEqual(revalidated, [
        "/radar-tasks",
        "/radar-tasks",
        "/radar-tasks/task_game",
        "/radar-tasks",
        "/radar-tasks/task_game",
      ]);

      const runPayload = buildRunScanPayload("task_game", {
        keywordLimit: "2",
        serpLimit: "1",
      });
      const runResult = serializeRunScanResult({
        data: {
          searchRunId: "run_game",
          status: "completed",
          counts: {
            keywordCandidates: 2,
            serpSuccesses: 2,
            opportunities: 1,
          },
          errors: [{ message: "one keyword warning" }],
        },
      });

      assert.deepEqual(runPayload, {
        radarTaskId: "task_game",
        useMockSerp: true,
        keywordLimit: 2,
        serpLimit: 1,
      });
      assert.equal(isRunScanDisabled({ isActive: false }), true);
      assert.equal(isRunScanDisabled({ isActive: true }), false);
      assert.deepEqual(runResult, {
        searchRunId: "run_game",
        status: "completed",
        keywordCandidates: 2,
        serpSuccesses: 2,
        opportunities: 1,
        errors: ["one keyword warning"],
      });
      assert.equal(blockedNetworkAttempts, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("covers radar task context, mock scan, opportunity detail, and MVP Spec generation without network", async () => {
    const repository = new ReleaseSmokeRepository(releaseRadarTask());
    const originalFetch = globalThis.fetch;
    let blockedNetworkAttempts = 0;

    globalThis.fetch = (async () => {
      blockedNetworkAttempts += 1;
      throw new Error("Network is blocked for the local release smoke.");
    }) as typeof fetch;

    try {
      const scan = await runScan(
        {
          radarTaskId: "task_game",
          useMockSerp: true,
          keywordLimit: 2,
          serpLimit: 1,
        },
        { repository },
      );

      assert.equal(scan.status, "completed");
      assert.equal(scan.useMockSerp, true);
      assert.equal(scan.radarTaskId, "task_game");
      assert.equal(scan.counts.keywordCandidates, 2);
      assert.equal(scan.counts.serpSuccesses, 2);
      assert.ok(scan.counts.opportunities >= 1);
      assert.equal(scan.errors.length, 0);
      assert.ok(repository.loadedRadarTaskIds.includes("task_game"));
      assert.equal(repository.searchRuns.length, 1);
      assert.ok(repository.serpResults.length >= 1);
      assert.ok(repository.opportunities.length >= 1);

      const firstOpportunity = repository.opportunities[0];
      assert.ok(firstOpportunity);
      assert.equal(firstOpportunity.radarTaskId, "task_game");
      assert.equal(firstOpportunity.searchRunId, scan.searchRunId);
      assert.equal(firstOpportunity.scoreBreakdown.totalScore, firstOpportunity.totalScore);
      assert.match(firstOpportunity.riskSummary, /low|medium|high|excluded/);

      const rawAnalysis = firstOpportunity.rawAnalysis as {
        keywordCandidate?: unknown;
        serpAnalysis?: unknown;
        opportunityAnalysis?: {
          toolConcept?: {
            inputFields?: unknown[];
            outputModules?: unknown[];
          };
        };
        serpResults?: unknown[];
      };

      assert.ok(rawAnalysis.keywordCandidate);
      assert.ok(rawAnalysis.serpAnalysis);
      assert.ok(rawAnalysis.opportunityAnalysis);
      assert.equal(rawAnalysis.serpResults?.length, 1);

      const detail = serializeOpportunityDetail(
        repository.toOpportunityDetailRow(firstOpportunity),
      );

      assert.equal(detail.radarTask.id, "task_game");
      assert.equal(detail.radarTask.name, "GameDev Microtools");
      assert.equal(detail.marketLabel, "EN / US");
      assert.equal(detail.searchRun.status, "completed");
      assert.equal(detail.mvpSpec, null);
      assert.ok(detail.scoreBreakdownItems.length >= 7);
      assert.ok(detail.toolConcept);
      assert.ok((detail.toolConcept.inputFields.length ?? 0) >= 1);
      assert.ok(detail.killCriteria.length >= 1);

      const spec = await generateMvpSpec(detail);

      assert.equal(spec.generatedByModel, MVP_SPEC_LOCAL_MODEL);
      assert.match(spec.markdown, /^# MVP Spec:/);
      assert.match(spec.markdown, /## Opportunity Context/);
      assert.match(spec.markdown, /## Page Structure/);
      assert.match(spec.markdown, /## Form Fields/);
      assert.match(spec.markdown, /## Data Model/);
      assert.match(spec.markdown, /## API Routes/);
      assert.match(spec.markdown, /## Monetization Entry Points/);
      assert.match(spec.markdown, /## Risk Notes/);
      assert.match(spec.markdown, /## 48-Hour Build Checklist/);
      assert.match(spec.markdown, /## Acceptance Criteria/);
      assert.match(spec.markdown, /## Kill Criteria/);
      assert.equal(blockedNetworkAttempts, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

type StoredSearchRun = PersistedSearchRun & {
  radarTaskId: string;
  startedAt: Date;
};

type StoredKeywordCandidate = PersistedKeywordCandidate &
  CreateKeywordCandidateInput & {
    status: "pending" | "searched" | "failed";
  };

type StoredOpportunity = CreateOpportunityInput & RunScanOpportunity;

class ReleaseSmokeRepository implements ScanRepository {
  readonly loadedRadarTaskIds: string[] = [];
  readonly searchRuns: StoredSearchRun[] = [];
  readonly searchRunUpdates: Array<{ id: string; input: UpdateSearchRunInput }> = [];
  readonly keywordCandidates: StoredKeywordCandidate[] = [];
  readonly serpResults: CreateSerpResultInput[] = [];
  readonly opportunities: StoredOpportunity[] = [];

  private nextSearchRunId = 1;
  private nextKeywordCandidateId = 1;
  private nextOpportunityId = 1;

  constructor(private readonly radarTask: ScanRadarTask) {}

  async findRadarTask(id: string): Promise<ScanRadarTask | null> {
    this.loadedRadarTaskIds.push(id);

    return this.radarTask.id === id ? this.radarTask : null;
  }

  async createSearchRun(input: {
    radarTaskId: string;
  }): Promise<PersistedSearchRun> {
    const run: StoredSearchRun = {
      id: `release_run_${this.nextSearchRunId}`,
      radarTaskId: input.radarTaskId,
      startedAt: new Date("2026-06-28T08:00:00.000Z"),
    };

    this.nextSearchRunId += 1;
    this.searchRuns.push(run);

    return { id: run.id };
  }

  async updateSearchRun(
    id: string,
    input: UpdateSearchRunInput,
  ): Promise<void> {
    this.searchRunUpdates.push({ id, input });
  }

  async createKeywordCandidate(
    input: CreateKeywordCandidateInput,
  ): Promise<PersistedKeywordCandidate> {
    const keywordCandidate: StoredKeywordCandidate = {
      id: `release_keyword_${this.nextKeywordCandidateId}`,
      ...input,
      status: "pending",
    };

    this.nextKeywordCandidateId += 1;
    this.keywordCandidates.push(keywordCandidate);

    return { id: keywordCandidate.id };
  }

  async updateKeywordCandidate(
    id: string,
    input: { status: "pending" | "searched" | "failed" },
  ): Promise<void> {
    const keywordCandidate = this.keywordCandidates.find(
      (candidate) => candidate.id === id,
    );

    if (keywordCandidate) {
      keywordCandidate.status = input.status;
    }
  }

  async createSerpResult(input: CreateSerpResultInput): Promise<void> {
    this.serpResults.push(input);
  }

  async createOpportunity(
    input: CreateOpportunityInput,
  ): Promise<RunScanOpportunity> {
    const id = `release_opportunity_${this.nextOpportunityId}`;
    const opportunity: StoredOpportunity = {
      id,
      ...input,
    };

    this.nextOpportunityId += 1;
    this.opportunities.push(opportunity);

    return {
      id,
      keyword: input.keyword,
      country: input.country,
      language: input.language,
      title: input.title,
      totalScore: input.totalScore,
      scoreBreakdown: input.scoreBreakdown,
      scoreExplanation: input.scoreExplanation,
    };
  }

  toOpportunityDetailRow(opportunity: StoredOpportunity): OpportunityDetailRow {
    const run = this.searchRuns.find(
      (searchRun) => searchRun.id === opportunity.searchRunId,
    );
    const finalRunUpdate = this.searchRunUpdates.findLast(
      (update) => update.id === opportunity.searchRunId &&
        update.input.status === "completed",
    );

    return {
      ...opportunity,
      status: "new",
      createdAt: new Date("2026-06-28T08:05:00.000Z"),
      updatedAt: new Date("2026-06-28T08:05:00.000Z"),
      radarTask: {
        id: this.radarTask.id,
        name: this.radarTask.name,
      },
      searchRun: {
        id: opportunity.searchRunId,
        status: finalRunUpdate?.input.status ?? "completed",
        startedAt: run?.startedAt ?? new Date("2026-06-28T08:00:00.000Z"),
        completedAt: new Date("2026-06-28T08:10:00.000Z"),
      },
      mvpSpec: null,
    } as unknown as OpportunityDetailRow;
  }
}

function releaseRadarTask(): ScanRadarTask {
  return {
    id: "task_game",
    name: "GameDev Microtools",
    domainDescription: "Steam, Unity, indie game launch, localization, and marketing microtools",
    seedExamples: ["steam short description generator", "unity store page checklist"],
    countries: ["US"],
    languages: ["en"],
    userAdvantages: ["GameDev", "AI automation", "fast MVP shipping"],
    monetizationPreferences: ["ads", "paid_export", "affiliate"],
    riskPreferences: {
      maxRisk: "medium",
      avoidYMYLConclusions: true,
    },
    excludedTopics: ["adult", "gambling", "medical", "financial"],
    dailyLimit: 10,
    isActive: true,
  };
}

function validRadarTaskFormData(): FormData {
  const formData = new FormData();

  formData.set("name", "GameDev Microtools");
  formData.set("domainDescription", "Steam, Unity, indie game launch microtools");
  formData.set("seedExamples", "steam launch planner\nunity checklist");
  formData.set("countries", "US, JP");
  formData.set("languages", "en, ja");
  formData.set("userAdvantages", "GameDev, AI automation");
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
    id: overrides.id ?? "task_game",
    userId: null,
    name: overrides.name ?? "GameDev Radar",
    domainDescription:
      overrides.domainDescription ??
      "Steam, Unity, indie game launch, localization, and marketing microtools",
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
    id: overrides.id ?? "run_game",
    radarTaskId: overrides.radarTaskId ?? "task_game",
    status: overrides.status ?? "completed",
    startedAt: overrides.startedAt ?? new Date("2026-06-29T01:00:00.000Z"),
    completedAt: overrides.completedAt ?? new Date("2026-06-29T01:02:00.000Z"),
    keywordCount: overrides.keywordCount ?? 2,
    serpSuccessCount: overrides.serpSuccessCount ?? 2,
    opportunityCount: overrides.opportunityCount ?? 1,
    estimatedCost: null,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-06-29T01:00:00.000Z"),
    radarTask: {
      id: overrides.radarTaskId ?? "task_game",
      name: "GameDev Radar",
    },
  } as SearchRunRow;
}

function opportunityRow(overrides: Partial<OpportunityRow> = {}): OpportunityRow {
  return {
    id: overrides.id ?? "opp_game",
    searchRunId: overrides.searchRunId ?? "run_game",
    radarTaskId: overrides.radarTaskId ?? "task_game",
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
      id: overrides.radarTaskId ?? "task_game",
      name: "GameDev Radar",
    },
    searchRun: {
      id: overrides.searchRunId ?? "run_game",
      status: "completed",
      startedAt: new Date("2026-06-29T01:00:00.000Z"),
      completedAt: new Date("2026-06-29T01:02:00.000Z"),
    },
  } as OpportunityRow;
}
