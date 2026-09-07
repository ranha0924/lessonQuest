# F01 Lesson Input Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated synthetic-preview teacher enter, save, list, reopen, and safely revise title, grade, lesson content, and learning objectives without coupling mutable source material to generated experience versions.

**Architecture:** A new strict contract and tenant-owned `LessonInputRepository` expose one editable lesson-input resource through authenticated Hono routes. A focused React workspace consumes those routes above the existing Science Studio while actor-scoped mutation IDs, optimistic revisions, database constraints, and audit rows make retries and conflicts explicit. The feature runs through the existing in-tab PGlite development preview and preserves the documented reset-on-refresh boundary.

**Tech Stack:** TypeScript 6, Zod 4, PGlite/PostgreSQL-compatible SQL, Hono 4, React 19, Vitest/Testing Library, Playwright Chromium, pnpm 11.24.0.

**Spec:** `docs/superpowers/specs/2026-09-07-f01-lesson-inputs-design.md`

## Global Constraints

- F01 input is a separate mutable resource; do not call AI, generate a BlockSpec, or alter approved experience-version immutability.
- Use only synthetic actors and fresh local/in-browser PGlite. Do not access Firebase, real school/student data, an external database, credentials, or paid resources.
- Keep every resource and mutation lookup organization-scoped and recheck active database-backed platform/organization roles before returning data, including exact mutation replays.
- Active teachers see and update only their own lesson inputs; active organization administrators may manage lesson inputs in their organization; students and incompatible/disabled roles fail closed.
- Accept title 1-120 trimmed characters, an existing supported grade band, lesson content 1-32,768 trimmed characters, and 1-8 unique trimmed objectives of 1-300 characters each.
- Treat accepted strings as plain text. Never render teacher text as HTML or place content, objectives, request bodies, tokens, SQL, or raw exceptions in audit/diagnostic records.
- Preserve the current public-preview promise: data survives route/component/role changes in one runtime but full refresh or **data reset** creates a fresh synthetic database.
- Add no dependency or version change. Existing reference repositories and deployments remain read-only.
- Observe RED before production edits for every task. A failed mandatory final review blocks merge and delivery regardless of implementer tests.

## File map

| Path                                                        | Responsibility                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/lesson-inputs.ts`                   | Strict public lesson-input requests, resources, summaries, mutation result, and inferred types    |
| `packages/contracts/test/lesson-inputs.test.ts`             | Contract bounds, normalization, mass-assignment, and response parsing                             |
| `packages/contracts/src/index.ts`                           | Public contract export                                                                            |
| `packages/db/src/lesson-input-repository.ts`                | Tenant authorization, CRUD subset, exact mutation replay, optimistic revision, and audit behavior |
| `packages/db/test/lesson-input-fixture.ts`                  | Fresh synthetic PGlite actors, organizations, and repository fixture                              |
| `packages/db/test/lesson-input-repository.test.ts`          | Repository correctness, isolation, retries, conflicts, rollback, and audit evidence               |
| `packages/db/src/schema.ts`                                 | Additive synthetic tables, indexes, constraints, and audit allowlists                             |
| `packages/db/src/index.ts`                                  | Repository export                                                                                 |
| `services/api/src/lesson-input-routes.ts`                   | Authenticated list/create/detail/update route adapter and no-store responses                      |
| `services/api/test/lesson-inputs.test.ts`                   | Real LocalAuth -> Hono -> repository -> PGlite boundary tests                                     |
| `services/api/src/app.ts`                                   | Optional repository injection, route registration, PUT CORS, safe lesson-input diagnostics        |
| `apps/web/src/api-client.ts`                                | Parsed lesson-input client interface and HTTP methods                                             |
| `apps/web/src/components/lesson-input-workspace.tsx`        | Teacher editor, saved-input list, exact retry, reopen, update, and conflict recovery UX           |
| `apps/web/src/components/studio-workbench.tsx`              | Compose F01 workspace above the existing F02+ development controls                                |
| `apps/web/src/dev-preview/runtime.ts`                       | Inject the lesson-input repository into the in-tab service                                        |
| `apps/web/src/lesson-inputs.css`                            | Responsive, accessible F01 layout only                                                            |
| `apps/web/test/lesson-input-workspace.test.tsx`             | Focused component validation/error/retry/conflict tests                                           |
| `apps/web/test/lesson-inputs-e2e.test.tsx`                  | React -> HTTP -> Hono -> PGlite save/reopen/revise flow                                           |
| `tests/browser/service-preview.spec.ts`                     | Three-viewport real preview flow and reset/accessibility regression                               |
| `package.json`                                              | Add the new DB/API/UI files to integration/E2E verification commands                              |
| `README.md`, `docs/SOURCE_PROVENANCE.md`                    | Shipped scope, limitations, and original-code provenance                                          |
| `docs/reviews/2026-09-07-f01-lesson-inputs-verification.md` | RED/GREEN and complete implementer evidence                                                       |

---

### Task 1: Define strict F01 contracts

**Files:**

- Create: `packages/contracts/src/lesson-inputs.ts`
- Create: `packages/contracts/test/lesson-inputs.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Consumes: `uuidSchema` from `primitives.ts` and `supportedGradeBandSchema` from `science.ts`.
- Produces: `lessonInputFieldsSchema`, `createLessonInputInputSchema`, `updateLessonInputInputSchema`, `lessonInputSchema`, `lessonInputSummarySchema`, `lessonInputListSchema`, `lessonInputMutationResultSchema`, and inferred `CreateLessonInputInput`, `UpdateLessonInputInput`, `LessonInput`, `LessonInputSummary`, `LessonInputMutationResult`.

