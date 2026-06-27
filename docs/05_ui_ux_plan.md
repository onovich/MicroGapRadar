# 05 - UI / UX 策划

## UI 设计目标

MicroGap Radar 的 UI 要服务一个动作：

> 让用户每天 30 秒内看懂今天最值得做哪 3 个微工具机会。

所以界面不追求复杂分析图表，而追求：

- 排行清晰。
- 分数可解释。
- 下一步行动明确。
- 能快速从机会跳到 MVP spec。
- 能收藏、放弃、标记已做。

## 信息架构

```text
Dashboard
├── Today's Top Opportunities
├── Radar Tasks
├── Recent Scan Runs
├── Saved Opportunities
└── Settings

Radar Tasks
├── Task List
├── Create Radar Task
└── Task Detail
    ├── Task Profile
    ├── Run Scan
    ├── Latest Opportunities
    └── Historical Runs

Opportunities
├── Opportunity List
└── Opportunity Detail
    ├── Score Breakdown
    ├── SERP Weakness
    ├── Tool Idea
    ├── MVP Spec
    ├── Monetization
    ├── Risk Notes
    └── Actions
```

## 主要页面

### 1. 登录 / Admin Gate

48 小时 MVP 只需要简单 admin gate。

字段：
- Email 或 password。

状态：
- 未登录：显示登录卡片。
- 登录成功：跳到 Dashboard。

文案：

```text
MicroGap Radar
Find low-competition search gaps you can turn into AI microtools.
```

### 2. Dashboard

目标：每天打开后立即知道最值得看的机会。

布局：

```text
┌────────────────────────────────────────────────────────────┐
│ MicroGap Radar                              New Radar Task │
├────────────────────────────────────────────────────────────┤
│ Today Scoreboard                                            │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ Top Score   │ │ New Opps    │ │ Avg Risk    │            │
│ │ 87          │ │ 24          │ │ Medium      │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                            │
│ Today's Top 5                                               │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 87  Steam short description generator     Generator    │ │
│ │     Strong intent, weak SERP, easy MVP                 │ │
│ │     [View brief] [Save] [Build next]                  │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ Radar Tasks                                                │
│ [GameDev] [EU Compliance] [Small Business] [Shopify]       │
└────────────────────────────────────────────────────────────┘
```

核心组件：
- `TopOpportunityCard`
- `ScoreBadge`
- `RadarTaskChip`
- `RunScanButton`
- `RecentRunStatus`

### 3. Create Radar Task

目标：用 2-3 分钟创建一个定制扫描任务。

表单字段：

#### Basic
- Task name
- Domain description
- Seed examples

#### Market
- Countries / regions
- Languages
- Audience type

#### User Fit
- Skills / advantages
- Available time per project
- Preferred build complexity

#### Monetization
- Ads
- Affiliate
- Paid export
- Lead-gen
- Subscription

#### Risk Boundaries
- Exclude industries
- Compliance tolerance
- Avoid YMYL conclusions

表单草图：

```text
Create Radar Task

1. What vertical do you want to scan?
[ Steam / indie game launch microtools                 ]

2. Target markets
[ United States ] [ Japan ] [ Germany ]

3. Target languages
[ English ] [ Japanese ] [ German ]

4. Your advantages
[x] GameDev
[x] Unity
[x] AI automation
[x] Multi-language SEO
[ ] Legal expertise
[ ] Medical expertise

5. Monetization preference
[x] Ads
[x] Affiliate
[x] Low-price export
[ ] High-ticket consulting

6. Exclusions
[ medical advice, adult, gambling, tax conclusions      ]

[Create Radar]
```

### 4. Radar Task Detail

目标：查看某个任务历史、运行扫描和机会列表。

布局：

```text
GameDev Microtools Radar
Markets: US, JP, DE | Languages: EN, JA, DE

[Run Scan] [Edit Task] [Duplicate]

Latest Run
Status: Completed
Keywords scanned: 30
Opportunities found: 14
Cost estimate: $0.42

Opportunities
[Filter: Score > 70] [Tool Type] [Risk] [Country]

87 Steam short description generator
82 Japanese Steam page checker
79 Game localization cost calculator
...
```

### 5. Opportunity List

目标：可筛选、可排序。

过滤项：
- Radar task
- Score range
- Country
- Language
- Tool type
- Risk level
- Monetization type
- Status

