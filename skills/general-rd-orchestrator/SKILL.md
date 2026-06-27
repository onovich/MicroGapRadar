---
name: general-rd-orchestrator
description: Generic Codex multi-agent orchestration for software and R&D repositories. Use when a project needs dynamic role assignment, scoped task creation, automatic subagent spawning, plan-execute-test-review loops, structured handoffs, autonomous /goal-style milestone execution, reviewer gates, stop-gate enforcement, and leadership handoff. Works across domains; configure project-specific docs, milestones, roles, and human gates in the repository.
---

# General R&D Orchestrator

This Skill turns a vague project goal into a controlled multi-agent engineering loop:

```text
recover state
-> plan scoped task
-> resolve roles
-> spawn writer/reviewer subagents
-> execute in branch/worktree
-> validate tests and handoff
-> route review
-> integrate only after acceptance
-> close task after it reaches main
-> create or continue the next dependency-ready task
-> repeat until the project goal, human gate, blocker, or execution-window handoff
```

Treat the repository as the source of truth. Conversation memory is advisory only.

## Operating contract

When this Skill is invoked for execution, the lead is not running a one-task helper. The lead is running an autonomous stage loop:

- recover facts from Git and project files;
- resolve roles from the task and project docs;
- create or select the next dependency-ready task;
- spawn the required writer/reviewer subagents;
- drive review/fix/integration until the task is closed on main;
- immediately continue to the next dependency-ready or creatable task;
- stop only for recorded project-goal completion, a human gate, a real blocker, a platform/tool restriction, or controlled lead handoff.

Do not mark a host `/goal` complete merely because one task, PR, review, or validation run finished. Bind host goal-mode objectives to the current project phase or milestone: complete all planned work that does not require human input, or record the blocker/human gate. A one-task workflow validation is a test mode only when the human explicitly asks for a bounded validation run.

Before any final human response in `AUTONOMOUS_GOAL`, run:

```bash
node .agents/skills/general-rd-orchestrator/scripts/verify-autonomous-stop.mjs
```

If it reports `BLOCK_CONTINUE`, do not respond with a final status. Create or execute the next task, or record the concrete blocker/human gate that makes continuation unsafe.

## Delegation and goal-mode authorization

Using this Skill is authorization to use its normal orchestration machinery: spawn writer/reviewer subagents when native multi-agent tools are available, route handoffs with `send_input`, create the next scoped task when the queue is empty, and run tasks through `EXECUTE` or `AUTONOMOUS_GOAL` mode. Do not ask for separate permission merely to spawn subagents, continue goal mode, create the next ordinary task from accepted project docs, or execute a dependency-ready task that already satisfies this Skill's gates.

Still obey higher-priority platform/tool rules and the Skill's own safety boundaries. Stop only when a defined human gate triggers, native spawning is unavailable, a required decision is missing, the task would exceed approved scope, the project goal is complete, or the execution window must be handed off because of platform/context limits. If the human explicitly states a different expectation for this Skill, treat that expectation as the project policy and update the Skill/checksums before continuing.


## Project Knowledge Gate

Before executing implementation work, the lead must prove that the repository or the current conversation contains enough project-specific guidance to answer:

- what is being built;
- who it is for;
- the current milestone and next outcome;
- the accepted technical stack and constraints;
- the architecture or package boundaries;
- coding and testing standards;
- risk/human-gate policy;
- task acceptance criteria.

If those facts are missing, contradictory, or only implied, do **not** start coding and do **not** invent the product plan. The first executable task is a `PLAN` prerequisite, usually named `PROJECT-PLAN-BOOTSTRAP-001` or similar, whose output is a reviewed project plan/task graph. Only after that plan is accepted may the Skill enter `EXECUTE` or `AUTONOMOUS_GOAL` mode.

Minimum acceptable planning artifacts can be repository documents or conversation-provided context, but they must be persisted before sustained autonomous execution. Recommended files are `AGENTS.md`, `PROJECT_STATUS.md`, `docs/roadmap.md`, `docs/architecture.md`, `docs/delivery-workflow.md`, `docs/risk-register.md`, and scoped task JSON files.

For autonomous execution details, read `references/autonomous-goal-mode.md`. For final-response stop checks, read `references/autonomy-stop-gate.md`. For role assignment, read `references/role-catalog.md`.


## Required first actions

Before modifying files:

1. Run `git status`, `git branch --show-current`, `git fetch --prune`, and inspect recent history.
2. Read project facts in this order when present:
   - `AGENTS.md`
   - `PROJECT_STATUS.md`
   - `README.md`
   - `docs/roadmap.md` or `docs/11-roadmap.md`
   - `docs/architecture.md` or equivalent
   - `docs/delivery-workflow.md` or equivalent
   - `docs/risk-register*.md`
   - `project/goal-mode-state.json`
   - `project/model-routing-state.json`
   - `project/tasks/thread-registry.json`