- [ ] **Step 1: Write the contract RED tests**

Create tests with fixed UUIDs and literal expected normalized output:

```ts
const mutationId = '018f72a4-cc52-7c5a-a6f9-8b21aa270101';
const validCreate = {
  mutationId,
  title: '  힘과 운동 수업  ',
  gradeBand: 'middle1',
  learningContent: '  같은 힘을 가할 때 질량에 따른 운동 변화를 비교한다.  ',
  learningObjectives: [' 힘과 질량의 관계를 설명한다. ', ' 실험 결과를 근거로 예측한다. '],
};

expect(createLessonInputInputSchema.parse(validCreate)).toEqual({
  mutationId,
  title: '힘과 운동 수업',
  gradeBand: 'middle1',
  learningContent: '같은 힘을 가할 때 질량에 따른 운동 변화를 비교한다.',
  learningObjectives: ['힘과 질량의 관계를 설명한다.', '실험 결과를 근거로 예측한다.'],
});
```

Add explicit failures for an empty/oversized title, empty/32,769-character content, zero/nine objectives, empty/301-character/duplicate normalized objectives, invalid grade, invalid mutation ID, nonpositive `expectedRevision`, and every forged key in `organizationId`, `ownerTeacherId`, `revision`, `createdAt`, `updatedAt`, and `extra`. Parse one complete mutation-result fixture and require unknown response keys to fail.

- [ ] **Step 2: Run the contract test and record RED**

Run: `corepack pnpm deps:build && corepack pnpm exec vitest run packages/contracts/test/lesson-inputs.test.ts`

Expected: FAIL because `@lessonquest/contracts` does not export the lesson-input schemas.

- [ ] **Step 3: Implement the exact schemas and types**

Use these public shapes:

```ts
const lessonTitleSchema = z.string().trim().min(1).max(120);
const lessonContentSchema = z.string().trim().min(1).max(32_768);
const learningObjectiveSchema = z.string().trim().min(1).max(300);

export const lessonInputFieldsSchema = z.strictObject({
  title: lessonTitleSchema,
  gradeBand: supportedGradeBandSchema,
  learningContent: lessonContentSchema,
  learningObjectives: z
    .array(learningObjectiveSchema)
    .min(1)
    .max(8)
    .refine((items) => new Set(items).size === items.length, 'Learning objectives must be unique'),
});

export const createLessonInputInputSchema = z.strictObject({
  mutationId: uuidSchema,
  ...lessonInputFieldsSchema.shape,
});

export const updateLessonInputInputSchema = z.strictObject({
  mutationId: uuidSchema,
  expectedRevision: z.int().positive().max(1_000_000),
  ...lessonInputFieldsSchema.shape,
});

export const lessonInputSchema = z.strictObject({
  id: uuidSchema,
  organizationId: uuidSchema,
  ownerTeacherId: uuidSchema,
  ...lessonInputFieldsSchema.shape,
  revision: z.int().positive().max(1_000_000),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const lessonInputSummarySchema = lessonInputSchema.pick({
  id: true,
  title: true,
  gradeBand: true,
  revision: true,
  updatedAt: true,
});
export const lessonInputListSchema = z.array(lessonInputSummarySchema).max(1_000);
export const lessonInputMutationResultSchema = z.strictObject({
  lessonInput: lessonInputSchema,
  duplicate: z.boolean(),
});
```

Export the module from `packages/contracts/src/index.ts`. Infer all public types from their schemas; do not duplicate manual interfaces.

- [ ] **Step 4: Run focused contracts and full contract package tests**

Run: `corepack pnpm exec vitest run packages/contracts/test/lesson-inputs.test.ts packages/contracts/test/science.test.ts packages/contracts/test/learning.test.ts`

Expected: PASS with no skipped cases.

- [ ] **Step 5: Commit the contract slice**

```bash
git add packages/contracts/src/index.ts packages/contracts/src/lesson-inputs.ts packages/contracts/test/lesson-inputs.test.ts
git commit -m "feat: define F01 lesson input contracts"
```

---

### Task 2: Add tenant-safe lesson-input persistence

**Files:**

