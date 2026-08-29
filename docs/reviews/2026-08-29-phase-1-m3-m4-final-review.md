# Phase 1 M3–M4 Independent Final Review

- Review date: 2026-08-29
- Reviewer: fresh independent non-implementing agent
- Base: `415d8487fb15627351e260c816fc70041801fb0e` (`origin/main`)
- Head: `1fb9d551167b7364e5a0f2bdb40b547d0b8183a0`
- Scope: Phase 1 M3 Science Studio and M4 assignment/student play only
- Threshold: strictly greater than 85 (86/100 minimum) and no critical blocker

## Verdict

**FAIL — 62/100, with three critical blockers.**

The candidate has a well-structured local vertical slice, strict generated-content schemas, current-database-role tenant joins, a network-denied fixed sandbox, answer-key redaction at the student API boundary, canonical SHA-256 checks, append-only event records, and meaningful tests. All mandated commands passed. However, the actual implementation does not satisfy the final gate: a normal resumed attempt cannot continue, validation is not cryptographically bound to the artifact that is approved, approved content can be rewritten through an allowed status downgrade, and the visible quiz records a predetermined wrong/retry outcome instead of evaluating the selected answer. These are core M3/M4 acceptance and product-invariant failures, not documentation-only gaps.

**Ready to merge: No.** No merge, push, or deployment is authorized by this review.

## Evidence basis and limitation

I read `AGENTS.md`, `CLAUDE.md`, `docs/PROJECT_CANON.md`, `memory/projects/lessonquest.md`, `docs/INTEGRATION_PLAN_V2.md`, the M3–M4 design, implementation plan, plan review, `README.md`, and `docs/SOURCE_PROVENANCE.md`. I inspected the complete 51-file base-to-head diff, production code, schema, contracts, UI, tests, package manifests, and lockfile dependency changes.

The requested source documents `LessonQuest_제품사업_기준문서_v3.md` and `LessonQuest_AI_사업계획서_v3_플레이형학습플랫폼.md` are absent from this checkout, every local Git ref, `/Users/ranha/Documents/ChatGPT/lessonQuest`, and the surrounding `/Users/ranha/Documents/ChatGPT` workspace. Consequently, I could not read those two files directly and assessed product conformance against the repository's approved canonical memory in `docs/PROJECT_CANON.md` plus `docs/INTEGRATION_PLAN_V2.md`. This is an evidence/provenance limitation, although the blockers below are independently demonstrated from the delivered code.

## Critical blockers

### 1. The approved artifact is not bound to the independent validation, and the immutability trigger is bypassable

`validateExperienceVersion` validates the `experience_versions.specification` column and persists findings, but the validation row stores no content hash (`packages/db/src/learning-repository.ts:297`, `packages/db/src/learning-repository.ts:320`, `packages/db/src/learning-repository.ts:323`). Approval separately parses and hashes the `artifact` column without proving that it is the same content that was validated (`packages/db/src/learning-repository.ts:383`, `packages/db/src/learning-repository.ts:387`, `packages/db/src/learning-repository.ts:423`). The trigger blocks content mutation only when the **old** status is `APPROVED`, `PUBLISHED`, or `RETIRED`; it neither protects `VALIDATED` content nor constrains status transitions (`packages/db/src/schema.ts:231`, `packages/db/src/schema.ts:234`, `packages/db/src/schema.ts:246`).

Two independent PGlite probes reproduced the failures without disabling the trigger:

1. After a PASS validation, I changed only the artifact and its hash to a schema-valid artifact with `forceN: 0`. The repository then returned `APPROVED`, and preview returned `approvedForceN: 0` beside the stored PASS report. Thus, the published artifact had not passed the validator.
2. After approval, I changed status to `GENERATED`, changed specification/artifact/hash, and changed status back to `APPROVED`. Preview accepted the changed title and matching new hash. Thus, the advertised immutable approved version is mutable.

This violates the canonical requirements that generated learning content cannot publish without independent validation and teacher approval and that approved versions are immutable. It is a critical blocker regardless of score.

