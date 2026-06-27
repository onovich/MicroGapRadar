# 06 - 具体功能策划

## 功能优先级定义

- **P0**：48 小时 MVP 必须完成。
- **P1**：自用强化版应该完成。
- **P2**：对外订阅版再做。
- **P3**：长期高级功能。

## P0 功能

### 1. Admin 登录

**目的**：保护自用后台。

用户故事：
> 作为产品 owner，我希望只有我可以访问 Dashboard，避免 API 被乱用。

功能：
- 输入密码登录。
- Session 持久化。
- Logout。

验收：
- 未登录无法访问 `/dashboard`。
- 登录后可访问。

### 2. Radar Task 创建

**目的**：定义一个垂直领域扫描任务。

用户故事：
> 作为用户，我希望告诉系统我关注的领域、国家、语言和优势，让它每天给我定制机会。

字段：
- `name`：任务名。
- `domain_description`：领域描述。
- `seed_examples`：种子关键词或样例。
- `countries`：目标国家。
- `languages`：目标语言。
- `user_advantages`：用户优势。
- `monetization_preferences`：变现偏好。
- `risk_preferences`：风险偏好。
- `excluded_topics`：排除领域。
- `daily_limit`：每日机会数量。
- `is_active`：是否启用。

验收：
- 可以创建、编辑、删除任务。
- 表单有基础校验。
- 空字段有合理提示。

### 3. 手动 Run Scan

**目的**：运行一次扫描。

用户故事：
> 作为用户，我希望点击一个按钮就能生成今日机会榜。

流程：
1. 用户点击 `Run Scan`。
2. 系统创建 `search_run`。
3. 生成候选关键词。
4. 获取 SERP。
5. 分析机会。
6. 保存结果。
7. 返回列表。

状态：
- pending
- running
- completed
- failed
- partial_failed

验收：
- 成功时显示机会数量。
- 部分关键词失败不会导致整个 scan 失败。
- 失败时显示错误信息。

### 4. Keyword Expansion Agent

**目的**：把用户领域转成可搜索候选词。

输入：
- Radar task profile。

输出：
- 20-50 个候选关键词。
- 每个关键词带：国家、语言、意图类型、预估工具形态。

关键词应优先包含这些修饰词：
- generator
- checker
- calculator
- estimator
- template
- checklist
- audit
- policy
- form
- cost
- requirements
- for [country/state/profession/platform]

验收：
- 输出 JSON。
- 不出现被排除领域。
- 候选词足够具体。

### 5. SERP Provider Adapter

**目的**：获取每个关键词的搜索结果。

功能：
- 统一 provider interface。
- mock provider。
- 至少一个真实 provider 的实现占位。
- 缓存结果。

验收：
- 无 API key 时 mock 模式可运行。
- provider 出错时记录错误。
- 原始结果可保存。

### 6. Opportunity Analysis Agent

**目的**：从 SERP 和关键词中判断微工具机会。

输入：
- keyword
- target country
- target language
- SERP top results
- radar task profile

输出：
- opportunity summary
- search intent
- recommended tool type
- SERP weakness signals
- monetization options
- build complexity
- risk notes
- score reasoning

验收：
- 输出结构化 JSON。
- 每个机会都有可解释理由。
- 分析不会输出收益承诺。

### 7. Scoring Engine

**目的**：把机会排序。

分项：
- intent_score
- monetization_score
- serp_weakness_score
- toolability_score
- user_fit_score
- build_speed_score
- risk_penalty

验收：
- 分数范围 0-100。
- 分项可解释。
- 评分函数可单独测试。

### 8. Opportunity List

**目的**：查看机会排行榜。

功能：
- 按总分排序。
- 显示关键词、市场、语言、工具形态、总分、摘要。
- 支持基础筛选。

验收：
- 列表加载快。
- 可以从 Dashboard 进入详情。

### 9. Opportunity Detail

**目的**：把机会变成行动 brief。

内容：
- 关键词。
- 分数和分项解释。
- SERP 弱点。
- 推荐工具形态。
- 变现建议。
- 风险说明。
- 48 小时 MVP brief。