- Create: `packages/db/src/lesson-input-repository.ts`
- Create: `packages/db/test/lesson-input-fixture.ts`
- Create: `packages/db/test/lesson-input-repository.test.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**

- Consumes: Task 1 schemas/types, `Actor`, `actorSchema`, `uuidSchema`, PGlite `Transaction`, and existing `ResourceNotFoundError`/`ConflictError`.
- Produces:

```ts
export class LessonInputRepository {
  constructor(database: PGliteInterface, options?: { now?: () => Date });
  create(
    actor: Actor,
    organizationId: string,
    input: CreateLessonInputInput,
    traceId?: string,
  ): Promise<LessonInputMutationResult>;
  list(actor: Actor, organizationId: string, traceId?: string): Promise<LessonInputSummary[]>;
  get(
    actor: Actor,
    organizationId: string,
    lessonInputId: string,
    traceId?: string,
  ): Promise<LessonInput>;
  update(
    actor: Actor,
    organizationId: string,
    lessonInputId: string,
    input: UpdateLessonInputInput,
    traceId?: string,
  ): Promise<LessonInputMutationResult>;
}
```

- [ ] **Step 1: Write repository RED tests using a fresh synthetic fixture**

Create `createLessonInputFixture()` with a fresh `PGlite`, `initializeSchema`, `TenantRepository`, one teacher owner, one second teacher, one `SUPER_ADMIN` with `ORG_ADMIN` membership, one student, two organizations, and fixed `now()`.

Add concrete tests that prove:

```ts
const first = await fixture.inputs.create(fixture.teacher, fixture.organization.id, validCreate);
expect(first).toMatchObject({
  duplicate: false,
  lessonInput: { title: '힘과 운동 수업', revision: 1, ownerTeacherId: fixture.teacher.userId },
});
expect(await fixture.inputs.list(fixture.teacher, fixture.organization.id)).toEqual([
  {
    id: first.lessonInput.id,
    title: '힘과 운동 수업',
    gradeBand: 'middle1',
    revision: 1,
    updatedAt: first.lessonInput.updatedAt,
  },
]);
expect(
  await fixture.inputs.get(fixture.teacher, fixture.organization.id, first.lessonInput.id),
).toEqual(first.lessonInput);
```

Also prove newest-update-first then title/ID ordering, exact create replay returns `duplicate: true` and one row, update increments once, exact update replay does not increment, cross-operation or changed-payload mutation reuse conflicts, stale update changes nothing, second teacher gets generic not-found and cannot see owner rows, admin can list/read/update, students/disabled/incompatible roles fail closed, cross-tenant and nonexistent UUIDs are indistinguishable, audit rows contain only allowlisted metadata, and an audit trigger failure rolls back create/update and mutation rows.

- [ ] **Step 2: Run the repository test and record RED**

Run: `corepack pnpm deps:build && corepack pnpm exec vitest run packages/db/test/lesson-input-repository.test.ts`

Expected: FAIL because the schema tables and `LessonInputRepository` do not exist.

- [ ] **Step 3: Add exact additive database objects**

Insert before `audit_logs` so foreign keys resolve during fresh initialization:

```sql
CREATE TABLE IF NOT EXISTS lesson_inputs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  owner_teacher_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  grade_band TEXT NOT NULL CHECK (grade_band IN (
    'elementary1','elementary2','elementary3','elementary4','elementary5','elementary6',
    'middle1','middle2','middle3','high1','high2','high3'
  )),
  learning_content TEXT NOT NULL CHECK (char_length(btrim(learning_content)) BETWEEN 1 AND 32768),
  learning_objectives JSONB NOT NULL CHECK (
    jsonb_typeof(learning_objectives) = 'array'
    AND jsonb_array_length(learning_objectives) BETWEEN 1 AND 8
  ),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 1000000),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, owner_teacher_id)
    REFERENCES organization_members(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS lesson_input_mutations (
  organization_id UUID NOT NULL,
  actor_user_id UUID NOT NULL,
  mutation_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'UPDATE')),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^sha256:[0-9a-f]{64}$'),
  lesson_input_id UUID NOT NULL,
  result_revision INTEGER NOT NULL CHECK (result_revision BETWEEN 1 AND 1000000),
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (organization_id, actor_user_id, mutation_id),
  FOREIGN KEY (organization_id, actor_user_id)
    REFERENCES organization_members(organization_id, user_id),
  FOREIGN KEY (organization_id, lesson_input_id)
    REFERENCES lesson_inputs(organization_id, id)
);
```

Add `LESSON_INPUT_CREATE`, `LESSON_INPUT_CREATED`, `LESSON_INPUT_LIST`, `LESSON_INPUT_READ`, `LESSON_INPUT_UPDATE`, and `LESSON_INPUT_UPDATED` to the audit action constraint; add `LESSON_INPUT` to resource types. Add indexes on `(organization_id, owner_teacher_id, updated_at DESC, id)` and `(organization_id, updated_at DESC, id)`.

- [ ] **Step 4: Implement mapping, authorization, hashing, audit, and transaction methods**

Use a constructed stable hash input rather than caller object enumeration order:

```ts
function requestHash(
  operation: 'CREATE' | 'UPDATE',
  lessonInputId: string | null,
  input: CreateLessonInputInput | UpdateLessonInputInput,
): string {
  const payload = JSON.stringify([
    operation,
    lessonInputId,
    input.mutationId,
    'expectedRevision' in input ? input.expectedRevision : null,
    input.title,
    input.gradeBand,
    input.learningContent,
    input.learningObjectives,
  ]);
  return contentHashSchema.parse(
    `sha256:${createHash('sha256').update(payload, 'utf8').digest('hex')}`,
  );
}
```

Every method must parse actor/UUID/input first, join active `organizations`, `organization_members`, and `users`, enforce platform-role compatibility, and apply `(owner_teacher_id = actor OR membership.role = 'ORG_ADMIN')` for existing resources. In create/update, check the actor-scoped mutation row after authorization, compare operation/hash/target, and return the currently authorized mapped row only on an exact match. Lock updates with `FOR UPDATE`; update with `WHERE revision = expectedRevision`, set `revision = revision + 1`, and use the injected server time. Write mutation and success audit rows before transaction commit. Use post-rollback metadata-only `DENIED`/`CONFLICT` audit writes and preserve original safe repository errors.

- [ ] **Step 5: Run focused persistence tests and adjacent tenant regressions**

Run: `corepack pnpm exec vitest run packages/db/test/lesson-input-repository.test.ts packages/db/test/tenant-repository.test.ts packages/db/test/learning-repository.test.ts packages/db/test/classroom-repository.test.ts`

Expected: PASS with all create/replay/update/tenant/audit assertions.

- [ ] **Step 6: Commit the persistence slice**

```bash
git add packages/db/src/index.ts packages/db/src/schema.ts packages/db/src/lesson-input-repository.ts packages/db/test/lesson-input-fixture.ts packages/db/test/lesson-input-repository.test.ts
git commit -m "feat: persist tenant-scoped lesson inputs"
```

---

### Task 3: Expose authenticated F01 HTTP routes

**Execution clarification (2026-09-07):** With default configuration, use a 256 KiB body limit only for the four F01 collection/detail paths so all contract-valid text, including 32,768 Korean characters and JSON-escaped text, fits the transport. Retain the existing 64 KiB default on every other route. An explicitly supplied `maxBodyBytes` remains authoritative for all routes. Keep the existing 1 MiB configuration ceiling, Origin/auth/media-type/error boundaries, and rejection of oversized streamed or declared bodies. Add tests accepting maximum valid Korean and escaped-text payloads, rejecting F01 bodies beyond 256 KiB, preserving the 64 KiB cap elsewhere, and honoring an explicit smaller cap. The gate evidence is in `docs/reviews/2026-09-07-f01-lesson-inputs-plan-amendment-review.md`.

**Files:**

- Create: `services/api/src/lesson-input-routes.ts`
- Create: `services/api/test/lesson-inputs.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `LessonInputRepository`, Task 1 input/response schemas, existing `readJson`, `parseRouteUuid`, actor/trace context, and API error mapping.
- Produces four routes from the design and optional `lessonInputRepository?: LessonInputRepository` in `CreateAppOptions`.

