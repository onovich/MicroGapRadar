# 10 - 验收标准与测试计划

## 总体验收标准

48 小时 MVP 验收通过需要满足：

1. 可以登录后台。
2. 可以创建 Radar 任务。
3. 可以手动运行 scan。
4. 可以生成机会排行榜。
5. 每条机会有可解释评分。
6. 可以打开机会详情。
7. 可以生成并复制 MVP spec。
8. mock provider 模式下无外部 API key 也能跑通核心流程。
9. 评分函数有测试。
10. 构建通过。

## Demo 验收流程

### 流程 1：首次进入

步骤：
1. 打开首页。
2. 点击进入 Dashboard。
3. 未登录时跳转登录页。
4. 输入 admin password。
5. 登录成功进入 Dashboard。

通过标准：
- 未登录不可访问后台。
- 登录状态可保持。

### 流程 2：创建 Radar Task

步骤：
1. 点击 `New Radar Task`。
2. 输入：
   - Name: `GameDev Microtools`
   - Domain: `Steam, Unity, indie game launch microtools`
   - Countries: `US, JP, DE`
   - Languages: `en, ja, de`
   - Advantages: `GameDev, Unity, AI automation, SEO`
   - Monetization: `ads, affiliate, paid_export`
   - Exclusions: `medical, adult, gambling, tax conclusions`
3. 保存。

通过标准：
- 创建成功。
- 任务列表可见。
- 数据库中有记录。

### 流程 3：运行 Scan

步骤：
1. 进入任务详情。
2. 点击 `Run Scan`。
3. 使用 mock provider。
4. 等待完成。

通过标准：
- run 状态从 running 变为 completed。
- 生成 keyword candidates。
- 生成 opportunities。
- Dashboard 出现 Top 机会。

### 流程 4：查看机会

步骤：
1. 打开 opportunity list。
2. 按 score 排序。
3. 筛选 tool type = generator。
4. 打开一个机会。

通过标准：
- 列表能显示分数、工具类型、摘要。
- 筛选生效。
- 详情页能显示 score breakdown。

### 流程 5：生成 MVP Spec

步骤：
1. 在机会详情页点击 `Generate MVP Spec`。
2. 等待生成。
3. 点击 `Copy Markdown`。

通过标准：
- 成功生成 Markdown。
- Markdown 包含页面结构、表单字段、API routes、验收标准。
- 复制按钮可用。

## 单元测试

### scoring.test.ts

测试 1：高分机会

输入：
```json
{
  "intentScore": 90,
  "monetizationScore": 80,
  "serpWeaknessScore": 85,
  "toolabilityScore": 95,
  "userFitScore": 90,
  "buildSpeedScore": 95,
  "riskPenalty": 5
}
```

预期：
- totalScore > 80。

测试 2：高风险机会

输入：
```json
{
  "intentScore": 95,
  "monetizationScore": 90,
  "serpWeaknessScore": 80,
  "toolabilityScore": 80,
  "userFitScore": 70,
  "buildSpeedScore": 80,
  "riskPenalty": 80
}
```

预期：
- totalScore 明显低于无风险版本。
- 可选：如果 risk level 为 excluded，则 opportunity 不入榜。

测试 3：低工具化机会

预期：
- 即使搜索意图中等，toolability 很低时总分不应过高。

### mock-provider.test.ts

测试：
- mock provider 返回固定 SERP。
- unknown keyword 也返回可用 mock 数据或空数组。
- provider failure 被捕获。

### schemas.test.ts

测试：
- Radar task schema 校验必填项。
- Opportunity analysis schema 拒绝缺少 title/summary 的输出。

## 集成测试

### scan-orchestrator.test.ts

模拟：
- 创建 RadarTask。
- 使用 mock provider。
- 使用 fake LLM 或 mock agent 输出。
- 运行 scan。

预期：
- SearchRun status = completed。
- Opportunity count > 0。
- 每条机会有 score breakdown。

## 手动 QA 清单

### UI

- Dashboard 空状态是否清楚。
- Run Scan 过程中是否有 loading。
- 错误状态是否可读。
- 机会卡片是否信息足够。
- 详情页是否可复制 spec。
- 长文本是否溢出。

### 数据

- 删除 task 是否不会误删不相关数据。
- Scan 失败是否保存错误。
- 重复运行同一 task 是否不会覆盖历史 run。
- 收藏/放弃状态是否持久化。

### AI 输出

- 是否出现被排除领域。
- 是否给出收益保证。
- 是否给出法律/税务/医疗确定性建议。
- 是否输出无效 JSON。
- 是否过度泛泛而谈。

### 安全

- API key 不出现在前端 bundle。
- API key 不出现在日志。
- Cron endpoint 需要 secret。
- 未登录不能访问后台数据。

## 边界情况

### SERP provider 无结果

预期：
- 记录该 keyword failed 或 no_results。
- scan 继续处理其他关键词。

### LLM 输出无效 JSON

预期：
- 触发 repair。
- repair 失败则标记该 keyword failed。
- 不影响整个 scan。

### 全部机会低分

预期：
- 仍然显示结果，但标明 “No strong opportunities found”。
- 给出调参建议：放宽领域、增加国家、提高候选关键词数量。

### 高风险机会

预期：
- risk level = high/excluded 的机会默认不进入 Top 5。
- 如果显示，必须有明显风险提示。

### 重复关键词

预期：
- 去重。
- 同一关键词不同国家/语言可保留。

## 生产前检查

上线自用前：
- 环境变量配置完成。
- 使用真实 provider 试跑一次。
- 成本限制设置完成。
- Cron secret 设置完成。
- admin password 更换。
- 日志不泄露敏感信息。

对外订阅前：
- 用户数据隔离。
- 配额控制。
- Stripe webhook。
- Terms / Privacy。
- Refund policy。
- 数据来源说明。
- 免责声明。

## MVP 完成定义

当以下条件全部满足时，可以认为 48 小时 MVP 完成：

```text
[ ] Can login
[ ] Can create radar task
[ ] Can run scan with mock provider
[ ] Can run scan with at least one real provider or adapter placeholder
[ ] Can generate 10+ opportunities
[ ] Can rank by score
[ ] Can view opportunity detail
[ ] Can generate MVP spec
[ ] Can copy Markdown
[ ] Can save/discard/build_next
[ ] Build passes
[ ] Basic tests pass
[ ] README explains setup
```