机会卡片字段：
- Score
- Keyword
- Recommended tool type
- Market / language
- One-line reason
- Monetization badges
- Risk badge
- Actions

卡片草图：

```text
┌────────────────────────────────────────────────────┐
│ 87  Steam short description generator   Generator  │
│ EN / US                                            │
│ Strong task intent. Top results are generic guides │
│ and no focused AI generator appears in SERP.       │
│                                                    │
│ Monetization: Paid export, affiliate, ads          │
│ Build: 1-2 days | Risk: Low                        │
│                                                    │
│ [View Brief] [Save] [Discard] [Build Next]         │
└────────────────────────────────────────────────────┘
```

### 6. Opportunity Detail

目标：让用户可以直接开工。

信息结构：

1. Header
   - Keyword
   - Score
   - Tool type
   - Market
   - Status buttons

2. Why this opportunity
   - Search intent
   - SERP weakness
   - User fit
   - Monetization

3. Score breakdown
   - Intent
   - SERP weakness
   - Toolability
   - Monetization
   - Build speed
   - Risk

4. Tool concept
   - Tool name
   - User input fields
   - Output modules
   - Example result

5. 48-hour MVP brief
   - Page structure
   - Features
   - Data needed
   - API needed
   - Acceptance criteria

6. Monetization plan
   - Ads
   - Affiliate
   - Paid export
   - Lead-gen

7. Risk notes
   - Compliance warning
   - Disclaimer copy

8. Actions
   - Copy MVP Spec
   - Export Markdown
   - Mark Build Next
   - Mark Discarded

页面草图：

```text
┌─────────────────────────────────────────────────────────┐
│ Steam short description generator       Score 87        │
│ Generator · EN/US · Low risk · 1-2 day build            │
│ [Save] [Build next] [Copy MVP spec]                     │
├─────────────────────────────────────────────────────────┤
│ Why it ranks high                                       │
│ - Strong task intent: user wants a concrete output.     │
│ - SERP weakness: mostly generic articles.               │
│ - Toolable: simple form + LLM rewrite.                  │
├─────────────────────────────────────────────────────────┤
│ Score Breakdown                                         │
│ Intent 92 | SERP Weakness 80 | Toolability 95           │
│ Monetization 76 | User Fit 90 | Risk Penalty 8          │
├─────────────────────────────────────────────────────────┤
│ MVP Tool Spec                                           │
│ Inputs: genre, gameplay hook, tone, target audience     │
│ Outputs: 3 short descriptions, tags, capsule tagline    │
│ CTA: Unlock full Steam Page Fix Pack - $9               │
└─────────────────────────────────────────────────────────┘
```

### 7. Settings

48 小时 MVP 简化设置：
- API keys 状态展示。
- Default country。
- Default language。
- LLM model。
- SERP provider。
- Scoring weights，可选。

## 视觉风格

建议：
- 黑白灰为主，少量强调色。
- 类似开发者工具 / analytics 产品。
- 避免“AI 魔法感”过重。
- 卡片密度适中，适合每天快速扫。

关键词：
- Focused
- Analytical
- Lightweight
- Operator-first
- Not flashy

## 关键交互

### Run Scan

状态流：

```text
idle → expanding keywords → fetching SERP → analyzing → scoring → completed / failed
```

UI 要显示进度，而不是让用户等待空白。

### Save / Discard

用户必须可以训练自己的偏好：
- Save：未来类似机会加权。
- Discard：记录原因。
- Build Next：标记为准备开发。
- Built：后续可填表现数据。

### Copy MVP Spec

这是最重要的 action。点击后复制 Markdown，用户可以直接贴给 Codex。

## 空状态文案

### 没有 Radar task

```text
No radar yet.
Create your first radar to scan a vertical for microtool opportunities.
```

### 没有机会

```text
No opportunities found for this run.
Try broadening the domain, adding more countries, or lowering the minimum score.
```

### Provider error

```text
SERP provider failed for some keywords. The scan continued with available results.
```

## 移动端

48 小时 MVP 以桌面端为主。移动端只保证可读，不做复杂优化。

## UI 开发优先级

P0：
- Dashboard
- Create Radar Task
- Opportunity List
- Opportunity Detail

P1：
- Filters
- Settings
- Scan run history

P2：
- Public digest
- Billing
- Team workspace
