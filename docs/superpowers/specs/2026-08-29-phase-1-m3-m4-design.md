# Phase 1 M3–M4 Design

## Decision status

This design concretizes the already approved architecture in `docs/INTEGRATION_PLAN_V2.md`. It covers only M3 Science Studio and M4 assignment/student play. M5 Rasa, M6 gamification/dashboard, deployment, push, and merge are excluded.

## Product slice

The slice has one authoritative path:

```text
Teacher-generated science JSON
  → strict parse into constrained BlockSpec
  → deterministic independent validation report
  → fixed-renderer sandbox preview
  → teacher approve/reject
  → immutable content hash
  → approved version assignment to an active class
  → student start/resume and fixed-renderer play
  → append-only idempotent events
  → teacher progress projection
```

Generated content never supplies HTML, JavaScript, URLs, CSS, storage keys, credentials, or network destinations. The only executable renderer is LessonQuest-owned code.

## Domain boundaries

### Contracts

`packages/contracts` owns runtime schemas shared by browser, API, domain, and persistence:

- `scienceBlockSpecSchema`: schema version, title, grade band, learning objectives, and an ordered block union.
- Block kinds: `CONCEPT_CARD`, `PREDICTION`, `SIMULATION`, `QUIZ`, `REFLECTION`.
- `SIMULATION` selects one allowlisted model (`FORCE_MOTION`) and bounded numeric parameters; it cannot carry code or URLs.
- `createScienceExperienceInputSchema`, `reviewExperienceVersionInputSchema`, `createAssignmentInputSchema`.
- `studentProgressSchema`, player-session and assignment-summary response schemas.
- Existing `clientLearningEventSchema` remains the one event envelope. Client-authored boss damage remains forbidden.

Strict objects reject mass-assigned ownership, organization, status, answer authority, artifact, hash, and role fields.

### Science Studio domain

`@lessonquest/science-studio` is a side-effect-free package with three responsibilities:

1. Parse generated JSON text with a byte ceiling and strict runtime schema.
2. Validate educational and safety invariants independently from generation.
3. Compile a canonical fixed-renderer artifact and compute `sha256:` content hashes.

The validator checks required block coverage/order, objective references, unique IDs, bounded text, simulation bounds, quiz option uniqueness/exactly one correct option, age suitability metadata, and absence of unsupported keys. Its report is immutable, versioned, and contains allowlisted finding codes rather than provider prose.

Canonical JSON recursively sorts object keys. The artifact is `{schemaVersion: 1, rendererVersion: "science-blocks-1", specification}`. Hashes are computed over the canonical UTF-8 artifact. Hash verification uses exact normalized values.

### Persistence

`packages/db` adds a focused `LearningRepository` while retaining `TenantRepository` for identity/class operations. New tenant-owned tables are:

- `experiences`
- `experience_versions`
- `experience_validations`
- `experience_approvals`
- `assignments`
- `attempts`
- `learning_events`
- `student_progress`

All IDs are UUIDs. Composite organization/resource uniqueness and foreign keys prevent cross-tenant references. Repository queries re-check current active database roles and class membership, never actor membership claims. Approved/PUBLISHED version content columns are protected by a database trigger. Validation and approval rows are append-only audit evidence.

Assignments can reference only a currently approved version in the same organization and an active class. Starting an assignment creates at most one attempt per student; subsequent starts return the same attempt. Player-session issuance recomputes the artifact hash and fails closed on mismatch.

Learning events have unique `(organization_id, event_id)` and `(attempt_id, sequence)`. An exact retransmission returns `accepted: false, duplicate: true`; the same event ID or sequence with changed content is a conflict. The server verifies actor, organization, assignment, attempt, experience/version, active membership, and lifecycle. Every accepted event rebuilds the assignment/student projection in the same transaction from append-only events.

M4 projection fields are `started`, `wrongAnswers`, `retries`, `completed`, `lastSequence`, `lastStepId`, `projectionVersion`, and `updatedAt`. It is reconstructable by replay and reveals no answer text.

### API

The Hono application keeps its existing exact-Origin, CORS, authentication, JSON-only, body-size, safe-error, and diagnostic middleware. It receives both repositories and registers:

