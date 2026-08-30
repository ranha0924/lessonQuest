# Phase 1 M5–M6 Rasa Hints and Class Boss Design

- Status: user-approved design, pending implementation-plan gate
- Date: 2026-08-30
- Branch: `codex/phase1-m5-m6-complete`
- Base: local `main` at `e5e1e04a0dcc02ff094e811e625c11a3b211bccf`

## 1. Goal and controlling requirements

This slice completes Phase 1 M5 and M6 without adding a production AI provider or touching an existing source repository. It adds a context-aware, answer-safe Rasa hint path and one active class boss campaign whose progress is derived only from authoritative learning events.

The controlling sources are the two user-provided product/business documents in `/Users/ranha/Downloads`, `docs/PROJECT_CANON.md`, `docs/INTEGRATION_PLAN_V2.md`, and the repository gate in `AGENTS.md`. The resulting vertical slice must satisfy these invariants:

- Rasa is a contextual learning partner, not a general chatbot or answer generator.
- The browser cannot author Rasa context, allowed actions, correctness, boss damage, or tenant identity.
- Rasa receives only the minimum current learning context and never receives the answer key, option correctness, raw free-form student answers, email, credentials, or full student profile.
- Only a bounded `SHOW_HINT` action is executable in Phase 1.
- Provider calls, accepted/rejected results, token estimates, zero local cost, latency, and safe error codes are durable and auditable.
- Boss contribution is derived from server-accepted first-correct, retry-correct, and completion events under an immutable teacher policy.
- Learning-event durability does not depend on boss projection success.
- Duplicate or concurrent event delivery cannot create duplicate contribution.
- Students see class aggregate progress only; individual contribution detail is restricted to the teacher boundary.
- Existing repositories, deployments, Firebase, real student data, and external AI services remain untouched.

## 2. Approved product decisions

The user approved both architectural choices before this document was written:

1. **M5 provider model:** a provider interface with a deterministic local provider. The local provider performs no network I/O, needs no secret, returns stable fixtures, reports deterministic token estimates, and records `costMicros = 0`. A real provider is a later adapter behind the same port.
2. **M6 campaign model:** at most one active boss campaign per class. A campaign may use a weekly or special class-scoped key and receives eligible contributions from all assignments in that class while it is active.

## 3. Scope

### Included

- Strict request/response contracts for Rasa hints, policies, boss campaigns, student aggregate progress, teacher detail, and event acknowledgements.
- A new `@lessonquest/rasa` package containing the provider port, deterministic local provider, output policy, and safe token estimation.
- Assignment-level Rasa policy, session/request/action/usage persistence, idempotent hint requests, and server-created Rasa learning events.
- Class boss campaign, projection outbox, append-only contribution persistence, student aggregate read, and teacher detail read.
- Integration of the existing pure `@lessonquest/gamification` rules after correcting its two recorded validation findings.
- Student hint and class-progress UI plus teacher campaign and evidence UI.
- Event delivery acknowledgement/resynchronization needed when server-created hint events share the attempt sequence.
- Append-only audit protection and a distinct durable `DUPLICATE` outcome because M5/M6 add new protected audit evidence.
- A real React → HTTP client → Hono → repository → PGlite Phase 1 completion E2E.

### Excluded

- OpenAI or any other network AI provider, API keys, provider SDKs, live cost, speech, audio, image, or video generation.
- Free-form chat, student-authored prompt text, arbitrary Rasa actions, browser automation, Windows/Jarvis runtime code, OAuth, or personal assistant memory.
- Public individual rankings, student-to-student comparison, client-authored damage, marketplace, billing, exports, or production admin functionality.
- Firebase, real student records, existing WordQuest/Jarvis repositories, external deployments, production adapters, and production migrations.
- Phase 2 invitation, PWA/offline queue, and legacy user migration work.

## 4. Architecture and ownership

### 4.1 Package and service boundaries

- `packages/contracts` owns strict wire and persistence-boundary schemas.
- `packages/rasa` owns the provider interface, deterministic local provider, output validation helpers, and token estimation. It has no database, HTTP, environment-variable, or network access.
- `packages/gamification` remains the pure boss key/HP/projection policy package. It accepts only internal verified outcomes and never reads client events directly.
- `packages/db` gains focused `RasaRepository` and `GamificationRepository` classes rather than adding more responsibilities to `LearningRepository`.
- `LearningRepository` remains authoritative for attempts, immutable artifacts, answer correctness, and learning-event order. It exposes internal server-verified event facts to the projection repository.
- `services/api` builds no policy decisions itself. It authenticates, parses, propagates trace IDs, invokes repositories/providers, and parses responses.
- `apps/web` renders only parsed responses and sends identifiers or teacher configuration. It cannot construct Rasa Context or contribution amounts.

