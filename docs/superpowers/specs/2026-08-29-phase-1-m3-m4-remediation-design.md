# Phase 1 M3–M4 Final-Gate Remediation Design

## Purpose and authority

This design remediates the reproduced findings in `docs/reviews/2026-08-29-phase-1-m3-m4-final-review.md`. It remains bounded to M3 Science Studio and M4 assignment/student play. It does not add M5, M6, production adapters, deployment, push, or merge.

The controlling product requirements are the two user-provided source documents in `/Users/ranha/Downloads`, `docs/PROJECT_CANON.md`, and `docs/INTEGRATION_PLAN_V2.md`: generated content follows AI draft → independent validation → teacher approval → publication; students can resume; teacher results reflect real student work; deadlines and privacy boundaries are server-owned; material decisions are auditable.

## Invariants

### Validated artifact binding

The SHA-256 hash of the canonical fixed renderer artifact is the content identity. Validation and approval rows each persist that exact `content_hash`. Validation parses both stored specification and artifact, rebuilds the canonical artifact, requires equality with the stored artifact and current hash, and validates the canonical specification.

Review may approve only when the latest PASS validation hash equals the current version hash. Approval persists the same hash before the version moves to `APPROVED`.

The database enforces a forward-only state graph:

- `GENERATED → VALIDATED` only with a PASS validation for the current hash.
- `GENERATED → REJECTED` only with a FAIL validation for the current hash.
- `VALIDATED → APPROVED` only with an APPROVE decision for the current hash.
- `VALIDATED → REJECTED` only with a REJECT decision for the current hash.
- `APPROVED → PUBLISHED` and `PUBLISHED → RETIRED` are the only later transitions.
- All other transitions, including downgrades and direct jumps, fail in PostgreSQL.

Specification, artifact, and hash become immutable at `VALIDATED`. Manifest may be created only during `VALIDATED → APPROVED` and is immutable thereafter. Validation, approval, learning-event, and audit evidence remain append-only.

### Server-authoritative quiz outcomes

The browser submits an option identifier, attempt number, and elapsed time. It never submits `correct`. The server loads the immutable published artifact inside the authorized attempt transaction, resolves the quiz step and option, and derives correctness from the private answer key.

The stored server event contains the selected option and authoritative correctness. The response returns only the correctness outcome for that submission; the player response still strips answer keys and explanations. Exact duplicates return the stored authoritative outcome.

The answer state machine requires:

- `QUESTION_ANSWERED` is the first answer for the quiz, with attempt `1`.
- `ANSWER_RETRIED` follows a wrong answer for the same step and increments the attempt by exactly one.
- A correct answer closes that step; further retries fail.
- Completion requires an authoritative correct outcome for every quiz step.
- Unknown steps/options, forged `correct` fields, skipped sequences, forged attempt counters, and premature completion fail closed.

Teacher progress counts every authoritative false quiz outcome as an incorrect answer and every accepted retry event as a retry.

### Resume and lifecycle

`startOrResumeAttempt` returns server-owned `nextSequence` and answer state. The SDK accepts `initialSequence`; the UI emits `EXPERIENCE_STARTED` only when the attempt remains `READY`. An `IN_PROGRESS` attempt resumes at `nextSequence` without a second start event. A completed attempt is displayed as completed and cannot emit more events.

Student listing, attempt creation/resume, player issuance, and event ingestion all require active organization, class, organization membership, class membership, user, assignment, and published version. They apply the same server clock window: `starts_at <= receivedAt` and `due_at IS NULL OR due_at >= receivedAt`.

### Shared runtime contracts

`@lessonquest/contracts` owns strict schemas for supported grade bands, teacher preview, validation/review results, assignment summaries, attempt sessions, student-safe player sessions, authoritative ingestion results, and progress arrays. The API validates outgoing shapes and the HTTP client parses every successful response rather than casting unchecked JSON.

Supported grade bands are the twelve Korean school-year identifiers `elementary1`–`elementary6`, `middle1`–`middle3`, and `high1`–`high3`. This makes age suitability metadata explicit and bounded.

### Audit evidence

Every M3/M4 material mutation and protected result read receives the API trace ID. Success audit rows are written in the same transaction as the state change. Denied or conflicting decisions write a redacted audit row after the failed transaction with only actor, organization, allowlisted action/resource type, resource ID, trace ID, and outcome. No content, answer text, token, or student display data enters the audit table.

Covered actions are experience create/validate/review, assignment create, attempt start/resume, event ingestion, and teacher progress read. Existing M1/M2 semantics and safe error envelopes remain unchanged.

## Verification boundary

Focused RED/GREEN tests cover each invariant. One integrated React → HTTP client → Hono → LearningRepository → PGlite flow proves correct-first, wrong/retry-correct, and reload/resume behavior without mocks. The implementer then runs one complete workspace check and security bundle. A new independent non-implementing agent must append a second attempt to the final review report and score at least 86/100 with no critical blocker.