3. Apply the Project Knowledge Gate. If the project-specific plan is insufficient, create the plan/bootstrap task first and stop before implementation.
4. Initialize orchestration files only if absent:

```bash
node .agents/skills/general-rd-orchestrator/scripts/taskctl.mjs init
```

5. Never overwrite uncommitted human work. Never `reset --hard`, `git clean -fd`, force-push, or delete unknown files unless the human explicitly authorizes that exact action.


## Skill integrity file

This Skill ships with `CHECKSUMS.sha256` at the Skill directory root. It records SHA-256 checksums for every shipped file except the checksum file itself. After installation, verify the extracted Skill with:

```bash
cd .agents/skills/general-rd-orchestrator
sha256sum -c CHECKSUMS.sha256
```

On systems without `sha256sum`, use the bundled cross-platform verifier:

```bash
node scripts/verify-skill-checksums.mjs
```

If verification fails before project-specific edits, stop and reinstall the Skill. If the repository intentionally modifies the Skill, regenerate `CHECKSUMS.sha256` in the same commit and document the reason.

## Modes

Classify the current request:

- `STARTUP`: install/check project orchestration, agent config, task graph.
- `PROJECT_PLANNING_PRECONDITION`: create the missing project brief, roadmap, architecture boundary, acceptance matrix, task graph, and human-gate policy before implementation.
- `PLAN`: create or refine task DAG, acceptance criteria, allowed paths, risk gates. Use this as a mandatory prerequisite when project context is insufficient.
- `EXECUTE`: implement a READY task through writer/reviewer loop.
- `REVIEW`: independently inspect actual diff, tests, and acceptance criteria.
- `RECONCILE`: fix mismatch between Git, task state, project status, and handoff logs.
- `RESEARCH`: collect evidence and decision options; no implementation.
- `SECURITY`: review security, supply chain, secrets, permissions, deployment risk.
- `RELEASE`: package, CI, artifacts, versioning, release gates.
- `LEAD_HANDOFF`: retire long-context lead and transfer to a fresh lead thread.
- `AUTONOMOUS_GOAL`: continue milestone-by-milestone until a human gate.

## Role resolution

Before creating or executing a task, resolve roles from the task content and project docs. If the task file already names `owner_role`, `reviewer_role`, or `required_reviewers`, treat those as authoritative unless they conflict with the project role catalog or a human gate. If roles are missing while creating a task, infer them before setting the task `READY`.

Use `references/role-catalog.md` for the full resolver. Minimum rules:

- UI/client/web/app/read-model work -> `client_engineer` writer and `qa_reviewer`; add `systems_architect` if client state boundaries or public contracts change.
- database/schema/migration/seed/content/import work -> `data_content_engineer` or `implementation_engineer`; add `systems_architect` when persistence or compatibility changes.
- core runtime/domain/algorithm work -> `implementation_engineer`; add `domain_designer` for domain-rule semantics and `systems_architect` for public APIs.
- planning/roadmap/task graph/architecture docs -> `systems_architect` or `domain_designer` writer plus `qa_reviewer`.
- tests/performance/harness/regression work -> `test_engineer` writer plus `qa_reviewer`; add `systems_architect` for benchmark policy.
- CI/package/release/deployment work -> `release_engineer` plus `qa_reviewer`; add `security_reviewer` for secrets, auth, permissions, IPC, supply chain, or deployment.

Always reserve one independent reviewer slot. Use at most two concurrent writers, and only when their allowed paths do not overlap. Never let a writer final-accept its own work.

## Role defaults

Use these defaults unless the repository overrides them in `.codex/agents`, `project/model-routing-state.json`, or project docs.

| Role | Default model | Effort | Sandbox | Use |
|---|---|---:|---|---|
| `lead_orchestrator` | `gpt-5.5` | `xhigh` | write | sole router, task owner, integration gate |
| `systems_architect` | `gpt-5.5` | `xhigh` | write/review | architecture, public APIs, package boundaries |
| `domain_designer` | `gpt-5.5` | `xhigh` | write/review | product/domain rules and cross-system design |
| `implementation_engineer` | `gpt-5.5` | `high` | write | core implementation |
| `client_engineer` | `gpt-5.5` | `high` | write | UI/client/runtime integration |
| `data_content_engineer` | `gpt-5.5` | `high` | write | schemas, fixtures, content/data pipelines |
| `test_engineer` | `gpt-5.4-mini` | `high` | write | tests, fixtures, coverage, regression checks |
| `qa_reviewer` | `gpt-5.5` | `xhigh` | read-only | independent acceptance reviewer |
| `security_reviewer` | `gpt-5.5` | `xhigh` | read-only | secrets, IPC, supply chain, permissions |
| `research_scout` | `gpt-5.4-mini` | `medium` | read-only | broad scans, evidence collection |
| `release_engineer` | `gpt-5.3-codex-spark` | `medium` | write | CI, packaging, scripts, mechanical release tasks |
| `spark_worker` | `gpt-5.3-codex-spark` | `medium` | write | small scoped implementation, never final review |