```text
POST /organizations/:organizationId/experiences/science
POST /organizations/:organizationId/experience-versions/:versionId/validate
GET  /organizations/:organizationId/experience-versions/:versionId/preview
POST /organizations/:organizationId/experience-versions/:versionId/review
POST /organizations/:organizationId/classes/:classId/assignments
GET  /organizations/:organizationId/student/assignments
POST /organizations/:organizationId/assignments/:assignmentId/attempts
GET  /organizations/:organizationId/assignments/:assignmentId/player
POST /organizations/:organizationId/learning-events
GET  /organizations/:organizationId/classes/:classId/assignments/:assignmentId/progress
```

All route IDs are syntactically validated, but authorization comes from database joins. Unauthorized tenant/resource access is collapsed to the same 404 response. Domain conflicts use safe 409/422 envelopes without echoing content, answers, SQL, tokens, or stack traces.

### Experience SDK

`@lessonquest/experience-sdk` owns client event creation. It requires server-issued assignment/attempt/experience context, creates UUID event IDs, increments an in-memory sequence, and exposes only M4-authorized helpers: start, wrong answer, retry, and completion. It queues no credentials and accepts no organization override per event.

### React web app

`apps/web` uses React 19.2.8, React DOM 19.2.8, Vite 8.2.2, and the official React plugin 6.1.1. It contains:

- Teacher Studio: concept/title input, generated-spec submission, validation report, sandbox preview, approve/reject, and class assignment.
- Student Play: assignment cards, status/resume affordance, fixed renderer, answer/retry/completion event submission.
- Teacher progress: privacy-preserving per-student operational details for the teacher only; no public ranking.

The web app never stores a production token. Its API client accepts an authorization provider so local synthetic sessions can be injected by the development host and replaced by a future production adapter.

#### Visual direction

- Concept: a **science expedition workbench** rather than a generic admin dashboard.
- Palette: deep navy `#10233f`, cobalt `#2457d6`, sky `#dff3ff`, amber `#ffbd4a`, coral `#f0645a`, white `#ffffff`.
- Type roles: Korean-capable system sans for body/UI; rounded system display stack for large mission headings and numeric progress.
- Layout: left expedition rail, central experiment canvas, right validation/progress ledger on wide screens; one-column task sequence on mobile.
- Signature element: a vertical "discovery trail" connecting 생성 → 검증 → 승인 → 배포 states.
- Accessibility: semantic landmarks and labels, visible focus, 44 px controls, text plus color for state, `prefers-reduced-motion`, and responsive keyboard-safe dialogs.

Sandbox preview uses an iframe with `sandbox="allow-scripts"`, a fixed CSP (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:`), no forms, same-origin, popups, navigation, or network. Student play uses LessonQuest-owned React rendering of the same validated JSON and does not execute generated code.

## Failure behavior

- JSON parse/schema failure: no experience version is created.
- Validator failure: a REJECTED version and report remain auditable; approve/assign fail.
- Teacher rejection: version remains immutable and cannot assign.
- Hash mismatch: preview/player session refuses content with a safe non-retryable error.
- Duplicate event retransmission: acknowledged without another row/projection increment.
- Conflicting replay: 409; original row/projection remain unchanged.
- Projection write failure: the event transaction rolls back so event and projection cannot diverge in this M4 slice.
- Provider/network failure: out of scope; deterministic local generation text is the input boundary and no external AI is called.

## Acceptance trace

| Canonical requirement                    | Evidence                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| Minimum Block specification              | Contract and Science Studio unit tests                                       |
| Validation failure cannot publish        | Repository and API negative tests                                            |
| Teacher preview and approve/reject       | React behavior tests plus API integration                                    |
| Approved hash mismatch refuses execution | Direct DB-tamper integration test                                            |
| Approved version only can assign         | Repository/API negative tests                                                |
| Student home, player, resume             | React behavior tests and start-or-resume integration                         |
| Common SDK start/wrong/retry/complete    | SDK literal-event tests                                                      |
| Idempotent event storage                 | DB/API replay and conflict tests                                             |
| Teacher projection                       | M3→M4 E2E flow with literal progress result                                  |
| Tenant/role fail-closed                  | Cross-tenant, forged membership, stale-role, and student-teacher route tests |

## Containment and rollback

No external system or existing source repository is changed. New schema is created only in fresh local PGlite test databases. The branch can be abandoned without data cleanup. At runtime, an affected experience version can be rejected/retired and assignments disabled; approved content is never overwritten.
