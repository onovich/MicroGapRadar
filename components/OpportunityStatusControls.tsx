"use client";

import * as React from "react";

import type { OpportunityStatus, OpportunityStatusUpdate } from "@/lib/opportunities";

type OpportunityStatusControlsProps = {
  opportunityId: string;
  updateUrl: string;
  initialStatus: OpportunityStatus;
  initialStatusLabel: string;
  initialUpdatedAt: string;
};

type StatusAction = {
  status: OpportunityStatusUpdate;
  label: string;
  activeClassName: string;
};

const statusActions: StatusAction[] = [
  {
    status: "saved",
    label: "Save",
    activeClassName: "border-signal/30 bg-signal text-white",
  },
  {
    status: "discarded",
    label: "Discard",
    activeClassName: "border-red-200 bg-red-600 text-white",
  },
  {
    status: "build_next",
    label: "Build next",
    activeClassName: "border-flare/30 bg-flare text-white",
  },
];

export function OpportunityStatusControls({
  opportunityId,
  updateUrl,
  initialStatus,
  initialStatusLabel,
  initialUpdatedAt,
}: OpportunityStatusControlsProps) {
  const [status, setStatus] = React.useState({
    value: initialStatus,
    label: initialStatusLabel,
    updatedAt: initialUpdatedAt,
  });
  const [pendingStatus, setPendingStatus] =
    React.useState<OpportunityStatusUpdate | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function applyStatus(nextStatus: OpportunityStatusUpdate) {
    setPendingStatus(nextStatus);
    setMessage(null);

    try {
      const response = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(
          payload?.error?.message ?? "Status update failed.",
        );
        return;
      }

      setStatus({
        value: payload?.data?.status ?? nextStatus,
        label: payload?.data?.statusLabel ?? formatStatusLabel(nextStatus),
        updatedAt: payload?.data?.updatedAt ?? new Date().toISOString(),
      });
      setMessage("Status updated.");
    } catch {
      setMessage("Status update failed.");
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <section
      aria-labelledby={`status-controls-${opportunityId}`}
      className="rounded-lg border border-ink/10 bg-white/85 p-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          className="text-sm font-semibold uppercase text-ink/55"
          id={`status-controls-${opportunityId}`}
        >
          Status
        </h2>
        <p className="text-lg font-semibold text-ink">{status.label}</p>
        <p className="text-xs text-ink/55">
          Updated {formatDateTime(status.updatedAt)}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {statusActions.map((action) => {
          const isActive = status.value === action.status;
          const isPending = pendingStatus === action.status;

          return (
            <button
              aria-pressed={isActive}
              className={[
                "h-10 rounded-lg border px-3 text-sm font-semibold transition",
                isActive
                  ? action.activeClassName
                  : "border-ink/15 bg-white text-ink hover:border-signal/40 hover:text-signal",
                pendingStatus && !isPending ? "opacity-60" : "",
              ].join(" ")}
              disabled={Boolean(pendingStatus) || isActive}
              key={action.status}
              onClick={() => void applyStatus(action.status)}
              type="button"
            >
              {isPending ? "Saving..." : action.label}
            </button>
          );
        })}
      </div>

      {message ? (
        <p className="mt-3 text-sm font-medium text-ink/65" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function formatStatusLabel(status: string): string {
  return status
    .trim()
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
