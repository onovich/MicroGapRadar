import type { ScoreBreakdown } from "./schemas";

export const SCORE_WEIGHTS = {
  intentScore: 0.18,
  monetizationScore: 0.16,
  serpWeaknessScore: 0.18,
  toolabilityScore: 0.18,
  userFitScore: 0.14,
  buildSpeedScore: 0.10,
  riskPenalty: 0.06,
} as const;

export const SCORE_DEFAULTS = {
  positiveDimension: 50,
  riskPenalty: 35,
} as const;

export const RISK_LEVEL_MINIMUM_PENALTIES = {
  low: 8,
  medium: 35,
  high: 70,
  excluded: 100,
} as const;

export type OpportunityRiskLevel = keyof typeof RISK_LEVEL_MINIMUM_PENALTIES;
export type ScoreInputValue = number | string | null | undefined;

export type OpportunityScoreHintsInput = {
  intentScore?: ScoreInputValue;
  monetizationScore?: ScoreInputValue;
  serpWeaknessScore?: ScoreInputValue;
  serpWeaknessScoreHint?: ScoreInputValue;
  toolabilityScore?: ScoreInputValue;
  userFitScore?: ScoreInputValue;
  buildSpeedScore?: ScoreInputValue;
  riskPenalty?: ScoreInputValue;
};

export type OpportunityScoreInput = OpportunityScoreHintsInput & {
  scoreHints?: OpportunityScoreHintsInput | null;
  riskLevel?: OpportunityRiskLevel | null;
};

export type OpportunityScoreBreakdown = ScoreBreakdown;

export type OpportunityScoreExplanation = {
  intentScore: string;
  monetizationScore: string;
  serpWeaknessScore: string;
  toolabilityScore: string;
  userFitScore: string;
  buildSpeedScore: string;
  riskPenalty: string;
  totalScore: string;
};

export type OpportunityScoreResult = {
  totalScore: number;
  scoreBreakdown: OpportunityScoreBreakdown;
  scoreExplanation: OpportunityScoreExplanation;
};

type ScoreDimension =
  | "intentScore"
  | "monetizationScore"
  | "serpWeaknessScore"
  | "toolabilityScore"
  | "userFitScore"
  | "buildSpeedScore";

const POSITIVE_DIMENSIONS: ScoreDimension[] = [
  "intentScore",
  "monetizationScore",
  "serpWeaknessScore",
  "toolabilityScore",
  "userFitScore",
  "buildSpeedScore",
];

const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  intentScore: "Search intent",
  monetizationScore: "Monetization",
  serpWeaknessScore: "SERP weakness",
  toolabilityScore: "Toolability",
  userFitScore: "User fit",
  buildSpeedScore: "Build speed",
};

export function calculateOpportunityScore(
  input: OpportunityScoreInput = {},
): OpportunityScoreResult {
  const scoreHints = input.scoreHints ?? {};
  const intentScore = normalizeScoreDimension(
    input.intentScore ?? scoreHints.intentScore,
    SCORE_DEFAULTS.positiveDimension,
  );
  const monetizationScore = normalizeScoreDimension(
    input.monetizationScore ?? scoreHints.monetizationScore,
    SCORE_DEFAULTS.positiveDimension,
  );
  const serpWeaknessScore = normalizeScoreDimension(
    input.serpWeaknessScore ??
      input.serpWeaknessScoreHint ??
      scoreHints.serpWeaknessScore ??
      scoreHints.serpWeaknessScoreHint,
    SCORE_DEFAULTS.positiveDimension,
  );
  const toolabilityScore = normalizeScoreDimension(
    input.toolabilityScore ?? scoreHints.toolabilityScore,
    SCORE_DEFAULTS.positiveDimension,
  );
  const userFitScore = normalizeScoreDimension(
    input.userFitScore ?? scoreHints.userFitScore,
    SCORE_DEFAULTS.positiveDimension,
  );
  const buildSpeedScore = normalizeScoreDimension(
    input.buildSpeedScore ?? scoreHints.buildSpeedScore,
    SCORE_DEFAULTS.positiveDimension,
  );
  const riskPenalty = normalizeRiskPenalty(
    input.riskPenalty ?? scoreHints.riskPenalty,
    input.riskLevel ?? undefined,
  );

  const totalScore = clampScore(Math.round(
    intentScore * SCORE_WEIGHTS.intentScore +
      monetizationScore * SCORE_WEIGHTS.monetizationScore +
      serpWeaknessScore * SCORE_WEIGHTS.serpWeaknessScore +
      toolabilityScore * SCORE_WEIGHTS.toolabilityScore +
      userFitScore * SCORE_WEIGHTS.userFitScore +
      buildSpeedScore * SCORE_WEIGHTS.buildSpeedScore -
      riskPenalty * SCORE_WEIGHTS.riskPenalty,
  ));

  const scoreBreakdown: OpportunityScoreBreakdown = {
    intentScore,
    monetizationScore,
    serpWeaknessScore,
    toolabilityScore,
    userFitScore,
    buildSpeedScore,
    riskPenalty,
    totalScore,
  };

  return {
    totalScore,
    scoreBreakdown,
    scoreExplanation: buildScoreExplanation(scoreBreakdown),
  };
}

