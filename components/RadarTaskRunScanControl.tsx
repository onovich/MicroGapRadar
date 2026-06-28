"use client";

import * as React from "react";

import {
  buildRunScanPayload,
  isRunScanDisabled,
  serializeRunScanResult,
  type RunScanResultViewModel,
} from "@/lib/radar-task-run-scan";
import type { RadarTaskCardViewModel } from "@/lib/radar-task-view-models";

type RadarTaskRunScanControlProps = {
  task: RadarTaskCardViewModel;
};

export function RadarTaskRunScanControl({ task }: RadarTaskRunScanControlProps) {
  const [result, setResult] = React.useState<RunScanResultViewModel | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const disabled = isRunScanDisabled(task) || isRunning;

  return (
    <section className="space-y-3 rounded-lg border border-ink/10 bg-white/90 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Mock scan</h2>
          <p className="mt-1 text-sm leading-6 text-ink/60">
            Runs the existing local mock-provider scan path for this task.
          </p>
        </div>
        <button
          className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal/90 disabled:cursor-not-allowed disabled:bg-ink/25"
          disabled={disabled}
          onClick={async () => {
            if (disabled) {
              return;
            }

            setError(null);
            setIsRunning(true);

            try {
              const response = await fetch("/api/scans/run", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                },
                body: JSON.stringify(
                  buildRunScanPayload(task.id, {
                    keywordLimit: Math.min(task.dailyLimit, 50),
                    serpLimit: 3,
                  }),
                ),
              });
              const payload = await response.json();

              if (!response.ok) {
                setResult(null);
                setError(
                  payload?.error?.message ??
                    "The mock scan request could not complete.",
                );
                return;
              }

              setResult(serializeRunScanResult(payload));
            } catch {
              setResult(null);
              setError("The mock scan request could not complete.");
            } finally {
              setIsRunning(false);
            }
          }}
          type="button"
        >
          {isRunning ? "Running..." : task.isActive ? "Run mock scan" : "Inactive"}
        </button>
      </div>

      {result ? (
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Metric label="Keywords" value={result.keywordCandidates} />
          <Metric label="SERP results" value={result.serpSuccesses} />
          <Metric label="Opportunities" value={result.opportunities} />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-flare/20 bg-flare/10 px-3 py-2 text-sm text-ink">
          {error}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-panel/70 p-3">
      <p className="text-xs font-medium uppercase text-ink/55">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}
