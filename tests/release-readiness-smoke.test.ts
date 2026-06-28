import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateMvpSpec,
  MVP_SPEC_LOCAL_MODEL,
} from "../agents";
import {
  serializeOpportunityDetail,
  type OpportunityDetailRow,
} from "../lib/opportunities";
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
