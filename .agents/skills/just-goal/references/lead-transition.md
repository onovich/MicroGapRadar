# Lead Thread Transition

Use this when the lead context becomes too long or unreliable.

## Outgoing lead procedure

1. Finish or freeze current atomic operation.
2. Sync and record Git/task/thread state.
3. Close unnecessary child agents.
4. Write `project/messages/outbox/LEAD-TRANSITION-PREPARE-001.json`.
5. Update `GOAL-MODE-CONTINUATION.json`.
6. Optionally commit a process-only checkpoint after QA review.
7. Enter `PREPARED_AWAITING_SUCCESSOR` / frozen state.
8. Do not start new project tasks.

Do not fabricate successor thread ID.

## Incoming lead procedure

1. Start new `lead_orchestrator` thread with configured model/effort.
2. Sync main and read required files.
3. Validate outgoing handoff.
4. Confirm no unresolved human gate.
5. Atomically update registry: outgoing retired, incoming active.
6. Write `LEAD-TRANSITION-ACCEPT-001.json`.
7. QA-review and integrate transition record if project requires.
8. Continue the next READY task.

## Required facts

Transition handoff should record:

- outgoing thread ID if known;
- actual/configured model and effort if known;
- main commit;
- current milestone;
- current/last/next task IDs;
- active threads;
- open branches/PRs;
- unresolved risks;
- human gate state;
- continuation instruction.