Required remediation: bind each validation and approval to the canonical content hash; reject review unless the latest PASS validation hash equals the current artifact hash; protect content at least from `VALIDATED` onward; and enforce an allowlisted forward-only status transition graph in the database. Add direct-SQL regression tests for validated-content mutation, status downgrade, artifact/specification divergence, approval/hash binding, and attempted restoration to an approved status.

### 2. A normal in-progress attempt cannot resume

`startOrResumeAttempt` correctly returns the existing attempt with `resumed: true` (`packages/db/src/learning-repository.ts:641`, `packages/db/src/learning-repository.ts:647`). The browser then always creates a new event session and sends a new `EXPERIENCE_STARTED` event (`apps/web/src/components/student-play.tsx:44`, `apps/web/src/components/student-play.tsx:48`, `apps/web/src/components/student-play.tsx:56`). Every new SDK session restarts its sequence at zero (`packages/experience-sdk/src/event-session.ts:38`, `packages/experience-sdk/src/event-session.ts:60`), while ingestion rejects the already-used attempt/sequence before it can treat the call as a valid resume (`packages/db/src/learning-repository.ts:788`, `packages/db/src/learning-repository.ts:800`).

An independent repository+SDK probe created an attempt, accepted its initial start, called resume, and submitted the event generated by the resumed session. The observed result was `resumed: true`, `status: IN_PROGRESS`, followed by `secondStart: rejected`, `errorName: ConflictError`.

This breaks the explicit student start/resume acceptance criterion through the normal shipped UI path. It is a critical acceptance blocker.

Required remediation: return server-owned resume state and `nextSequence` (or equivalent) with the attempt/player session, initialize the SDK from that state, and emit `EXPERIENCE_STARTED` only for a newly created READY attempt. Add a real reload/resume UI-to-API test after at least one accepted event and a completed-attempt behavior test.

### 3. The player does not evaluate the selected answer; teacher results are client-authored

The API appropriately removes `correct` and `explanation` from the student specification (`services/api/src/app.ts:476`, `services/api/src/app.ts:484`). However, every first option button calls the same function, which always emits `correct: false`, even when the student chose the correct option (`apps/web/src/components/student-play.tsx:62`, `apps/web/src/components/student-play.tsx:160`, `packages/experience-sdk/src/event-session.ts:61`). The retry button does not ask for another choice and always emits `correct: true` (`apps/web/src/components/student-play.tsx:74`, `apps/web/src/components/student-play.tsx:171`, `packages/experience-sdk/src/event-session.ts:63`). The server never verifies an option or step against approved content and derives `wrongAnswers` directly from the client boolean (`packages/db/src/learning-repository.ts:875`, `packages/db/src/learning-repository.ts:880`). A raw authorized client can likewise claim arbitrary correctness or completion.

The answer key is not leaked, which is good, but the current workaround is a scripted wrong→retry-success demo rather than a real playable quiz or trustworthy teacher result. The existing UI test only asserts that this scripted event sequence was emitted (`apps/web/test/app.test.tsx:194`, `apps/web/test/app.test.tsx:204`, `apps/web/test/app.test.tsx:211`). This blocks the claimed real M3→M4 student-play and result acceptance.

Required remediation: submit a selected option ID to a server-owned answer-check path, evaluate it against the approved immutable artifact, emit/return the authoritative correctness outcome, and project only that outcome. Keep the answer key out of the student response. Add correct-first, wrong-first, wrong-retry-wrong, wrong-retry-correct, nonexistent step/option, forged correctness, and premature completion tests.

## Important gaps

### Assignment and institution lifecycle is not enforced at player/event time

Listing and starting apply the assignment window (`packages/db/src/learning-repository.ts:591`, `packages/db/src/learning-repository.ts:633`), but player issuance checks neither `starts_at` nor `due_at` and does not join an active organization/class (`packages/db/src/learning-repository.ts:677`, `packages/db/src/learning-repository.ts:701`). Event ingestion likewise checks an active assignment and memberships but not the due window, organization status, or class status (`packages/db/src/learning-repository.ts:737`, `packages/db/src/learning-repository.ts:762`).

