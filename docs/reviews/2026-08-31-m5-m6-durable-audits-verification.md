# M5/M6 Durable Decision Audits — Implementer Evidence

- Date: 2026-08-31
- Branch: `codex/m5-m6-audit`
- Base: `9bcb2fb777ddae0d85248fe5df822976d17eec8c`
- Environment: Node 24.13.0, pnpm 11.24.0, frozen existing lockfile, fresh local PGlite per test.
- This report records implementer evidence; independent final validation is a separate gate.

## Test-first sequence

1. Fresh worktree install and `corepack pnpm test`: **26 files, 285 tests PASS**, zero failures. Log: `/tmp/lessonquest-audit-baseline.log`.
2. Added audit cases before production changes. Initial focused run: **12 failures, 2 passes**. Missing post-rollback rows and audit-storage path reproduced; the provider-revocation case also exposed an invalid fixture status rather than the intended revocation. Do not treat that setup mismatch as valid revocation RED evidence. Log: `/tmp/lessonquest-audit-red.log`.
3. Added post-rollback helper/wrappers. Focused run: **3 failures, 11 passes**. The invalid `REMOVED` fixture caused a DB constraint error and a provider-error 503; campaign exact replay still lacked an audit. Log: `/tmp/lessonquest-audit-green-1.log`.
4. Corrected fixture to schema-supported `DISABLED`, and withheld finalization classification change. Focused run: **2 failures, 12 passes**, specifically actual provider-time revocation recorded CONFLICT instead of DENIED, and exact campaign-end replay recorded no DUPLICATE. Log: `/tmp/lessonquest-audit-red-corrected.log`.
5. Applied the two remaining changes and tightened the original repository revocation assertion. Focused API/Rasa/boss suite: **3 files, 16 tests PASS**. Log: `/tmp/lessonquest-audit-green.log`.
6. Expanded proper-role cross-tenant boss probes, simultaneous same-ID hint conflict and authentication/input containment. Final focused API: **1 file, 17 tests PASS**. Log: `/tmp/lessonquest-audit-green-expanded.log`.

The 16 new cases execute real Hono requests and real repositories/PGlite (plus one direct unknown-actor repository call), not a mocked LessonQuest API. They assert trace-correlated literal metadata, no rolled-back success audit, unchanged business evidence, safe 404/409/500 envelopes, no raw fault text and no authenticated audit on rejected credentials. SQL trigger faults prove post-write rollback and audit-storage failure behavior. These are API integration tests, not new React/browser E2E coverage.

## Full verification

All commands completed with exit 0 in the implementation worktree. The sequential verification session was `95147`; no checks were skipped.

| Command                                                             | Result                                                                                               | Local log                                                                                                                                                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm check`                                               | Lint, formatting, both type checks, 26 files / 301 tests, all workspace builds PASS                  | `/tmp/lessonquest-audit-check.log`                                                                                                                                                       |
| `corepack pnpm test:integration`                                    | 5 files / 32 tests PASS                                                                              | `/tmp/lessonquest-audit-integration.log`                                                                                                                                                 |
| `corepack pnpm test:e2e`                                            | 5 files / 30 tests PASS as scripted; includes API tests, not 30 browser tests                        | `/tmp/lessonquest-audit-e2e.log`                                                                                                                                                         |
| `corepack pnpm audit --prod`                                        | No known vulnerabilities                                                                             | `/tmp/lessonquest-audit-security.log`                                                                                                                                                    |
| `VITE_DEMO_MODE=true corepack pnpm --filter @lessonquest/web build` | 132 modules; successful static demo build                                                            | `/tmp/lessonquest-audit-demo.log`                                                                                                                                                        |
| Changed-file credential-pattern scan                                | 11 changed/new files; zero private-key, provider-token or literal-bearer matches                     | Current task tool output                                                                                                                                                                 |
| `git diff --check 9bcb2fb`                                          | PASS                                                                                                 | Current task tool output                                                                                                                                                                 |
| Protected-scope comparison to baseline                              | Schema, auth, contracts, provider, UI source, root manifest/lockfile, CI and Vercel config unchanged | `git diff --exit-code 9bcb2fb -- packages/db/src/schema.ts packages/auth packages/contracts packages/rasa apps/web/src package.json pnpm-lock.yaml vercel.json .github/workflows/ci.yml` |

Before this change's delivery, GitHub repository metadata identified the existing public URL as `https://web-phi-lyart-72.vercel.app`. Read-only HTTP checks confirmed the LessonQuest title, HTML and both current JS/CSS assets returned 200, with `connect-src 'none'` and `frame-src 'none'`. The immutable deployment URL redirects to Vercel login; no login protection was bypassed. This baseline observation is not evidence of the new commit's deployment. Recheck GitHub Production status for the merged SHA and the public URL after delivery.

