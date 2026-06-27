# Risk Levels and Gates

## Risk levels

- `R0`: documentation, comments, trivial tests, no runtime impact.
- `R1`: small implementation or test with local impact.
- `R2`: package-level implementation, migration-safe schema additions, UI integration.
- `R3`: public API, architecture, security-sensitive, data migration, cross-package behavior. Requires senior reviewer.
- `R4`: human gate: frozen decisions, irreversible risk, secrets/accounts/budget, release/public deployment, legal/cultural/security escalation.

## Review requirements

| Risk | Writer | Reviewer | Extra gate |
|---|---|---|---|
| R0 | any suitable | QA or lead | lightweight checks |
| R1 | specialist | QA | required tests |
| R2 | specialist | QA + optional architect | CI required |
| R3 | senior/specialist | systems/security/domain + QA | ADR/decision note recommended |
| R4 | lead only after human decision | reviewer after decision | stop for human approval |

## Human gate examples

Stop for:

- product/platform/core architecture changes;
- new paid service, account, budget, or secret;
- public release or deployment;
- new telemetry, multiplayer, server, or arbitrary code plugin system;
- irreversible database/save/content migration;
- serious security incident;
- license/IP uncertainty;
- legal, medical, financial, or cultural claims outside policy;
- branch protection or permission blocker;
- final product milestone if reserved for humans.

Do not stop for routine task completion, clean main, review ACCEPT, or next task READY.
