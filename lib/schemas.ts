import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const scoreValue = z.number().int().min(0).max(100);

export const searchRunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "partial_failed",
]);

export const keywordCandidateStatusSchema = z.enum([
  "pending",
  "searched",
  "failed",
]);

export const serpResultTypeSchema = z.enum([
  "organic",
  "ad",
  "forum",
  "pdf",
  "video",
  "unknown",
]);

export const toolTypeSchema = z.enum([
  "generator",
  "checker",
  "calculator",
  "template",
  "checklist",
  "audit",
  "directory",
]);

export const buildComplexitySchema = z.enum(["low", "medium", "high"]);

export const opportunityStatusSchema = z.enum([
  "new",
  "saved",
  "discarded",
  "build_next",
  "built",
]);

export const riskPreferencesSchema = z
  .object({
    maxRisk: z.enum(["low", "medium", "high"]).default("medium"),
    avoidYMYLConclusions: z.boolean().default(true),
  })
  .passthrough();

export const radarTaskInputSchema = z
  .object({
    userId: z.string().trim().min(1).nullable().optional(),
    name: nonEmptyString.max(120),
    domainDescription: nonEmptyString.max(2000),
    seedExamples: z.array(nonEmptyString).min(1),
    countries: z.array(nonEmptyString).min(1),
    languages: z.array(nonEmptyString).min(1),
    userAdvantages: z.array(nonEmptyString).default([]),
    monetizationPreferences: z.array(nonEmptyString).default([]),
    riskPreferences: riskPreferencesSchema.default({
      maxRisk: "medium",
      avoidYMYLConclusions: true,
    }),
    excludedTopics: z.array(nonEmptyString).default([]),
    dailyLimit: z.coerce.number().int().min(1).max(100).default(10),
    isActive: z.boolean().default(true),
  })
  .strict();

export const scoreBreakdownSchema = z
  .object({
    intentScore: scoreValue,
    monetizationScore: scoreValue,
    serpWeaknessScore: scoreValue,
    toolabilityScore: scoreValue,
    userFitScore: scoreValue,
    buildSpeedScore: scoreValue,
    riskPenalty: scoreValue,
    totalScore: scoreValue,
  })
  .strict();

export const mvpSpecInputSchema = z
  .object({
    opportunityId: nonEmptyString,
    markdown: nonEmptyString,
    generatedByModel: nonEmptyString,
  })
  .strict();

export type RadarTaskInput = z.infer<typeof radarTaskInputSchema>;
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;
export type MvpSpecInput = z.infer<typeof mvpSpecInputSchema>;
