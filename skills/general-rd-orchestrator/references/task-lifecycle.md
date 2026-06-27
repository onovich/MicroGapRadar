# Generic Task Lifecycle

## State machine

```text
DRAFT -> READY -> IN_PROGRESS -> REVIEW -> ACCEPTED -> CLOSED
                      |            |          |
                      |            |          + only after merged/integrated
                      |            + reviewer REQUEST_CHANGES loops to writer
                      + PARTIAL/BLOCKED when progress cannot continue safely
```

## Required task fields

Every task file under `project/tasks/active/<TASK_ID>.json` should include:

- `id`: stable task ID.
- `summary`: one-line outcome.
- `milestone`: current project stage.
- `status`: lifecycle status.
- `owner_role`: writer or primary owner.
- `reviewer_role`: independent reviewer.
- `risk_level`: `R0` to `R4`.
- `dependencies`: task IDs that must be `CLOSED`.
- `scope.allowed_paths`: exact files/globs writer may touch.
- `scope.forbidden_paths`: files/globs writer must not touch.
- `acceptance_criteria`: observable outcomes.
- `required_tests`: commands that must be run or explicitly justified.
- `branch_or_worktree`: current branch/worktree when in progress.
- `threads`: role to thread ID map.
- `route_to`: next role after owner handoff.
- `non_goals`: optional but recommended.
- `created_at`, `updated_at`.

## Task sizing

A good task is:

- small enough to review in one PR;
- independently testable;
- scoped to one package/subsystem or one clear integration seam;
- reversible;
- explicit about non-goals.

Avoid:

- “Implement the whole system.”
- “Refactor everything.”
- “Make UI better.”
- tasks without tests;
- tasks with overlapping writers;
- tasks that silently alter product direction.

## Status transitions

- `DRAFT -> READY`: lead verifies dependencies and scope.
- `READY -> IN_PROGRESS`: writer spawned and registered.
- `IN_PROGRESS -> REVIEW`: writer handoff validates.
- `REVIEW -> IN_PROGRESS`: reviewer requests changes.
- `REVIEW -> ACCEPTED`: independent reviewer accepts.
- `ACCEPTED -> CLOSED`: accepted work has entered integration branch/main and state files are updated.
- any status -> `BLOCKED`: named blocker or human gate.
- any status -> `PARTIAL`: useful progress persisted but not ready for review.
