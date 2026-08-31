# Phase 1 Closeout and Development Preview — Verification

Date: 2026-08-31. Base: `fe206c1f9f69e10dbc15a7abc656d0b1636ad93d`. Branch: `codex/phase1-closeout`.

Status: local implementation accepted by independent Attempt3 at96/100 with no blocker. Earlier candidate evidence and failed verdicts below are historical and preserved. Exact-head CI, merged-SHA and live Vercel delivery results are recorded in this branch's merge PR after execution; this document alone is not deployment confirmation.

## Gates and boundaries

The closeout plan passed at97/100 before runtime edits; narrowly recorded hint recovery, contrast/motion and campaign-field refinements passed98,100,100. The user then explicitly asked for a Vercel development preview of the real service UI, expanding the original demo-only constraint. The separate preview plan passed96/100 before preview/runtime/CSP changes. All historical failures remain recorded.

Only synthetic data, fresh PGlite and the deterministic local Rasa provider were used. Reference repositories, Firebase and real student data were untouched. The browser preview is entirely client-controlled; its real repository authorization logic is exercised for development but cannot protect real records from the browser owner. No external AI, paid resource, secret or network DB is configured.

## Test-first observations

| Observation before correction                                                                                                                                           | Correction and observed result                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recovery tests: five failed, one passed; competing writes remained enabled and exact event/end retry was missing (`/tmp/lessonquest-closeout-recovery-red-2.log`).      | Retain pending event/UUID, serialize writes, explicitly retry the original request, acknowledge only server results.                                                                                                    |
| Ambiguous successful hint response allowed stale-sequence answers; immutable terminal503 left no way to request a new hint.                                             | Lock answers until exact uncertain request replay; separately allow a new UUID after a known terminal failure. Real API/DB tests check no duplicate effects and unchanged terminal rows.                                |
| SPECIAL campaign switch rendered a blank live version despite defaultValue1 (`/tmp/lessonquest-closeout-special-input-red.log`).                                        | Distinct conditional React keys; both switch directions and actual campaign submission now pass.                                                                                                                        |
| Generic Rasa finalization fault returned500 and recorded authorization-revoked; revoked terminal replay returned503 (`/tmp/lessonquest-closeout-finalization-red.log`). | Finite finalization code, accurate FAILED state, no false DENIED/CONFLICT, safe503 initial/replay, actual revocation remains404. Diagnostic payload is exact allowlisted metadata with matching trace and no raw fault. |
| Browser computed styles: CLASS BOSS2.7271/RASA2.4259 contrast, hover transforms persisted under reduced motion.                                                         | Existing scoped cyan token and reduced-motion selectors corrected; same matrix passes.                                                                                                                                  |
| Preview compatibility: no Buffer, ignored custom transport, bypassed response validation and missing hash adapter caused four initial failures.                         | UTF-8 byte count via TextEncoder; optional request transport; narrow pinned SHA-256 adapter with Node-equivalent vectors.                                                                                               |

Initial fixture/import/assertion mistakes were not product RED: unavailable test-only package import, membership204 versus201 expectation, lowercase contribution reasons, default-src fallback rather than explicit connect-src, duplicate200 versus fresh202, and empty student discovery rather than404. Corrections preserved repository behavior. Browser measurement helper setup errors likewise were not product failures.

## Focused evidence