验收：
- 点击机会卡可进入详情。
- 页面包含完整信息。
- 有 `Copy MVP Spec` 按钮。

### 10. MVP Spec 生成

**目的**：生成可直接交给 Codex 的开发 brief。

输出内容：
- 产品名。
- 目标关键词。
- 用户画像。
- 页面结构。
- 表单字段。
- AI 输出模块。
- 数据模型。
- API routes。
- 变现入口。
- 验收标准。
- 放弃条件。

验收：
- 输出 Markdown。
- 可复制。
- 内容足够让 Codex 开始开发。

## P1 功能

### 1. Daily Cron

每天自动扫描 active tasks。

功能：
- cron secret 校验。
- 每个任务独立运行。
- 出错不中断全部任务。

### 2. Daily Digest Email

每天发送 Top opportunities。

内容：
- Top 5。
- 每个机会一句话理由。
- 链接到详情页。

### 3. 用户反馈

字段：
- saved
- discarded
- build_next
- built
- result_notes
- real_impressions
- real_clicks
- real_revenue

目的：反向校准评分。

### 4. Scoring Weight Settings

允许用户调整权重：
- 更重视低竞争。
- 更重视变现。
- 更重视个人适配。
- 更重视低风险。

### 5. Export

导出格式：
- Markdown
- CSV
- JSON

## P2 功能

### 1. 多用户账号

- Email 登录。
- OAuth 可选。
- 用户级数据隔离。

### 2. Stripe 订阅

- Free / Starter / Pro。
- 配额控制。
- Webhook 同步订阅状态。

### 3. Public Opportunity Digest

- 每周公开 5 个机会。
- 用于 SEO 和获客。

### 4. Team Workspace

- 多成员。
- 多客户。
- 白标导出。

### 5. 多 Provider Fallback

- SERP provider 失败时自动切换。
- 每个 provider 的成本统计。

## P3 功能

### 1. Google Search Console 集成

用户把已上线项目连接 Search Console，系统跟踪真实表现。

### 2. 自动评分校准

根据真实 impressions、CTR、转化数据调权重。

### 3. Generate MVP Kit

从机会直接生成：
- landing page copy
- UI spec
- prompt
- schema
- API spec
- launch checklist

### 4. Generate Prototype

长期可选。生成 Next.js starter 项目或 GitHub issue。

## 功能不做清单

- 不自动抓取整个互联网。
- 不自动购买域名。
- 不自动发布 SEO 页面。
- 不替用户判断法律合规结果。
- 不给收益保证。
- 不做成人、博彩、灰产机会推荐。

## 核心使用流程

```text
Create Radar Task
→ Run Scan
→ View Ranked Opportunities
→ Open Detail
→ Generate MVP Spec
→ Copy to Codex
→ Mark Build Next / Discard
→ Later record results
```

## 首批内置 Radar 模板

### GameDev Microtools

领域描述：
> Steam、Unity、indie game launch、game localization、game marketing 相关的低竞争网页工具机会。

关键词方向：
- Steam description generator
- Steam tag checker
- game localization calculator
- Unity error explainer
- indie press kit generator

### Compliance Checklists

领域描述：
> 小企业合规、平台政策、无障碍、AI 使用政策的 checklist / generator / audit 工具机会。

关键词方向：
- accessibility checklist for Shopify
- AI policy generator for small business
- cookie banner checklist

### Small Business Startup Packets

领域描述：
> 本地小生意开店许可、成本、模板、清单类机会。

关键词方向：
- food truck permit checklist
- home bakery startup checklist
- dog grooming waiver generator

### Freelancer Documents

领域描述：
> 职业模板、报价、合同骨架、brief、intake form 等低风险文档生成器。

关键词方向：
- photographer contract brief generator
- cleaning service quote template
- interior design client brief

### Seller Tools

领域描述：
> Shopify、Etsy、Gumroad、KDP 等平台卖家的小工具机会。

关键词方向：
- Etsy fee calculator
- Shopify returns policy generator
- KDP description generator