- [ ] **Step 1: Write API RED tests through real Hono and PGlite**

Build `createApp` with the lesson-input fixture's `TenantRepository`, `LearningRepository`, `LessonInputRepository`, `LocalAuthProvider`, exact trusted origin, and diagnostics collector. Assert:

```ts
const created = await request(
  'POST',
  `/organizations/${org}/lesson-inputs`,
  validCreate,
  teacherToken,
);
expect(created.status).toBe(201);
expect(created.headers.get('x-trace-id')).toMatch(UUID_PATTERN);
expect(lessonInputMutationResultSchema.parse(await created.json())).toMatchObject({
  duplicate: false,
});

const replay = await request(
  'POST',
  `/organizations/${org}/lesson-inputs`,
  validCreate,
  teacherToken,
);
expect(replay.status).toBe(200);
expect(lessonInputMutationResultSchema.parse(await replay.json())).toMatchObject({
  duplicate: true,
});
```

Add list/detail `Cache-Control: no-store`, successful PUT update/replay, malformed route/input `400/404`, stale/mutation conflict `409`, missing/wrong media type `415`, oversized body `413`, missing/malformed/unknown auth `401`, student/cross-tenant/other-teacher generic `404`, wrong Origin `403`, and OPTIONS allowing PUT only for the trusted origin. Require safe error envelopes and diagnostics to contain no submitted title/content/objectives.

- [ ] **Step 2: Run the API test and record RED**