export function normalizeScoreDimension(
  value: ScoreInputValue,
  fallback: number = SCORE_DEFAULTS.positiveDimension,
): number {
  const parsedValue = parseScoreInputValue(value);

  if (parsedValue === undefined) {
    return clampScore(fallback);
  }

  const normalizedValue = parsedValue >= 0 && parsedValue <= 1
    ? parsedValue * 100
    : parsedValue;

  return clampScore(normalizedValue);
}

function normalizeRiskPenalty(
  value: ScoreInputValue,
  riskLevel: OpportunityRiskLevel | undefined,
): number {
  const fallback = riskLevel
    ? RISK_LEVEL_MINIMUM_PENALTIES[riskLevel]
    : SCORE_DEFAULTS.riskPenalty;
  const normalizedPenalty = normalizeScoreDimension(value, fallback);

  if (!riskLevel) {
    return normalizedPenalty;
  }

  return Math.max(normalizedPenalty, RISK_LEVEL_MINIMUM_PENALTIES[riskLevel]);
}

function parseScoreInputValue(value: ScoreInputValue): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return undefined;
    }

    const parsedValue = Number(trimmedValue);

    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return SCORE_DEFAULTS.positiveDimension;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildScoreExplanation(
  breakdown: OpportunityScoreBreakdown,
): OpportunityScoreExplanation {
  return {
    intentScore: explainPositiveDimension("intentScore", breakdown.intentScore),
    monetizationScore: explainPositiveDimension(
      "monetizationScore",
      breakdown.monetizationScore,
    ),
    serpWeaknessScore: explainPositiveDimension(
      "serpWeaknessScore",
      breakdown.serpWeaknessScore,
    ),
    toolabilityScore: explainPositiveDimension(
      "toolabilityScore",
      breakdown.toolabilityScore,
    ),
    userFitScore: explainPositiveDimension("userFitScore", breakdown.userFitScore),
    buildSpeedScore: explainPositiveDimension(
      "buildSpeedScore",
      breakdown.buildSpeedScore,
    ),
    riskPenalty: `Risk penalty is ${riskTier(breakdown.riskPenalty)} at ${breakdown.riskPenalty}/100 and subtracts weight ${SCORE_WEIGHTS.riskPenalty}. ${riskDecisionAid(breakdown.riskPenalty)}`,
    totalScore: `Final score is rounded and clamped to ${breakdown.totalScore}/100.`,
  };
}

function explainPositiveDimension(
  dimension: ScoreDimension,
  score: number,
): string {
  return `${DIMENSION_LABELS[dimension]} is ${scoreTier(score)} at ${score}/100 with weight ${SCORE_WEIGHTS[dimension]}.`;
}

function scoreTier(score: number): string {
  if (score >= 85) {
    return "excellent";
  }

  if (score >= 70) {
    return "strong";
  }

  if (score >= 40) {
    return "moderate";
  }

  return "weak";
}

function riskTier(riskPenalty: number): string {
  if (riskPenalty >= 71) {
    return "exclusion-level";
  }

  if (riskPenalty >= 36) {
    return "high";
  }

  if (riskPenalty >= 11) {
    return "medium";
  }

  return "low";
}

function riskDecisionAid(riskPenalty: number): string {
  if (riskPenalty >= 71) {
    return "Filter or treat as do-not-build outside numeric total.";
  }

  if (riskPenalty >= 36) {
    return "Poor automation fit; review before ranking.";
  }

  if (riskPenalty >= 11) {
    return "Use caution, disclaimer, or checklist framing.";
  }

  return "Low risk signal.";
}
