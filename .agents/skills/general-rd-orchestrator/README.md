# General R&D Orchestrator Skill

A generic Codex Skill for running software/R&D projects with dynamic role assignment, automatic subagent spawning, scoped tasks, structured handoffs, independent reviews, test gates, autonomous milestone execution, stop-gate enforcement, and lead-thread transitions.

Invoking this Skill for execution authorizes its standard subagent spawning and goal-mode loop after project readiness passes. It should stop for human gates, missing context, unavailable tooling, or explicit user limits, not for an extra spawn/goal-mode confirmation.

Autonomous execution is a stage loop, not a one-task runner. Before a final response in goal mode, run:

```bash
node scripts/verify-autonomous-stop.mjs
```

`BLOCK_CONTINUE` means there is still machine-visible work, a recommended next task, or a missing completion/blocker record.

## Verify the installed Skill

This package includes an internal `CHECKSUMS.sha256` file inside the `general-rd-orchestrator/` directory. No separate checksum sidecar is required.

After extracting or copying the Skill, verify it before use:

```bash
cd .agents/skills/general-rd-orchestrator
sha256sum -c CHECKSUMS.sha256
```

Cross-platform alternative:

```bash
node scripts/verify-skill-checksums.mjs
```

The checksum file validates the extracted Skill contents, not the outer ZIP container. It intentionally excludes itself.

## Install into a repository

1. Copy this directory to:

```text
.agents/skills/general-rd-orchestrator/
```

2. Optionally copy agent templates:

```text
.agents/skills/general-rd-orchestrator/assets/agents/*.toml -> .codex/agents/
```

3. Configure `.codex/config.toml`:

```toml
model = "gpt-5.5"
model_reasoning_effort = "xhigh"
multi_agent = true
max_threads = 6
max_depth = 1
```

4. Initialize project orchestration:

```bash
node .agents/skills/general-rd-orchestrator/scripts/taskctl.mjs init
```

5. Invoke:

```text
$general-rd-orchestrator
```

## Project Knowledge Gate

This Skill assumes the repository or current conversation contains enough project-specific context to understand what to build. Before implementation or autonomous execution, the lead must verify a clear goal, current milestone, architecture/constraints, coding/testing standards, risk gates, and task acceptance criteria.

If that context is missing, the first task is planning, not implementation. Create and review a `PROJECT-PLAN-BOOTSTRAP-001` style task that produces persistent project documents and a scoped task graph. Only then enter the plan-execute-test-review loop.

See `references/project-knowledge-gate.md` and `assets/templates/project-plan-bootstrap-task.json`.

## Minimal project files recommended

- `AGENTS.md`
- `PROJECT_STATUS.md`
- `docs/roadmap.md`
- `docs/architecture.md`
- `docs/delivery-workflow.md`
- `docs/risk-register.md`
- `project/tasks/active/*.json`

## Main tools

- `taskctl.mjs`: create/list/validate/set-status/register threads/ready/archive.
- `validate-handoff.mjs`: validate handoff JSON.
- `render-route-message.mjs`: compact route message for `send_input`.
- `verify-autonomous-stop.mjs`: block premature final responses while autonomous work can continue.
- `verify-skill-checksums.mjs`: validate `CHECKSUMS.sha256` cross-platform.

## Philosophy

The repository is the source of truth. Every agent gets a scoped task, every writer produces a validated handoff, every reviewer checks actual diff and tests, and work is only `CLOSED` after it reaches the integration branch.
