# 09 - Codex 开发任务拆解

## 总体目标

请 Codex 按下面顺序实现 MicroGap Radar 的 48 小时 MVP。不要先做复杂订阅、团队协作或自动建站。优先保证核心链路跑通：

```text
创建 Radar Task → Run Scan → 生成机会排行榜 → 打开机会详情 → 生成 MVP Spec → 复制给 Codex
```

## 技术要求

- Next.js + TypeScript。
- Tailwind CSS。
- PostgreSQL + ORM，或先用 SQLite 但保留迁移到 Postgres 的结构。
- 所有 LLM 输出走 Zod schema 校验。
- SERP provider 使用 adapter。
- 必须包含 mock provider，方便无 API key 时开发。
- 评分函数必须独立可测试。

## 开发顺序

### Task 1：初始化项目

交付：基础工程。

要做：
1. 创建 Next.js TypeScript 项目。
2. 加 Tailwind。
3. 加基础 layout。
4. 创建 `lib/env.ts` 读取环境变量。
5. 创建基础 UI components。
6. 创建 README 开发说明。

验收：
- `npm run dev` 可运行。
- 首页显示 MicroGap Radar。

### Task 2：数据库和 ORM

交付：数据模型。

要做：
1. 建立 ORM 配置。
2. 创建模型：
   - RadarTask
   - SearchRun
   - KeywordCandidate
   - SerpResult
   - Opportunity
   - MvpSpec
3. 创建 migration。
4. 创建 db client。
5. 创建 seed script，插入 sample radar tasks。

验收：
- migration 可运行。
- seed 后 dashboard 可读到 sample tasks。

### Task 3：Admin Gate

交付：简单登录保护。

要做：
1. `/login` 页面。
2. 密码校验。
3. session cookie。
4. middleware 保护 `/dashboard`、`/radar-tasks`、`/opportunities`。

验收：
- 未登录跳转 `/login`。
- 登录后可访问后台。

### Task 4：Radar Task CRUD

交付：任务管理。

要做：
1. `/radar-tasks` 列表。
2. `/radar-tasks/new` 创建。
3. `/radar-tasks/[id]` 查看。
4. 编辑和删除。
5. 表单使用 Zod 校验。

验收：
- 可创建并保存任务。
- 可修改 active 状态。

### Task 5：SERP Provider Interface + Mock Provider

交付：搜索适配器。

要做：
1. 定义 `SerpProvider` interface。
2. 实现 `MockSerpProvider`。
3. 实现 provider factory。
4. 创建几个 mock 关键词结果。
5. 后续真实 provider 使用同一接口。

验收：
- 调用 mock provider 可返回 top results。
- provider 错误可被捕获。

### Task 6：LLM Client + JSON Parser

交付：LLM 调用工具。

要做：
1. 创建 OpenAI-compatible client。
2. 创建 `safeJsonCompletion()`。
3. 加 Zod schema validate。
4. 加 repair JSON 逻辑。
5. 加超时和错误处理。

验收：
- 可以对一个 prompt 返回 JSON。
- JSON 解析失败时不会导致服务崩溃。

### Task 7：Keyword Expansion Agent

交付：候选关键词生成。

要做：
1. 创建 `agents/keyword-expansion-agent.ts`。
2. 输入 RadarTask。
3. 输出 KeywordCandidate 数组。
4. 保存到数据库。
5. 提供 mock fallback。

验收：
- 运行 agent 后有 20 个候选关键词。
- 不包含 excluded topics。

### Task 8：SERP Analysis Agent

交付：SERP 弱点分析。

要做：
1. 创建 `agents/serp-analysis-agent.ts`。
2. 输入关键词和 SERP results。
3. 输出 weakSignals、strongSignals、serpWeaknessScoreHint。
4. 结果保存到 opportunity raw analysis 或临时对象。

验收：
- 对 mock SERP 能判断“generic articles / no interactive tool”等信号。

### Task 9：Opportunity Analysis Agent

交付：机会结构化分析。

