import Link from "next/link";
import * as React from "react";

import type { OpportunityDetailViewModel } from "@/lib/opportunities";

import { MvpSpecPanel } from "./MvpSpecPanel";
import { getRiskBadgeClass } from "./OpportunityCard";
import { OpportunityStatusControls } from "./OpportunityStatusControls";
import { ScoreBadge } from "./ScoreBadge";

type OpportunityDetailProps = {
  opportunity: OpportunityDetailViewModel;
};

export function OpportunityDetail({ opportunity }: OpportunityDetailProps) {
  const updateUrl = `/api/opportunities/${encodeURIComponent(opportunity.id)}`;
  const mvpSpecUrl =
    `/api/opportunities/${encodeURIComponent(opportunity.id)}/mvp-spec`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-5 border-b border-ink/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <Link
            className="text-sm font-semibold text-signal hover:underline"
            href="/opportunities"
          >
            Back to opportunities
          </Link>
          <div className="space-y-2">
            <p className="flex flex-wrap gap-2 text-sm font-medium uppercase text-ink/55">
              <span>{opportunity.radarTask.name}</span>
              <span>{opportunity.marketLabel}</span>
              <span>{opportunity.toolTypeLabel}</span>
            </p>
            <h1 className="max-w-4xl text-3xl font-semibold leading-10 text-ink">
              {opportunity.title}
            </h1>
            <p className="text-base leading-7 text-ink/65">
              {opportunity.keyword}
            </p>
          </div>
        </div>

        <ScoreBadge score={opportunity.totalScore} />
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-lg border border-ink/10 bg-white/85 p-5">
          <h2 className="text-sm font-semibold uppercase text-ink/55">
            Brief
          </h2>
          <p className="mt-3 max-w-4xl text-base leading-7 text-ink/75">
            {opportunity.summary}
          </p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailTerm label="Target user" value={opportunity.targetUser} />
            <DetailTerm label="Search intent" value={opportunity.searchIntent} />
          </dl>
        </div>

        <OpportunityStatusControls
          initialStatus={opportunity.status}
          initialStatusLabel={opportunity.statusLabel}
          initialUpdatedAt={opportunity.updatedAt}
          opportunityId={opportunity.id}
          updateUrl={updateUrl}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <div className="space-y-4">
          <section
            aria-labelledby="score-breakdown-heading"
            className="rounded-lg border border-ink/10 bg-white/85 p-5"
          >
            <h2
              className="text-xl font-semibold text-ink"
              id="score-breakdown-heading"
            >
              Score breakdown
            </h2>
            {opportunity.scoreBreakdownItems.length > 0 ? (
              <dl className="mt-4 divide-y divide-ink/10">
                {opportunity.scoreBreakdownItems.map((item) => (
                  <div
                    className="grid gap-2 py-3 sm:grid-cols-[10rem_4rem_minmax(0,1fr)] sm:items-start"
                    key={item.key}
                  >
                    <dt className="font-semibold text-ink">{item.label}</dt>
                    <dd className="text-sm font-semibold text-ink/80">
                      {item.value}
                    </dd>
                    <dd className="text-sm leading-6 text-ink/65">
                      {item.explanation ?? "No explanation recorded."}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm leading-6 text-ink/65">
                No score breakdown was recorded for this opportunity.
              </p>
            )}
          </section>

          <section
            aria-labelledby="serp-tool-heading"
            className="rounded-lg border border-ink/10 bg-white/85 p-5"
          >
            <h2 className="text-xl font-semibold text-ink" id="serp-tool-heading">
              SERP and toolability
            </h2>
            <div className="mt-4 space-y-5">
              <DetailBlock
                label="SERP weakness"
                value={opportunity.serpWeaknessSummary}
              />
              {opportunity.toolabilitySummary ? (
                <DetailBlock
                  label="Tool concept"
                  value={opportunity.toolabilitySummary}
                />
              ) : null}
              {opportunity.toolConcept ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailList
                    items={opportunity.toolConcept.inputFields}
                    label="Inputs"
                  />
                  <DetailList
                    items={opportunity.toolConcept.outputModules}
                    label="Outputs"
                  />
                </div>
              ) : null}
            </div>
          </section>

          <MvpSpecPanel
            generateUrl={mvpSpecUrl}
            initialSpec={opportunity.mvpSpec}
            opportunityId={opportunity.id}
          />
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-ink/10 bg-white/85 p-5">
            <h2 className="text-sm font-semibold uppercase text-ink/55">
              Monetization
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              {opportunity.monetizationSummary}
            </p>
            {opportunity.monetizationTypes.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {opportunity.monetizationTypes.map((type) => (
                  <span
                    className="rounded-lg border border-ink/10 bg-panel px-2.5 py-1 text-xs font-medium text-ink/70"
                    key={type}
                  >
                    {type}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-ink/10 bg-white/85 p-5">
            <h2 className="text-sm font-semibold uppercase text-ink/55">
              Risk and build
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={[
                  "rounded-lg border px-2.5 py-1 text-xs font-semibold",
                  getRiskBadgeClass(opportunity.riskLevel),
                ].join(" ")}
              >
                {opportunity.riskLabel}
              </span>
              <span className="rounded-lg border border-ink/10 bg-white px-2.5 py-1 text-xs font-medium text-ink/65">
                Build: {opportunity.buildComplexityLabel}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink/70">
              {opportunity.riskSummary}
            </p>
          </section>

          <section className="rounded-lg border border-ink/10 bg-white/85 p-5">
            <h2 className="text-sm font-semibold uppercase text-ink/55">
              Kill criteria
            </h2>
            <DetailList
              emptyText="No kill criteria recorded."
              items={opportunity.killCriteria}
            />
          </section>

          <section className="rounded-lg border border-ink/10 bg-white/85 p-5">
            <h2 className="text-sm font-semibold uppercase text-ink/55">
              Run context
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <DetailTerm label="Radar task" value={opportunity.radarTask.name} />
              <DetailTerm
                label="Search run"
                value={opportunity.searchRun.statusLabel}
              />
              <DetailTerm
                label="Started"
                value={formatDateTime(opportunity.searchRun.startedAt)}
              />
              {opportunity.searchRun.completedAt ? (
                <DetailTerm
                  label="Completed"
                  value={formatDateTime(opportunity.searchRun.completedAt)}
                />
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-ink/50">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-ink/75">{value}</dd>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{label}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/70">{value}</p>
    </div>
  );
}

function DetailList({
  emptyText,
  items,
  label,
}: {
  emptyText?: string;
  items: string[];
  label?: string;
}) {
  if (items.length === 0) {
    return emptyText ? (
      <p className="mt-3 text-sm leading-6 text-ink/65">{emptyText}</p>
    ) : null;
  }

  return (
    <div>
      {label ? (
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
      ) : null}
      <ul className="mt-2 space-y-2 text-sm leading-6 text-ink/70">
        {items.map((item) => (
          <li className="rounded-lg border border-ink/10 bg-panel px-3 py-2" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
