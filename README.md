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

Start a production build locally:

```bash
npm run start
```

The scaffold can build without secrets. When runtime features need configuration, copy `.env.example` to `.env.local` and keep secret reads on the server through `lib/env.ts`.

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
