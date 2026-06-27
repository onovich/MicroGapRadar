# 11 - 研发计划

## 计划目标

本计划基于 `docs/01` 至 `docs/10` 的产品、架构、功能、Agent、数据模型和验收文档制定。当前阶段不追求完整 SaaS，而是先交付一个可自用、可演示、可继续扩展的 48 小时 MVP。

核心验收闭环：

```text
登录后台
→ 创建 Radar Task
→ 使用 mock provider 手动 Run Scan
→ 生成候选关键词与 SERP 结果
→ 生成机会排行榜
→ 查看机会详情与评分解释
→ 生成 MVP Spec
→ 复制 Markdown
```

## 研发原则

1. 先跑通核心链路，再打磨样式和扩展功能。
2. 无外部 API key 时必须可以用 mock provider 完成 demo。
3. SERP provider、LLM provider、数据库访问都通过可替换接口实现。
4. LLM 只负责结构化判断和文本生成，最终评分由 TypeScript 函数计算。
5. 所有 LLM JSON 输出必须经过 Zod 校验，解析失败要可恢复或可记录。
6. 后台先做单 admin，不提前做多用户、订阅、团队和完整权限系统。
7. 不输出收益保证，不输出法律、医疗、金融等高风险确定性结论。

## 里程碑拆分

### M0：仓库与工程初始化

目标：形成可运行、可提交、可部署的基础工程。

交付：
- Next.js App Router + TypeScript。
- Tailwind CSS。
- 基础 layout 和首页。
- `lib/env.ts` 环境变量读取。
- README 开发启动说明。
- 项目 git 初始化、远端配置和初始提交。

验收：
- `npm run dev` 可启动。
- 首页显示 MicroGap Radar。
- `npm run build` 至少能通过基础工程阶段。

### M1：数据库与基础数据

目标：建立 MVP 数据骨架，支持任务、扫描、关键词、SERP、机会和 spec。

交付：
- ORM 配置，优先 Prisma；本地可先 SQLite，结构保留 PostgreSQL 迁移空间。
- 模型：`RadarTask`、`SearchRun`、`KeywordCandidate`、`SerpResult`、`Opportunity`、`MvpSpec`。
- seed script，导入 `mock-data/sample_radar_tasks.json`。
- `lib/db.ts` 数据库客户端。

验收：
- migration 可运行。
- seed 后能读到 sample radar tasks。
- 删除和重复运行不会破坏历史 run 数据。

### M2：Admin Gate 与任务管理

目标：后台可保护，Radar Task 可管理。

交付：
- `/login` 页面。
- admin password 校验和 session cookie。
- middleware 保护 `/dashboard`、`/radar-tasks`、`/opportunities`。
- Radar Task 列表、创建、详情、编辑、删除。
- 表单 Zod 校验。

验收：
- 未登录访问后台会跳转 `/login`。
- 登录后可创建、编辑、删除任务。
- 页面刷新后数据仍存在。

### M3：Provider、LLM 客户端与 Agent 基础

目标：建立扫描 pipeline 的底层接口。

交付：
- `SerpProvider` interface。
- `MockSerpProvider` 和 provider factory。
- OpenAI-compatible LLM client。
- `safeJsonCompletion()`：JSON parse、Zod validate、repair prompt、错误记录。
- Keyword Expansion Agent，支持 mock fallback。
- SERP Analysis Agent。
- Opportunity Analysis Agent。

验收：
- mock provider 可返回稳定 SERP。
- 无 API key 时仍能生成候选关键词和机会分析。
- LLM JSON 异常不会导致整个 scan 崩溃。

### M4：评分引擎与 Run Scan 核心链路

目标：把 Radar Task 转成可排序机会。

交付：
- `lib/scoring.ts` 实现 `calculateOpportunityScore()`。
- `services/scan-orchestrator.ts`。
- `/api/scans/run`。
- run 状态：`pending`、`running`、`completed`、`failed`、`partial_failed`。
- 保存 keyword candidates、SERP results、opportunities、score breakdown。

验收：
- 从 Radar detail 点击 Run Scan 可以完成一轮扫描。
- 至少生成 10 条机会。
- 分数范围限制在 0-100。
- 高风险机会有惩罚，默认不进入 Top 5。

### M5：Dashboard、机会列表与详情

目标：用户能在 30 秒内判断今天最值得做的 3 个机会。

