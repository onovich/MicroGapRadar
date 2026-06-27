# 08 - AI Agents 与 Prompts

## 设计原则

MicroGap Radar 不需要复杂 agent 框架。第一版用稳定的 pipeline：

```text
Radar Task
→ Keyword Expansion Agent
→ SERP Provider
→ Opportunity Analysis Agent
→ Scoring Engine
→ MVP Spec Agent
```

每个 agent 必须输出 JSON，便于保存和测试。不要让 LLM 自由发挥产生不可解析文本。

## Agent 1：Keyword Expansion Agent

### 目的

把用户输入的领域、国家、语言、优势和变现偏好，扩展成可搜索的候选关键词。

### 输入

```json
{
  "domainDescription": "Steam, Unity, indie game launch microtools",
  "seedExamples": ["steam description generator", "game localization cost calculator"],
  "countries": ["US", "JP", "DE"],
  "languages": ["en", "ja", "de"],
  "userAdvantages": ["GameDev", "Unity", "AI automation", "multi-language SEO"],
  "monetizationPreferences": ["ads", "affiliate", "paid_export"],
  "excludedTopics": ["medical", "adult", "gambling"]
}
```

### 输出 schema

```json
{
  "candidates": [
    {
      "keyword": "steam short description generator",
      "country": "US",
      "language": "en",
      "intentType": "generator",
      "toolTypeGuess": "generator",
      "rationale": "Strong task keyword for indie developers preparing Steam pages."
    }
  ]
}
```

### Prompt

```text
You are a search opportunity researcher for AI microtools.

Your job is to generate narrow, high-intent search keywords that can potentially be turned into lightweight web tools such as calculators, checkers, generators, templates, estimators, audits, or checklists.

User radar profile:
- Domain: {{domainDescription}}
- Seed examples: {{seedExamples}}
- Target countries: {{countries}}
- Target languages: {{languages}}
- User advantages: {{userAdvantages}}
- Monetization preferences: {{monetizationPreferences}}
- Excluded topics: {{excludedTopics}}

Rules:
1. Prefer task-oriented keywords with words like generator, checker, calculator, estimator, template, checklist, audit, cost, requirements, policy, form.
2. Prefer vertical and specific keywords over broad keywords.
3. Include country/language-specific variants when useful.
4. Avoid excluded topics.
5. Avoid generic startup ideas.
6. Each keyword should be potentially buildable as a web microtool within 48 hours.
7. Output valid JSON only.

Return 20 candidates using this schema:
{
  "candidates": [
    {
      "keyword": "string",
      "country": "string",
      "language": "string",
      "intentType": "generator|checker|calculator|template|checklist|audit|estimator|other",
      "toolTypeGuess": "generator|checker|calculator|template|checklist|audit|directory|other",
      "rationale": "string"
    }
  ]
}
```

## Agent 2：SERP Analysis Agent

### 目的

分析搜索结果是否存在低竞争弱点。

### 输入

```json
{
  "keyword": "steam short description generator",
  "country": "US",
  "language": "en",
  "serpResults": [
    {
      "position": 1,
      "title": "How to write a Steam page description",
      "url": "https://example.com/article",
      "domain": "example.com",
      "snippet": "A guide for indie game developers..."
    }
  ]
}
```

### 输出 schema

```json
{
  "serpWeaknessSummary": "Top results are mostly generic articles; no focused AI generator appears.",
  "weakSignals": [
    {
      "type": "generic_articles",
      "strength": 0.8,
      "evidence": "Most top results are how-to guides."
    }
  ],
  "strongSignals": [
    {
      "type": "established_domain",
      "strength": 0.4,
      "evidence": "One established marketing site appears in top 3."
    }
  ],
  "serpWeaknessScoreHint": 78
}
```

### Prompt

```text
You are a SERP weakness analyst.

Analyze whether a keyword has a low-competition opportunity for a lightweight AI web tool.

Keyword: {{keyword}}
Country: {{country}}
Language: {{language}}
SERP results:
{{serpResultsJson}}

Look for weak signals:
- Top results are generic articles instead of tools.
- Forums, Reddit, Quora, old pages, PDFs, government pages, or poor UX pages appear in top results.
- Existing tools are broad, outdated, or not specialized.
- There is no interactive calculator/checker/generator.
- Search intent is specific but results are not task-completing.

Look for strong competition signals:
- Mature SaaS tools dominate.
- Official platform documentation fully satisfies the query.
- Multiple high-authority specialized tools rank.
- Query likely answered completely by a search snippet.

Return JSON only:
{
  "serpWeaknessSummary": "string",
  "weakSignals": [
    { "type": "string", "strength": number, "evidence": "string" }
  ],
  "strongSignals": [
    { "type": "string", "strength": number, "evidence": "string" }
  ],
  "serpWeaknessScoreHint": number
}
```

## Agent 3：Opportunity Analysis Agent

### 目的

结合关键词、SERP 和用户 profile，判断是否值得做，并输出结构化机会。

### 输入

```json
{
  "radarTask": { "...": "..." },
  "keywordCandidate": { "...": "..." },
  "serpAnalysis": { "...": "..." },
  "serpResults": ["..."]
}
```

### 输出 schema

