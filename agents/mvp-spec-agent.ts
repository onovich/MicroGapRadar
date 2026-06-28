import { z } from "zod";

import { safeJsonCompletion } from "../services/llm";
import type {
  LlmChatMessage,
  LlmClient,
} from "../services/llm";
import type {
  SafeJsonCompletionInput,
  SafeJsonCompletionResult,
} from "../services/llm/json-output";

export const MVP_SPEC_PROMPT_VERSION = "2026-06-28-v1";
export const MVP_SPEC_LOCAL_MODEL = `deterministic-mvp-spec-agent-${MVP_SPEC_PROMPT_VERSION}`;

const NonEmptyTextSchema = z.string().trim().min(1).transform(normalizeText);
const OptionalTextSchema = z
  .string()
  .trim()
  .transform(normalizeText)
  .optional()
  .nullable();
const TextListSchema = z
  .array(NonEmptyTextSchema)
  .transform(dedupeTextList);

const MvpSpecScoreItemSchema = z
  .object({
    label: NonEmptyTextSchema,
    value: z.number().finite(),
    explanation: OptionalTextSchema,
  })
  .passthrough();

const MvpSpecToolConceptSchema = z
  .object({
    oneLiner: NonEmptyTextSchema.optional(),
    inputFields: TextListSchema.default([]),
    outputModules: TextListSchema.default([]),
  })
  .passthrough();

export const MvpSpecOpportunityInputSchema = z
  .object({
    id: NonEmptyTextSchema,
    keyword: NonEmptyTextSchema,
    title: NonEmptyTextSchema,
    summary: NonEmptyTextSchema,
    toolType: NonEmptyTextSchema,
    toolTypeLabel: NonEmptyTextSchema,
    marketLabel: NonEmptyTextSchema,
    targetUser: NonEmptyTextSchema,
    searchIntent: NonEmptyTextSchema,
    serpWeaknessSummary: NonEmptyTextSchema,
    monetizationSummary: NonEmptyTextSchema,
    monetizationTypes: TextListSchema.default([]),
    riskSummary: NonEmptyTextSchema,
    riskLabel: NonEmptyTextSchema,
    buildComplexityLabel: NonEmptyTextSchema,
    totalScore: z.number().finite(),
    radarTask: z
      .object({
        id: NonEmptyTextSchema.optional(),
        name: NonEmptyTextSchema,
      })
      .passthrough(),
    scoreBreakdownItems: z.array(MvpSpecScoreItemSchema).default([]),
    toolConcept: MvpSpecToolConceptSchema.nullable().optional(),
    toolabilitySummary: OptionalTextSchema,
    killCriteria: TextListSchema.default([]),
  })
  .passthrough();

export const MvpSpecAgentResponseSchema = z
  .object({
    markdown: z
      .string()
      .trim()
      .min(200)
      .transform(normalizeMarkdown)
      .refine(hasRequiredMvpSpecSections, {
        message: "Markdown must include the required MVP Spec sections.",
      }),
  })
  .strict();

export type MvpSpecOpportunityInput = z.infer<
  typeof MvpSpecOpportunityInputSchema
>;
export type MvpSpecAgentResponse = z.infer<typeof MvpSpecAgentResponseSchema>;
export type MvpSpecAgentOutput = MvpSpecAgentResponse & {
  generatedByModel: string;
};

export type MvpSpecSafeJsonCompletion = <TSchema extends z.ZodType>(
  input: SafeJsonCompletionInput<TSchema>,
) => Promise<SafeJsonCompletionResult<z.infer<TSchema>>>;

