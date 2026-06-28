# MicroGap Radar 项目包

**中文名：微隙雷达**  
**英文名：MicroGap Radar**  
**一句话定位：** 每日扫描低竞争、高价值、适合用 AI 快速做成网页微工具的搜索机会，并把机会转化成可开发的 MVP 规格。

这个 zip 包面向 Codex / 开发代理使用，包含项目命名、48 小时开发计划、技术架构、roadmap、UI 策划、功能规格、数据模型、评分系统、AI prompt 与验收标准。

> 注意：MicroGap Radar 是工作名，不代表域名、商标或公司名可用。正式对外前需要做商标、域名和竞品命名检索。

## 当前工程脚手架

当前 M0 工程基础包含：

- Next.js App Router
- TypeScript
- Tailwind CSS
- `lib/env.ts` 服务端环境变量读取

数据库、admin login、SERP provider、LLM agent、scan orchestration 和部署配置会在后续里程碑实现。

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run automated tests:

```bash
npm test
```

Start a production build locally:

```bash
npm run start
```

The scaffold can build without secrets. When runtime features need configuration, copy `.env.example` to `.env.local` and keep secret reads on the server through `lib/env.ts`.

## Mock SERP Provider

The M3 provider slice lives under `services/serp/` and currently exposes only the deterministic mock provider:

- `SerpProvider`, `SerpSearchInput`, and `SerpResult` define the reusable provider contract.
- `MockSerpProvider` returns stable SERP-like results for `keyword`, `country`, `language`, and `limit` inputs.
- `createSerpProvider("mock")` creates the mock provider; unsupported names throw immediately instead of falling back to any external service.

The mock provider does not read environment variables, secrets, paid APIs, or network resources. Focused coverage for deterministic output, limit handling, provider factory behavior, and result shape runs with:

```bash
npm test
```

## LLM JSON Utility

The M3 LLM utility slice lives under `services/llm/` and is intentionally limited to reusable boundaries:

- `LlmClient` defines typed chat input, assistant output, token usage, and structured error results.
- `OpenAICompatibleClient` accepts explicit `baseUrl`, `apiKey`, `model`, and optional `fetchImplementation` configuration. It fails fast when required configuration is blank and does not read `process.env` directly.
- `safeJsonCompletion()` asks an injected `LlmClient` for assistant text, extracts only plain top-level JSON or a single fenced JSON block, validates with a caller-provided Zod schema, and makes at most one repair completion after parse or validation failure.

Tests for this slice use fake clients and fake fetch transports only. They do not load secrets, read environment variables, or call the network. Run the focused automated coverage with:

```bash
npm test
```

The required build check is:

```bash
npm run build
```

## Keyword Expansion Agent

The M3 Keyword Expansion Agent slice lives under `agents/` and exposes reusable typed boundaries:

- `generateKeywordCandidates()` accepts a Radar Task-like input shape and returns normalized keyword candidates.
- `KeywordExpansionInputSchema`, `KeywordExpansionCandidateSchema`, and `KeywordExpansionResponseSchema` keep the agent input and JSON output validated with Zod.
- `buildKeywordExpansionMessages()` centralizes the prompt based on `docs/08_ai_agents_and_prompts.md`.
- When an injected `LlmClient` is provided, the agent calls `safeJsonCompletion()` and validates the returned candidate JSON.
- When no client is provided, or when LLM output is malformed or rejected after repair, the agent uses a deterministic mock fallback.

The fallback can generate 20 usable candidates without reading `process.env`, loading secrets, using the network, writing to the database, or calling paid services. It normalizes country/language/intent/tool/rationale fields, limits results to the requested count, and filters configured `excludedTopics` case-insensitively.

Focused coverage for LLM success, bad-output fallback, excluded-topic filtering, deterministic fallback output, and count limits runs with:

```bash
npm test
```

The required build check is:

```bash
npm run build
```

## SERP Analysis Agent

The M3 SERP Analysis Agent slice lives under `agents/` and exposes reusable typed boundaries:

