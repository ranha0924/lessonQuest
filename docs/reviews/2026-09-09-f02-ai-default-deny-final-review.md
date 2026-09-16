# F02 AI default-deny independent final review

2026-09-09. Reviewer: `f02_ai_default_deny_final`, newly assigned and independent of implementation. Base: `389429d`; branch: `codex/f02-live-authoring`. Reviewed PROJECT_CANON, the project-memory rubric, the approved default-deny plan and its97/100 review, the complete tracked and untracked candidate diff, and verification evidence. No production or test implementation was edited during review. Additional probes were kept in `/tmp`; their output is recorded under `.verification/`.

## Decision and scope

**99/100 PASS; no critical blocker.** The local AI default-deny boundary may be accepted. This decision covers the saved-input generation denial, middleware integration, disabled UI control, regression tests and setup/status documentation. It does not certify full F02 completion, a payment integration, production teacher-login/server-storage rollout, remote database setup or deployment.

The explicit user choice—no payment service, AI blocked by default—is enforced. The generation route has no provider, key lookup or enable flag. An approved teacher or administrator cannot activate it, and browser-supplied payment claims cannot create authority. Future payment verification, entitlement, limits and actual generation remain separate gated work.

## Findings

No blocking correctness, authorization, tenant-isolation, secret-handling or external-call finding was found.

One low-priority operability observation remains at `services/api/src/app.ts:126`: `diagnosticResourceIds` recognizes the lesson-input base path but not its `/generations` subpath, so the denial's `API_ERROR.resourceId` is null. An independent probe confirmed that the same trace ID joins the authorized `LESSON_INPUT_READ` audit with the correct lesson UUID. Correlation therefore remains available and the response stays safe. A future generation implementation can add a UUID-only subpath match with a durable test; logging raw paths or request bodies is unnecessary. This is not a reason to widen the current scope or postpone default denial.

## Actual implementation evidence

- `services/api/src/ai-generation-routes.ts:8` strictly validates mutation UUID and bounded positive revision, then parses both route UUIDs and uses the current actor with the existing repository read at line30. The repository checks active user, compatible current platform and membership roles, active organization and lesson ownership or current organization administration in its SQL. The unconditional safe403 follows at line38.
- `services/api/src/app.ts:315` applies no-store before authentication/error handling for the new path. The ordinary64KiB limit remains separate from the larger F01 text allowance. Existing authentication, origin, media-type, trace and safe-error handling remain in force; the new403 is nonretryable and contains no saved content or upstream exception.
- `apps/web/src/components/lesson-input-workspace.tsx:449` renders a native disabled button with a described-by notice and no click handler. The real React → API → PGlite regression verifies disabled state before save, after save and after reopening revision2, while source save/load/edit still works and no generation request is emitted.
- The diff adds no dependency, schema change, provider import, secret read, checkout endpoint, payment write or external service mutation. Existing deterministic local Rasa/manual authoring behavior remains separate. Documentation accurately distinguishes local code from live delivery.

## Independent verification

| Check                               | Result and evidence                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused actual-source API/UI suite  | 19/19 passed,2 files, exit0; `.verification/f02-ai-deny-independent-focused.log`                                                                              |
| Adversarial real Hono/PGlite probes | 22 passed, exit0; `.verification/f02-ai-deny-independent-probes.log`                                                                                          |
| Changed production/test ESLint      | Exit0, no warnings; `.verification/f02-ai-deny-independent-lint.log`                                                                                          |
| Production dependency audit         | Exit0, no known vulnerabilities; `.verification/f02-ai-deny-independent-audit.log`                                                                            |
| Fresh emitted-artifact scan         | 21 JS/map/HTML files in normal, demo and preview output, no server SDK/key/credential-environment markers; `.verification/f02-ai-deny-independent-bundle.log` |
| Frozen implementation identity      | All5 hashes in `.verification/f02-ai-deny-manifest.log` matched after probes; no implementation edit during review                                            |
| Diff whitespace                     | `git diff --check` exit0                                                                                                                                      |

The additional probes cover another teacher's source, invalid revision values and JSON, stale revision, paid query/header spoofing, malformed and unknown IDs, current organization disablement, membership disablement and downgrade, wrong HTTP methods, a body just over64KiB, and an upstream exception containing a synthetic sensitive marker. API import and requests made **zero guarded AI-environment reads and zero external fetch calls**. Lesson revision, mutation count and experience rows remained unchanged. The probes also confirmed trace-to-audit correlation for the minor diagnostic observation above.

The reviewer inspected the implementer's actual RED output:12 expected failures before the route/UI existed, followed by19 focused passes, plus a separate body-limit RED failure before correction. The final full check passed544 tests across49 files plus lint, formatting, root/web types and builds. The four completed matrix records and their logs show integration80, scripted E2E80, demo Chromium12 and preview Chromium42, all exit0. The implementer's fresh21-file bundle scan also passed in `.verification/f02-ai-deny-bundle.log`. No matrix or artifact result was left pending when this score was recorded.

## Final rubric

| Category                                   |           Score | Evidence                                                                                                                                      |
| ------------------------------------------ | --------------: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance  |           25/25 | Unconditional default denial, existing storage usability, explicit local-only scope and no unauthorized provider/payment work.                |
| Correctness and code quality               |           20/20 | Small route boundary, strict parsing, existing authority/error reuse, disabled control, negative and failure-path checks.                     |
| Security, privacy and tenant isolation     |           20/20 | Current database authority, default denial even with key/admin/client flags, no key access/provider request, bounded body and no-store.       |
| Test and verification evidence             |           20/20 | Observed RED/GREEN, independent19 tests and22 probes, fresh lint/audit/artifact checks, full544-test and80/80/12/42 regression evidence.      |
| Operability, recoverability and provenance |           14/15 | Safe trace-correlated diagnostics/audits, accurate status and fail-closed rollback; minor direct diagnostic resource-ID omission noted above. |
| **Total**                                  | **99/100 PASS** | **Strictly above85 with no critical blocker.**                                                                                                |

Required repository integration, CI and exact deployed-commit verification remain release steps under the standing authorization; this review is not evidence that those steps occurred.
