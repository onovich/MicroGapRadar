import Link from "next/link";

import { OpportunityCard } from "@/components/OpportunityCard";
import {
  formatRiskLabel,
  getOpportunityListData,
  type OpportunityListViewModel,
} from "@/lib/opportunities";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type OpportunitiesPageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function OpportunitiesPage({
  searchParams,
}: OpportunitiesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const opportunities = await getOpportunityListData(resolvedSearchParams);

  return (
    <main className="min-h-screen bg-panel/90 px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-ink/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink/55">
              {opportunities.totalAfterFilters}{" "}
              {opportunities.totalAfterFilters === 1
                ? "opportunity"
                : "opportunities"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold leading-9 text-ink">
              Opportunities
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link
              className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink hover:border-signal/40 hover:text-signal"
              href="/dashboard"
            >
              Dashboard
            </Link>
            <Link
              className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink/70 hover:border-signal/40 hover:text-signal"
              href="/"
            >
              Home
            </Link>
          </nav>
        </header>

        <OpportunityFiltersForm opportunities={opportunities} />

        <section aria-labelledby="opportunity-list-heading" className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h2
              className="text-xl font-semibold text-ink"
              id="opportunity-list-heading"
            >
              Score-sorted list
            </h2>
            <p className="text-sm text-ink/60">
              {opportunities.hasActiveFilters ? "Filtered" : "All"} results
            </p>
          </div>

          {opportunities.items.length > 0 ? (
            <div className="space-y-3">
              {opportunities.items.map((opportunity, index) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  rank={index + 1}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-ink/20 bg-white/70 p-6">
              <h3 className="text-lg font-semibold text-ink">
                No opportunities match.
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
                Try clearing a filter, lowering the minimum score, or scanning
                a broader radar task.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function OpportunityFiltersForm({
  opportunities,
}: {
  opportunities: OpportunityListViewModel;
}) {
  const { filters, filterOptions } = opportunities;

  return (
    <form
      action="/opportunities"
      className="grid gap-3 rounded-lg border border-ink/10 bg-white/85 p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto_auto]"
      method="get"
    >
      <label className="space-y-1 text-sm font-medium text-ink/70">
        <span>Radar task</span>
        <select
          className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink"
          defaultValue={filters.radarTaskId ?? ""}
          name="radarTaskId"
        >
          <option value="">All tasks</option>
          {filterOptions.radarTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm font-medium text-ink/70">
        <span>Min score</span>
        <input
          className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink"
          defaultValue={filters.minScore ?? ""}
          max={100}
          min={0}
          name="minScore"
          type="number"
        />
      </label>

      <label className="space-y-1 text-sm font-medium text-ink/70">
        <span>Tool type</span>
        <select
          className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink"
          defaultValue={filters.toolType ?? ""}
          name="toolType"
        >
          <option value="">All types</option>
          {filterOptions.toolTypes.map((toolType) => (
            <option key={toolType} value={toolType}>
              {formatTokenLabel(toolType)}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm font-medium text-ink/70">
        <span>Risk</span>
        <select
          className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink"
          defaultValue={filters.riskLevel ?? ""}
          name="riskLevel"
        >
          <option value="">All risks</option>
          {filterOptions.riskLevels.map((riskLevel) => (
            <option key={riskLevel} value={riskLevel}>
              {formatRiskLabel(riskLevel)}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm font-medium text-ink/70">
        <span>Status</span>
        <select
          className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink"
          defaultValue={filters.status ?? ""}
          name="status"
        >
          <option value="">All statuses</option>
          {filterOptions.statuses.map((status) => (
            <option key={status} value={status}>
              {formatTokenLabel(status)}
            </option>
          ))}
        </select>
      </label>

      <button
        className="h-10 self-end rounded-lg border border-signal/30 bg-signal px-4 text-sm font-semibold text-white hover:bg-signal/90"
        type="submit"
      >
        Apply
      </button>
      <Link
        className="flex h-10 items-center justify-center self-end rounded-lg border border-ink/15 bg-white px-4 text-sm font-semibold text-ink/70 hover:border-signal/40 hover:text-signal"
        href="/opportunities"
      >
        Reset
      </Link>
    </form>
  );
}

function formatTokenLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
