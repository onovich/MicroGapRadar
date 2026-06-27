# Handoff Message Protocol

Use JSON handoffs so a new session or subagent can resume without hidden context.

## Writer handoff

```json
{
  "message_id": "MSG-YYYYMMDD-TASK-ROLE",
  "task_id": "TASK-ID",
  "from_role": "implementation_engineer",
  "status": "REVIEW",
  "summary": "What changed and why.",
  "artifacts": ["packages/example/src/file.ts"],
  "branch_or_worktree": "feat/task-id",
  "commit": null,
  "tests_run": [
    {"command": "pnpm test", "exit_code": 0, "result": "42 passed"}
  ],
  "decisions": ["Used existing adapter boundary; no public API change."],
  "risks": ["Performance not benchmarked beyond fixture size."],
  "blockers": [],
  "route_to": "qa_reviewer",
  "requested_action": "Review actual diff, tests, and acceptance criteria.",
  "created_at": "YYYY-MM-DDTHH:mm:ssZ"
}
```

## Reviewer handoff

Reviewer uses the same shape with:

- `status = ACCEPT`, `REQUEST_CHANGES`, or `BLOCKED`.
- `route_to = lead_orchestrator` for ACCEPT.
- `route_to = <original_writer_role>` for REQUEST_CHANGES.
- `route_to = lead_orchestrator` or named decision owner for BLOCKED.

## Status values

Allowed handoff statuses:

- `PARTIAL`
- `BLOCKED`
- `REVIEW`
- `ACCEPT`
- `REQUEST_CHANGES`
- `INFO`

## Truthfulness rules

- Record only commands actually run.
- Preserve nonzero exit codes.
- Use `commit: null` if no commit exists.
- Do not claim a PR, merge, or CI result without checking it.
- Artifacts must be real paths or clearly external reports.
- Distinguish decisions from observations.
- Risks do not necessarily block; blockers do.

## File naming

```text
project/messages/outbox/<TASK_ID>__<MESSAGE_ID>__<FROM_ROLE>.json
project/messages/routes/<TASK_ID>__ROUTE-<YYYYMMDD>-<FROM>-TO-<TO>.json
```

Prefer ASCII-safe names.
