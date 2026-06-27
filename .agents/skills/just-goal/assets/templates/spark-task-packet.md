# Spark Worker Task Packet

ROLE: spark_worker
MODEL: <fast-tier model from project/model-routing-state.json>

TASK:

CONTEXT:

ALLOWED_PATHS:
- 

FORBIDDEN_PATHS:
- 

ACCEPTANCE_CRITERIA:
- 

REQUIRED_TESTS:
- 

STOP_CONDITIONS:
- Need to modify public API or architecture.
- Need to edit files outside ALLOWED_PATHS.
- Requirement is ambiguous.
- Need new production dependency.
- Required test cannot run.
- Security/license/secrets risk appears.

REQUIRED_HANDOFF:
Write JSON to `project/messages/outbox/<TASK_ID>__<MESSAGE_ID>__spark_worker.json`.

ROUTE_TO:
qa_reviewer or systems_architect, as specified by task.