- `analyzeSerpResults()` accepts a keyword, market, language, and SERP-like result array, then returns `serpWeaknessSummary`, `weakSignals`, `strongSignals`, and a clamped `serpWeaknessScoreHint` from 0 to 100.
- `SerpAnalysisInputSchema`, `SerpAnalysisOutputSchema`, `SerpWeakSignalSchema`, and `SerpStrongSignalSchema` validate the agent contract with Zod.
- `buildSerpAnalysisMessages()` centralizes the docs-aligned prompt for Agent 2 in `docs/08_ai_agents_and_prompts.md`.
- When an injected `LlmClient` is provided, the agent calls `safeJsonCompletion()` and validates the returned JSON.
- When no client is provided, or when LLM output is malformed or rejected after repair, the agent uses a deterministic heuristic fallback.

The fallback is side-effect free and does not read `process.env`, load secrets, call the network, write to the database, or use paid services. It recognizes empty result sets, generic articles, forum/community pages, PDFs/static documents, government/official pages, old or poor-UX pages, missing interactive tools, broad/outdated tools, and mature SaaS or specialized-tool competition.

Focused coverage for LLM success, failed-output fallback, score clamping, weak SERP signals, strong competition signals, and empty SERP behavior runs with:

```bash
npm test
```

The required build check is:

```bash
npm run build
```

## Opportunity Analysis Agent

The M3 Opportunity Analysis Agent slice lives under `agents/` and turns a Radar Task, keyword candidate, SERP weakness analysis, and SERP results into a structured opportunity brief.

- `analyzeOpportunity()` is the stable public entry point.
- `OpportunityAnalysisInputSchema`, `OpportunityAnalysisOutputSchema`, and nested schemas validate the agent contract with Zod.
- `buildOpportunityAnalysisMessages()` centralizes the prompt aligned with Agent 3 in `docs/08_ai_agents_and_prompts.md`.
- When an injected `LlmClient` is provided, the agent calls `safeJsonCompletion()` and validates JSON before returning it.
- When no client is provided, or LLM output is malformed or rejected after repair, the agent uses a deterministic heuristic fallback.

The output includes `title`, `summary`, `targetUser`, `searchIntent`, `recommendedToolType`, `toolConcept`, `monetization`, `risk`, `buildComplexity`, `scoreHints`, and `killCriteria`. Score hints are normalized and clamped to 0-100.

Risk guardrails are enforced after LLM or fallback output:

- No promises about revenue, search rankings, legal compliance, medical outcomes, financial outcomes, or assured business results.
- Legal, tax, medical, and financial topics are constrained to checklist or self-assessment framing, or marked high/excluded risk.
- Adult, gambling, gray-market, and harmful topics are excluded.
- Configured `excludedTopics` from the Radar Task are honored.

This slice does not read `process.env`, load secrets, call the network, write to the database, create scoring-engine totals, or persist opportunities. Tests use fake LLM clients only.

Run the focused automated coverage with:

```bash
npm test
```

The required build check is:

```bash
npm run build
```

## Scoring Engine

The M4 scoring slice lives in `lib/scoring.ts` and exposes `calculateOpportunityScore()` with typed input/output contracts for score hints, score breakdown, score explanations, and the final total score.

The score uses the documented formula:

```text
intentScore * 0.18 +
monetizationScore * 0.16 +
serpWeaknessScore * 0.18 +
toolabilityScore * 0.18 +
userFitScore * 0.14 +
buildSpeedScore * 0.10 -
riskPenalty * 0.06
```

The final total is rounded and clamped to 0-100. Individual dimensions are defensively normalized and clamped to 0-100, with missing or invalid positive dimensions defaulting to 50 and missing or invalid risk penalty defaulting to 35. Numeric strings are accepted, and 0-1 values are treated as normalized fractions.

`scoreBreakdown` returns persistence-ready numeric fields: `intentScore`, `monetizationScore`, `serpWeaknessScore`, `toolabilityScore`, `userFitScore`, `buildSpeedScore`, `riskPenalty`, and `totalScore`. `scoreExplanation` returns concise text for the same dimensions so later opportunity detail UI can explain why a score moved up or down.

