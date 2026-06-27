# Startup Packet

ROLE: implementation_engineer

TASK_ID: M0-SCAFFOLD-NEXT-001

BRANCH_OR_WORKTREE: feat/m0-scaffold-next

## Task

Scaffold the Next.js, TypeScript, and Tailwind foundation for MicroGap Radar.

## Required Context

Read these files before editing:

- `AGENTS.md`
- `PROJECT_STATUS.md`
- `README.md`
- `docs/03_technical_architecture.md`
- `docs/10_acceptance_criteria_and_test_plan.md`
- `docs/11_development_plan.md`
- `project/tasks/active/M0-SCAFFOLD-NEXT-001.json`

## Allowed Paths

- `app/**`
- `components/**`
- `lib/**`
- `public/**`
- `styles/**`
- `tests/**`
- `package.json`
- lockfiles
- `next.config.*`
- `postcss.config.*`
- `tailwind.config.*`
- `tsconfig.json`
- eslint config files
- `.gitignore`
- `README.md`

## Forbidden Paths

- `.git/**`
- `.agents/**`
- `.codex/**`
- `project/**`
- `skills/**`
- `docs/**`
- `mock-data/**`

## Acceptance Criteria

- A Next.js App Router project exists with TypeScript enabled.
- Tailwind CSS is configured and used by the base app.
- The home page renders the MicroGap Radar name and positioning.
- `lib/env.ts` exists and provides typed/safe access for core environment variables without exposing secrets to the client.
- README contains accurate local development commands for the scaffolded app.
- The app can start locally with the package manager commands added by this task.
- The production build command succeeds or any failure is documented with a concrete blocker.

## Required Tests

- `npm run build`

## Stop Conditions

- Need to edit files outside allowed paths.
- Need to change product scope, core architecture, public deployment, paid services, secrets, or budgeted APIs.
- Need to implement database/auth/SERP/LLM features beyond scaffold.
- Required test cannot run and the blocker is not local/tooling-specific.
- Security/license/secrets risk appears.

## Required Handoff

Write JSON to:

`project/messages/outbox/M0-SCAFFOLD-NEXT-001__MSG-20260627-IMPLEMENTATION_ENGINEER.json`

Use `status = REVIEW`, `PARTIAL`, or `BLOCKED`.

ROUTE_TO: qa_reviewer
