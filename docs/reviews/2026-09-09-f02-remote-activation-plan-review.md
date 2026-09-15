# F02 remote activation — plan review

The live implementation and standing delivery authorization already cover this release stage. This review makes the observed targets, credential transport, restricted roles and recovery commands concrete before remote database/IAM mutations.

| Category                 |           Score | Evidence                                                                                                                                        |
| ------------------------ | --------------: | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements/scope       |           25/25 | Dedicated teacher login and storage only; explicit UID, AI denied, no students or new paid resources.                                           |
| Architecture/interfaces  |           19/20 | Reviewed operator/runtime separation, explicit verified-TLS/channel-binding configuration, Production-only secrets and distinct Preview branch. |
| Security/privacy/tenancy |           20/20 | Auth viewer service account, standalone restricted PostgreSQL role, CLI project scope, secret stdin/private files and catalog-only preflight.   |
| Verification             |           19/20 | Corrected CI/gates, actual grant/readiness checks, expected-head integration, merged SHA/deployment and real login/save smoke.                  |
| Execution/recovery       |           14/15 | Exact existing targets, free no-compute checkpoint, retained old deployment; explicit handoff when credentials or UID are missing.              |
| **Total**                | **97/100 PASS** | **No blocker to the prepared read-only/configuration steps; DDL/release retains the explicit CI, isolation and checkpoint preconditions.**      |

This is a plan gate, not proof of completed provisioning or deployment. Independent final review of actual remote evidence is required before claiming activation complete.

## Credential-separation amendment — 2026-09-09

The actual Vercel metadata preflight lists eight generic owner-secret variables shared by Production and Preview. The dedicated Neon branch currently has only the owner role, so retaining those credentials in the web runtime conflicts with the reviewed owner/operator separation. Plan step5 now names the exact eight removals, orders them after successful restricted-role readiness, preserves the resource/integration and other variables, and adds an initial failing/final passing metadata check plus post-deployment re-injection check. No values are read; the separately obtained project-scoped owner credential remains available for operator recovery.

Fresh rubric review after this amendment: requirements25/25, architecture19/20, security20/20, verification19/20, execution/recovery14/15 = **97/100 PASS**, no critical blocker to this bounded configuration step once its stated prerequisites pass. This is authorization within the user's existing setup/delivery scope, not evidence that the removals or remote activation have happened. The independent remote final review must inspect the actual before/after metadata.