交付：
- `/dashboard` 今日 Top 5。
- `/opportunities` 机会列表。
- 基础筛选：task、score、tool type、risk。
- OpportunityCard、ScoreBadge、RunScanButton、RecentRunStatus。
- `/opportunities/[id]` 详情页。
- Save、Discard、Build Next 状态更新。

验收：
- Dashboard 能看到 Top 机会。
- 列表按分数排序正确。
- 详情页显示 SERP 弱点、工具概念、变现建议、风险说明和分项评分。

### M6：MVP Spec 与最终验收

目标：把机会转成 Codex-ready brief。

交付：
- MVP Spec Agent。
- `/api/opportunities/[id]/mvp-spec`。
- 生成并保存 Markdown。
- Copy Markdown。
- 基础 loading、error、empty states。
- 单元测试和 smoke test。

验收：
- 点击 Generate MVP Spec 后生成可复制 Markdown。
- Markdown 包含页面结构、表单字段、API routes、变现入口、风险说明、验收标准和放弃条件。
- `npm test` 通过。
- `npm run build` 通过。

## 推荐执行顺序

1. 初始化 Next.js、Tailwind、README 和 env 读取。
2. 建立 ORM、schema、migration、seed。
3. 实现 admin gate。
4. 实现 Radar Task CRUD。
5. 实现 SERP provider interface 和 mock provider。
6. 实现 LLM client、JSON parser 和 repair 流程。
7. 实现 Keyword Expansion、SERP Analysis、Opportunity Analysis。
8. 实现 scoring engine 和测试。
9. 实现 scan orchestrator 与 `/api/scans/run`。
10. 实现 Dashboard 和 Opportunity List。
11. 实现 Opportunity Detail 和状态更新。
12. 实现 MVP Spec Agent 和复制 Markdown。
13. 补齐测试、构建、README 和部署准备。

## 推荐提交节奏

```text
commit 1: chore: initialize project workflows and planning docs
commit 2: feat: scaffold nextjs app
commit 3: feat: add database schema and seed data
commit 4: feat: add admin gate and protected routes
commit 5: feat: add radar task crud
commit 6: feat: add serp provider interface and mock provider
commit 7: feat: add llm json client and agents
commit 8: feat: add scoring engine and tests
commit 9: feat: add scan orchestrator and api
commit 10: feat: add dashboard and opportunity list
commit 11: feat: add opportunity detail and mvp spec generation
commit 12: test: add smoke coverage and deployment polish
```

## 测试策略

单元测试：
- `calculateOpportunityScore()`。
- mock provider。
- Zod schemas。
- JSON repair fallback。

集成测试：
- 创建 RadarTask。
- 使用 mock provider 运行 scan。
- 断言 SearchRun completed。
- 断言 opportunity count 大于 0。
- 断言每条机会有 score breakdown。

手动 QA：
- 未登录不能访问后台。
- 创建任务后刷新仍存在。
- provider 部分失败时 scan 可继续。
- 机会详情长文本不溢出。
- MVP Spec 可复制。
- API key 不进入前端 bundle 或日志。

## 风险与控制

| 风险 | 控制方式 |
|---|---|
| LLM 输出不可解析 | Zod 校验、repair prompt、失败记录 |
| 外部 SERP API 不稳定 | mock provider 保底，真实 provider 后置 |
| 评分变成黑盒 | LLM 只给结构化 hints，代码计算总分 |
| 范围膨胀 | 48 小时内不做多用户、完整支付、邮件 digest、自动建站 |
| 高风险领域误导用户 | risk penalty、排除主题、免责声明、只输出 checklist/self-assessment |
| API 成本失控 | 限制候选数量、缓存 SERP、低分机会不生成 spec |

## Phase 0 完成定义

```text
[ ] Can login
[ ] Can create radar task
[ ] Can run scan with mock provider
[ ] Can generate keyword candidates
[ ] Can save SERP results
[ ] Can generate 10+ opportunities
[ ] Can rank by score
[ ] Can view opportunity detail
[ ] Can save/discard/build_next
[ ] Can generate MVP spec
[ ] Can copy Markdown
[ ] Basic tests pass
[ ] Build passes
[ ] README explains setup
```

Phase 0 完成后，进入 Phase 1：每日 cron、digest 邮件、反馈字段、评分权重配置、批量导出和更多 Radar 模板。