## Containment and provenance

No migration/schema, auth predicate, response contract, provider/output policy, projection algorithm, frontend, dependency or deployment configuration changes. All new code is original LessonQuest work. Only synthetic data and deliberate local test triggers are used. No Firebase, external AI, actual students or reference repository was accessed. No audit endpoint was added. No SQL exception, title, hint, step text, answer or credential is included in the audit writer.

Audit writes cannot be guaranteed while the database is unavailable; safe 500 diagnostics remain the failure path. PGlite results do not establish real PostgreSQL multi-connection behavior. Broader E2E and visual-regression follow-ups remain open under the plan.

## Independent gate failure and organization-lifecycle remediation

The first independent review scored candidate `c15d25e` **82/100 FAIL**. It independently passed 301 tests, 32 integration tests, 30 scripted E2E tests, audit, and 12 adversarial probes, then reproduced an inherited disabled-organization bypass on all four boss endpoints. Its failed report is preserved; passing ordinary checks did not supersede the blocker.

The separate remediation plan/review passed at **98/100** before further production edits. Five new real API cases (create, student read, teacher detail, end, exact end replay) were written with only organization status disabled; users, classes and memberships remain active.

- RED: `corepack pnpm exec vitest run services/api/test/m5-m6.test.ts -t 'disabled organization'` failed **5/5 selected tests** (17 unrelated tests intentionally filtered out), with successful 200/201 responses instead of safe 404. Evidence: `/tmp/lessonquest-audit-org-red.log`.
- Implementation: exactly two authorization query changes since the failing candidate, each adding an organization join with `status='ACTIVE'`. This supersedes the initial scope's unchanged-authorization-predicate statement. No auth provider, membership policy, schema, UI, projection or dependency changed.
- GREEN: dependency build plus focused API/Rasa/boss repository checks passed **3 files / 24 tests**, with zero failures/skips. Evidence: `/tmp/lessonquest-audit-org-build.log`, `/tmp/lessonquest-audit-org-green.log`.

The inherited generic Rasa-finalization DB-failure classification remains a separate, nonblocking diagnostic limitation in the first independent report. It is not a new wrapper regression and this remediation does not claim to fix it. A different fresh independent reviewer must validate the complete remediated diff before delivery.

## Fresh remediated verification

The first full run stopped on a test-only TypeScript inference error: `randomUUID()` inferred a narrower template type than the parsed API string. The test variable now explicitly has type `string`; no production change was needed. Failed evidence is preserved at `/tmp/lessonquest-audit-org-check-type-red.log`.

The complete subsequent sequential verification session `65017` exited 0:

| Check                                                 | Result                                                                                      | Evidence                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `corepack pnpm check`                                 | Lint/format/typechecks, 26 files / **306 tests**, all builds PASS                           | `/tmp/lessonquest-audit-org-check.log`                          |
| `corepack pnpm test:integration`                      | 5 files / **37 tests** PASS                                                                 | `/tmp/lessonquest-audit-org-integration.log`                    |
| `corepack pnpm test:e2e`                              | 5 files / **35 tests** PASS as scripted (includes API tests)                                | `/tmp/lessonquest-audit-org-e2e.log`                            |
| `corepack pnpm audit --prod`                          | No known vulnerabilities                                                                    | `/tmp/lessonquest-audit-org-security.log`                       |
| Static demo build                                     | PASS, 132 modules                                                                           | `/tmp/lessonquest-audit-org-demo.log`                           |
| Secret-pattern scan                                   | 14 changed/new files, no matches                                                            | Current-task tool output                                        |
| Full-range whitespace and protected-scope comparisons | PASS; schema/auth package/contracts/provider/UI/dependency/CI/Vercel config still unchanged | `git diff --check 9bcb2fb` and the protected-path command above |

All ordinary remediated verification completed with zero failed/skipped tests. Independent final acceptance remains a distinct gate, recorded in the second review rather than inferred from these results.
