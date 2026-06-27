# 02 - 48 小时 MVP 执行计划

## 目标

在 48 小时内完成一个自用版 MicroGap Radar：

- 可以创建多个 Radar 任务。
- 每个任务包含领域、国家、语言、个人优势、排除项和变现偏好。
- 可以手动触发扫描。
- 系统自动生成候选关键词，调用 SERP provider 获取搜索结果，再用 AI 分析竞争弱点和工具化机会。
- 输出今日机会排行榜。
- 每条机会都有可解释评分、MVP 工具形态、变现建议、风险提醒和 48 小时开发 brief。

## 技术前提

- 先做 admin-only 单用户产品。
- 支持本地运行和 Vercel 部署。
- 允许先使用 mock SERP 数据，确保 UI 和流程跑通。
- SERP provider 做适配器接口，第一版接一个 provider 即可。
- 订阅支付只做占位，不在 48 小时内做完整 Stripe webhook。

## 时间安排

### 0-4 小时：项目初始化

交付：可运行的基础工程。

任务：
1. 初始化 Next.js + TypeScript 项目。
2. 配置 Tailwind CSS 和基础 UI 组件。
3. 配置数据库 ORM。
4. 创建基本目录结构：
   - `app/`
   - `components/`
   - `lib/`
   - `services/`
   - `agents/`
   - `server/`
   - `prisma/` 或 `db/`
5. 创建环境变量读取工具。
6. 创建简单 admin auth，或用单一密码保护后台。

验收：
- 本地 `npm run dev` 可启动。
- `/dashboard` 可访问。
- 未登录或密码错误不能进入后台。

### 4-10 小时：数据模型和任务管理

交付：可以创建、编辑、删除 Radar 任务。

任务：
1. 建表：`radar_tasks`、`search_runs`、`opportunities`。
2. 实现 Radar 任务表单。
3. 实现任务列表。
4. 支持字段：
   - 任务名称
   - 领域描述
   - 目标国家
   - 目标语言
   - 技术优势
   - 变现偏好
   - 风险偏好
   - 排除行业
   - 每日候选数量
5. 写入数据库。

验收：
- 可创建 3 个不同任务。
- 可在数据库看到保存结果。
- 页面刷新后数据仍在。

### 10-18 小时：候选关键词生成与 SERP 适配

交付：每个 Radar 可以生成候选关键词并拉取搜索结果。

任务：
1. 实现 `KeywordExpansionAgent`。
2. 输入 Radar 任务，输出 20-50 个候选关键词。
3. 实现 SERP provider interface：
   ```ts
   interface SerpProvider {
     search(input: SerpSearchInput): Promise<SerpResult[]>;
   }
   ```
4. 实现至少一个真实 provider 或 mock provider。
5. 缓存 SERP 查询，避免重复消耗。
6. 保存 `raw_serp_results`。

验收：
- 点击 `Run Scan` 后可看到候选关键词。
- 至少 10 个关键词有 SERP 结果。
- provider 出错时任务不会整体崩溃，而是记录错误。

### 18-28 小时：机会分析和评分系统

交付：系统能把搜索结果转成机会排行榜。

任务：
1. 实现 `OpportunityAnalysisAgent`。
2. 对每个关键词分析：
   - 搜索意图
   - 工具化程度
   - SERP 弱点
   - 竞争强度
   - 变现方式
   - 合规风险
   - 个人适配度
3. 实现评分公式：
   ```text
   total_score =
     intent_score * 0.18 +
     monetization_score * 0.16 +
     serp_weakness_score * 0.18 +
     toolability_score * 0.18 +
     user_fit_score * 0.14 +
     build_speed_score * 0.10 -
     risk_penalty * 0.06
   ```
4. 为每个分数保存解释。
5. 生成排序列表。

验收：
- 每个机会有 0-100 总分。
- 每个机会有分项分数和解释。
- 列表可按分数排序。
- 至少输出 10 个机会。

### 28-36 小时：机会详情页与 MVP brief

交付：点开机会后能得到可开发规格。

任务：
1. 创建机会详情页。
2. 显示：
   - 关键词
   - 用户意图
   - SERP 弱点
   - 推荐工具形态
   - 48 小时 MVP 功能
   - 页面结构
   - 表单字段
   - AI 输出模块
   - 付费导出点
   - affiliate / 广告 / lead-gen 机会
   - 风险和免责声明建议
3. 实现 `MvpSpecAgent`，生成 Markdown brief。
4. 支持复制 Markdown。
5. 支持收藏机会。

验收：
- 任意机会都能打开详情页。
- 点击 `Generate MVP Spec` 后生成可复制 Markdown。
- 收藏状态持久化。

### 36-42 小时：Dashboard 和 UI 打磨

交付：自用可看、可操作的后台。

任务：
1. Dashboard 顶部展示今日 Top 5。
2. 提供筛选：任务、国家、语言、分数、风险、工具形态。
3. 提供空状态和错误状态。
4. 提供 loading 状态。
5. 给机会卡片加 badge：
   - Calculator
   - Checker
   - Generator
   - Template
   - Checklist
   - Lead-gen
6. 增加 “Do today” section。

验收：
- 用户 30 秒内能看到今天最值得做的 3 个机会。
- 每条机会的理由清晰。
- 不需要看数据库就能完成主要操作。

### 42-48 小时：测试、部署和文档

交付：可交给自己长期使用的 MVP。

任务：
1. 写基础单元测试：评分函数、provider mock、数据写入。
2. 写 smoke test：创建任务、运行扫描、查看机会。
3. 部署到 Vercel 或自有服务器。
4. 配置 cron endpoint，但允许先手动触发。
5. 写 README：如何启动、如何配置 provider、如何运行 scan。
6. 加入免责声明：分数不是收益承诺。

验收：
- 线上环境可以登录。
- 可以创建任务。
- 可以手动运行 scan。
- 可以看到机会榜和详情。
- 开发文档清楚。

## 48 小时内明确不做

- 完整订阅系统。
- 多用户团队协作。
- 自动生成完整网站。
- 复杂爬虫和反爬处理。
- 自建关键词数据库。
- 完整邮件 digest。
- 复杂权限管理。
- 商标/域名检索。

## 48 小时完成后的第一周目标

- 每天自用一次。
- 至少创建 5 个 Radar：GameDev、合规、Shopify/Etsy、小生意、职业模板。
- 记录系统推荐的 Top 30 机会。
- 从中挑 3 个实际开发小工具。
- 用真实结果反向校准评分公式。
