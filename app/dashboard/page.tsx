import Link from "next/link";

import { OpportunityCard } from "@/components/OpportunityCard";
import { getDashboardData } from "@/lib/opportunities";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dashboard = await getDashboardData();

  return (
    <main className="min-h-screen bg-panel/90 px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-ink/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink/55">
              {dashboard.todayLabel}
            </p>
            <h1 className="mt-1 text-3xl font-semibold leading-9 text-ink">
              Dashboard
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link
              className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink hover:border-signal/40 hover:text-signal"
              href="/opportunities"
            >
              All opportunities
            </Link>
            <Link
              className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink/70 hover:border-signal/40 hover:text-signal"
              href="/"
            >
              Home
            </Link>
          </nav>
        </header>

        <section aria-labelledby="scoreboard-heading" className="space-y-3">
          <h2
            className="text-sm font-semibold uppercase text-ink/55"
            id="scoreboard-heading"
          >
            Today scoreboard
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {dashboard.metrics.map((metric) => (
              <div
                className="rounded-lg border border-ink/10 bg-white/85 p-4"
                key={metric.label}
              >
                <dt className="text-sm font-medium text-ink/55">
                  {metric.label}
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-ink">
                  {metric.value}
                </dd>
                <p className="mt-1 text-xs leading-5 text-ink/55">
                  {metric.detail}
                </p>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="top-opportunities-heading" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                className="text-xl font-semibold text-ink"
                id="top-opportunities-heading"
              >
                Today's Top 5
              </h2>
            </div>
            <Link
              className="text-sm font-semibold text-signal hover:underline"
              href="/opportunities"
            >
              Open full list
            </Link>
          </div>

          {dashboard.topOpportunities.length > 0 ? (
            <div className="space-y-3">
              {dashboard.topOpportunities.map((opportunity, index) => (
                <OpportunityCard
                  compact
                  key={opportunity.id}
                  opportunity={opportunity}
                  rank={index + 1}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-ink/20 bg-white/70 p-6">
              <h3 className="text-lg font-semibold text-ink">
                No opportunities today.
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
                Run a scan from an active radar task, then come back here to
                compare today's highest-scoring microtool gaps.
              </p>
            </div>
          )}
        </section>

        <section aria-labelledby="recent-runs-heading" className="space-y-3">
          <h2 className="text-xl font-semibold text-ink" id="recent-runs-heading">
            Recent runs
          </h2>

          {dashboard.recentRuns.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-ink/10 bg-white/85">
              <table className="min-w-full divide-y divide-ink/10 text-left text-sm">
                <thead className="bg-white/70 text-xs uppercase text-ink/55">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Task</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Keywords</th>
                    <th className="px-4 py-3 font-semibold">SERP</th>
                    <th className="px-4 py-3 font-semibold">Opps</th>
                    <th className="px-4 py-3 font-semibold">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {dashboard.recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-3 font-medium text-ink">
                        {run.radarTaskName}
                      </td>
                      <td className="px-4 py-3 text-ink/70">
                        {run.statusLabel}
                      </td>
                      <td className="px-4 py-3 text-ink/70">
                        {run.keywordCount}
                      </td>
                      <td className="px-4 py-3 text-ink/70">
                        {run.serpSuccessCount}
                      </td>
                      <td className="px-4 py-3 text-ink/70">
                        {run.opportunityCount}
                      </td>
                      <td className="px-4 py-3 text-ink/70">
                        <time dateTime={run.startedAt}>
                          {formatTime(run.startedAt)}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-ink/20 bg-white/70 p-5 text-sm leading-6 text-ink/65">
              No scan runs have started today.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
