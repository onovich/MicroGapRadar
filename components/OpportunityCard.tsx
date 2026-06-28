import Link from "next/link";
import * as React from "react";

import type { OpportunityCardViewModel, RiskDisplayLevel } from "@/lib/opportunities";

import { ScoreBadge } from "./ScoreBadge";

type OpportunityCardProps = {
  opportunity: OpportunityCardViewModel;
  rank?: number;
  compact?: boolean;
};

const riskClasses: Record<RiskDisplayLevel, string> = {
  low: "border-signal/25 bg-signal/10 text-signal",
  medium: "border-flare/25 bg-flare/10 text-flare",
  high: "border-red-200 bg-red-50 text-red-700",
  excluded: "border-ink/20 bg-ink/10 text-ink/70",
  unknown: "border-ink/10 bg-white text-ink/55",
};

export function getRiskBadgeClass(level: RiskDisplayLevel): string {
  return riskClasses[level];
}

export function OpportunityCard({
  opportunity,
  rank,
  compact = false,
}: OpportunityCardProps) {
  const monetizationBadges = opportunity.monetizationTypes.slice(0, 3);

  return (
    <article className="rounded-lg border border-ink/10 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <ScoreBadge score={opportunity.totalScore} compact={compact} />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase text-ink/55">
                {rank ? <span>#{rank}</span> : null}
                <span>{opportunity.radarTask.name}</span>
                <span>{opportunity.marketLabel}</span>
                <span>{opportunity.toolTypeLabel}</span>
              </div>
              <h2 className="text-lg font-semibold leading-6 text-ink">
                <Link
                  className="underline-offset-4 hover:text-signal hover:underline"
                  href={opportunity.detailHref}
                >
                  {opportunity.title}
                </Link>
              </h2>
              <p className="text-sm leading-6 text-ink/65">
                {opportunity.keyword}
              </p>
            </div>

            <Link
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-ink/15 bg-white px-3 text-sm font-semibold text-ink hover:border-signal/40 hover:text-signal"
              href={opportunity.detailHref}
            >
              View brief
            </Link>
          </div>

          <p className="max-w-4xl text-sm leading-6 text-ink/75">
            {opportunity.summary}
          </p>

          {!compact ? (
            <p className="max-w-4xl text-sm leading-6 text-ink/65">
              {opportunity.monetizationSummary}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {monetizationBadges.map((type) => (
              <span
                className="rounded-lg border border-ink/10 bg-panel px-2.5 py-1 text-xs font-medium text-ink/70"
                key={type}
              >
                {type}
              </span>
            ))}
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
            <span className="rounded-lg border border-ink/10 bg-white px-2.5 py-1 text-xs font-medium text-ink/65">
              Status: {opportunity.statusLabel}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