An independent clock-controlled probe started before the deadline, advanced one hour beyond `dueAt`, and observed both `playerIssuedAfterDue: true` and `completionAcceptedAfterDue: true`. This conflicts with the design's lifecycle check and the integration policy that authorization/deadline decisions use server `receivedAt`. Apply the same active organization, active class, assignment-window, version, membership, and attempt lifecycle predicate to start, player, and ingestion, with explicit post-deadline and disabled-state tests.

### M3/M4 audit actions are declared but never written

The schema allowlists `EXPERIENCE_CREATED` through `PROGRESS_READ` (`packages/db/src/schema.ts:202`), but those symbols appear nowhere else in packages/services, and new API routes do not pass their trace IDs into `LearningRepository` (`services/api/src/app.ts:377`, `services/api/src/app.ts:519`). Therefore M3/M4 success, denial, and conflict decisions have no durable audit record or trace correlation, contrary to the README and existing M1/M2 pattern. Implement redacted transactional audit writes for the new actions and test success/denial/conflict trace correlation.

### The planned shared response contracts are missing

The design calls for player-session and assignment-summary runtime schemas, but `packages/contracts/src/learning.ts` stops at progress and ingestion-result schemas (`packages/contracts/src/learning.ts:27`, `packages/contracts/src/learning.ts:40`). The web client duplicates response shapes and accepts unchecked JSON with `value as T` (`apps/web/src/api-client.ts:15`, `apps/web/src/api-client.ts:161`, `apps/web/src/api-client.ts:180`). This weakens the browser/API boundary and helped the tests use hand-built responses disconnected from server behavior. Add strict teacher-preview, student-safe-player, assignment-summary, attempt-session, and progress-list schemas and parse every response.

### Generated-content validation is narrower than the approved design

The independent validator has only two semantic findings: uncovered objective and zero force (`packages/science-studio/src/validation.ts:3`, `packages/science-studio/src/validation.ts:18`). Structural schema checks are strong, but `gradeBand` accepts any lowercase identifier rather than an age-suitability allowlist (`packages/contracts/src/science.ts:108`). The planned age-suitability metadata/check is absent. Add an explicit supported grade-band contract and deterministic age/suitability policy evidence, or narrow the design claim.

### The named E2E suite is not an end-to-end UI/API test and misses the blockers above

`test:e2e` runs one direct Hono/PGlite integration file and one React file (`package.json:17`). The React tests use a fully mocked `LessonQuestApi` (`apps/web/test/app.test.tsx:73`), while the API test never mounts the UI (`services/api/test/m3-m4.test.ts:105`). Consequently, neither test crosses React → HTTP client → Hono → PGlite, and the suite missed resume, validation/hash binding, immutable-status downgrade, expiry, real answer evaluation, disabled lifecycle, and M3/M4 audit evidence. The planned cross-tenant/role coverage is also much narrower than the route matrix described in the plan. Add a real integrated acceptance path and focused negative tests rather than relying on test counts.

## Minor issues

- `createAssignmentInputSchema` compares ISO date strings lexically (`packages/contracts/src/learning.ts:21`). Different valid offsets can reject a valid interval or admit an invalid one until PostgreSQL turns it into a generic server failure. Compare parsed instants.
- Creating a new draft does not clear the prior validation/preview/approval/assignment state (`apps/web/src/components/studio-workbench.tsx:38`). The server still fails closed, but the UI can show stale PASS/approved state and enable actions for the new unvalidated version.
- The README says M3/M4 audit logs record success, denial, and conflicts, but the implementation does not do so (`README.md:61`). Documentation should follow the actual supported behavior after the audit gap is fixed.

## Security and privacy assessment

