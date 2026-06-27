import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const scoreValue = z.number().int().min(0).max(100);
const nonEmptyStringArray = z.array(nonEmptyString);

const queryBooleanSchema = z.preprocess((value) => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}, z.boolean());

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

const radarTaskFieldSchemas = {
  userId: z.string().trim().min(1).nullable().optional(),
  name: nonEmptyString.max(120),
  domainDescription: nonEmptyString.max(2000),
  seedExamples: nonEmptyStringArray.min(1),
  countries: nonEmptyStringArray.min(1),
  languages: nonEmptyStringArray.min(1),
  userAdvantages: nonEmptyStringArray,
  monetizationPreferences: nonEmptyStringArray,
  riskPreferences: riskPreferencesSchema,
  excludedTopics: nonEmptyStringArray,
  dailyLimit: z.coerce.number().int().min(1).max(100),
  isActive: z.boolean(),
};

export const radarTaskInputSchema = z
  .object({
    userId: radarTaskFieldSchemas.userId,
    name: radarTaskFieldSchemas.name,
    domainDescription: radarTaskFieldSchemas.domainDescription,
    seedExamples: radarTaskFieldSchemas.seedExamples,
    countries: radarTaskFieldSchemas.countries,
    languages: radarTaskFieldSchemas.languages,
    userAdvantages: radarTaskFieldSchemas.userAdvantages.default([]),
    monetizationPreferences:
      radarTaskFieldSchemas.monetizationPreferences.default([]),
    riskPreferences: riskPreferencesSchema.default({
      maxRisk: "medium",
      avoidYMYLConclusions: true,
    }),
    excludedTopics: radarTaskFieldSchemas.excludedTopics.default([]),
    dailyLimit: radarTaskFieldSchemas.dailyLimit.default(10),
    isActive: radarTaskFieldSchemas.isActive.default(true),
  })
  .strict();

export const radarTaskUpdateInputSchema = z
  .object({
    userId: radarTaskFieldSchemas.userId,
    name: radarTaskFieldSchemas.name.optional(),
    domainDescription: radarTaskFieldSchemas.domainDescription.optional(),
    seedExamples: radarTaskFieldSchemas.seedExamples.optional(),
    countries: radarTaskFieldSchemas.countries.optional(),
    languages: radarTaskFieldSchemas.languages.optional(),
    userAdvantages: radarTaskFieldSchemas.userAdvantages.optional(),
    monetizationPreferences:
      radarTaskFieldSchemas.monetizationPreferences.optional(),
    riskPreferences: radarTaskFieldSchemas.riskPreferences.optional(),
    excludedTopics: radarTaskFieldSchemas.excludedTopics.optional(),
    dailyLimit: radarTaskFieldSchemas.dailyLimit.optional(),
    isActive: radarTaskFieldSchemas.isActive.optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one radar task field must be provided.",
  });

export const radarTaskListQuerySchema = z
  .object({
    isActive: queryBooleanSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const radarTaskRouteParamsSchema = z
  .object({
    id: nonEmptyString.max(191),
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
export type RadarTaskUpdateInput = z.infer<typeof radarTaskUpdateInputSchema>;
export type RadarTaskListQuery = z.infer<typeof radarTaskListQuerySchema>;
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;
export type MvpSpecInput = z.infer<typeof mvpSpecInputSchema>;