### 4.2 Dependency direction

```text
React UI
  → HTTP client and shared response schemas
  → Hono auth/origin/body/trace boundary
  → RasaRepository ──→ @lessonquest/rasa LocalRasaProvider
  → LearningRepository ──→ projection outbox
  → GamificationRepository ──→ @lessonquest/gamification
  → PGlite/PostgreSQL-compatible schema
```

No package points back toward the web or API layers. Rasa and gamification remain pure and independently testable.

## 5. Contracts

All schemas are strict and reject unknown fields.

### 5.1 Assignment Rasa policy

Assignment creation accepts an optional teacher-owned policy:

```ts
type AssignmentRasaPolicyInput = {
  enabled: boolean;
  maxHintLevel: 1 | 2 | 3;
};
```

`forbidFinalAnswer` is always `true` and is not client-configurable. Existing assignments without a policy are disabled. The Studio assignment UI requires an explicit choice and defaults the visible control to enabled with level 2 for newly created synthetic assignments.

### 5.2 Hint request and result

```ts
type RasaHintRequest = {
  requestId: UUID;
  attemptId: UUID;
  stepId: BoundedIdentifier;
};

type RasaHintResult = {
  requestId: UUID;
  sessionId: UUID;
  duplicate: boolean;
  action: {
    action: 'SHOW_HINT';
    experienceId: ExperienceId;
    stepId: BoundedIdentifier;
    level: 1 | 2 | 3;
    content: string;
  };
  nextSequence: number;
};
```

Organization and assignment are path-owned. Context, requested level, policy, model, token counts, cost, and correctness never appear in the request. A repeated `requestId` with the same semantic request returns the stored action and current acknowledgement; a changed reuse returns conflict.

### 5.3 Event acknowledgement

`EventIngestionResult` adds server-owned `nextSequence`. Accepted and exact-duplicate responses both return the authoritative next sequence. The experience SDK retains one unacknowledged event and advances only after `acknowledge(eventId, nextSequence)`. `synchronize(nextSequence)` is used after a server-created hint event or reload. Retrying a failed delivery returns the identical envelope and event ID.

`AttemptSession` also returns student-safe Rasa resume state:

```ts
type AttemptRasaState = {
  enabled: boolean;
  maxHintLevel: 1 | 2 | 3;
  hints: Array<{
    stepId: BoundedIdentifier;
    level: 1 | 2 | 3;
    content: string;
  }>;
};
```

This is rebuilt from accepted append-only actions so reload restores used levels and the last visible hint without another provider call. `RASA_OPENED` and `HINT_USED` move out of the client event union and remain server-event variants only.

### 5.4 Boss campaign input

```ts
type CreateBossCampaignInput = {
  title: string;
  period:
    { kind: 'WEEKLY'; weekStart: 'YYYY-MM-DD' } | { kind: 'SPECIAL'; version: PositiveSafeInteger };
  targetHp: PositiveSafeInteger; // 60..60_000
  policy: {
    amounts: {
      ANSWER_CORRECT: number; // integer 0..10_000
      ANSWER_RETRIED: number; // integer 0..10_000
      EXPERIENCE_COMPLETED: number; // integer 0..10_000
    };
  };
};
```

The server builds the lowercase class-scoped campaign key. Client input has no organization ID, class ID, current damage, student amount, status, or contribution list. Campaign policy and target are immutable after activation; a teacher ends the campaign and creates another to change them.

### 5.5 Student and teacher reads

Student aggregate response:

```ts
type StudentBossProgress = {
  campaignId: UUID;
  title: string;
  targetHp: number;
  damage: number;
  completed: boolean;
} | null;
```

It contains no student IDs, names, ranks, or contribution rows.

Teacher detail adds campaign policy, safe projection health counts, and deterministic rows `{ studentId, damage, reasons }`. The UI masks IDs consistently while the teacher API remains current-role and class-owner/admin guarded.

## 6. Persistence model and database invariants

All tables use composite organization foreign keys where applicable, bounded check constraints, server timestamps, and explicit state constraints.

### 6.1 Rasa tables

