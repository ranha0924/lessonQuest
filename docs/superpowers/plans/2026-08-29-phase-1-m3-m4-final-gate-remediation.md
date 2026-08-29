# Phase 1 M3–M4 Final-Gate Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every reproduced M3/M4 final-gate blocker by binding validation to immutable content, making resume and quiz results server-authoritative, enforcing lifecycle/audit policy, and proving the real browser-to-database flow.

**Architecture:** Shared Zod contracts define safe client/server boundaries. PostgreSQL triggers and hash-linked validation/approval rows protect publication invariants, while `LearningRepository` derives quiz outcomes and resume state under tenant/lifecycle guards. React uses parsed responses and server outcomes; an integrated test crosses React, the HTTP client, Hono, and PGlite.

**Tech Stack:** TypeScript 5.9, Zod 4.5, Hono 4.13, PGlite/PostgreSQL, React 19.2, Vitest 4.1, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-29-phase-1-m3-m4-remediation-design.md`

## Global Constraints

- Scope is M3 and M4 only; do not implement M5, M6, production adapters, deployment, push, or merge.
- Use synthetic identities and local PGlite only; never access real Firebase/student data or copy private source code.
- Every production change follows an observed mutation-sensitive RED before GREEN.
- Use the existing exact-Origin, JSON-only, body-limit, safe-error, current-database-role, and tenant-404 boundaries.
- Run focused checks during TDD, then one complete implementer check and one fresh independent final review.

---

## File map

- `packages/contracts/src/events.ts`: client option submissions and authoritative stored-event variants.
- `packages/contracts/src/science.ts`: supported grade bands and student-safe science schema.
- `packages/contracts/src/learning.ts`: strict response, resume-state, and ingestion-result schemas.
- `packages/db/src/schema.ts`: hash-bound evidence columns and database state/immutability triggers.
- `packages/db/src/learning-repository.ts`: content binding, lifecycle, resume, quiz authority, projection, and audits.
- `packages/experience-sdk/src/event-session.ts`: resume-aware sequence and option-submission helpers.
- `services/api/src/app.ts`: trace propagation, output parsing, and safe player/event responses.
- `apps/web/src/api-client.ts`: shared schema parsing instead of unchecked casts.
- `apps/web/src/components/student-play.tsx`: real answer/retry/resume UI driven by server outcomes.
- Tests beside each layer plus `apps/web/test/m3-m4-e2e.test.tsx`: direct invariant and integrated acceptance evidence.

### Task 1: Lock client/server contracts

**Files:**

- Modify: `packages/contracts/src/events.ts`
- Modify: `packages/contracts/src/science.ts`
- Modify: `packages/contracts/src/learning.ts`
- Modify: `packages/contracts/test/events.test.ts`
- Modify: `packages/contracts/test/science.test.ts`
- Modify: `packages/contracts/test/learning.test.ts`

**Interfaces:**

- Client answer payload: `{ optionId: string; attempt: number; elapsedMs: number }` with no `correct` key.
- Server answer payload: client payload plus `correct: boolean`.
- `AttemptSession`: `{ id, assignmentId, status, resumed, nextSequence, answers }`.
- `EventIngestionResult`: `{ accepted, duplicate, answer: { stepId, attempt, correct } | null }`.
- Export strict schemas for created/validation/review/preview/assignment/student-list/attempt/player/progress responses.

- [x] **Step 1: Write contract RED tests**

  Assert that a client answer containing `correct` is rejected, an answer with `optionId` is accepted, a server answer requires `correct`, unsupported `gradeBand: "college"` fails, student-safe quiz JSON containing `correct` fails, invalid date offsets are compared as instants, and every response schema rejects unknown/missing fields.

- [x] **Step 2: Run the contract RED**

  Run `corepack pnpm exec vitest run packages/contracts/test/events.test.ts packages/contracts/test/science.test.ts packages/contracts/test/learning.test.ts`. Expected: failures for the old correctness payload, open grade band, lexical dates, and missing response schemas.

- [x] **Step 3: Implement minimal strict schemas**

  Define distinct client and server answer variants, an explicit twelve-value `supportedGradeBandSchema`, a strict student-safe quiz/specification schema, and the response schemas named in Interfaces. Change date refinement to `new Date(dueAt).getTime() > new Date(startsAt).getTime()`.

- [x] **Step 4: Run the contract GREEN**

  Run the same three contract files. Expected: all pass.

### Task 2: Bind validation, approval, and publication in PostgreSQL

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/learning-repository.ts`
- Modify: `packages/db/test/learning-repository.test.ts`

