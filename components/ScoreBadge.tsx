import * as React from "react";

export type ScoreTone = "strong" | "good" | "watch" | "weak";

type ScoreBadgeProps = {
  score: number;
  label?: string;
  compact?: boolean;
};

const toneClasses: Record<ScoreTone, string> = {
  strong: "border-signal/25 bg-signal/10 text-signal",
  good: "border-ink/15 bg-white text-ink",
  watch: "border-flare/25 bg-flare/10 text-flare",
  weak: "border-ink/10 bg-ink/5 text-ink/65",
};

export function getScoreTone(score: number): ScoreTone {
  if (score >= 80) {
    return "strong";
  }

  if (score >= 65) {
    return "good";
  }

  if (score >= 50) {
    return "watch";
  }

  return "weak";
}

export function ScoreBadge({
  score,
  label = "score",
  compact = false,
}: ScoreBadgeProps) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const tone = getScoreTone(normalizedScore);

  return (
    <div
      aria-label={`Score ${normalizedScore} out of 100`}
      className={[
        "flex shrink-0 flex-col items-center justify-center rounded-lg border font-semibold",
        toneClasses[tone],
        compact ? "h-14 w-14" : "h-16 w-16",
      ].join(" ")}
    >
      <span className={compact ? "text-xl leading-6" : "text-2xl leading-7"}>
        {normalizedScore}
      </span>
      <span className="text-[11px] font-medium uppercase leading-4 text-current/70">
        {label}
      </span>
    </div>
  );
}
