# Project Knowledge Gate

This Skill is an executor and orchestrator; it is not a substitute for project definition.

Before any implementation task enters `READY` or `IN_PROGRESS`, the lead must verify that either repository documents or current conversation context answer these questions:

1. What is the project trying to build?
2. What is the current milestone or concrete outcome?
3. What are the product/non-product goals?
4. What technical stack and constraints are accepted?
5. What architecture or package boundaries should agents respect?
6. What coding, testing, security, and review standards apply?
7. What risk levels and human gates apply?
8. What are the next task acceptance criteria?

## Pass

The gate passes when the answer is persisted or directly available and stable enough that a writer can be scoped without inventing product direction.

## Fail

The gate fails when context is missing, contradictory, vague, or only implied. In that case, the lead must not start coding. Create a prerequisite planning task such as:

```text
PROJECT-PLAN-BOOTSTRAP-001
```

The planning task should produce persistent project documents, a task graph, acceptance criteria, and risk gates. It must be reviewed before implementation begins.

## Minimum planning outputs

Recommended minimum files:

- `AGENTS.md`
- `PROJECT_STATUS.md`
- `docs/roadmap.md`
- `docs/architecture.md`
- `docs/delivery-workflow.md`
- `docs/risk-register.md`
- `project/tasks/active/*.json`

Conversation context may seed the plan, but sustained autonomous execution requires persisted project state.
