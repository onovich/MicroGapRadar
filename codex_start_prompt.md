# Codex 启动提示词

你现在要开发一个名为 **MicroGap Radar（微隙雷达）** 的 48 小时 MVP。

请先阅读项目包中的全部文档，特别是：

1. `docs/02_48_hour_execution_plan.md`
2. `docs/03_technical_architecture.md`
3. `docs/06_feature_specification.md`
4. `docs/07_data_model_and_scoring.md`
5. `docs/08_ai_agents_and_prompts.md`
6. `docs/09_codex_implementation_tasks.md`
7. `docs/10_acceptance_criteria_and_test_plan.md`

## 项目目标

MicroGap Radar 是一个自用优先、未来可订阅化的 AI 微工具机会雷达。它每天扫描垂直领域，发现低竞争、高价值、适合用 AI 快速做成网页微工具的搜索机会，并输出机会排行榜与可开发 MVP spec。

48 小时 MVP 的核心链路：

```text
创建 Radar Task
→ 手动 Run Scan
→ 生成候选关键词
→ 获取 SERP 或 mock SERP
→ AI 分析机会
→ 评分排序
→ 查看机会详情
→ 生成 MVP Spec
→ 复制给 Codex 开发具体小工具
```

## 开发原则

1. 不要先做完整 SaaS、团队协作或复杂支付。
2. 必须实现 mock SERP provider，保证无外部 API key 也能跑通。
3. SERP provider 必须通过 adapter 接口实现，方便替换。
4. AI 输出必须使用 Zod schema 校验。
5. 评分函数必须是普通 TypeScript 函数，不要让 LLM 直接决定最终总分。
6. MVP spec 必须能复制为 Markdown。
7. 不要输出收益保证、法律/医疗/金融确定性建议。

## 请按这个顺序开发

1. 初始化 Next.js + TypeScript + Tailwind。
2. 建立数据库模型。
3. 实现 admin gate。
4. 实现 Radar Task CRUD。
5. 实现 SERP provider interface 和 mock provider。
6. 实现 LLM client 和 JSON parser。
7. 实现 Keyword Expansion Agent。
8. 实现 SERP Analysis Agent。
9. 实现 Opportunity Analysis Agent。
10. 实现 Scoring Engine。
11. 实现 Run Scan API。
12. 实现 Dashboard 和 Opportunity List。
13. 实现 Opportunity Detail。
14. 实现 MVP Spec Agent。
15. 写测试，确保 build 通过。

## 最小验收 Demo

完成后请保证可以演示：

1. 登录后台。
2. 创建 `GameDev Microtools` Radar。
3. 使用 mock provider 点击 `Run Scan`。
4. Dashboard 显示机会榜。
5. 打开一个机会。
6. 查看分数解释。
7. 点击 `Generate MVP Spec`。
8. 复制 Markdown。

如果时间不够，优先完成核心链路，放弃复杂样式、订阅和邮件功能。
