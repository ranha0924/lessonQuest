# F02 bounded Neon connection timeout — independent final validation

## Decision and scope

**97/100 PASS. No critical blocker remains for this bounded connection-timeout change.**

Reviewer: independent agent `f02_neon_wake_final`, assigned after implementation and uninvolved in production or test edits. Reviewed the working-tree diff against `680161a33030599f3874964ac1b0c148a976821d`, the repository rules, PROJECT_CANON, project-memory final rubric, the97-point approved timeout plan, actual failure/verification records, and installed pg-pool behavior. The separately reviewed Neon deployment-isolation addendum is outside this code-change score and was not edited by this reviewer.

Production behavior changes only at `packages/db/src/postgres.ts:94`: connectionTimeoutMillis rises from5000 to15000, with an explanatory comment. Pool size, verified TLS/channel binding, ten-second statement limit,15second idle-transaction limit, readiness/role/grant validation, authorization and unconditional AI denial remain unchanged. There is no migration, credential change, retry, dependency or compute-policy change.

This accepts the bounded implementation for subsequent authorized commit/CI/deployment verification. It does not certify main release, live Firebase activation, an approved teacher UID, a real lesson save/login flow or guaranteed service availability. The Firebase key and explicit teacher setup remain separate pending gates.

## Verification inspected and independently executed

- Actual idle RED: `f02-neon-idle-before-diagnostic.log` identifies the dedicated main endpoint as idle; `f02-runtime-staged-idle-20260915.log` records the original5000ms setting and a classified connection timeout at5004ms on readiness query1. The two earlier generic operator failures remain unattributed.
- Corrected regression RED/GREEN: `f02-neon-wake-relay-corrected-red.log` shows the real6second PostgreSQL handshake failing at5012ms under restored5000ms configuration. Corrected GREEN records6046ms success plus a15030ms sanitized stalled-connection failure followed by pool recovery. The initial relay port-capture defect and its misleading RED/failed GREEN remain preserved and are excluded from accepted evidence.
- **Independent full owned-disposable PostgreSQL run:73/73 pass**, exit0, in `f02-neon-wake-independent-postgres.log`. This includes38 adapter/tenant cases and35 provisioning/ACL cases. New real-wire cases independently completed in6019ms and15012ms. The helper captures the upstream port before replacing the URL port, binds loopback, forwards to actual PostgreSQL, and closes tracked sockets/timers. It does not mock query results or relax global test timeouts.
- **Independent checks passed:** root TypeScript check, changed DB files' ESLint, Prettier for the changed DB files/plan, diff validation, and production dependency audit. Records: `f02-neon-wake-independent-typecheck.log`, `f02-neon-wake-independent-static-checks.log`, and `f02-neon-wake-independent-audit.log`. One initial hash command failed in macOS Perl because the inherited C.UTF-8 locale could not initialize; Python hashlib replaced that tooling step without source changes.
- Parent's fresh stable-candidate `pnpm check` exited0: **577 tests across60 files**, lint, formatting, types and all builds; `f02-neon-wake-check-final.log`. This supersedes the earlier broad run that overlapped fixture correction. Parent's full PostgreSQL run also passed73 cases and its production audit was clean.
- Actual corrected idle GREEN: `f02-neon-idle-before-corrected-final.log` confirms the exact main endpoint was idle. `f02-runtime-staged-idle-corrected-final.log` records the emitted15000ms configuration, readiness query1 succeeding in6601ms and all8 queries succeeding in8331ms. The reviewer inspected the nonsecret diagnostic/helper source, including the emitted-configuration guard before connection. The earlier4916ms success using an old5000ms build is explicitly excluded as corrected GREEN; idle startup duration varies.
- **Independent original operator repeat passed**, exit0, using the frozen `runtime-smoke` mode with the final emitted adapter: restricted readiness passed, owner runtime refused, all six rollback permission probes denied, and aggregate users/organizations/lesson_inputs remained0. Record: `f02-neon-wake-independent-runtime.log`. The parent separately passed the same original operator in `f02-neon-wake-runtime-final.log`. No secret values or application records were displayed; denied probes were rolled back.

All log names above are under `.verification/`. The original operator's internal historic CI guard concerns its previously accepted baseline; it does not replace required CI for the new timeout commit.

## Findings and limits

No actionable correctness, security or tenant-isolation blocker was found. The new stalled-handshake test checks both the finite error deadline and successful reuse of the same max1 pool, so an indefinitely hung connection or permanently consumed slot fails verification. Existing tests continue to enforce sanitized errors, strict production connection configuration, transactional behavior and restricted authority.

One documentation precision issue was identified and corrected by the implementer during review: installed pg-pool uses connectionTimeoutMillis for waiting to acquire a pooled client as well as establishing a new socket. Both waits therefore become15seconds; pool concurrency and SQL limits do not increase. The approved plan and progress record now state this effect. A slow connection or saturated pool may keep a request waiting longer than before, within the finite setting and unchanged60second Vercel function maximum.

The actual idle success supports this correction for the observed failure; it is not a broad availability guarantee. Unknown prior generic errors, future network failures and production login/storage verification remain outside that conclusion. Rollback is the scoped code/test/documentation revert and requires no data migration; it would restore the observed five-second limitation.

## Score

| Category                                   |           Score | Evidence                                                                                                                        |
| ------------------------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance  |           25/25 | One approved finite setting, real idle RED/GREEN, no auth/payment/resource expansion.                                           |
| Correctness and code quality               |           19/20 | Real handshake and stalled-pool recovery verified; inherited pool-acquisition behavior documented.                              |
| Security, privacy and tenant isolation     |           20/20 | TLS, sanitized errors, role/ACL/tenant guards and AI denial preserved; independent actual permission checks pass.               |
| Test and verification evidence             |           19/20 | Independent73 PostgreSQL cases and static/audit checks, parent stable577 full checks, preserved and corrected fixture evidence. |
| Operability, recoverability and provenance |           14/15 | Finite limit, exact actual endpoint proof, no new dependency or migration, explicit remaining activation/availability limits.   |
| **Total**                                  | **97/100 PASS** | **No critical blocker within this bounded implementation scope.**                                                               |

## Reviewed implementation fingerprints

The exact implementation/test bytes were unchanged through independent verification:

- `packages/db/src/postgres.ts`: `fa1beff2105acc2ad78eea28376e1181b283e63e47a794dfc9bbb99aa109463e`
- `packages/db/test/postgres.test.ts`: `2240824027b33f8afd82a24a60c048bbdac0af9d7bfb06dd49cead06908138cf`

Manifest: `.verification/f02-neon-wake-independent-manifest.log`. Subsequent implementation edits require verification and review of the changed result; this report is not approval for unrelated production changes.