- Baseline:306 tests passed before closeout work.
- Latest root boundary bundle: **43/43** tests across full-flow2, recovery10, negative7 and API24; `/tmp/lessonquest-closeout-core-43.log`. Start/double-start cases characterize the guarded result; no separate pre-fix RED is claimed for them.
- Earlier broader focused bundle: **49/49** across six files including SDK and Rasa repository; `/tmp/lessonquest-closeout-core-final.log`. It preceded the two additional start cases and the diagnostic assertion lint adjustment.
- Full authoring path uses authenticated API to create another organization/class/student membership, real React save/validate/sandbox/approve/assignment/boss creation, student wrong/hint/remount/retry/completion and teacher persisted results. Correct-first literally records no wrong answer, retry, hint request, hint action or usage, and contributes7; retry path contributes8.
- Existing demo Chromium suite: **12/12**, three viewport sizes1440×900/768×1024/375×812 and24 measured states;195 targets all≥44px,219 surfaces max luminance0.117835,681 critical text checks min contrast5.228944. Every state checks keyboard focus; dedicated tests cover fragment navigation and reduced motion. Controlled20px target and1:1 contrast faults are detected. `/tmp/lessonquest-closeout-browser-{green,summary}.log`.
- Preview asset build emits same-origin `pglite.wasm`10,088,160 bytes, `initdb.wasm`395,241 bytes, `pglite.data`6,295,309 bytes. This development-only first-load cost is visible in the UI; no general unsafe-eval allowance is authorized.
- Preview browser development run: **10/10**, desktop/mobile, actual save→validate→sandbox→approve→assign→play→teacher evidence, correct-first, completed reentry, reset/reload, reset during write, failed asset retry and normal build exclusion. `/tmp/lessonquest-preview-browser-fifth.log`. It uses the real Vercel headers; `frame-src 'none'` did not need relaxation for scripts-only srcDoc.
- Browser-specific RED exposed PGlite's hanging default asset-failure startup and Chromium stripping `Origin` from native Request headers. Explicit same-origin fetch/compile before DB construction makes startup errors retryable. Detached headers on the request forwarded solely to in-memory Hono preserve the synthetic trusted Origin; no global fetch override or network transport bypass exists. A normal-build module-graph guard initially caught retained lazy preview imports; direct compile-time Vite flag access removed them.
- Playwright's `serviceWorkers: 'block'` injected an access to a forbidden getter inside the intentionally opaque iframe. Removing that test instrumentation resolved the harness-only error; neither sandbox nor production frame policy was weakened. The suite instead rejects actual serviceworker events/registrations and continues requiring no application console/page errors. Build warnings about upstream unused eval paths are not ignored runtime errors: CSP still omits generic unsafe-eval and the exercised runtime succeeds.

## Final verification and delivery

- Frozen install succeeded with the committed candidate lockfile, then root's fresh `corepack pnpm check` passed **31/31 files,332/332 tests**, ESLint, Prettier, both TypeScript checks, all workspace builds and the ordinary Vite build. Exit0; `/tmp/lessonquest-closeout-{frozen-install-final,check-final}.log`.
- `corepack pnpm audit --prod --audit-level high` reported **No known vulnerabilities found**; `/tmp/lessonquest-closeout-audit.log`.
- Before independent review, the41 changed runtime/test/tooling files were fingerprinted separately from documentation: manifest SHA-256 `dd2bd20bd272baebe22f15cd7e5b13934d2e297359f83d8d186c846db52f0540`. The manifest includes untracked new files and is stored in `/tmp/lessonquest-closeout-candidate-manifest.json`. Root and both implementers froze code; the reviewer did not implement it.

Root's additional sequential verification exited0:

| Command                          | Result                                                                            | Local log                                           |
| -------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------- |
| `corepack pnpm test:integration` | 5 files,39 tests PASS                                                             | `/tmp/lessonquest-closeout-integration-final.log`   |
| `corepack pnpm test:e2e`         | 8 files,56 tests PASS; React tests use jsdom plus actual HTTP/Hono/PGlite         | `/tmp/lessonquest-closeout-e2e-final.log`           |
| `corepack pnpm test:browser`     | 12 Chromium cases PASS,20.6s                                                      | `/tmp/lessonquest-closeout-browser-final.log`       |
| `corepack pnpm test:preview`     | 10 Chromium cases PASS,20.0s; normal build then actual-header preview             | `/tmp/lessonquest-closeout-preview-final.log`       |
| Production dependency audit      | No known vulnerabilities found                                                    | `/tmp/lessonquest-closeout-audit-final.log`         |
| Diff / credential-pattern check  | No whitespace errors;49 changed files, no private-key/cloud-token pattern matches | `/tmp/lessonquest-closeout-secret-check-final.json` |