- `assignment_rasa_policies(organization_id, assignment_id, enabled, max_hint_level, policy_version, created_by, created_at)`; one immutable policy snapshot per assignment.
- `rasa_sessions(id, organization_id, assignment_id, attempt_id, student_id, policy_version, status, created_at, updated_at)`; one active session per attempt.
- `rasa_requests(id, organization_id, session_id, step_id, hint_level, context_hash, status, provider, model, trace_id, error_code, created_at, finished_at)`; the client request ID is the primary idempotency key.
- `rasa_actions(id, organization_id, request_id, action, status, created_at)`; accepted and rejected structured results are append-only. Rejected raw provider output is never stored.
- `ai_usage(id, organization_id, rasa_request_id, provider, model, input_tokens, output_tokens, cost_micros, latency_ms, created_at)`; nonnegative bounded integers and exactly one row per completed provider call.

`rasa_requests` follows `QUEUED → RUNNING → SUCCEEDED | REJECTED | FAILED | TIMED_OUT`. Terminal states cannot transition. `rasa_actions` and `ai_usage` reject update/delete.

### 6.2 Boss tables

- `class_boss_campaigns(id, organization_id, class_id, campaign_key, title, target_hp, policy, status, created_by, created_at, ended_at)`; unique campaign key and at most one `ACTIVE` row per organization/class.
- `boss_projection_jobs(id, organization_id, learning_event_id, campaign_id, status, attempts, last_error_code, created_at, updated_at)`; unique learning event and immutable campaign binding.
- `boss_contributions(id, organization_id, campaign_id, student_id, source_event_id, amount, reason, created_at)`; unique `(organization_id, source_event_id)` and append-only.

Campaign state is `ACTIVE → ENDED`. `COMPLETED` is derived from contribution sum versus target so concurrent writes cannot desynchronize a mutable HP column. Projection state is `PENDING → PROCESSING → SUCCEEDED | FAILED`; `FAILED → PROCESSING` is the only retry edge and attempts are bounded.

### 6.3 Cross-cutting database hardening

- Event ingestion and hint finalization lock the attempt row before reading or assigning sequence numbers. This serializes concurrent browser, duplicate, and server-created hint events for real PostgreSQL as well as PGlite.
- `audit_logs` receives an update/delete rejection trigger.
- Audit outcomes distinguish `SUCCEEDED`, `DUPLICATE`, `DENIED`, and `CONFLICT`.
- Existing validation, approval, learning-event, Rasa action/usage, audit, and boss contribution evidence is append-only.
- No generated content, answer key, option label, token, free-form student text, or provider raw response is written to audit columns.

## 7. M5 Rasa flow

### 7.1 Eligibility and context construction

The hint route is available only when all of these are true at one captured server time:

- organization, user, memberships, class, assignment, published version, attempt, and Rasa policy are active;
- the assignment window is open and the attempt is `IN_PROGRESS`;
- the requested quiz step exists in the immutable approved artifact;
- the server event history contains an unresolved wrong answer for that step;
- the next sequential hint level does not exceed the teacher maximum.

The repository builds `RasaContext` from the approved artifact and authoritative event history. It includes subject, unit, experience/version, current step/question summary, correctness-only recent responses, used levels, grade band, objectives, and the fixed final-answer prohibition. It excludes option labels, correct option ID, explanation, raw answer text, email, display name, credentials, and other assignments.

### 7.2 Provider port

```ts
interface RasaHintProvider {
  generateHint(input: RasaProviderInput, signal: AbortSignal): Promise<RasaProviderResult>;
}
```

The port returns unknown action data plus `{ provider, model, inputTokens, outputTokens, costMicros, latencyMs }`. `LocalRasaProvider` uses only non-answer concept/simulation summaries and fixed pedagogical templates. It has a 2-second orchestration timeout, deterministic character-based token estimates, model `local-rasa-v1`, and zero cost.

### 7.3 Output policy

Provider output is accepted only when:

- it parses as `SHOW_HINT` and has no extra field;
- experience and step match the server context;
- level equals the next unused level and does not exceed policy;
- content is nonempty, normalized, bounded, and contains no URL, markup, instruction to execute code, direct-answer marker, correct option ID, or normalized correct option label;
- the output does not request another action.

The correct answer is used only by the server-side leak check and is never passed into the provider. Malicious fixtures covering Korean and English direct-answer wording, exact option leakage, target substitution, level skipping, arbitrary actions, URLs, markup, and oversized content must be rejected.

### 7.4 Durable completion and events

Provider work occurs outside a long database transaction. The request row is first created under idempotency protection; after provider completion, a second transaction relocks and revalidates attempt/lifecycle state. On success it stores the action and usage, then appends `RASA_OPENED` for the first successful session request and one `HINT_USED` event at contiguous server-owned sequences. It returns the new `nextSequence`.

