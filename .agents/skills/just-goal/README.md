# JustGoal

Chinese name: 只为目标

JustGoal is a portable skill for running software and R&D projects through scoped tasks, model-aware agent roles, structured handoffs, independent reviews, test gates, autonomous milestone execution, and lead-thread transitions.

It is not tied to one project or one agent product. It works best in agents that can load skills or skill-like instruction folders, spawn subagents or threads, and run local scripts. When those tools are missing, it falls back to startup packets and manual handoffs.

## Install

### Any skill-capable agent

Install this repository as `JustGoal.skill`, or install the folder as a skill named `just-goal` so it contains `SKILL.md` at its root:

```text
<agent-skill-dir>/just-goal/SKILL.md
```

Invoke it as:

```text
$just-goal
```

If your agent uses a manifest or picker, point it at this folder and keep the folder name `just-goal`.

### Repository-scoped install

For a project-local install, copy this folder to:

```text
.agents/skills/just-goal/
```

Then use commands like:

```bash
node .agents/skills/just-goal/scripts/taskctl.mjs init --repo-root .
node .agents/skills/just-goal/scripts/modelctl.mjs init --repo-root .
```

### Codex or agents with TOML agent profiles

The files in `assets/agents/*.toml` are templates. They contain model placeholders and should be rendered only after model discovery:

```bash
node .agents/skills/just-goal/scripts/modelctl.mjs record --repo-root . --models "model-a,model-b" --deep "model-a" --balanced "model-b" --fast "model-b"
node .agents/skills/just-goal/scripts/modelctl.mjs render-agents --repo-root . --target .codex/agents
```

For non-Codex agents, copy the role instructions from those templates into that agent's equivalent profile or subagent configuration format.

### No skill loader

Use the skill manually by opening `SKILL.md`, following the first actions, and using the scripts directly from this folder. Keep generated project state in the target repository, not in this skill folder.

## First Run

1. Verify the skill package:

```bash
cd .agents/skills/just-goal
node scripts/verify-skill-checksums.mjs
```

2. Initialize project state:

```bash
node .agents/skills/just-goal/scripts/taskctl.mjs init --repo-root .
```

3. Discover available models with your agent's native model picker, CLI, account page, or configuration files. Then record a routing plan:

```bash
node .agents/skills/just-goal/scripts/modelctl.mjs init --repo-root .
node .agents/skills/just-goal/scripts/modelctl.mjs record --repo-root . --models "model-a,model-b" --deep "model-a" --balanced "model-b" --fast "model-b"
node .agents/skills/just-goal/scripts/modelctl.mjs validate --repo-root .
```

4. Invoke:

```text
$just-goal
```

## Project Knowledge Gate

JustGoal assumes the repository or current conversation contains enough project-specific context to understand what to build. Before implementation or autonomous execution, the lead must verify a clear goal, current milestone, architecture and constraints, coding and testing standards, risk gates, and task acceptance criteria.

If that context is missing, the first task is planning, not implementation. Create and review a `PROJECT-PLAN-BOOTSTRAP-001` task that produces persistent project documents and a scoped task graph. Only then enter the plan-execute-test-review loop.

## Recommended Project Files

- `AGENTS.md`
- `PROJECT_STATUS.md`
- `docs/roadmap.md`
- `docs/architecture.md`
- `docs/delivery-workflow.md`
- `docs/risk-register.md`
- `project/model-routing-state.json`
- `project/tasks/active/*.json`

## Main Tools

- `taskctl.mjs`: initialize/list/validate/update/archive task state and thread registry.
- `modelctl.mjs`: initialize model routing, record available models, validate routing state, and render agent templates.
- `validate-handoff.mjs`: validate handoff JSON.
- `render-route-message.mjs`: render compact route messages for native thread/message tools.
- `verify-skill-checksums.mjs`: validate `CHECKSUMS.sha256` cross-platform.

## Integrity

`CHECKSUMS.sha256` validates the skill contents and intentionally excludes itself. After intentional edits, regenerate it and commit the reason. If verification fails before local modification, reinstall the skill.

## Philosophy

The repository is the source of truth. Every agent gets a scoped task, every writer produces a validated handoff, every reviewer checks actual diff and tests, and work is only `CLOSED` after it reaches the integration branch.