```json
{
  "title": "Steam Short Description Generator",
  "summary": "A narrow generator for indie developers preparing Steam store pages.",
  "targetUser": "Solo indie developers preparing a Steam page.",
  "searchIntent": "The user wants usable Steam short description copy, not a generic guide.",
  "recommendedToolType": "generator",
  "toolConcept": {
    "oneLiner": "Input your game hook and genre, get 3 Steam-ready short descriptions.",
    "inputFields": ["game genre", "gameplay hook", "tone", "target audience", "word limit"],
    "outputModules": ["3 short description versions", "tagline", "tag suggestions", "common mistakes"]
  },
  "monetization": {
    "primary": "paid_export",
    "secondary": ["ads", "affiliate"],
    "paidExportIdea": "Full Steam Page Fix Pack for $9"
  },
  "risk": {
    "level": "low",
    "notes": "No regulated advice. Avoid promising wishlist growth."
  },
  "buildComplexity": "low",
  "scoreHints": {
    "intentScore": 92,
    "monetizationScore": 76,
    "toolabilityScore": 95,
    "userFitScore": 90,
    "buildSpeedScore": 95,
    "riskPenalty": 8
  },
  "killCriteria": [
    "Discard if manual SERP review finds 3+ strong existing generators.",
    "Do not claim it will increase wishlists."
  ]
}
```

### Prompt

```text
You are an AI microtool opportunity analyst.

Your task is to decide whether this keyword is worth turning into a lightweight web product.

Radar task:
{{radarTaskJson}}

Keyword candidate:
{{keywordCandidateJson}}

SERP weakness analysis:
{{serpAnalysisJson}}

SERP results:
{{serpResultsJson}}

Evaluate the opportunity by these criteria:
1. Search intent: Does the user want to complete a task?
2. Toolability: Can this be solved by a small web tool with form input and personalized output?
3. Monetization: Can it support ads, affiliate, paid export, lead-gen, or subscription?
4. SERP weakness: Are current results weak or non-interactive?
5. User fit: Does this match the user's advantages and preferences?
6. Build speed: Can a useful MVP be built within 48 hours?
7. Risk: Does it involve regulated or high-stakes advice?

Important constraints:
- Do not promise revenue, rankings, legal compliance, medical outcomes, or guaranteed business results.
- For legal/tax/medical/financial topics, recommend checklist/self-assessment only, not definitive advice.
- Avoid adult, gambling, gray-market, or harmful topics.
- Output valid JSON only.

Return schema:
{
  "title": "string",
  "summary": "string",
  "targetUser": "string",
  "searchIntent": "string",
  "recommendedToolType": "generator|checker|calculator|template|checklist|audit|directory|other",
  "toolConcept": {
    "oneLiner": "string",
    "inputFields": ["string"],
    "outputModules": ["string"]
  },
  "monetization": {
    "primary": "ads|affiliate|paid_export|lead_gen|subscription|none",
    "secondary": ["ads|affiliate|paid_export|lead_gen|subscription"],
    "paidExportIdea": "string"
  },
  "risk": {
    "level": "low|medium|high|excluded",
    "notes": "string"
  },
  "buildComplexity": "low|medium|high",
  "scoreHints": {
    "intentScore": number,
    "monetizationScore": number,
    "toolabilityScore": number,
    "userFitScore": number,
    "buildSpeedScore": number,
    "riskPenalty": number
  },
  "killCriteria": ["string"]
}
```

## Agent 4：MVP Spec Agent

### 目的

把一个机会生成可直接交给 Codex 的开发 brief。

### 输入

- Opportunity 对象。
- Radar task profile。
- Score breakdown。

### 输出

Markdown 文档。

### Prompt

```text
You are a senior product spec writer for small AI web tools.

Create a compact but actionable MVP spec that Codex can use to implement the tool.

Opportunity:
{{opportunityJson}}

Radar task:
{{radarTaskJson}}

Score breakdown:
{{scoreBreakdownJson}}

Write in Chinese unless the opportunity language requires examples in another language.

The MVP must be buildable within 48 hours by a solo developer using Next.js and an LLM API.

Include these sections:
1. Product name
2. Target keyword
3. Target user
4. Core promise
5. Page structure
6. Input form fields
7. AI output modules
8. Data model
9. API routes
10. Monetization hooks
11. Risk and disclaimer copy
12. 48-hour build checklist
13. Acceptance criteria
14. Kill criteria

Rules:
- Do not include revenue guarantees.
- Do not include legal/medical/financial definitive advice.
- Make the spec concrete enough to start coding.
- Keep it concise.
```

## JSON 解析策略

LLM 输出必须经过：
1. JSON parse。
2. Zod schema validate。
3. 如果失败，调用 repair prompt。
4. 如果仍失败，保存 raw output 并标记该 keyword failed。

Repair prompt：

```text
The following output was supposed to be valid JSON matching this schema, but it failed to parse.

Schema:
{{schema}}

Invalid output:
{{rawOutput}}

Return corrected JSON only. Do not add comments or markdown.
```

## 成本控制策略

- 关键词扩展一次生成 20-50 个，不要每个词单独生成。
- SERP 分析可先让代码提取简单 signals，再让 LLM 解释。
- MVP spec 只在用户点击时生成，不要对全部机会自动生成。
- 缓存相同关键词和国家的 SERP。
- 对低分机会不生成详细 spec。

## Prompt 版本管理

建议把 prompt 保存在代码中，并加版本号：

```ts
export const PROMPT_VERSION = "2026-06-27-v1";
```

每个 analysis 保存：
- prompt version
- model
- raw input hash
- raw output

这样后续方便比较不同 prompt 的效果。
