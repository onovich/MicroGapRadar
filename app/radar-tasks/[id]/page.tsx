import Link from "next/link";
import { notFound } from "next/navigation";

import { RadarTaskDeleteControl } from "@/components/RadarTaskDeleteControl";
import { RadarTaskRunScanControl } from "@/components/RadarTaskRunScanControl";
import {
  getRadarTaskDetailData,
  type RadarTaskDetailViewModel,
} from "@/lib/radar-task-view-models";
import { RadarTaskNotFoundError } from "@/lib/radar-tasks";

export const dynamic = "force-dynamic";

type RadarTaskDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RadarTaskDetailPage({
  params,
}: RadarTaskDetailPageProps) {
  const { id } = await params;
  let task: RadarTaskDetailViewModel;

  try {
    task = await getRadarTaskDetailData(id);
  } catch (error) {
    if (error instanceof RadarTaskNotFoundError) {
      notFound();
    }

    throw error;
  }

  return (
    <main className="min-h-screen bg-panel/90 px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-ink/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink/55">
              {task.statusLabel} / {task.riskLabel}
            </p>
            <h1 className="mt-1 text-3xl font-semibold leading-9 text-ink">
              {task.name}
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link className={secondaryLinkClassName} href="/radar-tasks">
              All tasks
            </Link>
            <Link className={primaryLinkClassName} href={task.editHref}>
              Edit
            </Link>
          </nav>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-lg border border-ink/10 bg-white/90 p-5">
            <h2 className="text-lg font-semibold text-ink">Task profile</h2>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              {task.domainDescription}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <FieldList label="Seed examples" values={task.seedExamples} />
              <FieldList label="Markets" values={task.countries} />
              <FieldList label="Languages" values={task.languages} />
              <FieldList label="Advantages" values={task.userAdvantages} />
              <FieldList
                label="Monetization"
                values={task.monetizationPreferences}
              />
              <FieldList label="Excluded topics" values={task.excludedTopics} />
            </div>
          </article>

          <div className="space-y-4">
            <RadarTaskRunScanControl task={task} />
            <RadarTaskDeleteControl id={task.id} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <RecentRuns runs={task.recentRuns} />
          <LatestOpportunities opportunities={task.latestOpportunities} />
        </section>
      </div>
    </main>
  );
}

function FieldList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-panel/70 p-3">
      <h3 className="text-sm font-semibold text-ink">{label}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value) => (
            <span
              className="rounded-lg border border-ink/10 bg-white px-2.5 py-1 text-xs font-medium text-ink/65"
              key={value}
            >
              {value}
            </span>
          ))
        ) : (
          <span className="text-sm text-ink/55">None</span>
        )}
      </div>
    </div>
  );
}

function RecentRuns({ runs }: { runs: RadarTaskDetailViewModel["recentRuns"] }) {
  return (
    <section className="space-y-3 rounded-lg border border-ink/10 bg-white/90 p-5">
      <h2 className="text-lg font-semibold text-ink">Recent runs</h2>
      {runs.length > 0 ? (
        <div className="space-y-2">
          {runs.map((run) => (
            <div className="rounded-lg border border-ink/10 bg-panel/70 p-3" key={run.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{run.statusLabel}</p>
                <time className="text-xs text-ink/55" dateTime={run.startedAt}>
                  {formatDate(run.startedAt)}
                </time>
              </div>
              <p className="mt-2 text-sm text-ink/65">
                {run.keywordCount} keywords / {run.serpSuccessCount} SERP /{" "}
                {run.opportunityCount} opportunities
              </p>
              {run.errorMessage ? (
                <p className="mt-2 text-sm text-flare">{run.errorMessage}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-ink/60">No runs yet.</p>
      )}
    </section>
  );
}

function LatestOpportunities({
  opportunities,
}: {
  opportunities: RadarTaskDetailViewModel["latestOpportunities"];
}) {
  return (
    <section className="space-y-3 rounded-lg border border-ink/10 bg-white/90 p-5">
      <h2 className="text-lg font-semibold text-ink">Top opportunities</h2>
      {opportunities.length > 0 ? (
        <div className="space-y-2">
          {opportunities.map((opportunity) => (
            <Link
              className="block rounded-lg border border-ink/10 bg-panel/70 p-3 hover:border-signal/40"
              href={opportunity.detailHref}
              key={opportunity.id}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-ink">{opportunity.title}</h3>
                <span className="rounded-lg border border-signal/20 bg-signal/10 px-2.5 py-1 text-xs font-semibold text-signal">
                  {opportunity.totalScore}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink/60">{opportunity.keyword}</p>
              <p className="mt-1 text-xs font-medium uppercase text-ink/45">
                {opportunity.marketLabel} / {opportunity.toolTypeLabel} /{" "}
                {opportunity.statusLabel}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-ink/60">
          Run a mock scan to generate opportunities.
        </p>
      )}
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const primaryLinkClassName =
  "rounded-lg border border-signal/30 bg-signal px-3 py-2 text-sm font-semibold text-white hover:bg-signal/90";

const secondaryLinkClassName =
  "rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink/70 hover:border-signal/40 hover:text-signal";