A retry of a completed request returns the stored action without another provider call, usage row, event, or sequence increment. Provider failure/timeout/rejection records a safe terminal status and audit outcome but creates no learning event. Changed request-ID reuse conflicts.

## 8. M6 boss flow

### 8.1 Campaign lifecycle

Only a current class owner teacher or organization admin can create/end a campaign. Creation validates the period, produces a lowercase class-scoped key, and fails if another campaign is active. Ending is idempotent only for the literal same request and otherwise conflicts. Students cannot mutate campaign state.

### 8.2 Projection outbox

When an authoritative `QUESTION_ANSWERED`, `ANSWER_RETRIED`, or `EXPERIENCE_COMPLETED` event commits, the learning transaction locks and snapshots the campaign active at event time, then inserts a projection job bound to it. Campaign activation/ending takes the complementary class/campaign lock, so an event cannot drift between campaigns. The event remains committed even if later processing fails.

The API performs one best-effort post-commit drain for responsive local UI. A repository drain method processes pending jobs in a separate transaction and is directly callable in deterministic tests. A failed job retains an allowlisted code and can be retried without changing its campaign binding.

### 8.3 Server outcome mapping

- First-attempt authoritative correct → `ANSWER_CORRECT`.
- Authoritative retry correct with attempt greater than one → `ANSWER_RETRIED`.
- Valid server completion → `EXPERIENCE_COMPLETED`.
- Wrong answers, hint events, openings, forged client damage, and unrecognized event types → no contribution.

The projection reads the stored server event and immutable campaign policy. It never accepts amount or outcome flags from HTTP input. A zero configured amount is a valid no-op. The unique source-event constraint and locked job state make exact replay and concurrent processing idempotent.

### 8.4 Existing package corrections

Before persistence integration, `@lessonquest/gamification` must:

- reject boolean, array, object, nonfinite, and otherwise unsupported HP tuning shapes rather than relying on broad `Number(...)` coercion;
- normalize or reject uppercase UUIDs so campaign keys have one lowercase canonical form.

These are preserved findings from its independent Phase 2 review and are required before the pure package becomes a runtime authority dependency.

## 9. Authorization, privacy, and failure semantics

- Student hint, student boss read, teacher campaign, teacher boss detail, and projection operations repeat current database role/membership/lifecycle checks and collapse unauthorized or cross-tenant identifiers to the safe not-found response.
- Provider input is local and synthetic in Phase 1. No provider boundary reads environment variables or secrets.
- Rasa content is rendered as React text, never HTML.
- Boss and hint APIs are JSON-only, origin-restricted, body-limited, trace-correlated, and schema parsed on both success boundaries.
- Invalid context/step/action/output returns a safe non-retryable 422. Disabled/exhausted hint policy returns conflict. Local provider failure or timeout returns a retryable 503 with no raw cause. Cross-tenant and stale-role access returns safe 404.
- Boss projection failure does not alter the learning-event response. It appears in teacher-only projection health and allowlisted diagnostics without content or student display data.
- `REQUEST_TEACHER_HELP` and all media/navigation actions remain excluded from Phase 1 execution even though the shared general contract recognizes them.

## 10. Audit and observability

Allowlisted M5/M6 actions include:

- `RASA_HINT_REQUESTED`, `RASA_HINT_DELIVERED`, `RASA_HINT_REJECTED`;
- `BOSS_CAMPAIGN_CREATED`, `BOSS_CAMPAIGN_ENDED`, `BOSS_PROJECTION_PROCESSED`;
- `BOSS_PROGRESS_READ` and `BOSS_DETAIL_READ`.

Success audit rows commit with their material state change. Denied/conflicting decisions are recorded after rollback. Exact idempotent replay records `DUPLICATE`. Audit fields contain trace, actor, organization, resource type/ID, action, outcome, and time only.

Diagnostics expose only trace ID, organization/resource UUIDs, safe error/job code, retryability, and duration. Teacher projection health shows pending/failed counts, never raw provider output or internal stack data.

## 11. User experience

### Student Play

- After an unresolved wrong quiz response, a Rasa panel offers “힌트 받기”.
- One accepted hint is displayed at a time with its level; used levels remain visible after reload.
- The button disables during a request, after success, after policy exhaustion, and after assignment expiry/completion.
- A retryable failure offers the same request again; it does not silently consume a level.
- A class boss card shows title, aggregate damage/target, percentage, and completed state only.
- No rank, other student ID, name, contribution row, or blame language appears.

