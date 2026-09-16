# F02 live teacher workspace — independent final review, attempt 1

2026-09-09. Reviewer: fresh independent agent `/root/f02_live_teacher_final`, which did not implement this unit. Base `44fe133`; inspected the tracked diff and the untracked implementation, test, dependency and configuration files in `.verification/f02-live-final-manifest.log`, the approved 97-point plan, PROJECT_CANON, AGENTS, the memory rubric, setup runbook and verification evidence. No implementation was edited during this review.

## Decision

**84/100 FAIL. Do not accept, merge, push or deploy this candidate.** The Vercel rewrite and gateway disagree about automatically generated query parameters, preventing the prepared live API routes from reaching the application. Preserve this report, fix with a reviewed plan and test-first evidence, then obtain a fresh independent final review.

## Blocking finding

**[P1] The named API rewrite creates a query that the gateway always rejects.** `vercel.json:9` rewrites `/api/:path*` to `/api`. Vercel passes unused named rewrite parameters into the query string; its published routing converter turns this rule into `dest: "/api?path=$1"`. Meanwhile `services/api/src/server-runtime.ts:79` rejects every nonempty query, and line 128 returns 404 before runtime dispatch. Thus a normal request for `/api/session` gains `?path=session` and cannot establish a teacher session. Health and lesson-input routes have the same problem.

This behavior is specified by the [Vercel configuration documentation](https://vercel.com/docs/project-configuration/vercel-json) and implemented by the official [routing-utils converter](https://github.com/vercel/vercel/blob/main/packages/routing-utils/src/superstatic.ts) in `replaceSegments`. The checked-in tests call the Fetch handler directly and assert the raw rewrite object (`tests/vercel-api.test.ts:5` and `:21`); the loopback browser server likewise bypasses Vercel's rewrite conversion. Those tests therefore miss the deployment boundary.

Independent reproduction used **@vercel/routing-utils 6.5.0**, installed with lifecycle scripts disabled into an owned temporary directory, and the built candidate handler with a synthetic successful runtime. No repository dependency was added, and no cloud project or credentials were accessed:

| Request                                             | Official converted destination                           | Direct handler | Original pathname plus converted query | Rewritten target |
| --------------------------------------------------- | -------------------------------------------------------- | -------------: | -------------------------------------: | ---------------: |
| `/api/session`                                      | `/api?path=session`                                      |            200 |                                    404 |              404 |
| `/api/health`                                       | `/api?path=health`                                       |            200 |                                    404 |              404 |
| `/api/organizations/<synthetic UUID>/lesson-inputs` | `/api?path=organizations/<synthetic UUID>/lesson-inputs` |            200 |                                    404 |              404 |

All six converted-input probes were rejected before `active.fetch`; the three direct-handler baselines reached it. Evidence: `.verification/f02-live-independent-routing.log`. Reproduction script: `/var/folders/c2/d7fb3_sj53jfnp8mmfnx2glw0000gn/T/lessonquest-vercel-review-tmmrs68p/probe.mjs`. These are local tests of the official conversion and candidate handler, not an actual deployed Vercel request.

Make the rewrite and handler contract agree and add a durable test that applies the actual route conversion before dispatch. An unnamed capture converts without the automatic `path` query in the independent comparison, but any chosen remedy must still preserve supported paths, reject unrelated routes and arbitrary query input, and pass exact deployed-SHA smoke later. Do not broadly trust a caller-supplied `path` parameter as a shortcut.

## Other inspection and verification evidence

- All 46 frozen manifest hashes matched at initial inspection. The implementer subsequently corrected only the new PostgreSQL fixture's source/dist Firebase import; the original manifest is preserved as `.verification/f02-live-first-manifest.log`. All 46 current hashes also matched the updated final manifest. No production change occurred during this scoring pass.
- The schema-readiness extraction retains exact schema/table/column/function ACL checks and both directions of runtime-role membership checks, while explicitly separating owner and runtime identity. Runtime setup contains no migration/bootstrap action; shared app credentials have no owner-URL fallback.
- Firebase configuration remains dedicated to LessonQuest. Current SQL role/membership authority, F01 route scope, no-store responses, token/session invalidation and AI default-deny remain present in the inspected code. No additional authorization or secret-exposure blocker was established in this review.
- The implementer's completed logs show full check **572 tests / 57 files**, PostgreSQL **71**, integration **80**, scripted E2E **80**, demo Chromium **12**, preview Chromium **42**, live Chromium **4**, and a clean production audit. The earlier PostgreSQL **70 pass / 1 fail** came from mixing source and emitted AuthenticationError identities in the test fixture; its corrected run passes. That fixture issue is distinct from the deployment routing finding.
- This reviewer deliberately did not rebuild packages while the implementer's sequential matrix was running. The independent routing conversion and nine handler probes establish the blocking finding; a full independent regression/browser rerun was not completed after that finding because the candidate already fails. These implementer checks are not represented as independent passes. The remediation review must independently run the required relevant checks against its final frozen candidate.

## Score

| Category                                   |           Score | Evidence                                                                                                                                               |
| ------------------------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance  |           21/25 | Teacher/session/storage wiring follows the bounded plan, but the deployed API routing acceptance criterion fails.                                      |
| Correctness and code quality               |           16/20 | Clear server/browser separation and fail-closed state, with a reproduced platform-boundary correctness defect.                                         |
| Security, privacy and tenant isolation     |           20/20 | Inspected authority, credential, ACL, route and AI-denial boundaries remain intact; the identified defect denies requests rather than granting access. |
| Test and verification evidence             |           15/20 | Meaningful unit/SQL/browser evidence exists, but route tests bypass the platform transformation and independent broad reruns remain pending.           |
| Operability, recoverability and provenance |           12/15 | Explicit setup and rollback documentation, pinned SDK and safe diagnostics; current routing prevents live operation.                                   |
| **Total**                                  | **84/100 FAIL** | **Fresh independent review required after remediation.**                                                                                               |

Actual Google login, remote PostgreSQL provisioning/persistence, configured secrets/domains, chosen teacher registration, preview isolation, required CI and exact deployed commit/status/URL verification remain separate release requirements. The local synthetic SDK/verifier/browser fixtures do not establish those outcomes. No real student data, reference repository or external system was changed.