export type MvpSpecAgentOptions = {
  llmClient?: LlmClient;
  safeJsonCompletion?: MvpSpecSafeJsonCompletion;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

const MVP_SPEC_SCHEMA_DESCRIPTION = `{
  "markdown": "Codex-ready MVP spec Markdown. Must include: Page Structure, Form Fields, Data Model, API Routes, Monetization Entry Points, Risk Notes, 48-Hour Build Checklist, Acceptance Criteria, and Kill Criteria."
}`;

export async function generateMvpSpec(
  input: MvpSpecOpportunityInput,
  options: MvpSpecAgentOptions = {},
): Promise<MvpSpecAgentOutput> {
  const parsedInput = MvpSpecOpportunityInputSchema.parse(input);
  const fallback = (): MvpSpecAgentOutput => ({
    markdown: generateDeterministicMvpSpecMarkdown(parsedInput),
    generatedByModel: MVP_SPEC_LOCAL_MODEL,
  });

  if (!options.llmClient) {
    return fallback();
  }

  const jsonCompletion = options.safeJsonCompletion ?? safeJsonCompletion;

  try {
    const result = await jsonCompletion({
      client: options.llmClient,
      model: options.model,
      temperature: options.temperature ?? 0.1,
      maxTokens: options.maxTokens ?? 2400,
      responseFormat: { type: "json_object" },
      schema: MvpSpecAgentResponseSchema,
      schemaDescription: MVP_SPEC_SCHEMA_DESCRIPTION,
      messages: buildMvpSpecMessages(parsedInput),
    });

    if (!result.ok) {
      return fallback();
    }

    return {
      markdown: result.data.markdown,
      generatedByModel: options.model ?? "injected-llm-mvp-spec",
    };
  } catch {
    return fallback();
  }
}

export function buildMvpSpecMessages(
  input: MvpSpecOpportunityInput,
): LlmChatMessage[] {
  const parsedInput = MvpSpecOpportunityInputSchema.parse(input);

  return [
    {
      role: "system",
      content: "You are a senior product spec writer for small AI web tools.",
    },
    {
      role: "user",
      content: [
        "Create a compact, Codex-ready MVP spec Markdown document for this persisted opportunity.",
        "Make it concrete enough for a coding agent to implement without further product discovery.",
        "",
        "Opportunity detail view model:",
        formatPromptJson(formatOpportunityForPrompt(parsedInput)),
        "",
        "Required Markdown sections:",
        "- Opportunity Context",
        "- Product Thesis",
        "- Page Structure",
        "- Form Fields",
        "- Data Model",
        "- API Routes",
        "- Result Behavior",
        "- Monetization Entry Points",
        "- Risk Notes",
        "- 48-Hour Build Checklist",
        "- Acceptance Criteria",
        "- Kill Criteria",
        "",
        "Constraints:",
        "- Keep the spec narrow enough for a 48-hour local MVP.",
        "- Do not promise revenue, rankings, legal compliance, medical outcomes, financial outcomes, or guaranteed business results.",
        "- For regulated or high-risk topics, frame outputs as checklist/self-assessment only.",
        "- Return valid JSON only with the markdown field.",
        "",
        `Prompt version: ${MVP_SPEC_PROMPT_VERSION}`,
        "Return schema:",
        MVP_SPEC_SCHEMA_DESCRIPTION,
      ].join("\n"),
    },
  ];
}

export function generateDeterministicMvpSpecMarkdown(
  input: MvpSpecOpportunityInput,
): string {
  const opportunity = MvpSpecOpportunityInputSchema.parse(input);
  const slug = slugify(opportunity.title || opportunity.keyword);
  const title = opportunity.title;
  const toolConcept = opportunity.toolConcept ?? null;
  const inputFields = buildFormFields(opportunity);
  const outputModules = buildOutputModules(opportunity);
  const monetizationEntries = buildMonetizationEntries(opportunity);
  const riskNotes = buildRiskNotes(opportunity);
  const acceptanceCriteria = buildAcceptanceCriteria(opportunity);
  const killCriteria = buildKillCriteria(opportunity);
  const scoreNotes = opportunity.scoreBreakdownItems
    .map((item) => `- ${item.label}: ${Math.round(item.value)}${item.explanation ? ` - ${item.explanation}` : ""}`)
    .join("\n");

  return normalizeMarkdown([
    `# MVP Spec: ${title}`,
    "",
    "## Opportunity Context",
    `- Keyword: ${opportunity.keyword}`,
    `- Market: ${opportunity.marketLabel}`,
    `- Radar task: ${opportunity.radarTask.name}`,
    `- Tool type: ${opportunity.toolTypeLabel}`,
    `- Opportunity score: ${Math.round(opportunity.totalScore)}/100`,
    `- Target user: ${opportunity.targetUser}`,
    `- Search intent: ${opportunity.searchIntent}`,
    "",
    "## Product Thesis",
    opportunity.summary,
    "",
    `Primary tool promise: ${toolConcept?.oneLiner || opportunity.toolabilitySummary || `Help ${opportunity.targetUser.toLowerCase()} complete the ${opportunity.keyword} workflow with a focused ${opportunity.toolTypeLabel.toLowerCase()}.`}`,
    "",
    "SERP gap to exploit:",
    `- ${opportunity.serpWeaknessSummary}`,
    scoreNotes ? ["", "Score notes:", scoreNotes].join("\n") : "",
    "",
    "## Page Structure",
    `- \`/\`: Single tool workspace with concise header, input form, result panel, monetization slot, and risk note.`,
    `- \`/${slug}\`: Optional canonical tool route if the app hosts multiple generated microtools later.`,
    "- Empty state: show the form and one short example input set.",
    "- Loading state: disable submit, keep entered values visible, and show generation progress text.",
    "- Result state: show the generated/checklist/calculated output with copy and reset controls.",
    "- Error state: show a short recoverable message and preserve user-entered fields.",
    "",
    "## Form Fields",
    ...inputFields.map((field) => `- ${field}`),
    "",
    "## Data Model",
    `- Input payload: ${inputFields.map((field) => `\`${camelCase(field.replace(/\s*\([^)]*\)\s*$/, ""))}\``).join(", ")}.`,
    `- Result modules: ${outputModules.map((module) => `\`${camelCase(module)}\``).join(", ")}.`,
    "- Session state: keep form values and the latest result in client state for the 48-hour MVP; add persistence only after repeat-use validation.",
    "- Stored records: no account, billing, telemetry, or public sharing tables are required for this first local build.",
    "",
    "## API Routes",
    `- \`POST /api/${slug}/generate\`: Accepts the form payload, validates required fields, and returns the generated result modules.`,
    `- \`GET /api/${slug}/health\`: Optional local smoke endpoint returning \`{ "ok": true }\` for development checks.`,
    "",
    "Request body shape:",
    "```json",
    formatPromptJson(buildRequestBodyExample(inputFields)),
    "```",
    "",
    "Success response shape:",
    "```json",
    formatPromptJson({
      data: {
        title,
        modules: outputModules,
        riskNote: riskNotes[0],
      },
    }),
    "```",
    "",
    "## Result Behavior",
    ...outputModules.map((module) => `- ${module}: render a scannable section with copyable text and no outcome guarantees.`),
    "- Keep all generated language cautious, practical, and specific to the user's submitted inputs.",
    "",
    "## Monetization Entry Points",
    ...monetizationEntries.map((entry) => `- ${entry}`),
    "",
    "## Risk Notes",
    ...riskNotes.map((note) => `- ${note}`),
    "",
    "## 48-Hour Build Checklist",
    "- Build the single-page form, validation, empty/loading/error/result states, and copy controls first.",
    "- Implement the local generation API with deterministic sample output before wiring any optional provider.",
    "- Add focused tests for validation, API error envelopes, result rendering, copy behavior, and risk copy.",
    "- Run local smoke checks with one realistic sample input and one invalid input before treating the MVP as ready.",
    "",
    "## Acceptance Criteria",
    ...acceptanceCriteria.map((criterion) => `- ${criterion}`),
    "",
    "## Kill Criteria",
    ...killCriteria.map((criterion) => `- ${criterion}`),
  ].filter(Boolean).join("\n"));
}

