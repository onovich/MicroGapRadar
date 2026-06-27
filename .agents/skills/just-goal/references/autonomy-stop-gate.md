# Autonomy Stop Gate

Use this reference before any final response in `AUTONOMOUS_GOAL`.

## Principle

Autonomous execution stops only when continuing would be wrong or impossible. It does not stop at clean checkpoints.

Allowed final-response reasons:

- `project_goal_complete`: the accepted autonomous scope is complete and recorded.
- `human_gate`: a defined human decision is required.
- `blocker`: a concrete blocker prevents safe progress.
- `tool_or_platform_block`: required native spawning, routing, Git, CI, or filesystem capability is unavailable or denied.
- `lead_handoff`: the current execution window must retire and transfer state to a successor lead.

Not allowed as stop reasons:

- one task closed;
- reviewer accepted;
- PR merged;
- main is clean;
- no READY tasks are listed;
- a continuation file was written;
- the next task is only described as `recommended_next_task`;
- tests passed;
- output is long;
- the lead has run for a while.

## Required command

Run from the repository root:

```bash
node .agents/skills/just-goal/scripts/verify-autonomous-stop.mjs
```

The command exits `1` with `BLOCK_CONTINUE` when machine-visible state says the lead should keep working.

## How to respond to BLOCK_CONTINUE

Do not send a final answer. Instead:

1. If a task is `READY` or dependency-ready `DRAFT`, execute or promote it.
2. If `current_task` or active threads exist, route/recover/reconcile that work.
3. If `recommended_next_task` exists, convert it into a normal task JSON packet.
4. If no machine-visible next task exists, derive the smallest task from accepted roadmap/architecture/acceptance docs.
5. If no safe task can be derived, write the blocker or human gate into project state and continuation, then rerun the stop gate.

## Explicit completion

If the autonomous scope is actually complete, persist one of:

- `project/goal-mode-state.json` with `"project_goal_complete": true`;
- `project/messages/outbox/GOAL-MODE-CONTINUATION.json` with `"project_goal_complete": true`;
- an equivalent project policy file accepted by the repository.

Do not infer completion from an empty queue alone.