| Area                               | Assessment                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret handling and real data      | Good within scope. The changed-file secret-pattern scan found no credential-shaped values; tests use synthetic actors/tokens and local PGlite; no Firebase or real student data was accessed.                                                                                                                                                                                                                   |
| Authorization and tenant isolation | Repository queries consistently recheck current user/platform role, organization membership, class membership, owner/admin status, and collapse IDOR to `ResourceNotFoundError`. Cross-tenant and stale-teacher tests are useful. Lifecycle checks are nevertheless incomplete after start, and several table relationships rely only on repository discipline rather than full composite database constraints. |
| Generated-code isolation           | Good. The strict BlockSpec rejects unknown code/URL fields, rendering escapes generated text, CSP defaults to no network, and the iframe has only `allow-scripts` without same-origin/forms/popups/navigation. The candidate does not execute generated HTML/JS.                                                                                                                                                |
| Generated-content publication      | Failing. The artifact approved is not bound to the PASS validation, and the approved-version trigger can be bypassed via status changes.                                                                                                                                                                                                                                                                        |
| Answer-key privacy                 | Good at the HTTP response boundary: `correct` and `explanation` are stripped, and sandbox HTML does not include the key. Correctness authority is not implemented safely; the client authors the result instead.                                                                                                                                                                                                |
| Event idempotency and projection   | Exact duplicate event IDs return duplicate, changed event IDs/sequences conflict, append-only triggers protect stored events, and projection rebuild occurs in the same transaction. Resume sequence state, authoritative answer verification, deadline checks, and concurrent retry behavior remain unproven.                                                                                                  |

## Verification performed

All commands were run independently in `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m3-m4-complete` at head `1fb9d551167b7364e5a0f2bdb40b547d0b8183a0`.