function formatOpportunityForPrompt(input: MvpSpecOpportunityInput) {
  return {
    id: input.id,
    keyword: input.keyword,
    title: input.title,
    summary: input.summary,
    toolType: input.toolType,
    marketLabel: input.marketLabel,
    targetUser: input.targetUser,
    searchIntent: input.searchIntent,
    serpWeaknessSummary: input.serpWeaknessSummary,
    monetizationSummary: input.monetizationSummary,
    monetizationTypes: input.monetizationTypes,
    riskSummary: input.riskSummary,
    riskLabel: input.riskLabel,
    buildComplexityLabel: input.buildComplexityLabel,
    totalScore: input.totalScore,
    radarTask: input.radarTask,
    scoreBreakdownItems: input.scoreBreakdownItems,
    toolConcept: input.toolConcept,
    toolabilitySummary: input.toolabilitySummary,
    killCriteria: input.killCriteria,
  };
}

function buildFormFields(input: MvpSpecOpportunityInput): string[] {
  const conceptFields = input.toolConcept?.inputFields ?? [];
  const defaults = [
    `${input.keyword} context (textarea, required)`,
    "User goal or constraint (text, optional)",
    "Output format preference (select, optional)",
  ];
  const fields = conceptFields.length > 0
    ? conceptFields.map((field) => `${toSentenceCase(field)} (text, required)`)
    : defaults;

  return dedupeTextList([
    ...fields,
    "Email address (email, optional, only if lead capture is enabled)",
  ]);
}

