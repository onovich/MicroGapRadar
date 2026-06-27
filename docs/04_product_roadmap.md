# 04 - Product Roadmap

## 路线图原则

MicroGap Radar 的路线不是从第一天就做完整 SaaS，而是：

```text
自用雷达 → 半公开日报 → 定制订阅 → MVP 生成工作台 → 机会反馈闭环
```

每一阶段都要证明一个具体假设，而不是堆功能。

## Phase 0：48 小时自用 MVP

目标：证明系统能帮你自己做决策。

核心能力：
- 创建 Radar 任务。
- 手动触发扫描。
- 生成候选关键词。
- 获取 SERP 或 mock SERP。
- 分析机会。
- 输出排行榜。
- 生成 MVP spec。

成功标准：
- 每天能产出 10+ 条机会。
- Top 3 机会中至少 1 个看起来值得做。
- 能从系统输出直接开始开发一个小工具。

不做：
- 多用户。
- 完整支付。
- 完整邮件。
- 自动建站。

## Phase 1：自用强化版，1-2 周

目标：让系统真的成为项目选题工作台。

新增功能：
1. 每日 cron 自动扫描。
2. 每日 digest 邮件。
3. 收藏 / 标记状态：
   - `new`
   - `reviewing`
   - `build_next`
   - `built`
   - `discarded`
4. 用户反馈字段：
   - 是否上线
   - impressions
   - clicks
   - paid conversions
   - affiliate clicks
5. 评分权重可配置。
6. 批量导出 Markdown。
7. 支持更多 Radar 模板。

成功标准：
- 用它筛出 3 个实际开发项目。
- 至少 1 个项目获得搜索展示或用户使用。
- 评分公式经过至少 2 轮人工校准。

## Phase 2：公开样例与等候名单，2-4 周

目标：验证别人是否愿意看和订阅。

新增功能：
1. Public digest 页面。
2. 每周 5 个公开机会。
3. 邮件订阅等待名单。
4. 单页介绍产品定位。
5. 示例 opportunity brief。
6. 用户申请内测表单。

成功标准：
- 100+ waitlist。
- 10+ 人主动描述自己的领域需求。
- 至少 3 人愿意为定制报告付费或试用。

## Phase 3：订阅 MVP，1-2 个月

目标：验证 $19-$49/月 是否有人付费。

新增功能：
1. 用户账号。
2. Stripe Checkout。
3. 订阅计划和配额：
   - Free
   - Starter
   - Pro
4. 每个用户可以创建多个 Radar。
5. 每日自动扫描。
6. 邮件 digest。
7. 机会收藏和导出。
8. 配额限制：
   - 每日任务数
   - 每日 SERP 查询数
   - 每日 MVP spec 生成数

成功标准：
- 10 个付费用户。
- 月收入覆盖 API 成本。
- 订阅用户每周至少打开 2 次 digest 或 dashboard。

## Phase 4：MVP 生成工作台，2-3 个月

目标：从“发现机会”升级为“把机会转成项目”。

新增功能：
1. Generate MVP Kit：
   - landing page copy
   - tool form schema
   - AI result schema
   - paid export structure
   - SEO support pages
   - implementation checklist
2. Generate Codex Prompt。
3. 导出 GitHub issue 列表。
4. 导出 Linear / Notion task。
5. 机会之间的内链建议。

成功标准：
- 用户从机会到启动开发的时间小于 30 分钟。
- 付费用户每月至少生成 3 个 MVP Kit。
- 用户愿意为 Pro 方案续费。

## Phase 5：反馈闭环与数据资产，3-6 个月

目标：让系统越用越准。

新增功能：
1. 用户项目跟踪。
2. 连接 Google Search Console。
3. 连接 analytics。
4. 跟踪每个机会的真实表现：
   - impressions
   - clicks
   - CTR
   - tool usage
   - paid export clicks
   - revenue
5. 评分模型自动校准。
6. 推荐“扩展同类机会”。

成功标准：
- 能知道哪些领域、关键词形态、工具形态实际表现更好。
- 系统推荐准确率提高。
- 产品壁垒从 prompt 变成数据反馈闭环。

## Phase 6：Agency / Studio 版本，6 个月后

目标：服务小团队和 agency。

新增功能：
1. 多客户工作区。
2. 白标 opportunity report。
3. 团队权限。
4. 批量 radar。
5. API / webhook。
6. 领域模板市场。
7. 合作伙伴 lead-gen。

成功标准：
- 有 agency 用户愿意付 $99-$199/月。
- 白标报告能用于客户提案。
- 系统成为 agency 选题和 lead magnet 生产工具。

## 长期愿景

MicroGap Radar 最终不是一个“机会排行榜”，而是：

> 从搜索需求发现到微工具 MVP 生成，再到上线后数据反馈的 AI 小产品工厂控制台。

最终系统应该能回答：

1. 今天哪个机会最值得做？
2. 为什么是它？
3. 该做成什么工具？
4. 48 小时版本应该包含什么？
5. 变现入口放哪里？
6. 上线后如何判断继续还是放弃？
7. 同类机会还能复制到哪些国家、语言和职业？