| Command                                                              | Outcome                                                                                                                                                                                         |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile`                            | Exit 0; all 9 workspace projects already up to date; pnpm 11.24.0.                                                                                                                              |
| `corepack pnpm check`                                                | Exit 0; lint passed with zero warnings, Prettier passed, typechecks passed, 17/17 test files and 176/176 tests passed, all workspace builds passed, and Vite built the web app.                 |
| `corepack pnpm test:integration`                                     | Exit 0; 2/2 files and 8/8 tests passed.                                                                                                                                                         |
| `corepack pnpm test:e2e`                                             | Exit 0; 2/2 files and 5/5 tests passed. This command's architectural limitation is described above.                                                                                             |
| `corepack pnpm audit --prod`                                         | Exit 0; `No known vulnerabilities found`.                                                                                                                                                       |
| `git diff --check 415d8487fb15627351e260c816fc70041801fb0e..1fb9d55` | Exit 0; no whitespace errors.                                                                                                                                                                   |
| Changed-file credential-pattern scan                                 | No matches.                                                                                                                                                                                     |
| Dependency inspection                                                | New React/Vite/Testing Library/jsdom dependencies and workspace links are exact-pinned in manifests/lockfile; no install scripts or untracked binary additions were found in the reviewed diff. |
| Resume probe                                                         | Reproduced: existing attempt returned `resumed: true`/`IN_PROGRESS`; second session start rejected with `ConflictError`.                                                                        |
| Validation-binding probe                                             | Reproduced: PASS validation followed by changed artifact/hash still produced `APPROVED`; approved preview contained validator-rejected `forceN: 0`.                                             |
| Approved-immutability probe                                          | Reproduced without disabling triggers: `APPROVED → GENERATED`, content/hash change, `→ APPROVED`; changed content passed preview/hash verification.                                             |
| Deadline probe                                                       | Reproduced: player issuance and completion event were both accepted after `dueAt`.                                                                                                              |

## Rubric score

| Category                                    |      Score | Evidence                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance   |      15/25 | Most planned packages and routes exist, M3 create/validate/preview/review/assign works on the happy path, and M4 list/start/events/projection exists. Core resume, exact validated-artifact approval, immutable approved versions, and real quiz/result behavior fail. Planned shared response schemas and true integrated E2E are absent. |
| Correctness and code quality                |      11/20 | Boundaries are readable, typed, parameterized, and mostly fail closed. Normal resume is broken, status transitions allow invariant bypass, the quiz is scripted, and deadline/state checks are inconsistent.                                                                                                                               |
| Security, privacy, and tenant isolation     |      12/20 | Strong points include current-role/membership joins, safe 404s, strict JSON, answer-key stripping, CSP/sandbox isolation, synthetic data, and no detected secrets. The validation/publication invariant is bypassable, client correctness is trusted, and active lifecycle checks are incomplete.                                          |
| Test and verification evidence              |      14/20 | The complete check, 176 tests, targeted integration/E2E commands, build, audit, and diff check all pass. Tests assert several useful negatives, but the purported E2E is split across mocks and direct API calls and missed every reproduced blocker. TDD RED evidence is not observable in the single squash commit.                      |
| Operability, recoverability, and provenance |      10/15 | Dependencies are pinned/audited, diagnostics redact errors, local containment is clear, and provenance states original work/no private source copy. M3/M4 audit records are absent, immutability/recovery claims are false, and two named controlling source documents are unavailable.                                                    |
| **Total**                                   | **62/100** | **FAIL — below 86 and critical blockers remain.**                                                                                                                                                                                                                                                                                          |

## Final decision

Do not accept, merge, push, or deploy this candidate. Fix the critical blockers test-first, add the missing lifecycle/audit/contract/E2E evidence, rerun the full verification set, and obtain a new independent final review as required by `AGENTS.md`.

---

## Attempt 2 — Remediation Review

- Review date: 2026-08-29
- Reviewer: fresh independent non-implementing agent who did not perform Attempt 1
- Base: `415d8487fb15627351e260c816fc70041801fb0e`
- Remediation head: `486abb82102d0d8198ae04b0c1ba8a5d8e42f362`
- Scope: Phase 1 M3 Science Studio and M4 assignment/student play only
- Threshold: strictly greater than 85 (86/100 minimum) and no critical blocker

### Attempt 2 verdict

**PASS — 91/100, with no critical blocker.**

The remediation resolves all three Attempt 1 blockers. Validation and approval are now bound to the canonical artifact hash and protected by database transition/content invariants; resume restores server-owned sequence and answer state without a second start; and the server derives option correctness from the immutable published artifact. Player/event lifecycle predicates, tenant and current-role checks, strict response contracts, explicit Korean grade bands, student-safe content, trace-correlated audits, and a real React → HTTP client → Hono → PGlite test are present and independently exercised.

The remaining findings are scored gaps, not final-gate blockers. The M3/M4 candidate clears the independent validation gate at this reviewed head. This verdict does not review or authorize M5/M6, production adapters, deployment, push, or merge.

### Evidence basis

Before scoring, I read both controlling Korean product/business documents from `/Users/ranha/Downloads`, `AGENTS.md`, `docs/PROJECT_CANON.md`, `docs/INTEGRATION_PLAN_V2.md`, the original M3/M4 design/plan/plan review, the complete Attempt 1 report above, the remediation design/plan/100-point plan review, `README.md`, `docs/SOURCE_PROVENANCE.md`, and the final rubric in `memory/projects/lessonquest.md`. I inspected the complete 59-file, 7,659-insertion/36-deletion base-to-head diff, including dependency manifests/lockfile, runtime code, tests, README, provenance, and memory.

All dynamic probes used synthetic actors and local PGlite only. I did not access Firebase, external systems, or real student data.

### Critical blockers

None.

### Remaining scored findings

#### Moderate: M3/M4 audit rows are not database-enforced append-only, and duplicate/conflict audit outcomes collapse together

The remediation design says validation, approval, learning-event, and audit evidence remain append-only (`docs/superpowers/specs/2026-08-29-phase-1-m3-m4-remediation-design.md:26`). The database installs mutation-rejection triggers on validations, approvals, and learning events, but not `audit_logs` (`packages/db/src/schema.ts:308`, `packages/db/src/schema.ts:316`, `packages/db/src/schema.ts:321`, `packages/db/src/schema.ts:326`). An independent direct-SQL probe successfully updated an existing audit outcome. In addition, an exact duplicate is returned correctly to the caller but is durably labeled `CONFLICT`, the same outcome class used by thrown conflicts (`packages/db/src/learning-repository.ts:342`, `packages/db/src/learning-repository.ts:1094`). This does not expose content or cross tenants, and application writes remain redacted and trace-correlated, but the audit evidence is less tamper-resistant and less diagnostically precise than the approved remediation design.

#### Moderate: browser event sequence consumption does not provide an exact retry after a transient delivery failure

The SDK increments its local sequence when an event is built, before delivery succeeds (`packages/experience-sdk/src/event-session.ts:55`, `packages/experience-sdk/src/event-session.ts:70`). The player builds once, sends once, and on rejection only shows an error; it neither retains/replays the exact event nor restores the consumed sequence (`apps/web/src/components/student-play.tsx:86`, `apps/web/src/components/student-play.tsx:95`, `apps/web/src/components/student-play.tsx:111`, `apps/web/src/components/student-play.tsx:115`). A failure before server receipt therefore makes the next in-memory submission skip a sequence, while a lost response after acceptance cannot be retried with the same event ID. Reloading recovers from server-owned resume state, so this is recoverable and not a local acceptance blocker, but it falls short of seamless idempotent retry behavior.

The local concurrent exact-replay probe did serialize to one accepted result, one duplicate result, and one stored event. Multi-connection PostgreSQL behavior remains unproven: event/context reads are not row-locked (`packages/db/src/learning-repository.ts:1008`, `packages/db/src/learning-repository.ts:1131`, `packages/db/src/learning-repository.ts:1138`) before the eventual insert (`packages/db/src/learning-repository.ts:1210`), so a future real PostgreSQL adapter must normalize a concurrent unique violation into the documented duplicate/conflict result. Production adapters are outside this review scope.

#### Minor: the declared Node 24 range is wider than jsdom's supported Node 24 range

The repository declares Node `>=24.0.0` and the README says Node 24+ (`package.json:7`, `README.md:9`), while pinned `jsdom@30.0.1` requires Node `^24.15.0` on the Node 24 line (`apps/web/package.json:24`, `pnpm-lock.yaml:790`). Verification passed on Node 24.13.0 despite that metadata mismatch, but supported-environment guidance should be narrowed or jsdom changed.

#### Minor: the real integrated E2E omits the design's correct-first scenario

The new test genuinely crosses React, the real HTTP client, Hono, LocalAuth, LearningRepository, and PGlite, and proves wrong → reload/resume → retry-correct → complete (`apps/web/test/m3-m4-e2e.test.tsx:35`, `apps/web/test/m3-m4-e2e.test.tsx:92`, `apps/web/test/m3-m4-e2e.test.tsx:120`). The remediation design also says that integrated flow proves correct-first (`docs/superpowers/specs/2026-08-29-phase-1-m3-m4-remediation-design.md:64`), but correct-first is only covered at repository level (`packages/db/test/learning-repository.test.ts:597`). This is an evidence-coverage mismatch, not a functional failure.

### Attempt 1 finding disposition

| Attempt 1 finding                                                             | Attempt 2 disposition                 | Independent evidence                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical: validation/approval not hash-bound; approved content/status mutable | **Resolved**                          | Validation and approval rows carry the canonical hash; the repository checks current PASS evidence (`packages/db/src/learning-repository.ts:480`, `packages/db/src/learning-repository.ts:574`), and the trigger enforces content immutability plus a forward-only graph (`packages/db/src/schema.ts:235`, `packages/db/src/schema.ts:249`). Direct SQL hash/status/content probes were rejected.        |
| Critical: normal resume sends a duplicate start and cannot continue           | **Resolved**                          | Attempt sessions return `nextSequence` and answer state (`packages/contracts/src/learning.ts:105`); UI initializes from it and starts only READY attempts (`apps/web/src/components/student-play.tsx:63`, `apps/web/src/components/student-play.tsx:72`). Repository and integrated reload probes resumed without another start.                                                                         |
| Critical: client authors correctness / scripted quiz                          | **Resolved**                          | Client events carry option ID, not correctness; server resolves the selected option and stores authoritative correctness (`packages/db/src/learning-repository.ts:1106`, `packages/db/src/learning-repository.ts:1120`). Forged correctness is schema-rejected and the player schema strips quiz answer keys (`services/api/src/app.ts:491`).                                                            |
| Important: assignment/institution lifecycle omitted at player/event time      | **Resolved**                          | Player and ingestion queries require active assignment/window, organization, class, memberships, user, and published version (`packages/db/src/learning-repository.ts:932`, `packages/db/src/learning-repository.ts:1016`). Deadline, disabled-class, and disabled-organization probes all failed closed for player and events.                                                                          |
| Important: no M3/M4 audit writes                                              | **Partially resolved**                | Atomic success, denial/conflict, trace correlation, and redaction are implemented (`packages/db/src/learning-repository.ts:330`, `packages/db/src/learning-repository.ts:342`) and probes passed. Database append-only enforcement and duplicate/conflict outcome distinction remain as scored findings above.                                                                                           |
| Important: shared response contracts missing                                  | **Resolved**                          | Strict schemas now cover assignments, attempts, player, ingestion, and progress (`packages/contracts/src/learning.ts:91`, `packages/contracts/src/learning.ts:105`, `packages/contracts/src/learning.ts:114`, `packages/contracts/src/learning.ts:137`); server and HTTP client parse them (`services/api/src/app.ts:480`, `apps/web/src/api-client.ts:152`). Extra-field response probes were rejected. |
| Important: grade band/age suitability too broad                               | **Resolved**                          | The science contract uses an explicit 12-value Korean elementary/middle/high grade enum (`packages/contracts/src/science.ts:125`, `packages/contracts/src/science.ts:170`) and the student artifact uses the same safe schema (`packages/contracts/src/science.ts:179`).                                                                                                                                 |
| Important: no real React-to-database E2E                                      | **Resolved, with minor coverage gap** | The real boundary test mounts `StudentPlay`, uses `createHttpLessonQuestApi`, routes fetch through Hono, and asserts PGlite events/projection/audits (`apps/web/test/m3-m4-e2e.test.tsx:35`, `apps/web/test/m3-m4-e2e.test.tsx:77`, `apps/web/test/m3-m4-e2e.test.tsx:109`). Correct-first is not in this integrated scenario.                                                                           |
| Minor: assignment date offsets compared lexically                             | **Resolved**                          | Contract validation compares parsed instants rather than raw offset strings.                                                                                                                                                                                                                                                                                                                             |
| Minor: new draft leaves stale approval/preview UI                             | **Resolved**                          | Draft creation clears prior version-dependent state and disables assignment until the new draft advances (`apps/web/src/components/studio-workbench.tsx:45`).                                                                                                                                                                                                                                            |
| Minor: README overclaimed nonexistent audits                                  | **Resolved**                          | M3/M4 audit rows now exist and are verified; the remaining append-only precision gap is disclosed above.                                                                                                                                                                                                                                                                                                 |

### Targeted exploit and code-probe results

| Probe area                                 | Result                                                                                                                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hash-bound validation/approval             | Matching SHA-256 evidence observed for both; divergent artifact verification raised `ContentIntegrityError`.                                                                                                                                       |
| Direct SQL downgrade/jump/content mutation | VALIDATED content mutation, APPROVED content mutation, status downgrade, and invalid status jump were all rejected by database triggers.                                                                                                           |
| Authoritative answer and state machine     | Wrong option returned/stored `correct: false`; retry-correct returned/stored `true`; unknown step, unknown option, skipped sequence, forged retry, premature completion, and post-completion events all failed closed.                             |
| Resume/idempotency                         | Resume returned IN_PROGRESS, `nextSequence: 2`, and the prior wrong-answer state; exact duplicate returned the stored authoritative answer; concurrent exact replay produced accepted + duplicate and one row.                                     |
| Lifecycle                                  | Deadline expiry plus disabled organization/class blocked both player issuance and event ingestion.                                                                                                                                                 |
| Tenant/role isolation                      | Cross-tenant actor, student role escalation, and stale-role actor all collapsed to `ResourceNotFoundError`.                                                                                                                                        |
| Audit atomicity/privacy                    | Audit columns were limited to action/actor/organization/outcome/resource/trace; no token/content/answer/student display data appeared. Forced audit failure rolled back the material mutation. Audit-row UPDATE remained possible, as noted above. |
| Contracts/student artifact                 | College grade band, student answer key, client-authored `correct`, and extra successful-response fields were all rejected/absent.                                                                                                                  |
| Integrated boundary                        | Real React → HTTP client → Hono → PGlite flow completed wrong/retry/reload/resume and teacher projection without a mocked LessonQuest API.                                                                                                         |

### Independent command verification

All commands were run in `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m3-m4-complete` at remediation head `486abb82102d0d8198ae04b0c1ba8a5d8e42f362`.

| Command                                                              | Exact outcome                                                                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile`                            | Exit 0; all 9 workspace projects already up to date; pnpm 11.24.0.                                                                                                  |
| `corepack pnpm check`                                                | Exit 0; lint zero warnings, Prettier passed, typechecks passed, **19/19 test files and 196/196 tests passed**, all workspace builds passed; Vite built 126 modules. |
| `corepack pnpm test:integration`                                     | Exit 0; **2/2 files and 13/13 tests passed**.                                                                                                                       |
| `corepack pnpm test:e2e`                                             | Exit 0; **3/3 files and 8/8 tests passed**.                                                                                                                         |
| `corepack pnpm audit --prod`                                         | Exit 0; no known vulnerabilities.                                                                                                                                   |
| `git diff --check 415d8487fb15627351e260c816fc70041801fb0e..486abb8` | Exit 0; no whitespace errors.                                                                                                                                       |
| Changed-file high-confidence credential scan                         | No PEM private keys, AWS/GitHub/Google/OpenAI/Stripe/Slack credential forms, or high-confidence literal secrets matched.                                            |

