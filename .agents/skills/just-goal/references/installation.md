# Installation and First Prompt

## Skill-capable agents

Install the `JustGoal.skill` repository directly, or install it as a skill folder named `just-goal` with `SKILL.md` at the folder root:

```text
<agent-skill-dir>/just-goal/SKILL.md
```

Invoke:

```text
$just-goal
```

For repository-scoped use, copy the folder to:

```text
.agents/skills/just-goal/
```

## Agents without native skills

Open `SKILL.md`, follow the Required first actions, and run the scripts directly from the installed folder. Use startup packets when native subagent/thread spawning is unavailable.

## Optional agent profiles

`assets/agents/*.toml` are role templates with model placeholders. Do not copy them blindly. First discover available models, record routing, then render templates for agents that support TOML profiles:

```bash
node .agents/skills/just-goal/scripts/modelctl.mjs record --repo-root . --models "model-a,model-b" --deep "model-a" --balanced "model-b" --fast "model-b"
node .agents/skills/just-goal/scripts/modelctl.mjs render-agents --repo-root . --target .codex/agents
```

For other agents, translate the role names, model tiers, sandbox expectations, and instructions into that agent's profile format.

## Verify integrity

The Skill directory contains `CHECKSUMS.sha256`; no separate checksum sidecar is required. After installation:

```bash
cd .agents/skills/just-goal
node scripts/verify-skill-checksums.mjs
```

If `sha256sum` is available:

```bash
sha256sum -c CHECKSUMS.sha256
```

If verification fails before intentional local modification, reinstall the Skill. If you intentionally edit the Skill for a project, regenerate the checksum file and commit that change with the reason.

## Initialize project state

```bash
node .agents/skills/just-goal/scripts/taskctl.mjs init --repo-root .
```

## Initialize model routing

Discover available models with the current agent's native model list, CLI, account/config UI, or human-provided account details. Then record the routing tiers:

```bash
node .agents/skills/just-goal/scripts/modelctl.mjs init --repo-root .
node .agents/skills/just-goal/scripts/modelctl.mjs record --repo-root . --models "model-a,model-b" --deep "model-a" --balanced "model-b" --fast "model-b"
node .agents/skills/just-goal/scripts/modelctl.mjs validate --repo-root .
```

The `deep` tier is for lead/review/architecture/security roles, `balanced` is for ordinary implementation and test roles, and `fast` is for scoped scans or mechanical work.

## Delegation authorization

Installing or invoking this Skill for repository execution authorizes its standard orchestration behavior: spawn writer/reviewer subagents when native tools are available, route messages with native thread/message tools, and continue READY tasks in goal mode after the Project Knowledge Gate passes. Do not add an extra confirmation step solely for subagent spawning or autonomous goal-mode execution. Stop only for human gates, missing project readiness, unavailable/blocked tooling, or explicit user limits.

## Project Knowledge Gate

This Skill can execute and coordinate work only when project-specific context is sufficient. At minimum, the repository or current conversation must provide what is being built, the current milestone, architecture/constraints, coding/testing rules, acceptance criteria, and human gates.

If these are missing, the first task is not coding. Create `PROJECT-PLAN-BOOTSTRAP-001` to produce the minimum viable development plan, task graph, acceptance matrix, and risk/human-gate policy. Review and integrate that plan before spawning implementation agents.

## First lead prompt

```text
You are the sole active lead_orchestrator for this repository.
Use $just-goal.
Recover repository state from Git and project files, verify CHECKSUMS.sha256 for the installed Skill, initialize model routing if absent, apply the Project Knowledge Gate, initialize orchestration directories if absent, validate any existing task graph, and either select the next READY task or create the smallest prerequisite planning task if project context is insufficient. Treat this prompt as authorization to use dynamic subagents and goal mode for READY tasks; if native spawning is unavailable or blocked, write startup packets and tell me exactly which roles/models to create. Do not overwrite human work and do not proceed beyond a human gate.
```

## Continuing prompt

```text
Continue Autonomous Goal Mode if enabled. Sync the integration branch, close integrated accepted tasks, choose the next dependency-ready task, spawn writer/reviewer roles using recorded model routing, execute, validate handoff, route review, integrate accepted work, update goal-mode-state, and continue until a human gate or execution-window stop. Do not stop merely because one task or PR is done.
```
