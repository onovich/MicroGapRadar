# Autonomous Goal Mode

Autonomous Goal Mode lets the lead continue beyond single tasks while preserving review gates.

## Enabling

Require project readiness plus one of:

- explicit human instruction, including a request to use, execute, or continue this Skill;
- project policy file confirming autonomous milestone execution;
- prior accepted decision record.

Project readiness means the repository or current conversation already contains enough project brief, roadmap, architecture, acceptance criteria, and human-gate policy to safely create implementation tasks. If not, autonomous mode may only create and review the planning prerequisite task.

When this Skill has been invoked for execution and project readiness passes, do not ask for a second confirmation merely to enter goal mode, spawn writer/reviewer agents, or run an already READY task. Continue until a human gate, blocker, platform/tool restriction, or execution-window stop condition triggers.

Record state in `project/goal-mode-state.json`:

```json
{
  "enabled": true,
  "current_milestone": "M1",
  "current_task": null,
  "active_threads": [],
  "last_integrated_task": null,
  "last_main_commit": null,
  "next_ready_tasks": [],
  "unresolved_risks": [],
  "human_gate": {"required": false, "reason": null},
  "last_updated_at": "YYYY-MM-DDTHH:mm:ssZ"
}
```

## Loop

1. Sync integration branch.
2. Close accepted tasks that actually reached main.
3. Find READY tasks.
4. If none, create the smallest task from roadmap/gate criteria.
5. Spawn writer/reviewer.
6. Run writer/reviewer loop.
7. Integrate accepted work.
8. Update state and continuation.
9. Repeat until a human gate or execution window ends.

## Milestone gates

A milestone gate should have:

- all milestone tasks `CLOSED`;
- acceptance matrix evidence;
- full required checks;
- independent reviewer ACCEPT;
- known risks recorded;
- status files updated;
- integration into main.

If project policy allows automatic milestone exit for this stage, pass and continue. If reserved for humans, stop.

## Continuation

Before session end or long pause, write:

```text
project/messages/outbox/GOAL-MODE-CONTINUATION.json
```

Include main commit, milestone, current task, active threads, next READY tasks, recent handoffs/routes, and exact next prompt.