Spark roles are fast executors, not decision makers. They require `ALLOWED_PATHS`, `FORBIDDEN_PATHS`, `REQUIRED_TESTS`, `STOP_CONDITIONS`, and a GPT-5.5 reviewer.

## Task lifecycle

Task statuses:

```text
DRAFT -> READY -> IN_PROGRESS -> REVIEW -> ACCEPTED -> CLOSED
                           -> REQUEST_CHANGES loop
                           -> PARTIAL / BLOCKED
```

Rules:

- `DRAFT`: defined but not dependency-ready or not approved.
- `READY`: dependencies satisfied and scope/criteria/tests clear.
- `IN_PROGRESS`: one writer owns allowed paths.
- `REVIEW`: writer handoff exists and validates.
- `ACCEPTED`: independent reviewer accepted.
- `CLOSED`: accepted work has actually reached `main`/integration branch and state files are updated.
- `BLOCKED`: cannot proceed without named decision or missing permission.

Only the lead closes tasks. Reviewers do not mark `CLOSED`; writers never mark `ACCEPTED`.

## Core loop

1. **Recover state**
   - Sync `main`/integration branch.
   - Run `taskctl validate`, `taskctl list`, and `taskctl ready`.
   - Check `project/messages/outbox`, `project/messages/routes`, open branches, open PRs, and thread registry.
   - Apply the Project Knowledge Gate before implementation. If the repository lacks enough product/architecture/roadmap context, create a planning prerequisite task and do not code.
   - If Git/task/status disagree, create a reconciliation task before new work.

2. **Select next task**
   - First verify project readiness. If docs/context cannot justify implementation, select or create the planning prerequisite task and do not code.
   - Choose the highest-priority dependency-ready task in the current milestone.
   - If no READY task exists and no human gate is active, create the smallest verifiable task from the roadmap, current milestone, acceptance matrix, or continuation state, validate it, set it `READY`, and immediately continue to thread planning.
   - Do not create giant "implement whole system" tasks.

3. **Validate task packet**
   Every task must specify:
   - one owner/writer role;
   - one independent reviewer role;
   - any extra required reviewers implied by role resolution or risk;
   - dependencies;
   - risk level `R0` to `R4`;
   - allowed and forbidden paths;
   - acceptance criteria;
   - required tests;
   - route target;
   - explicit non-goals.

4. **Plan threads**
   - Keep `max_threads <= 6` and `max_depth = 1`.
   - Reserve at least one independent reviewer slot.
   - Run at most two writer agents concurrently.
   - Never assign two writers to the same package/file area.
   - Parallelize only when dependencies are satisfied and allowed paths do not overlap.

5. **Spawn agents**
   - Use native `spawn_agent` when available. Invocation of this Skill is sufficient authorization for normal writer/reviewer spawning; do not stop for an extra spawn approval prompt.
   - Record returned thread IDs:

```bash
node .agents/skills/general-rd-orchestrator/scripts/taskctl.mjs set-thread <TASK_ID> <ROLE> <THREAD_ID>
```

   - If `spawn_agent` is unavailable or blocked by a higher-priority platform rule, write startup packets under `project/messages/outbox` and tell the human exactly which roles/models to create. Do not fake thread IDs.

6. **Writer packet**
   Give writers only the focused task packet:
   - task ID;
   - required docs;
   - allowed/forbidden paths;
   - acceptance criteria;
   - required tests;
   - stop conditions;
   - branch/worktree name;
   - handoff file path;
   - `ROUTE_TO` reviewer.

7. **Writer output**
   Writers must create a structured JSON handoff in `project/messages/outbox` and set `status = REVIEW`, `PARTIAL`, or `BLOCKED`.

8. **Validate handoff**

```bash
node .agents/skills/general-rd-orchestrator/scripts/validate-handoff.mjs <handoff.json>
```

   Then verify claimed tests, files, branches, and commits against the actual workspace. Do not trust "tests passed" without commands and exit codes.

9. **Route review**
   - Generate compact route message:

```bash
node .agents/skills/general-rd-orchestrator/scripts/render-route-message.mjs <handoff.json>
```

   - Use `send_input` to an active target thread. If absent, spawn the reviewer and register it without asking for extra approval, unless a human gate or platform block applies.

10. **Review gate**
   - Reviewer checks actual diff, required tests, scope, acceptance criteria, risk, and project rules.
   - Reviewer outputs `ACCEPT`, `REQUEST_CHANGES`, or `BLOCKED` with a handoff.
   - `REQUEST_CHANGES` goes back to the original writer unless the lead explicitly transfers ownership.
   - `BLOCKED` routes to the decision owner or human gate.

11. **Integration gate**
   Lead only integrates after reviewer `ACCEPT` and all required checks pass.
   - Create PR/merge request when available.
   - Wait for required CI.
   - Merge according to project policy.
   - Sync `main`.
   - Only then set task `CLOSED` and update status files.

12. **Continue**
   - Update `project/goal-mode-state.json`.
   - Close stale agents.
   - Write or update `project/messages/outbox/GOAL-MODE-CONTINUATION.json`.
   - Run `node .agents/skills/general-rd-orchestrator/scripts/verify-autonomous-stop.mjs` before any final response.
   - Immediately continue to the next READY task. If no READY task exists, create the next smallest verifiable task from accepted project docs and continue.
   - Do not produce a final human response after routine task closure, a clean `main`, an empty READY queue, or a continuation-file update. Those are loop checkpoints, not stopping conditions.

## Autonomous goal mode

Autonomous mode is allowed after project readiness has been satisfied by repository docs, conversation context, or an accepted planning prerequisite task, plus one of: a user request to use/execute/continue this Skill, project policy enabling autonomous milestone execution, or a prior accepted decision record. A request to "run the Skill", "execute the ready tasks", "continue goal mode", or equivalent counts as explicit human approval for autonomous goal mode.

When enabled, the lead may automatically:

- create ordinary tasks from the roadmap;
- spawn subagents;
- run tests;
- open and merge PRs after gates pass;
- close tasks after integration;
- pass non-human milestone gates;
- continue to the next milestone.

The lead must stop for human input when any `R4` human gate triggers. Otherwise, continue until the accepted project goal is complete, an explicit blocker prevents progress, or platform/context limits require a lead handoff.

## Human gates

Stop and ask the human for:

- changes to frozen product/platform/core architecture decisions;
- new paid services, accounts, secrets, credentials, or budgets;
- public deployment, release, store listing, or commercial decisions;
- server/multiplayer/telemetry/code-mod support if not already approved;
- irreversible data migrations or data-loss risk;
- serious security incident;
- licensing issue or IP-risky dependency;
- sensitive legal, medical, financial, cultural, or historical claims beyond project policy;
- two viable options that permanently alter public APIs and docs cannot decide;
- branch protection or permission blockers;
- final milestone/product acceptance when project policy reserves it for humans.

Do not stop merely because one task or PR finished, main is clean, output is long, or the next task is READY.

## Lead handoff

For long-context leads, perform controlled retirement:

1. Finish or freeze current atomic operation.
2. Generate `project/messages/outbox/LEAD-TRANSITION-PREPARE-001.json` and update continuation state.
3. Do not start new work.
4. New lead verifies, registers itself as the unique active lead, and writes `LEAD-TRANSITION-ACCEPT-001.json`.
5. Old lead becomes retired/closed only after successor acceptance is integrated.

See `references/lead-transition.md`.

## Stop conditions for child agents

Children must not guess. They stop with `PARTIAL` or `BLOCKED` when:

- requirements conflict or are ambiguous;
- allowed paths are insufficient;
- public API or architecture change is needed;
- required tests cannot run;
- uncommitted conflicting work exists;
- security/license/secrets risk appears;
- project policy or human gate would be changed;
- they need credentials or external access not provided.

## Final human response

In `AUTONOMOUS_GOAL`, send a final human response only when the project goal is complete, a human gate/blocker is active, or an execution-window/lead-handoff stop is unavoidable. Before responding, verify that no task can be created or continued without crossing a gate.

Run `scripts/verify-autonomous-stop.mjs` first. A `BLOCK_CONTINUE` result means the Skill has found machine-visible work or a missing stop record; continue the loop instead of finalizing. An `ALLOW_STOP` result is necessary but not sufficient: the lead must still explain the concrete project goal completion, human gate, blocker, or handoff reason.

Report only evidence-backed facts:

- tasks closed;
- current `main` commit;
- current milestone and active task;
- active/closed thread IDs;
- PRs/merge commits;
- tests with exit codes;
- risks or human gates;
- continuation file path.

Never claim unsupported model, thread, test, PR, or merge status.