The41-file runtime/test/tooling manifest was recomputed after all root checks and was byte-identical to the pre-review manifest. Browser test servers released their ports before independent checks began. The temporary Chromium body-capture assertion produced empty bodies after WASM compilation; the final test verifies the three observed same-origin resource URLs via its isolated test HTTP client with redirects disabled, checking binary size, MIME and WASM magic. No product workaround was introduced for that harness limitation.

Pending: independent complete-diff review, exact-head CI, main merge, Vercel deployed-SHA/status and live interaction. Results will be appended only after execution. Temporary logs are local evidence aids; checked-in tests and CI are the repeatable source.

## First independent verdict and gated correction

The first independent final review scored **82/100 FAIL** in `2026-08-31-phase1-closeout-final-review.md`. It independently passed the332-test full check,10 preview cases,12 demo cases and audit, but four real-boundary probes exposed an unresolved hint replay bug. A409, temporary404 or audit-storage500 on a retry did not establish that the original disconnected request finished; losing that UUID could consume a second hint or leave completion at a stale sequence. The report and original manifest are preserved unchanged. Nothing was pushed or deployed from that candidate.

The narrowly scoped correction plan `2026-08-31-phase1-uncertain-hint-replay-remediation.md` passed a new **99/100** plan review before production edits. After the first reviewer released its snapshot, four durable recovery cases were added: three nonterminal replays while RUNNING and one confirmed terminal failure after lost transport. The first run produced **3 failures /1 pass /10 skipped**, exactly the missing write locks for actual409/404/500; `/tmp/lessonquest-closeout-remediation-red.log`. The terminal-failure case was already correct and is regression evidence, not invented RED.

The StudentPlay catch handler now retains prior uncertainty and request identity until successful exact replay or one of the finite terminal Rasa codes. Nonterminal errors do not release competing writes. A confirmed failed request still permits the explicit new-request recovery path. The actual new candidate requires fresh checks and a different independent final reviewer before acceptance.

Root's post-correction focused run passed45/45 tests (recovery14, negative7, API24). The complete sequential verification then exited0: `pnpm check` passed336 tests across31 files plus lint/format/types/all builds; integration39/39, E2E60/60, demo Chromium12/12 and actual-service preview Chromium10/10 passed. Logs: `/tmp/lessonquest-closeout-{check,integration,e2e,browser,preview}-remediated.log` and `/tmp/lessonquest-closeout-remediation-green.log`. The new41-file code/test/tooling manifest has SHA-256 `c9edc4ecd97b5f18e8250e38b21a43edcd805687c13375816d9e5f3f7c2f5776`; all build outputs and test ports were released to the different second independent reviewer. This is implementer evidence, not acceptance.

## Second independent verdict and server resume containment

Attempt2 scored **85/100 FAIL**, preserved in `2026-08-31-phase1-closeout-final-review-attempt-2.md`. Its independent fullcheck336, original recovery probes4, terminal recovery probes3, preview browser10 and dependency audit passed. Two new real-boundary probes nevertheless reproduced stale completion after direct student remount and actual teacher→student role switching while the original hint remained RUNNING. Both completion attempts returned409. No candidate was pushed or deployed.

The new pending-hint-resume remediation plan passed **97/100** before production edits and after that failure was reproduced. Implementation began only after the second reviewer preserved its verdict and released its ports. Durable direct-remount/actual-role-switch tests first failed because the resume endpoint returned200 instead of409; `/tmp/lessonquest-closeout-resume-red-2.log` (2FAIL,15skipped). The preceding message-focused RED also failed at the missing waiting status; neither is a fixture error.