### Dependency and source provenance

The added React/Vite/Testing Library/jsdom direct dependencies are exact-pinned, lockfile entries have registry integrity hashes, inspected packages use expected public upstream repositories/MIT licensing, and no dependency lifecycle scripts or untracked binary additions were found. `docs/SOURCE_PROVENANCE.md:12` through `docs/SOURCE_PROVENANCE.md:15` attribute M3/M4 as original LessonQuest work and explicitly record that private Science LAB code was neither read nor copied. No external repository was mutated.

### Attempt 2 rubric score

| Category                                    |      Score | Evidence                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      24/25 | All core M3/M4 and Attempt 1 remediation requirements are implemented. The integrated E2E omits the design's correct-first branch.                                                                                                                                |
| Correctness and code quality                |      18/20 | Hash/status/sequence/answer/lifecycle invariants fail closed and resume works. Transient browser delivery recovery and future multi-connection concurrency normalization are incomplete.                                                                          |
| Security, privacy, and tenant isolation     |      19/20 | Server-owned correctness, current-role tenant joins, lifecycle symmetry, answer-key stripping, strict schemas, sandbox policy, synthetic data, and no detected secrets are strong. Audit rows lack database append-only protection.                               |
| Test and verification evidence              |      18/20 | 196 unit/contract/component tests, 13 integration tests, 8 E2E-selected tests, full builds, audit, diff, credential scan, and independent adversarial probes pass. Integrated correct-first and real multi-connection concurrency/retry-loss evidence are absent. |
| Operability, recoverability, and provenance |      12/15 | Trace-correlated atomic audits, deterministic resume, pinned/audited dependencies, source attribution, and local containment are present. Audit mutability, transient event recovery, and the Node/jsdom engine mismatch reduce confidence.                       |
| **Total**                                   | **91/100** | **PASS — at least 86 and no critical blocker.**                                                                                                                                                                                                                   |

### Attempt 2 final decision

The Phase 1 M3/M4 remediation at `486abb82102d0d8198ae04b0c1ba8a5d8e42f362` passes the repository's independent final-validation gate. The moderate and minor findings should be tracked before production-adapter work, but none invalidates this synthetic/local M3/M4 vertical slice. Attempt 1's 62/100 FAIL remains preserved above as the historical first review.
