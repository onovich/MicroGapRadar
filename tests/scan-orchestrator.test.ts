import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RunScanRadarTaskInactiveError,
  RunScanRadarTaskNotFoundError,
  RunScanUnsupportedProviderError,
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
import type { SerpProvider, SerpResult, SerpSearchInput } from "../services/serp";

describe("runScan", () => {
  it("runs the deterministic mock scan chain and persists scored opportunities", async () => {
    const repository = new FakeScanRepository(activeRadarTask());
    const originalFetch = globalThis.fetch;
    globalThis.fetch = blockedFetch;

    try {
      const result = await runScan(
        {
          radarTaskId: "task_game",
          serpLimit: 1,
        },
        { repository },
      );

      assert.equal(result.status, "completed");
      assert.equal(result.useMockSerp, true);
      assert.deepEqual(result.counts, {
        keywordCandidates: 10,
        serpSuccesses: 10,
        opportunities: 10,
      });
      assert.equal(result.errors.length, 0);
      assert.equal(result.opportunities.length, 10);
      assert.equal(repository.searchRuns.length, 1);
      assert.equal(repository.keywordCandidates.length, 10);
      assert.equal(repository.serpResults.length, 10);
      assert.equal(repository.opportunities.length, 10);

      const finalRunUpdate = repository.searchRunUpdates.at(-1);
      assert.equal(finalRunUpdate?.input.status, "completed");
      assert.equal(finalRunUpdate?.input.keywordCount, 10);
      assert.equal(finalRunUpdate?.input.serpSuccessCount, 10);
      assert.equal(finalRunUpdate?.input.opportunityCount, 10);
      assert.equal(finalRunUpdate?.input.errorMessage, null);

      const persistedOpportunity = repository.opportunities[0];
      assert.ok(persistedOpportunity);
      assert.equal(persistedOpportunity.searchRunId, result.searchRunId);
      assert.equal(persistedOpportunity.radarTaskId, "task_game");
      assert.equal(
        persistedOpportunity.scoreBreakdown.totalScore,
        persistedOpportunity.totalScore,
      );
      assert.equal(typeof persistedOpportunity.scoreExplanation.totalScore, "string");
      assert.ok(persistedOpportunity.scoreExplanation.totalScore.length > 0);
      assert.match(persistedOpportunity.monetizationSummary, /Primary:/);
      assert.match(persistedOpportunity.riskSummary, /low|medium|high|excluded/);

      const rawAnalysis = persistedOpportunity.rawAnalysis as {
        keywordCandidate?: unknown;
        serpAnalysis?: unknown;
        opportunityAnalysis?: unknown;
        serpResults?: unknown[];
      };
      assert.ok(rawAnalysis.keywordCandidate);
      assert.ok(rawAnalysis.serpAnalysis);
      assert.ok(rawAnalysis.opportunityAnalysis);
      assert.equal(rawAnalysis.serpResults?.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects missing, inactive, and unsupported non-mock provider scans before creating a run", async () => {
    const missingRepository = new FakeScanRepository(null);
    await assert.rejects(
      () => runScan({ radarTaskId: "missing" }, { repository: missingRepository }),
      RunScanRadarTaskNotFoundError,
    );
    assert.equal(missingRepository.searchRuns.length, 0);

    const inactiveRepository = new FakeScanRepository({
      ...activeRadarTask(),
      isActive: false,
    });
    await assert.rejects(
      () => runScan({ radarTaskId: "task_game" }, { repository: inactiveRepository }),
      RunScanRadarTaskInactiveError,
    );
    assert.equal(inactiveRepository.searchRuns.length, 0);

    const unsupportedProviderRepository = new FakeScanRepository(activeRadarTask());
    await assert.rejects(
      () =>
        runScan(
          { radarTaskId: "task_game", useMockSerp: false },
          { repository: unsupportedProviderRepository },
        ),
      RunScanUnsupportedProviderError,
    );
    assert.equal(unsupportedProviderRepository.searchRuns.length, 0);
  });

  it("keeps successful keyword opportunities when one keyword fails", async () => {
    const repository = new FakeScanRepository(activeRadarTask());
    const serpProvider = new FailingSerpProvider();

    const result = await runScan(
      {
        radarTaskId: "task_game",
        keywordLimit: 3,
        serpLimit: 2,
      },
      {
        repository,
        serpProvider,
      },
    );

    assert.equal(result.status, "partial_failed");
    assert.deepEqual(result.counts, {
      keywordCandidates: 3,
      serpSuccesses: 2,
      opportunities: 2,
    });
    assert.equal(result.opportunities.length, 2);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]?.stage, "serp_search");
    assert.match(result.errors[0]?.message ?? "", /\[redacted\]/);
    assert.doesNotMatch(result.errors[0]?.message ?? "", /sk-test-secret/);
    assert.doesNotMatch(result.errors[0]?.message ?? "", /super-secret/);

    const failedKeyword = repository.keywordCandidates.find(
      (candidate) => candidate.keyword.includes("checker"),
    );
    assert.equal(failedKeyword?.status, "failed");

    const finalRunUpdate = repository.searchRunUpdates.at(-1);
    assert.equal(finalRunUpdate?.input.status, "partial_failed");
    assert.match(finalRunUpdate?.input.errorMessage ?? "", /serp_search/);
    assert.doesNotMatch(finalRunUpdate?.input.errorMessage ?? "", /super-secret/);
  });

  it("marks the run failed with sanitized errors when no useful output is saved", async () => {
    const repository = new FailingKeywordPersistenceRepository(activeRadarTask());

    const result = await runScan(
      {
        radarTaskId: "task_game",
        keywordLimit: 2,
      },
      { repository },
    );

    assert.equal(result.status, "failed");
    assert.deepEqual(result.counts, {
      keywordCandidates: 0,
      serpSuccesses: 0,
      opportunities: 0,
    });
    assert.equal(result.opportunities.length, 0);
    assert.equal(result.errors.length, 2);
    assert.ok(
      result.errors.every((error) => error.stage === "keyword_persistence"),
    );
    assert.ok(
      result.errors.every((error) => /\[redacted\]/.test(error.message)),
    );
    assert.ok(
      result.errors.every((error) => !/sk-test-secret|super-secret/.test(error.message)),
    );

    const finalRunUpdate = repository.searchRunUpdates.at(-1);
    assert.equal(finalRunUpdate?.input.status, "failed");
    assert.equal(finalRunUpdate?.input.keywordCount, 0);
    assert.equal(finalRunUpdate?.input.serpSuccessCount, 0);
    assert.equal(finalRunUpdate?.input.opportunityCount, 0);
    assert.match(finalRunUpdate?.input.errorMessage ?? "", /keyword_persistence/);
    assert.doesNotMatch(finalRunUpdate?.input.errorMessage ?? "", /sk-test-secret/);
    assert.doesNotMatch(finalRunUpdate?.input.errorMessage ?? "", /super-secret/);
  });
});