Risk remains part of the exact weighted formula. Passing `riskLevel: "high"` raises the normalized risk penalty to at least 70, and `riskLevel: "excluded"` raises it to 100, so comparable safer opportunities sort above high-risk ones.

Risk tiers are decision aids as well as numeric inputs:

- `0-10` low risk: normal scoring can proceed.
- `11-35` medium risk: use caution, disclaimer, or checklist/self-assessment framing.
- `36-70` high risk: poor fit for automation and usually not suitable for default ranking.
- `71-100` exclusion-level risk: filter out or treat as a do-not-build signal outside the numeric total.

Focused scoring coverage runs with:

```bash
npm test
```

The required build check is:

```bash
npm run build
```

## Run Scan API

The M4 Run Scan slice adds the local scan orchestrator at `services/scan-orchestrator.ts` and the API route `POST /api/scans/run`.

The default execution path is deterministic and local:

- `useMockSerp` defaults to `true`.
- The orchestrator uses `MockSerpProvider` unless a test injects a fake provider.
- No LLM client is created by default, so the keyword, SERP, and opportunity agents use their deterministic fallback logic.
- The default path does not read API keys, call paid services, or use the network.

Request shape:

```json
{
  "radarTaskId": "clx_example_task_id",
  "useMockSerp": true,
  "keywordLimit": 10,
  "serpLimit": 10
}
```

`radarTaskId` is required. `keywordLimit` and `serpLimit` are optional integers from 1 to 50.

Success responses use `{ "data": ... }` and include the persisted SearchRun id, terminal status, counts, sanitized per-keyword errors, and generated opportunities:

```json
{
  "data": {
    "searchRunId": "clx_example_run_id",
    "radarTaskId": "clx_example_task_id",
    "status": "completed",
    "useMockSerp": true,
    "counts": {
      "keywordCandidates": 10,
      "serpSuccesses": 10,
      "opportunities": 10
    },
    "errors": [],
    "opportunities": [
      {
        "id": "clx_example_opportunity_id",
        "keyword": "steam description generator",
        "country": "US",
        "language": "en",
        "title": "Steam Description Generator",
        "totalScore": 82,
        "scoreBreakdown": {},
        "scoreExplanation": {}
      }
    ]
  }
}
```