### Teacher evidence and campaign UI

- Assignment creation includes explicit Rasa enablement and maximum hint level.
- The teacher can create/end one class campaign and configure target plus the three action amounts.
- The dashboard combines existing completion/wrong/retry evidence with hint count, per-student contribution detail, aggregate boss progress, and projection health.
- Campaign controls and student detail are absent for student sessions and unauthorized teachers.

Accessibility requires semantic headings/regions, keyboard-reachable controls, visible focus, live status text, reduced-motion compatibility, and status communication that does not rely on color alone.

## 12. Test strategy and acceptance criteria

Production changes follow mutation-sensitive RED before GREEN. Focused tests run during implementation; the full bundle runs once before independent review.

### Contract and pure-unit evidence

- Strict hint/policy/campaign/aggregate/detail/ack schemas reject missing, extra, forged, oversized, and unsafe fields.
- Provider output policy rejects context absence, arbitrary actions, target/level substitution, direct answers, option leakage, URLs/markup, and unbounded content.
- Local provider is deterministic, bounded, zero-network, zero-cost, and returns stable usage.
- Boss rules reject coercive tuning and noncanonical UUIDs; projection maps only authoritative eligible outcomes.

### Repository and API evidence

- Cross-tenant, stale-role, disabled organization/class/member/assignment, expired window, completed attempt, unknown step, no prior wrong answer, and exhausted hint level fail closed.
- Same hint request returns one provider call, one usage row, one action, one set of events, and one sequence advance; changed reuse conflicts.
- Provider timeout/failure/rejection writes safe status/audit but no hint event.
- Concurrent learning/hint operations serialize on the attempt and preserve contiguous sequence.
- Learning event commits when projection fails; retry creates at most one contribution.
- Client damage, changed event replay, cross-class campaign, policy mutation, direct contribution insert/update, and audit update/delete probes fail.
- Student boss output cannot contain individual data; teacher detail remains class/tenant guarded.
- Every success response is parsed at repository/API/client boundaries and every material operation is trace-audited.

### UI and E2E evidence

- Components cover hidden-before-wrong, hint success, rejection, exact retry, exhaustion, reload, student aggregate privacy, teacher campaign controls, and projection health.
- A real Phase 1 E2E covers teacher campaign/policy setup → student start → wrong answer → Rasa hint → retry correct → completion → event persistence → boss contribution → teacher results.
- A second integrated path covers correct-first contribution so the earlier M3/M4 E2E coverage gap is closed.
- The E2E uses React, the real HTTP client, Hono, LocalAuth, repositories, local Rasa provider, gamification projector, and PGlite without a mocked LessonQuest API.

### Completion commands

```text
corepack pnpm check
corepack pnpm test:integration
corepack pnpm test:e2e
corepack pnpm audit --prod
changed-file credential-pattern scan
git diff --check
```

The implementation is not complete until a fresh non-implementing agent inspects the actual diff, reruns relevant checks and adversarial probes, records a score of at least 86/100, and reports no critical blocker.

## 13. Rollback, containment, and provenance

- Work stays on `codex/phase1-m5-m6-complete`; no push, merge, PR, deploy, or external-system mutation is authorized by this design.
- Schema tests use newly initialized local PGlite only. There is no production migration or real-data conversion.
- Rasa remains disabled unless the assignment policy explicitly enables it. Boss contribution remains disabled without an active teacher-created campaign.
- A rollback removes the new UI/routes/repositories/package/tables and restores the prior event acknowledgement contract; existing M1–M4 evidence remains valid because no existing event/content row is rewritten.
- `@lessonquest/gamification` retains the already recorded WordQuest provenance. M6 persistence/orchestration and all M5 Rasa code are original LessonQuest work.
- No Jarvis source is copied: its Windows automation, OAuth, personal memory, and broad execution model conflict with the approved web learning-partner boundary.

## 14. Design acceptance summary

M5 is accepted when an eligible student can receive one context-aware, sequential, answer-safe local hint whose provider usage and safe outcome are durable, while absent/forged/answer-leaking context or output fails closed.

M6 is accepted when a teacher can activate one class campaign, eligible authoritative events contribute under immutable policy, client damage and replay cannot change totals, projection failure cannot roll back learning evidence, students see only class aggregate progress, and the teacher sees protected detail.

Together they complete the documented Phase 1 path from approved science experience through student play, Rasa assistance, authoritative event evidence, class boss contribution, and teacher review without using external AI, Firebase, real data, or existing-deployment mutation.