function buildOutputModules(input: MvpSpecOpportunityInput): string[] {
  const modules = input.toolConcept?.outputModules ?? [];

  if (modules.length > 0) {
    return modules.map(toSentenceCase);
  }

  if (input.toolType === "calculator") {
    return ["Summary score", "Calculation breakdown", "Next-step checklist"];
  }

  if (input.toolType === "checker" || input.toolType === "audit") {
    return ["Pass/fail review", "Issue list", "Prioritized recommendations"];
  }

  if (input.toolType === "checklist") {
    return ["Personalized checklist", "Priority notes", "Review reminders"];
  }

  return ["Generated result", "Explanation notes", "Copy-ready summary"];
}

function buildMonetizationEntries(input: MvpSpecOpportunityInput): string[] {
  const entries = input.monetizationTypes.length > 0
    ? input.monetizationTypes.map((type) => {
        if (/paid export/i.test(type)) {
          return "Paid export: offer a polished PDF/CSV/download after the free on-page result.";
        }

        if (/lead/i.test(type)) {
          return "Lead capture: ask for email only after showing value in the free result.";
        }

        if (/affiliate/i.test(type)) {
          return "Affiliate slot: place relevant tools or services beside the result, labeled clearly.";
        }

        if (/subscription/i.test(type)) {
          return "Subscription upsell: save history, templates, or repeated checks after the MVP proves repeat use.";
        }

        if (/ads/i.test(type)) {
          return "Ads: reserve a restrained result-page slot that does not block the workflow.";
        }

        return `${type}: test only after the free workflow is useful.`;
      })
    : [];

  return dedupeTextList([
    ...entries,
    `Monetization cue from opportunity: ${input.monetizationSummary}`,
  ]);
}

function buildRiskNotes(input: MvpSpecOpportunityInput): string[] {
  const notes = [
    `${input.riskLabel}: ${input.riskSummary}`,
    "Avoid promises about revenue, search rankings, legal compliance, medical outcomes, financial outcomes, or guaranteed business results.",
  ];

  if (/high|excluded|legal|tax|medical|financial|compliance/i.test(input.riskSummary)) {
    notes.push("Use checklist or self-assessment framing and include a professional-review reminder where relevant.");
  }

  return dedupeTextList(notes);
}

function buildAcceptanceCriteria(input: MvpSpecOpportunityInput): string[] {
  return [
    "The page renders the form, empty state, loading state, result state, and recoverable error state.",
    "Submitting valid inputs returns all planned result modules from the local API route.",
    "Required fields are validated before generation and invalid input keeps the user's entered values visible.",
    "The result can be copied without requiring sign-in or a paid account.",
    "The monetization entry point appears only after a useful free result is visible.",
    `Risk copy remains aligned with ${input.riskLabel.toLowerCase()} and avoids guaranteed-outcome claims.`,
    "The MVP can be tested locally with deterministic sample inputs.",
  ];
}

function buildKillCriteria(input: MvpSpecOpportunityInput): string[] {
  return dedupeTextList([
    ...input.killCriteria,
    "Kill if a fresh SERP review finds three or more focused interactive tools already satisfying this exact workflow.",
    "Kill if the first useful result cannot be built within a 48-hour MVP scope.",
    "Kill if the product requires definitive regulated advice rather than checklist or self-assessment guidance.",
    "Kill if the only monetization path depends on guaranteed-outcome claims.",
  ]);
}

function buildRequestBodyExample(fields: string[]): Record<string, string> {
  return fields.reduce<Record<string, string>>((body, field) => {
    const label = field.replace(/\s*\([^)]*\)\s*$/, "");
    body[camelCase(label)] = "example value";

    return body;
  }, {});
}

function hasRequiredMvpSpecSections(markdown: string): boolean {
  const requiredSections = [
    "Page Structure",
    "Form Fields",
    "Data Model",
    "API Routes",
    "Monetization Entry Points",
    "Risk Notes",
    "48-Hour Build Checklist",
    "Acceptance Criteria",
    "Kill Criteria",
  ];

  return requiredSections.every((section) =>
    new RegExp(`^##\\s+${escapeRegExp(section)}\\s*$`, "im").test(markdown),
  );
}

function normalizeMarkdown(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function dedupeTextList(values: string[]): string[] {
  const seen = new Set<string>();
  const dedupedValues: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    dedupedValues.push(normalized);
  }

  return dedupedValues;
}

function slugify(value: string): string {
  const slug = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "microtool";
}

function toSentenceCase(value: string): string {
  const normalized = normalizeText(value);

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function camelCase(value: string): string {
  const words = normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "value";
  }

  return words
    .map((word, index) =>
      index === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join("");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatPromptJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