The authenticated attempt is now locked before checking organization/attempt-scoped nonterminal Rasa requests. Resume returns existing409 until the original request reaches a terminal state; retry then reads committed hints and sequence. StudentPlay explains the temporary wait without mounting stale write controls. Existing authority checks still run first, including the new temporary-membership404 assertion. REJECTED, FAILED, TIMED_OUT (including late provider resolution), finalization failure and restored authorization failure all have remount/resume regression checks. A stranded RUNNING state fails closed; durable worker-crash recovery is not claimed for this synthetic, resettable preview. A third fresh independent gate remains required.

The fresh focused suite passed **61/61** (recovery17, negative7, flow2, learning repository11, API24), `/tmp/lessonquest-closeout-resume-green-2.log`. The preceding run's single failure was a test-fixture error: it invoked LocalRasaProvider with an already-aborted signal when trying to simulate a late provider. Preparing the local result before the controlled delay correctly simulates a provider that returns after timeout; no production change was made for that harness correction. Focused lint and diff checks passed. The newly frozen42-file code/test/tooling digest is `67528a28b671f9790124241acb7b4712b649c16e1950df10181042b61a23b0be`, `/tmp/lessonquest-closeout-candidate-3-manifest.json`. A different third independent validator is auditing this complete candidate while root runs the final sequential verification.

Root's final sequential bundle exited0 on this frozen candidate:

| Command                          | Result                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `corepack pnpm check`            | 31 files, **339 tests PASS**, lint/format/types/all workspace builds and normal Vite build |
| `corepack pnpm test:integration` | 5 files, **39 PASS**                                                                       |
| `corepack pnpm test:e2e`         | 8 files, **63 PASS** (real React/HTTP/Hono/PGlite, not Chromium)                           |
| `corepack pnpm test:browser`     | **12 Chromium PASS**,20.7s                                                                 |
| `corepack pnpm test:preview`     | **10 Chromium PASS**,20.0s, actual Vercel headers and normal-build exclusion               |
| Production audit                 | No known vulnerabilities found                                                             |
| Diff / credential-pattern scan   | Clean full-range whitespace;56 changed files, no token/private-key pattern matches         |

Logs: `/tmp/lessonquest-closeout-{check,integration,e2e,browser,preview,audit}-resume-fixed.log`; scan `/tmp/lessonquest-closeout-secret-check-resume-fixed.json`. The42-file manifest matched after execution. All root outputs/ports were explicitly released before the third reviewer ran its independent checks. Independent acceptance and remote delivery are still separate gates.

## Accepted independent verdict

The fresh third validator finalized **96/100 PASS, no critical/blocking finding** in `2026-08-31-phase1-closeout-final-review-attempt-3.md`. It independently ran full339/31,12 additional adversarial probes, actual-service Chromium10, demo Chromium12, dependency audit and real checked-in-header/asset checks. The42-file manifest remained identical and both failed reports remained byte-identical. Its first fullcheck stopped at a formatting-only evidence-document update by root; the corrected fresh fullcheck passed, and that initial log remains preserved. All temporary test copies and owned servers were removed/stopped before delivery.

The additional probes confirm pending requests are scoped to the authenticated attempt, QUEUED and RUNNING both block resume, terminal states allow recovery, and a failed terminal-status write leaves RUNNING safely blocked. They remain ephemeral independent evidence; checking them into durable tests is a nonblocking follow-up that needs its own plan, not an unreviewed amendment to this accepted candidate. The normal build, synthetic-data limitation, fixed local Rasa, large startup payload and absent operating auth/persistence/external AI are unchanged.

The user already authorized commit/main/push/Vercel delivery. After this verdict, documentation-only acceptance updates precede the release commit. Exact-head CI and the expected-head merge guard must pass, the merged tree must match the reviewed tree, and the existing Vercel Production record must identify the merged SHA. The branch's PR body will record those immutable references and the public browser's actual save→validate→approve→assign→play→teacher-result flow after they are observed, avoiding a documentation-only redeployment solely to insert its own future deployment SHA.