Run: `corepack pnpm deps:build && corepack pnpm exec vitest run services/api/test/lesson-inputs.test.ts`

Expected: FAIL because lesson-input routes and repository injection are absent.

- [ ] **Step 3: Implement the focused route module**

Register exact handlers:

```ts
app.get('/organizations/:organizationId/lesson-inputs', listHandler);
app.post('/organizations/:organizationId/lesson-inputs', createHandler);
app.get('/organizations/:organizationId/lesson-inputs/:lessonInputId', detailHandler);
app.put('/organizations/:organizationId/lesson-inputs/:lessonInputId', updateHandler);
```

Each handler parses the route UUID, uses `context.get('actor')` and `context.get('traceId')`, parses request/response contracts, and never accepts identity or tenant scope from JSON. Set `Cache-Control: no-store` on every lesson-input response. Return create status `201` when `duplicate === false` and `200` when true; update always returns `200`.

- [ ] **Step 4: Wire shared HTTP security and diagnostics**

Add `lessonInputRepository` to `CreateAppOptions`, register routes only when supplied, and change the CORS allowlist to `['GET', 'POST', 'PUT', 'OPTIONS']`. Extend `diagnosticResourceIds` so `/organizations/:organizationId/lesson-inputs/:lessonInputId` reports the validated lesson-input UUID as `resourceId` while existing class diagnostics remain unchanged. Do not parse or record content.

- [ ] **Step 5: Add focused tests to root verification scripts and run API regressions**

Add `packages/db/test/lesson-input-repository.test.ts` and `services/api/test/lesson-inputs.test.ts` to `test:integration`; later Task 5 adds the React test to `test:e2e`.

Run: `corepack pnpm exec vitest run services/api/test/lesson-inputs.test.ts services/api/test/app.test.ts services/api/test/classrooms.test.ts services/api/test/m3-m4.test.ts`

Expected: PASS, including existing auth/Origin/body/diagnostic behavior.

- [ ] **Step 6: Commit the API slice**

```bash
git add package.json services/api/src/app.ts services/api/src/lesson-input-routes.ts services/api/test/lesson-inputs.test.ts
git commit -m "feat: expose authenticated lesson input API"
```

---

### Task 4: Build the teacher lesson-input workspace

**Files:**

- Create: `apps/web/src/components/lesson-input-workspace.tsx`
- Create: `apps/web/src/lesson-inputs.css`
- Create: `apps/web/test/lesson-input-workspace.test.tsx`
- Modify: `apps/web/src/api-client.ts`

**Interfaces:**

- Consumes: Task 1 request/response types and schemas plus `LessonQuestApiError`.
- Produces these client methods and component:

```ts
export interface LessonInputApi {
  listLessonInputs(organizationId: string): Promise<LessonInputSummary[]>;
  createLessonInput(
    organizationId: string,
    input: CreateLessonInputInput,
  ): Promise<LessonInputMutationResult>;
  getLessonInput(organizationId: string, lessonInputId: string): Promise<LessonInput>;
  updateLessonInput(
    organizationId: string,
    lessonInputId: string,
    input: UpdateLessonInputInput,
  ): Promise<LessonInputMutationResult>;
}

export function LessonInputWorkspace(props: {
  api: LessonInputApi;
  organizationId: string;
}): JSX.Element;
```

- [ ] **Step 1: Write component and client RED tests**

Use one controllable fake API to prove the initial list load, labeled empty fields, required validation, create, list selection, authoritative reopen, update, and `revision` display. Capture create/update inputs and assert objectives become trimmed nonempty lines in order.

Add lost-response cases where the fake commits then throws a retryable `LessonQuestApiError(503, 'INTERNAL_ERROR', message, true)`. Pressing save again must send the identical mutation ID and fields. Add a `409 RESOURCE_CONFLICT` case that preserves every local field, displays an explicit conflict message, and enables **서버 저장본 다시 불러오기**; only that button replaces local text. A list/detail failure must not clear editor text. A confirmed `400` must release the mutation ID so corrected input uses a new UUID.

- [ ] **Step 2: Run the component test and record RED**

Run: `corepack pnpm deps:build && corepack pnpm exec vitest run apps/web/test/lesson-input-workspace.test.tsx apps/web/test/api-client.test.ts`

Expected: FAIL because `LessonInputApi` and `LessonInputWorkspace` do not exist.

- [ ] **Step 3: Add parsed HTTP client methods**

Extend the returned API object with:

```ts
listLessonInputs: (organizationId) =>
  request(`/organizations/${organizationId}/lesson-inputs`, lessonInputListSchema),
createLessonInput: (organizationId, input) =>
  request(`/organizations/${organizationId}/lesson-inputs`, lessonInputMutationResultSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
getLessonInput: (organizationId, lessonInputId) =>
  request(`/organizations/${organizationId}/lesson-inputs/${lessonInputId}`, lessonInputSchema),
updateLessonInput: (organizationId, lessonInputId, input) =>
  request(`/organizations/${organizationId}/lesson-inputs/${lessonInputId}`, lessonInputMutationResultSchema, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
```