**Interfaces:**

- `experience_validations.content_hash TEXT NOT NULL`.
- `experience_approvals.content_hash TEXT NOT NULL`.
- Validation and review repository results remain public-compatible but are parsed by Task 1 schemas.

- [x] **Step 1: Write content-integrity RED tests**

  Using direct SQL without disabling triggers, prove all of these must fail: mutate specification/artifact/hash after PASS validation; change `APPROVED → GENERATED`; direct-jump `GENERATED → APPROVED`; change artifact/hash after PASS and call review; diverge specification and artifact before validation; restore a mutated version to approved. Assert validation/approval rows store the literal version hash.

- [x] **Step 2: Run the database integrity RED**

  Run `corepack pnpm exec vitest run packages/db/test/learning-repository.test.ts -t "binds validation"`. Expected: at least the artifact-swap and status-downgrade probes succeed when they should be rejected.

- [x] **Step 3: Implement hash evidence and trigger graph**

  Add both hash columns. During validation, parse specification and artifact, rebuild the canonical artifact, require canonical equality/hash, insert the report with current hash, then transition status. During review, query the latest PASS validation and require its hash to equal the current canonical hash, insert the approval with that hash, then transition.

  Replace `reject_approved_version_mutation` with a trigger that freezes core content from `VALIDATED`, freezes manifest after approval, allowlists only the design state graph, and requires a matching evidence row for validation/rejection/approval transitions.

- [x] **Step 4: Run the database integrity GREEN**

  Run the focused test name from Step 2. Expected: every direct-SQL bypass is rejected and repository approval succeeds only for the validated hash.

### Task 3: Make resume, answers, completion, and deadlines server-owned

**Files:**

- Modify: `packages/db/src/learning-repository.ts`
- Modify: `packages/db/test/learning-repository.test.ts`
- Modify: `packages/experience-sdk/src/event-session.ts`
- Modify: `packages/experience-sdk/test/event-session.test.ts`

**Interfaces:**

- `createExperienceEventSession(context, { initialSequence, createId, now })`.
- Session helpers: `started(stepId)`, `answered(stepId, optionId, attempt, elapsedMs)`, `retried(stepId, optionId, attempt, elapsedMs)`, `completed(stepId, elapsedMs)`.
- `startOrResumeAttempt` returns the next contiguous sequence and latest per-quiz authoritative answer state.

- [x] **Step 1: Write resume/lifecycle/authority RED tests**

  Prove an in-progress attempt resumes at sequence two without another start; the SDK begins at that sequence; completed attempts cannot add events; post-deadline player/event calls fail; disabled organization/class calls fail; client `correct` is rejected; correct-first, wrong-first, wrong-retry-wrong, and wrong-retry-correct derive literal server outcomes; unknown step/option, skipped sequence, forged attempt number, retry after correct, and premature completion fail.

- [x] **Step 2: Run focused repository and SDK RED tests**

  Run `corepack pnpm exec vitest run packages/db/test/learning-repository.test.ts packages/experience-sdk/test/event-session.test.ts`. Expected: the new assertions fail against sequence zero, trusted correctness, and missing lifecycle predicates.

- [x] **Step 3: Implement the state machines**

  Compute `nextSequence = COALESCE(MAX(sequence) + 1, 0)` and replay answer state for attempt responses. Enforce `event.sequence === storedEventCount`. Load and verify the published artifact inside ingestion, resolve the exact quiz/option, derive correctness, enrich the stored server event, and return the outcome. Require retry continuity and correct completion.

  Apply the same active organization/class/member/assignment/version/window predicate to listing, start/resume, player, and ingestion using one captured server timestamp per operation. Initialize the SDK from the server sequence.

- [x] **Step 4: Run focused repository and SDK GREEN tests**

  Run the same files from Step 2. Expected: all pass, including every negative probe.

### Task 4: Add trace-correlated audits and parsed API boundaries

**Files:**

- Modify: `packages/db/src/learning-repository.ts`
- Modify: `packages/db/test/learning-repository.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/test/m3-m4.test.ts`
- Modify: `apps/web/src/api-client.ts`
- Modify: `apps/web/test/api-client.test.ts`

**Interfaces:**

- Every material LearningRepository method accepts optional final `traceId` and resolves it through `uuidSchema`.
- API passes `context.get('traceId')` into create/validate/review/assign/start/event/progress.
- HTTP `request(path, schema, init)` parses successful JSON with the shared runtime schema.