const blockedFetch: typeof fetch = async () => {
  throw new Error("Network should not be called by the default mock scan path.");
};

function activeRadarTask(): ScanRadarTask {
  return {
    id: "task_game",
    name: "GameDev Microtools",
    domainDescription: "Steam, Unity, indie game launch microtools",
    seedExamples: ["steam description"],
    countries: ["US"],
    languages: ["en"],
    userAdvantages: ["GameDev", "AI automation"],
    monetizationPreferences: ["ads", "paid_export", "affiliate"],
    riskPreferences: {
      maxRisk: "high",
      avoidYMYLConclusions: true,
    },
    excludedTopics: ["adult", "gambling"],
    dailyLimit: 10,
    isActive: true,
  };
}

class FailingSerpProvider implements SerpProvider {
  async search(input: SerpSearchInput): Promise<SerpResult[]> {
    if (input.keyword.includes("checker")) {
      throw new Error(
        "SERP provider failed token=super-secret sk-test-secret",
      );
    }

    return [
      {
        position: 1,
        title: `${input.keyword} guide`,
        url: `https://example.com/${slugify(input.keyword)}-guide`,
        domain: "example.com",
        snippet: "A generic guide without an interactive tool.",
        resultType: "organic",
      },
      {
        position: 2,
        title: `${input.keyword} discussion`,
        url: `https://reddit.com/r/gamedev/${slugify(input.keyword)}`,
        domain: "reddit.com",
        snippet: "A discussion thread asking for a faster workflow.",
        resultType: "forum",
      },
    ];
  }
}

class FakeScanRepository implements ScanRepository {
  readonly searchRuns: Array<PersistedSearchRun & { radarTaskId: string }> = [];
  readonly searchRunUpdates: Array<{ id: string; input: UpdateSearchRunInput }> = [];
  readonly keywordCandidates: Array<
    PersistedKeywordCandidate & CreateKeywordCandidateInput & { status: string }
  > = [];
  readonly serpResults: CreateSerpResultInput[] = [];
  readonly opportunities: CreateOpportunityInput[] = [];

  private nextSearchRunId = 1;
  private nextKeywordCandidateId = 1;
  private nextOpportunityId = 1;

  constructor(private readonly radarTask: ScanRadarTask | null) {}

  async findRadarTask(id: string): Promise<ScanRadarTask | null> {
    return this.radarTask?.id === id ? this.radarTask : null;
  }

  async createSearchRun(input: {
    radarTaskId: string;
  }): Promise<PersistedSearchRun> {
    const run = {
      id: `run_${this.nextSearchRunId}`,
      radarTaskId: input.radarTaskId,
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
    const keywordCandidate = {
      id: `keyword_${this.nextKeywordCandidateId}`,
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
    const id = `opportunity_${this.nextOpportunityId}`;
    this.nextOpportunityId += 1;
    this.opportunities.push(input);

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
}

class FailingKeywordPersistenceRepository extends FakeScanRepository {
  async createKeywordCandidate(
    _input: CreateKeywordCandidateInput,
  ): Promise<PersistedKeywordCandidate> {
    throw new Error(
      "Prisma keyword write failed api_key=super-secret sk-test-secret",
    );
  }
}

function slugify(value: string | undefined): string {
  return (value ?? "keyword")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