Parse all successful server values; preserve existing safe error parsing.

- [ ] **Step 4: Implement the focused controlled component**

Keep separate state for list, selected ID, loaded resource/revision, each input field, pending mutation ID, busy state, error/status text, and conflict reload availability. Generate `crypto.randomUUID()` once per logical create/update and retain it through unknown/retryable outcomes. Clear it only after success, a confirmed non-retryable non-conflict failure, or a successful explicit authoritative reload after conflict; that reload starts the next edit as a new logical mutation. Use `createLessonInputInputSchema.safeParse` or equivalent exact field checks before calling the API, while leaving server validation authoritative.

Render these exact accessible controls: **저장된 수업 자료**, **새 수업 자료**, **수업 자료 다시 열기**, **수업 제목**, **대상 학년**, **학습 내용**, **학습목표 (한 줄에 하나)**, **수업 자료 저장**/**수정 내용 저장**, and **서버 저장본 다시 불러오기**. Disable only operations that would race, never clear text on failure, and use `role="status"`/`role="alert"` for messages.

- [ ] **Step 5: Add scoped responsive styles and run focused web tests**

Use `.lesson-input-workspace` descendants only. Provide a two-column library/editor layout above 900px, one column below 900px, `min-width: 0`, wrapping text, and minimum 44px controls. Preserve existing global theme tokens and reduced-motion behavior.

Run: `corepack pnpm exec vitest run apps/web/test/lesson-input-workspace.test.tsx apps/web/test/api-client.test.ts apps/web/test/app.test.tsx`

Expected: PASS with no React act warnings or skipped cases.

- [ ] **Step 6: Commit the teacher workspace slice**

```bash
git add apps/web/src/api-client.ts apps/web/src/components/lesson-input-workspace.tsx apps/web/src/lesson-inputs.css apps/web/test/lesson-input-workspace.test.tsx
git commit -m "feat(web): add F01 lesson input workspace"
```

---

### Task 5: Connect F01 through the real preview boundary

**Files:**

- Create: `apps/web/test/lesson-inputs-e2e.test.tsx`
- Modify: `apps/web/src/components/studio-workbench.tsx`
- Modify: `apps/web/src/dev-preview/runtime.ts`
- Modify: `apps/web/test/phase1-flow.test.tsx`
- Modify: `package.json`

**Interfaces:**

- Consumes: `LessonInputWorkspace`, `LessonInputRepository`, and the Task 3/4 API capability.
- Produces: real teacher React -> HTTP client -> Hono -> repository -> PGlite create/reopen/update behavior in the same synthetic runtime.

- [ ] **Step 1: Write the end-to-end RED test**

Create a fresh fixture with real auth/app/repositories and render `StudioWorkbench`. Fill all F01 controls, save, unmount, render again, select the saved summary, reopen it, modify content/objectives, save revision 2, and verify the database plus a third render returns revision 2. Assert existing **생성된 과학 JSON**, validation, approval, and assignment controls remain unchanged.

Add one student-token render/request probe proving all four F01 routes fail and no lesson title/content appears. Add a transport that commits create/update then throws once; the React retry must yield exactly one row and one revision increment.

- [ ] **Step 2: Run the E2E test and record RED**

Run: `corepack pnpm deps:build && corepack pnpm exec vitest run apps/web/test/lesson-inputs-e2e.test.tsx`

Expected: FAIL because Studio and preview runtime do not compose the new capability.

- [ ] **Step 3: Compose the teacher UI and preview repository**

Render `<LessonInputWorkspace api={api} organizationId={organizationId} />` after the Studio header and before the existing generated-content trail. Instantiate one `LessonInputRepository(database)` in `createPreviewRuntime()` and pass it to `createApp` as `lessonInputRepository`. Do not seed lesson inputs or change sample generated JSON, role tokens, offline queue, close/reset ownership, or database persistence mode.

Update existing Studio test fixtures only where the expanded `LessonQuestApi` type requires explicit lesson-input methods; prefer narrowing `StudioWorkbenchProps.api` to the exact intersection it consumes so unrelated test doubles do not acquire unused stubs.

- [ ] **Step 4: Add the real React test to scripted E2E and run adjacent flows**

Add `apps/web/test/lesson-inputs-e2e.test.tsx` to `test:e2e`.

Run: `corepack pnpm exec vitest run apps/web/test/lesson-inputs-e2e.test.tsx apps/web/test/phase1-flow.test.tsx apps/web/test/phase1-recovery.test.tsx apps/web/test/classrooms-e2e.test.tsx`

Expected: PASS; the existing generated science flow remains green.

- [ ] **Step 5: Commit the connected vertical slice**

```bash
git add package.json apps/web/src/components/studio-workbench.tsx apps/web/src/dev-preview/runtime.ts apps/web/test/lesson-inputs-e2e.test.tsx apps/web/test/phase1-flow.test.tsx
git commit -m "feat: connect F01 lesson inputs end to end"
```

---

### Task 6: Prove browser behavior and document the delivered boundary

**Files:**

- Modify: `tests/browser/service-preview.spec.ts`
- Modify: `README.md`
- Modify: `docs/SOURCE_PROVENANCE.md`
- Create: `docs/reviews/2026-09-07-f01-lesson-inputs-verification.md`

**Interfaces:**

- Consumes: complete Tasks 1-5 behavior and existing three-project preview Playwright configuration.
- Produces: durable desktop/tablet/mobile proof and implementation evidence for independent review.

- [ ] **Step 1: Write the browser RED test before preview production wiring is considered complete**

Add one Playwright test, automatically executed by desktop/tablet/mobile projects:

```ts
test('teacher saves, returns, reopens and revises one F01 lesson input', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByLabel('수업 제목').fill('합성 힘과 운동 수업');
  await page.getByLabel('대상 학년').selectOption('middle1');
  await page.getByLabel('학습 내용').fill('합성 자료로 힘과 질량의 관계를 비교한다.');
  await page
    .getByLabel('학습목표 (한 줄에 하나)')
    .fill('힘과 질량의 관계를 설명한다.\n관찰 결과를 근거로 예측한다.');
  await page.getByRole('button', { name: '수업 자료 저장' }).click();
  await expect(page.getByText('수업 자료를 저장했습니다.')).toBeVisible();
  await page.getByRole('button', { name: '학생 화면' }).click();
  await page.getByRole('button', { name: '교사 화면' }).click();
  await page.getByLabel('저장된 수업 자료').selectOption({ label: /합성 힘과 운동 수업/ });
  await page.getByRole('button', { name: '수업 자료 다시 열기' }).click();
  await expect(page.getByLabel('학습 내용')).toHaveValue(/합성 자료/);
  await page.getByLabel('학습 내용').fill('수정한 합성 자료로 운동 변화를 비교한다.');
  await page.getByRole('button', { name: '수정 내용 저장' }).click();
  await expect(page.getByText('수정 내용을 저장했습니다.')).toBeVisible();
});
```

Continue by clicking **데이터 초기화**, wait for `ready(page)`, and require the saved selector to be empty. Require no horizontal overflow. The existing full-page accessibility-state test must include the new controls and continue enforcing minimum 44px target size, contrast at least 4.5, keyboard focus, and reduced motion.

- [ ] **Step 2: Run the new browser case against the pre-final build and record RED if any wiring/style is missing**

Run:

```bash
corepack pnpm deps:build
VITE_DEMO_MODE=false VITE_DEV_PREVIEW=false corepack pnpm --filter @lessonquest/web build --outDir dist-normal-check --base /normal-build/
VITE_DEMO_MODE=false VITE_DEV_PREVIEW=true corepack pnpm --filter @lessonquest/web build --outDir dist-preview
corepack pnpm exec playwright test --config playwright.preview.config.ts --grep "teacher saves, returns, reopens"
```

Expected before final corrections: FAIL at the first missing route, control, runtime injection, reset assertion, or geometry condition; record the exact product failure rather than weakening selectors.

- [ ] **Step 3: Make only browser-discovered accessibility/layout corrections**

Edit `lesson-inputs.css` or labeled component markup only for reproduced failures. Do not change global theme, existing learning behavior, test thresholds, viewport sizes, or reset semantics.

- [ ] **Step 4: Update scope and provenance documentation**

README must state F01 fields/save/list/reopen/revise are available only in the synthetic in-tab preview; external AI and full-refresh persistence remain absent. Add an original LessonQuest-code provenance row for the F01 contract/repository/API/UI/tests with no copied source. Create the verification record with baseline, every genuine RED, focused GREEN commands/counts, changed-file manifest hash, audit/diff results, known limitations, and no claim of independent acceptance or deployment.

- [ ] **Step 5: Run focused browser and formatting checks**

Run:

```bash
corepack pnpm deps:build
VITE_DEMO_MODE=false VITE_DEV_PREVIEW=false corepack pnpm --filter @lessonquest/web build --outDir dist-normal-check --base /normal-build/
VITE_DEMO_MODE=false VITE_DEV_PREVIEW=true corepack pnpm --filter @lessonquest/web build --outDir dist-preview
corepack pnpm exec playwright test --config playwright.preview.config.ts --grep "teacher saves, returns, reopens"
corepack pnpm exec prettier --check packages/contracts/src/lesson-inputs.ts packages/db/src/lesson-input-repository.ts services/api/src/lesson-input-routes.ts apps/web/src/components/lesson-input-workspace.tsx apps/web/src/lesson-inputs.css tests/browser/service-preview.spec.ts README.md docs/SOURCE_PROVENANCE.md docs/reviews/2026-09-07-f01-lesson-inputs-verification.md
git diff --check main...HEAD
```

Expected: three Playwright project cases pass and formatting/diff checks exit 0.

- [ ] **Step 6: Commit browser evidence and documentation**

```bash
git add tests/browser/service-preview.spec.ts README.md docs/SOURCE_PROVENANCE.md docs/reviews/2026-09-07-f01-lesson-inputs-verification.md
git commit -m "test: verify F01 lesson input workflow"
```

---

### Task 7: Complete implementer verification and freeze the candidate

**Files:**

- Modify: `docs/reviews/2026-09-07-f01-lesson-inputs-verification.md`
- Modify: this plan only to check completed boxes and record observed counts/hashes

**Interfaces:**

- Consumes: the complete F01 candidate.
- Produces: reproducible verification evidence and an immutable implementation/test manifest for a different reviewer.

- [ ] **Step 1: Run the complete sequential verification matrix**

Run sequentially to avoid PGlite resource contention:

```bash
corepack pnpm check
corepack pnpm test:integration
corepack pnpm test:e2e
corepack pnpm test:browser
corepack pnpm test:preview
corepack pnpm audit --prod --audit-level high
git diff --check main...HEAD
```

Every command must exit 0. Do not count a concurrent timeout as product evidence; rerun sequentially and preserve both facts if that occurs.

- [ ] **Step 2: Check boundary containment and credentials**

Build normal/demo/preview outputs through the commands above. Confirm the normal build contains no `dev_` bearer values, synthetic actor UUIDs, PGlite runtime module, or preview sample data. Scan changed files for private-key blocks, cloud tokens, Authorization literals, Firebase configuration, and real-looking student data. Confirm `package.json`/`pnpm-lock.yaml` contain no dependency version change.

- [ ] **Step 3: Freeze and record the reviewed candidate**

Create a sorted manifest of all implementation, test, script, and configuration files changed from `main`, with each file's SHA-256 and a manifest SHA-256. Exclude review/verification prose from the runtime manifest but list it separately. Record exact command counts, output paths, commit SHAs, and manifest hash in the verification document.

- [ ] **Step 4: Commit final implementer evidence**

```bash
git add docs/superpowers/plans/2026-09-07-f01-lesson-inputs.md docs/reviews/2026-09-07-f01-lesson-inputs-verification.md
git commit -m "docs: record F01 implementation verification"
```

---

### Task 8: Obtain independent final validation and deliver

**Files:**

- Create by independent non-implementing agent: `docs/reviews/2026-09-07-f01-lesson-inputs-final-review.md`
- Modify after delivery: PR body/status evidence only; do not rewrite the accepted runtime candidate

**Interfaces:**

- Consumes: approved spec/plan/plan review, complete `main...HEAD` diff, implementer logs, and frozen manifest.
- Produces: mandatory independent score and, only after PASS >85/no blocker, guarded GitHub/Vercel delivery.

- [ ] **Step 1: Assign a fresh independent reviewer**

The reviewer did not implement Tasks 1-7. They must read `AGENTS.md`, canon, spec, plan, plan review, rubric, verification record, and complete diff; match the frozen hashes; run focused lesson-input tests, `pnpm check`, integration/E2E, both Chromium suites, audit, diff, credential/containment/adversarial tenant/replay probes; then write concrete findings and a 100-point score to the final-review path.

- [ ] **Step 2: Enforce the final gate**

Accept only **86/100 or higher** with no critical blocker. A score of 85 or lower, tenant/auth leak, unsafe retry, lost teacher text, mutable approved content, unverified acceptance criterion, or failing mandatory check requires a new remediation plan if scope changes, test-first fixes, a fresh manifest, and a different independent review. Do not merge or deploy a failing candidate.

- [ ] **Step 3: Deliver the exact accepted candidate**

After PASS, push `codex/f01-lesson-inputs`, open a PR to the then-current `main`, require exact-head CI, verify `main` did not move unexpectedly, and merge only the reviewed head with expected-head protection. If `main` has received the separate identity C1 hardening change, rebase/merge and rerun affected verification plus independent review before delivery; never silently drop or duplicate it.

- [ ] **Step 4: Verify main and the existing Git-linked Vercel deployment**

Confirm the remote merged SHA, required main CI, and Vercel deployment status/SHA. Open the live URL with synthetic content and verify save -> student-role switch -> teacher return -> reopen -> edit plus reset clearing. Confirm the page still warns against real data and does not claim full-refresh persistence or external AI. Do not create a duplicate manual deployment.

- [ ] **Step 5: Record immutable delivery evidence and report completion**

Record PR number/URL, reviewed head SHA, merge SHA, CI run/status, deployment ID/status/SHA/live URL, and live synthetic interaction in the PR body or an authorized delivery record. Report F01 complete only within the user-approved synthetic-preview boundary and list external AI/operating persistence as later milestones.
