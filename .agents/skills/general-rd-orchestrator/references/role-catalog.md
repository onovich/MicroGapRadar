# Generic Role Catalog

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