- [x] **Step 1: Write audit/response RED tests**

  Assert mutation success audits commit atomically, denied/conflicting actions write one redacted row with the response trace ID, event duplicate/conflict outcomes are distinguished, no audit column contains content/token/answer text, and malformed successful HTTP responses are rejected by the client.

- [x] **Step 2: Run focused audit/API-client RED tests**

  Run `corepack pnpm exec vitest run packages/db/test/learning-repository.test.ts services/api/test/m3-m4.test.ts apps/web/test/api-client.test.ts`. Expected: missing M3/M4 audit rows and unchecked responses fail.

- [x] **Step 3: Implement transactional audits and schema parsing**

  Add a redacted `writeLearningAudit` helper. Write success rows inside mutation transactions; on `ResourceNotFoundError` write `DENIED`, and on conflict/state/integrity errors write `CONFLICT` after rollback. Pass API trace IDs. Parse every outgoing API object and every successful browser response with Task 1 schemas.

- [x] **Step 4: Run focused audit/API-client GREEN tests**

  Run the same files from Step 2. Expected: all pass with literal trace correlation and malformed-response rejection.

### Task 5: Drive the student UI from authoritative outcomes and prove the real boundary

**Files:**

- Modify: `apps/web/src/components/student-play.tsx`
- Modify: `apps/web/src/components/studio-workbench.tsx`
- Modify: `apps/web/test/app.test.tsx`
- Create: `apps/web/test/m3-m4-e2e.test.tsx`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `memory/projects/lessonquest.md`

**Interfaces:**

- The UI selects an option, sends `answered` for attempt one or `retried` thereafter, and uses `result.answer.correct` to decide retry/completion state.
- Resumed state initializes sequence, attempt number, and correct/wrong UI from the server attempt session.

- [x] **Step 1: Write UI and integrated RED tests**

  Component tests cover correct-first, wrong-retry-wrong, wrong-retry-correct, completed-card behavior, and reload of an in-progress wrong attempt. The integrated test mounts `StudentPlay` with `createHttpLessonQuestApi`; its fetch adapter calls the real Hono app backed by LocalAuth and PGlite, then reloads the component, resumes without a second start event, answers correctly, completes, and asserts the real teacher projection/audit rows.

- [x] **Step 2: Run UI/E2E RED**

  Run `corepack pnpm exec vitest run apps/web/test/app.test.tsx apps/web/test/m3-m4-e2e.test.tsx`. Expected: failures because the current UI scripts outcomes and the end-to-end file is absent.

- [x] **Step 3: Implement outcome-driven UI and clear stale Studio state**

  Replace `submitFirstChoice`/automatic retry success with option-aware submission. Keep choices available after a wrong answer, close them after authoritative success, and enable completion only after success. On resume, do not emit a second start and restore answer state. Disable completed assignments. When creating a new draft, clear prior validation/approval/assignment UI state.

- [x] **Step 4: Run UI/E2E GREEN**

  Run the same files from Step 2. Expected: all UI and real boundary assertions pass.

### Task 6: Final evidence and independent re-review

**Files:**

- Modify: `docs/reviews/2026-08-29-phase-1-m3-m4-final-review.md` only through the fresh reviewer for Attempt 2.

- [x] **Step 1: Run one implementer verification bundle**

  Run `corepack pnpm check`, `corepack pnpm test:integration`, `corepack pnpm test:e2e`, `corepack pnpm audit --prod`, changed-file secret scan, and `git diff --check`. Record exact counts and outcomes in project memory.

- [x] **Step 2: Commit the remediation without external writes**

  Commit on `codex/phase1-m3-m4-complete`. Do not push, merge, or deploy.

- [x] **Step 3: Assign a fresh independent reviewer**

  A new agent that did not implement or perform Attempt 1 must inspect the source documents (using their provided `/Users/ranha/Downloads` paths), approved plan, complete base-to-head diff, tests, and verification. It reruns relevant checks and appends an independent Attempt 2 score to the existing final review report. Acceptance requires at least 86/100 and no critical blocker.

## Self-review

- Spec coverage: every Attempt 1 critical, important, and minor code finding maps to Tasks 1–5; source-document availability is corrected in Task 6.
- Placeholder scan: no TBD/TODO/similar-to references remain.
- Type consistency: client answers contain `optionId` only; server answers add `correct`; attempt response owns `nextSequence`/`answers`; ingestion result returns nullable authoritative answer metadata consistently across contract, repository, API, client, and UI.
- Containment: schema changes remain fresh-PGlite-only on this unpushed branch; rollback is branch-local; no external credential or irreversible migration is needed.
