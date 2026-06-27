# Generic Role Catalog

## Role Resolver

Resolve roles before a task becomes `READY`. Prefer project-specific role files when present, then use these generic rules.

Inputs:

- task summary and acceptance criteria;
- allowed and forbidden paths;
- milestone intent;
- risk level;
- required tests;
- project role overrides in `.codex/agents`, `project/model-routing-state.json`, or docs.

Output:

- one primary writer role;
- one independent acceptance reviewer;
- any required specialist reviewers;
- optional support roles that do not final-accept.

Generic mapping:

| Work type | Primary writer | Required reviewer(s) |
|---|---|---|
| UI, web, client shell, read model, accessibility, responsive layout | `client_engineer` | `qa_reviewer`; add `systems_architect` for client/state contract changes |
| Database, schema, migrations, seed, fixtures, data import/export, validation schemas | `data_content_engineer` or `implementation_engineer` | `qa_reviewer`; add `systems_architect` for persistence or compatibility changes |
| Core runtime, algorithms, domain rules, orchestration logic | `implementation_engineer` | `qa_reviewer`; add `domain_designer` for rule semantics and `systems_architect` for public APIs |
| Architecture, API contracts, package boundaries, protocols, save formats | `systems_architect` | `qa_reviewer`; add `security_reviewer` if data/auth/IPC risk exists |
| Product scope, roadmap, task graph, acceptance matrix, UX rules | `domain_designer` or `systems_architect` | `qa_reviewer` |
| Tests, fixtures, coverage, E2E, performance harness, regression repair | `test_engineer` | `qa_reviewer`; add `systems_architect` for benchmark policy or determinism gates |
| CI, packaging, release dry-runs, artifacts, deployment setup | `release_engineer` | `qa_reviewer`; add `security_reviewer` for secrets, permissions, supply chain, deployment |
| Security, auth, secrets, permissions, sandboxing, IPC, supply chain | `security_reviewer` for review or `implementation_engineer` for scoped fixes | `qa_reviewer` plus `security_reviewer` final security gate |
| Broad repository scan, evidence gathering, prior-decision recovery | `research_scout` | Lead decides next executable task; research does not final-accept |
| Small mechanical edits with exact paths and tests | `spark_worker` | GPT-5.5 reviewer, usually `qa_reviewer` or `systems_architect` |

Rules:

- Always include `qa_reviewer` unless the repository defines an equivalent independent acceptance role.
- Add `systems_architect` when public APIs, protocols, persistence contracts, package boundaries, or cross-runtime behavior change.
- Add `security_reviewer` for credentials, auth, IPC, deployment, supply chain, permissions, sandboxing, or data exposure.
- Add `domain_designer` when product/domain semantics, policy, scoring, rules, content meaning, or UX consequences change.
- Add `test_engineer` when the main deliverable is a test harness or when a writer needs separate fixture/coverage support.
- Never assign final acceptance to the writer.
- Do not spawn two writers whose allowed paths overlap.
- If role inference is ambiguous and docs cannot decide, create a planning/reconciliation task instead of guessing.

## Lead Orchestrator

Sole active router and integration owner. Reads project state, creates scoped tasks, spawns agents, validates handoffs, routes reviews, integrates accepted work, closes tasks only after merge, and stops at human gates.

## Systems Architect

Owns package boundaries, public APIs, schemas, persistence/compatibility strategy, deterministic execution policy, cross-runtime contracts, and architecture review.

## Domain Designer

Owns product/domain rules, feature scope, acceptance criteria, non-goals, UX consequences, and cross-system consistency. Not a code reviewer unless assigned.

## Implementation Engineer

Implements core logic within allowed paths. Must not expand architecture or change public APIs without architect approval.

## Client Engineer

Implements UI/client integration, accessibility/responsiveness, state/read-model boundaries, and front-end tests. Must not write authoritative domain state directly.

## Data/Content Engineer

Implements schemas, validators, fixtures, data import/export, manifests, and content guards.

## Test Engineer

Builds test harnesses, fixtures, regression tests, property tests, E2E tests, and negative tests. May support writer but does not final-accept.

## QA Reviewer

Independent read-only reviewer. Checks diff, task criteria, tests, risk, documentation, and integration evidence. Can ACCEPT, REQUEST_CHANGES, or BLOCK.

## Security Reviewer

Reviews IPC, secrets, permissions, dependencies, supply chain, data handling, sandboxing, auth, and deployment workflows. Security BLOCKs override ordinary QA.

## Research Scout

Read-only scanner for large codebases, docs, logs, sources, or prior decisions. Produces evidence, not implementation.

## Release Engineer

Handles package managers, CI, artifact manifests, versioning, build scripts, release checks, and packaging. May use Spark when tasks are mechanical.

## Spark Worker

Fast constrained implementation channel. Use for small path-limited tasks with explicit tests. Never final reviewer, architect, or decision owner.
