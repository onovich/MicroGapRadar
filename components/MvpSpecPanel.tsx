"use client";

import * as React from "react";

import type { MvpSpecViewModel } from "@/lib/opportunities";

type MvpSpecPanelProps = {
  opportunityId: string;
  generateUrl: string;
  initialSpec: MvpSpecViewModel | null;
};

export function MvpSpecPanel({
  opportunityId,
  generateUrl,
  initialSpec,
}: MvpSpecPanelProps) {
  const [spec, setSpec] = React.useState<MvpSpecViewModel | null>(initialSpec);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isCopying, setIsCopying] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function generateSpec() {
    setIsGenerating(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(generateUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error?.message ?? "MVP Spec generation failed.");
        return;
      }

      setSpec(payload?.data ?? null);
      setMessage("MVP Spec generated.");
    } catch {
      setError("MVP Spec generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyMarkdown() {
    if (!spec?.markdown) {
      return;
    }

    setIsCopying(true);
    setMessage(null);
    setError(null);

    try {
      await writeClipboardText(spec.markdown);
      setMessage("Markdown copied.");
    } catch {
      setError("Copy failed.");
    } finally {
      setIsCopying(false);
    }
  }

  return (
    <section
      aria-labelledby={`mvp-spec-${opportunityId}`}
      className="rounded-lg border border-ink/10 bg-white/85 p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink" id={`mvp-spec-${opportunityId}`}>
            MVP Spec
          </h2>
          <p className="mt-1 text-sm text-ink/55">
            {spec
              ? `Generated ${formatDateTime(spec.updatedAt)}`
              : "No MVP Spec yet."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="h-10 rounded-lg border border-signal/30 bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isGenerating}
            onClick={() => void generateSpec()}
            type="button"
          >
            {isGenerating
              ? "Generating..."
              : spec
                ? "Regenerate"
                : "Generate MVP Spec"}
          </button>
          <button
            className="h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm font-semibold text-ink transition hover:border-signal/40 hover:text-signal disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!spec?.markdown || isCopying}
            onClick={() => void copyMarkdown()}
            type="button"
          >
            {isCopying ? "Copying..." : "Copy Markdown"}
          </button>
        </div>
      </div>

      {message ? (
        <p className="mt-3 text-sm font-medium text-ink/65" role="status">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {spec?.markdown ? (
        <pre className="mt-4 max-h-[34rem] overflow-auto rounded-lg border border-ink/10 bg-ink px-4 py-3 text-xs leading-5 text-white">
          <code>{spec.markdown}</code>
        </pre>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-ink/15 bg-panel px-4 py-5 text-sm leading-6 text-ink/60">
          No Markdown has been generated for this opportunity.
        </div>
      )}
    </section>
  );
}

async function writeClipboardText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");

    if (!copied) {
      throw new Error("Copy command failed.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
