# Routing Workflow

## Standard routes

```text
lead_orchestrator -> writer
writer -> architecture/security/domain/qa reviewer
reviewer ACCEPT -> lead_orchestrator
reviewer REQUEST_CHANGES -> original writer
reviewer BLOCKED -> lead_orchestrator or human gate
research_scout -> domain_designer or historical/domain expert
security_reviewer BLOCKED -> lead_orchestrator + human gate if severe
test_engineer -> writer or qa_reviewer
release_engineer -> qa_reviewer or systems_architect
spark_worker -> deep-tier reviewer
```

## Routing steps

1. Validate handoff JSON.
2. Render route message:

```bash
node .agents/skills/just-goal/scripts/render-route-message.mjs <handoff.json>
```

3. If target thread exists in registry, use native thread/message tools such as `send_input`.
4. If not, spawn the role and register returned thread ID. Invocation of this Skill is the authorization for normal routing spawns; do not ask for a separate spawn approval unless a human gate or platform/tool restriction applies.
5. Persist route evidence under `project/messages/routes` when possible.
6. Never claim a route was sent unless the native route operation actually returned success or a platform-visible ID.

## Startup packet for manually created agents

When native spawning is unavailable or blocked by a higher-priority platform rule, produce a packet containing:

- role;
- model and effort;
- task ID;
- branch/worktree;
- allowed/forbidden paths;
- required docs;
- acceptance criteria;
- required tests;
- stop conditions;
- required handoff path;
- `ROUTE_TO`.

Tell the human to paste it into a new thread. Mark thread ID as unknown until the human supplies it.
