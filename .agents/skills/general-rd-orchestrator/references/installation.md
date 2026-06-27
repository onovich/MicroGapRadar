# Installation and First Prompt

## Repository installation

Copy this Skill to `.agents/skills/general-rd-orchestrator/`.

Copy agent templates into `.codex/agents/` if your environment supports custom agents:

```bash
mkdir -p .codex/agents
cp .agents/skills/general-rd-orchestrator/assets/agents/*.toml .codex/agents/
```

Set or amend `.codex/config.toml`:

```toml
model = "gpt-5.5"
model_reasoning_effort = "xhigh"
multi_agent = true
max_threads = 6
max_depth = 1
```

## Verify integrity

The Skill directory contains `CHECKSUMS.sha256`; no separate checksum sidecar is required. After installation:

```bash
cd .agents/skills/general-rd-orchestrator
sha256sum -c CHECKSUMS.sha256
```

Or, cross-platform:

```bash
node scripts/verify-skill-checksums.mjs
```

If verification fails before intentional local modification, reinstall the Skill. If you intentionally edit the Skill for a project, regenerate the checksum file and commit that change with the reason.

## Initialize project state

```bash
node .agents/skills/general-rd-orchestrator/scripts/taskctl.mjs init
```

## Delegation authorization

Installing or invoking this Skill for repository execution authorizes its standard orchestration behavior: spawn writer/reviewer subagents when native tools are available, route messages with `send_input`, create the next ordinary scoped task when the queue is empty, and continue tasks in goal mode after the Project Knowledge Gate passes. Do not add an extra confirmation step solely for subagent spawning, task creation from accepted docs, or autonomous goal-mode execution. Stop only for human gates, missing project readiness, unavailable/blocked tooling, explicit user limits, completed project goals, or unavoidable execution-window handoff.

## Project Knowledge Gate

This Skill can execute and coordinate work only when project-specific context is sufficient. At minimum, the repository or current conversation must provide what is being built, the current milestone, architecture/constraints, coding/testing rules, acceptance criteria, and human gates.

If these are missing, the first task is not coding. Create `PROJECT-PLAN-BOOTSTRAP-001` to produce the minimum viable development plan, task graph, acceptance matrix, and risk/human-gate policy. Review and integrate that plan before spawning implementation agents.

## First lead prompt

```text
You are the sole active lead_orchestrator for this repository.
Use $general-rd-orchestrator.
Recover repository state from Git and project files, verify CHECKSUMS.sha256 for the installed Skill, apply the Project Knowledge Gate, initialize orchestration directories if absent, validate any existing task graph, and either select the next READY task or create the smallest prerequisite planning task if project context is insufficient. Treat this prompt as authorization to use dynamic subagents, create ordinary scoped tasks from accepted docs, and run goal mode until the project goal, human gate, blocker, or unavoidable execution-window handoff. If spawn_agent is unavailable or blocked, write startup packets and tell me exactly which roles/models to create. Do not overwrite human work and do not proceed beyond a human gate.
```

## Continuing prompt

```text
Continue Autonomous Goal Mode if enabled. Sync main, close integrated accepted tasks, choose the next dependency-ready task, or create the next smallest verifiable task when none is READY. Spawn writer/reviewer roles, execute, validate handoff, route review, integrate accepted work, update goal-mode-state, and continue until the project goal, human gate, blocker, or unavoidable execution-window handoff. Do not stop merely because one task or PR is done, main is clean, or the READY queue is empty.
```