要做：
1. 创建 `agents/opportunity-analysis-agent.ts`。
2. 输入 RadarTask、KeywordCandidate、SERP results、SERP analysis。
3. 输出 opportunity JSON。
4. 保存 Opportunity。

验收：
- 每个关键词生成一个 opportunity 或标记不推荐。
- 机会包含 title、summary、toolType、monetization、risk。

### Task 10：Scoring Engine

交付：稳定评分。

要做：
1. 创建 `lib/scoring.ts`。
2. 实现 `calculateOpportunityScore()`。
3. 编写单元测试。
4. 保存 score_breakdown。

验收：
- 输入 scoreHints 能返回 0-100 总分。
- 高风险机会被惩罚。
- 工具化高、SERP 弱、个人适配高的机会分数更高。

### Task 11：Run Scan API

交付：核心 orchestrator。

要做：
1. 创建 `services/scan-orchestrator.ts`。
2. 创建 API `/api/scans/run`。
3. 顺序运行：keyword expansion → SERP → analysis → scoring → save。
4. 支持 `useMockSerp`。
5. 保存 run 状态。

验收：
- 从 Radar detail 点击 Run Scan 可完成一轮。
- 完成后生成机会列表。
- 错误被记录。

### Task 12：Dashboard 和 Opportunity List

交付：可看榜单。

要做：
1. `/dashboard` 显示 Top 5。
2. `/opportunities` 显示列表。
3. 支持按 task、score、toolType、risk 过滤。
4. 创建 OpportunityCard。

验收：
- 能看到机会卡片。
- 排序正确。
- 点击进入详情。

### Task 13：Opportunity Detail

交付：机会详情页。

要做：
1. `/opportunities/[id]`。
2. 显示 score breakdown。
3. 显示 SERP weakness。
4. 显示 tool concept。
5. 显示 monetization 和 risk。
6. 增加 Save / Discard / Build Next 状态更新。

验收：
- 机会详情信息完整。
- 状态按钮生效。

### Task 14：MVP Spec Agent

交付：Codex-ready brief。

要做：
1. 创建 `agents/mvp-spec-agent.ts`。
2. 创建 API `/api/opportunities/[id]/mvp-spec`。
3. 生成 Markdown。
4. 保存 MvpSpec。
5. UI 提供 Copy Markdown。

验收：
- 点击按钮生成 spec。
- Markdown 可复制。
- 再次打开机会仍能看到已生成 spec。

### Task 15：基础测试和部署准备

交付：可部署。

要做：
1. 单元测试：评分函数。
2. 单元测试：mock provider。
3. Smoke test：创建 task → run scan → opportunity count > 0。
4. README 补充环境变量。
5. 处理 loading/error states。

验收：
- `npm test` 通过。
- `npm run build` 通过。

## 推荐提交顺序

```text
commit 1: project setup
commit 2: db schema and seed
commit 3: admin gate
commit 4: radar task CRUD
commit 5: provider interface and mock provider
commit 6: LLM client and agents
commit 7: scoring engine
commit 8: scan orchestrator and API
commit 9: dashboard and opportunity list
commit 10: opportunity detail and MVP spec
commit 11: tests and polish
```

## 关键代码约束

1. 不要把 prompt 散落在组件中，统一放 `agents/`。
2. 不要让组件直接调用 LLM。
3. SERP provider 必须可替换。
4. 评分函数不要依赖 LLM。
5. 所有 API routes 要处理异常。
6. 所有长文本输出要有复制按钮。
7. 不要在日志中泄露 API keys。

## 最小可用验收 Demo

演示脚本：

1. 登录后台。
2. 创建 Radar：`GameDev Microtools`。
3. 点击 Run Scan，选择 mock provider。
4. Dashboard 出现 Top opportunities。
5. 打开 `Steam short description generator`。
6. 查看分数解释。
7. 点击 Generate MVP Spec。
8. 复制 Markdown。

只要这个流程顺畅，48 小时 MVP 就算完成。