Error responses follow the existing API shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "issues": []
  }
}
```

The orchestrator creates a `SearchRun`, saves `KeywordCandidate` rows, saves `SerpResult` rows, runs SERP and opportunity analysis, calculates scores with `calculateOpportunityScore()`, saves `Opportunity` rows with `scoreBreakdown` and `scoreExplanation`, and finalizes the run as `completed`, `partial_failed`, or `failed`. A single keyword failure is recorded with a sanitized message and does not discard successful opportunities.

Validate this slice with:

```bash
npm test
npm run build
```

Non-goals for this slice: no dashboard UI, no opportunity list/detail UI, no cron or queue, no auth/session changes, no real SERP provider, no real LLM provider setup, no secret loading, no schema migration, and no package dependency changes.

## Dashboard and Opportunity List

The M5 dashboard/list slice adds server-rendered pages backed by persisted Prisma data:

- `/dashboard` shows today's summary metrics, recent scan runs, and the Top 5 opportunities sorted by `totalScore` descending.
- `/opportunities` shows the score-sorted opportunity list with reusable `OpportunityCard` and `ScoreBadge` UI.
- `lib/opportunities.ts` is the shared data helper for Prisma queries, query-filter normalization, view-model serialization, sorting, risk cues, and filter option derivation.

These pages depend on local `Opportunity`, `SearchRun`, and `RadarTask` rows. Seed radar tasks with `npm run db:seed`, then create opportunities by running the scan API or another persisted scan flow.

`/opportunities` supports these query parameters:

```text
radarTaskId=clx_task_id
minScore=70
toolType=generator
riskLevel=low
status=new
```

`task` is also accepted as an alias for `radarTaskId`, and `risk` is accepted as an alias for `riskLevel`. Risk filtering is derived from stored opportunity analysis/risk summaries because risk is not a dedicated database column in this slice.

Validate this slice with:

```bash
npm test
npm run build
```

Non-goals for this slice: no `/opportunities/[id]` implementation, no status mutations, no Run Scan button wiring, no recent-run polling component, no API routes, no scan orchestration changes, no schema or migration changes, and no package dependency changes.

## Opportunity Detail and Status Updates

The M5 opportunity detail slice adds a server-rendered `/opportunities/{id}` page backed by the shared `lib/opportunities.ts` helper. The detail page loads one persisted Opportunity by id and renders the keyword brief, total score, persisted score breakdown and explanations, SERP weakness, tool concept/toolability cues, monetization cues, risk cues, build complexity, kill criteria, radar task context, search run context, and current status. Missing opportunities use the framework not-found path.

Status updates are intentionally narrow and local-admin only:

```text
PATCH /api/opportunities/{id}
```

Request body:

```json
{
  "status": "saved"
}
```

Only `saved`, `discarded`, and `build_next` are accepted. Invalid statuses return a validation error, missing opportunities return a sanitized not-found error, and successful updates persist the new status on the Opportunity row. This MVP still assumes a single local admin and does not add sessions, auth, public multi-user workflow, audit history, discard reasons, or irreversible deletes.

Validate this slice with:

```bash
npx tsx --test tests/opportunities.test.ts
npm test
npm run build
git diff --check
```

Non-goals for the detail/status slice: no schema migration, no package dependency change, no scan orchestration change, no scoring formula change, no auth/session system, no provider setup, no deployment, and no GitHub Actions change.

## MVP Spec Generation

The M6 MVP Spec slice turns one persisted opportunity detail view model into copyable, Codex-ready Markdown.

- `agents/mvp-spec-agent.ts` exposes `generateMvpSpec()` and deterministic local Markdown generation. It can use injected LLM and safe-JSON dependencies in tests, but the default path does not create providers, read secrets, read `process.env`, call the network, or require package changes.
- `POST /api/opportunities/{id}/mvp-spec` loads the persisted opportunity, generates Markdown, upserts the existing `MvpSpec` table by `opportunityId`, and returns `{ "data": { ... } }` with markdown, model id, and timestamps.
- `/opportunities/{id}` shows an MVP Spec panel with empty, loading, error, already-generated, generate/regenerate, and Copy Markdown states. Reopening the detail page displays the persisted spec when one exists.

The generated Markdown includes page structure, form fields, data model notes, API routes, result behavior, monetization entry points, risk notes, a 48-hour build checklist, acceptance criteria, and kill criteria. It is meant for local build planning, not public publishing.

Local data dependency: the route needs an existing `Opportunity` row with its related `RadarTask` and `SearchRun`. Seed radar tasks with `npm run db:seed`, then create opportunities through the local scan flow before generating a spec.

This MVP still assumes a single local admin. It does not add sessions, public auth, ownership checks, billing, telemetry, public sharing, deployment, provider setup, schema migrations, scan orchestration changes, scoring formula changes, or package dependencies.

Validate this slice with:

```bash
npx tsx --test tests/mvp-spec-agent.test.ts tests/mvp-spec-api.test.ts tests/opportunities.test.ts
npm test
npm run build
git diff --check
```

## Local Radar Task API

The MVP exposes a single-admin, unauthenticated local API slice for Radar Task management. It is intended for local development and later admin UI integration; it does not add sessions, public auth, scans, SERP providers, or LLM calls.

Endpoints:

```text
GET    /api/radar-tasks?limit=50&isActive=true
POST   /api/radar-tasks
GET    /api/radar-tasks/{id}
PATCH  /api/radar-tasks/{id}
DELETE /api/radar-tasks/{id}  # deactivates the task without deleting historical runs
```

`DELETE /api/radar-tasks/{id}` is intentionally non-destructive for the MVP. It sets `isActive` to `false` and returns a payload with `action: "deactivated"` and `historyPreserved: true`; related SearchRun, KeywordCandidate, SerpResult, Opportunity, and MvpSpec records are left intact.

Create requests use the shared strict Radar Task schema. Patch requests accept one or more of the same fields:

```json
{
  "name": "GameDev Microtools",
  "domainDescription": "Steam, Unity, indie game launch, game localization, game marketing microtools",
  "seedExamples": ["steam short description generator"],
  "countries": ["US"],
  "languages": ["en"],
  "userAdvantages": ["GameDev", "AI automation"],
  "monetizationPreferences": ["ads", "affiliate"],
  "riskPreferences": {
    "maxRisk": "medium",
    "avoidYMYLConclusions": true
  },
  "excludedTopics": ["medical", "adult", "gambling"],
  "dailyLimit": 10,
  "isActive": true
}
```

API responses use `{ "data": ... }` on success and `{ "error": { "code": "...", "message": "...", "issues": [...] } }` for invalid JSON, validation failures, missing records, or unexpected failures.

Validate the local API slice with:

```bash
npx prisma validate
npx prisma generate
npm run build
```

## Database Setup

This MVP uses Prisma with local SQLite by default. The Prisma schema points at `file:./dev.db`, so the CLI can run from a clean checkout without creating a root `.env` file. Runtime features may still read `DATABASE_URL` from `.env.local` when they need it.

```bash
npm run db:validate
npm run db:generate
```

Create or update the local database with a non-destructive Prisma migration:

```bash
npm run db:migrate -- --name init
```

Seed sample radar tasks from `mock-data/sample_radar_tasks.json` without modifying the mock data file:

```bash
npm run db:seed
```

The default SQLite URL is `file:./dev.db`, which Prisma resolves under the `prisma/` directory. For hosted PostgreSQL later, switch the Prisma datasource provider to PostgreSQL, use the PostgreSQL `DATABASE_URL`, and keep the model fields aligned with the existing schema maps.

## 包内文档

| 文件 | 用途 |
|---|---|
| `docs/01_project_naming_and_positioning.md` | 项目命名、定位、人群、商业模式 |
| `docs/02_48_hour_execution_plan.md` | 48 小时可完成的 MVP 计划 |
| `docs/03_technical_architecture.md` | 技术架构、模块、API、部署建议 |
| `docs/04_product_roadmap.md` | 从自用 MVP 到订阅 SaaS 的路线图 |
| `docs/05_ui_ux_plan.md` | 页面结构、UI 信息架构、主要界面草图 |
| `docs/06_feature_specification.md` | 具体功能规格、用户故事、优先级 |
| `docs/07_data_model_and_scoring.md` | 数据模型、机会评分公式、字段定义 |
| `docs/08_ai_agents_and_prompts.md` | AI agent 分工、核心 prompts、输出 schema |
| `docs/09_codex_implementation_tasks.md` | 给 Codex 的开发任务拆解和提交顺序 |
| `docs/10_acceptance_criteria_and_test_plan.md` | 验收标准、测试计划、边界情况 |
| `docs/11_development_plan.md` | 基于全部项目文档整理的研发计划、里程碑和验收节奏 |
| `codex_start_prompt.md` | 可直接复制给 Codex 的启动提示词 |
| `.env.example` | 环境变量模板 |
| `mock-data/sample_opportunities.json` | 示例机会数据 |
| `mock-data/sample_radar_tasks.json` | 示例 Radar 任务数据 |

## 推荐开发原则

1. **先自用，不先做公开 SaaS。** 48 小时 MVP 的目标是每天帮你自己筛项目。
2. **先手动触发扫描，再做定时任务。** Cron 可以放到第 2 天后半段或 V1。
3. **先输出机会 brief，再生成完整 MVP spec。** 不要第一版就做复杂自动建站。
4. **避免黑盒分数。** 每个机会必须解释为什么值得做、为什么竞争弱、为什么适合用户。
5. **不要做 SEO 内容农场。** 产品目标是发现可交互工具机会，而不是批量生成低价值文章。
