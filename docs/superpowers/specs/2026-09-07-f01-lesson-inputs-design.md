# F01 Lesson Input Authoring Design

Date: 2026-09-07
Status: user-approved design, pending implementation plan and mandatory plan review

## Goal and controlling scope

Implement the Version 1 F01 lesson-input flow inside the existing synthetic LessonQuest development preview:

1. A teacher enters a lesson title, target grade, lesson content, and one or more learning objectives.
2. The teacher saves the input under the active organization.
3. The teacher can list their saved inputs, reopen one, edit it, and save a later revision.
4. Missing or invalid fields identify the correction required without losing the teacher's current text.

The user explicitly selected the current synthetic-preview boundary. Records remain available across component unmounts, teacher/student role changes, and return visits while the same preview runtime is alive. A full browser refresh or **data reset** still creates a new in-memory PGlite database, exactly as the preview currently documents. This milestone does not claim operating persistence or invite teachers to enter real school/student data.

F01 is separate from F02. This change does not generate an experience, call an AI model, or feed lesson input into the existing generated-JSON workflow. It prepares a stable source boundary that F02 can consume later.

## Considered approaches

### Selected: dedicated lesson-input resource

Store editable teacher source material independently of immutable generated experience versions. This matches the canonical authoring sequence (`teacher input -> AI draft -> validation -> approval`) and prevents mutable source text from weakening the approved-content lifecycle.

### Rejected: reuse `experiences` and `experience_versions`

The current experience creation route requires a complete, valid science BlockSpec JSON document and immediately creates generated artifacts and hashes. Using those rows for raw source material would couple F01 to F02 and mislabel teacher-authored input as AI-generated content.

### Rejected: browser-only local storage

Local storage would be quick but would bypass the existing authenticated Hono, tenant repository, audit, and PostgreSQL-compatible boundaries. It would not prove the authorization and reopen/edit behavior needed for the later operating implementation.

## Data ownership and contract

`@lessonquest/contracts` owns strict request and response schemas.

An editable lesson input contains:

- `id`: server-generated UUID;
- `organizationId`: route- and authorization-derived UUID;
- `ownerTeacherId`: authenticated server-owned actor UUID;
- `title`: trimmed text, 1-120 characters;
- `gradeBand`: the existing bounded LessonQuest grade-band enum;
- `learningContent`: trimmed plain text, 1-32,768 characters;
- `learningObjectives`: 1-8 trimmed plain-text entries, each 1-300 characters;
- `revision`: positive integer beginning at 1;
- `createdAt` and `updatedAt`: server timestamps.

Create and update requests include a UUID `mutationId`. An update also includes `expectedRevision`. Requests are strict objects and reject organization IDs, owner IDs, revision results, timestamps, unknown fields, file/object payloads, and any other mass-assignment input. Accepted strings are always treated and rendered as plain text, never as executable markup.

Lists return bounded summaries containing only ID, title, grade band, revision, and update time. The detail route returns the full lesson input. Create and update return `{ lessonInput, duplicate }`, parsed by one shared mutation-result schema. A future F02 request will refer to a lesson input and snapshot the selected revision; that behavior is explicitly outside this milestone.

## Persistence and mutation semantics

Add two tenant-scoped tables through the existing synthetic schema initializer:

- `lesson_inputs`: current editable state, organization and owner, fields, revision, timestamps;
- `lesson_input_mutations`: organization-and-actor-scoped mutation ID, actor, operation, canonical input hash, target lesson-input ID, and resulting revision.

Every resource primary key and lookup includes `organization_id`. Foreign keys bind owners and mutation actors to organization membership. Mutation uniqueness is `(organization_id, actor_user_id, mutation_id)` so one teacher cannot collide with or replay another teacher's request. The mutation ledger does not store lesson content or objectives.

Create and update run in one transaction with their audit record. The canonical request hash binds the operation, target ID where applicable, and the complete validated request. Exact replay by the same actor of the same `mutationId` and canonical request hash returns the current authorized resource with `duplicate: true` and does not create another row or increment revision. Reusing a mutation ID with different input fails with conflict. Update locks the row and succeeds only when `expectedRevision` equals the stored revision; stale revisions fail with conflict without changing the record. Authorization is rechecked before any replay result is returned.

No delete, archive, history browser, or content-revision snapshot table is added. F01 requires reopening and editing the current teacher input, while immutable history begins when a later generated experience version snapshots source material.

## Authorization and audit

- Active teachers can create inputs and list/read/update only inputs they own.
- Active `ORG_ADMIN` members can list/read/update inputs in their organization for support and administration.
- Students, disabled users, incompatible platform/organization roles, cross-tenant IDs, and unknown IDs fail closed.
- Existing and inaccessible detail/update IDs use the same public `404` shape.
- Stale revision and conflicting mutation replay use the existing safe `409` envelope.
- Audit rows record trace ID, actor, organization, action, resource type/ID, and outcome only. They never contain lesson titles, learning content, objectives, request bodies, tokens, SQL, or raw exceptions.
- Audit persistence failure rolls back the lesson-input write.

New allowlisted audit actions cover create, list, detail read, and update. Denied and conflicting attributable operations follow the repository's existing post-rollback audit pattern without disclosing resource existence.

## API

Extend the existing authenticated application under the same Origin, JSON body-size, security-header, diagnostic, and error boundaries:

```text
GET  /organizations/:organizationId/lesson-inputs
POST /organizations/:organizationId/lesson-inputs
GET  /organizations/:organizationId/lesson-inputs/:lessonInputId
PUT  /organizations/:organizationId/lesson-inputs/:lessonInputId
```

POST returns `201` for a new row and `200` with `duplicate: true` for an exact replay. PUT returns `200` for both a new successful revision and an exact replay. GET responses set `Cache-Control: no-store`.

The existing application continues to require an injected repository; lesson-input routes are enabled only when that repository capability is present so unrelated focused fixtures do not silently gain partially configured behavior.

## Teacher experience

Add a focused `LessonInputWorkspace` to the top of the teacher Studio surface. It contains:

- a saved-input selector ordered by most recently updated;
- **new lesson input** and **reopen** controls;
- labeled title, grade, lesson-content, and learning-objectives fields;
- objectives entered one per line, with empty lines ignored before strict validation;
- save/create and save-changes actions;
- an accessible live status and actionable validation, authorization, conflict, and retry messages.

On first entry the editor starts empty. Saving adds or updates the list without clearing the text. Reopening obtains authoritative detail from the API. Returning from the student role remounts the component and reloads the saved list from the same runtime database.

The client retains the same mutation ID after an uncertain transport failure so a retry is exact. It creates a new ID only after a confirmed success or a confirmed non-retryable rejection. On stale revision, the current local text remains visible and the teacher is offered an explicit authoritative reload; the UI never silently overwrites local work.

The existing generated science JSON editor, validation, preview, approval, assignment, Rasa, and boss behaviors remain unchanged. F01 input is not presented as generated content and does not automatically populate or alter the JSON editor.

## Error handling

- Empty title/content/objectives and an unselected grade are identified next to or through their labeled controls before submission, with the server contract remaining authoritative.
- Network or unknown-result errors retain all fields and the pending mutation ID and invite exact retry.
- A `404` tells the teacher that access or the saved input is no longer available, without distinguishing the cause.
- A `409` mutation conflict or stale revision retains local text and directs the teacher to reload the authoritative version before deciding how to reapply changes.
- List/detail failure clears no previously entered editor content.
- Diagnostics remain metadata-only under the current allowlist.

## Testing strategy

Implementation follows strict RED/GREEN order.

1. Contract tests reject missing, oversized, duplicate/empty objectives, extra keys, forged ownership/organization/revision values, and malformed mutation IDs; they accept all supported grade bands and Korean multiline content.
2. Repository tests prove create/list/read/update/reopen, deterministic ordering, exact mutation replay, conflicting reuse, stale revision rejection, transaction rollback, active-role enforcement, owner/admin behavior, student denial, generic cross-tenant absence, and content-free audit rows.
3. API tests exercise the real LocalAuth -> Hono -> repository -> fresh PGlite boundary, response status/schema/cache headers, safe errors, body limits, and exact retry.
4. React integration tests exercise empty validation, create, remount/list, reopen, edit, uncertain create/update retry, stale conflict with local-text preservation, and student-role exclusion.
5. Chromium development-preview tests exercise create -> role switch -> teacher return -> reopen -> edit at desktop, tablet, and mobile widths, along with keyboard focus, 44px targets, contrast, no overflow, and reset behavior.
6. Run focused suites, `pnpm check`, integration, scripted E2E, demo browser, development-preview browser, production dependency audit, diff/credential scan, and emitted normal-build containment checks.

The existing 423-test `main` baseline is green in the isolated worktree before this design document.

## Files and boundaries

Expected production areas:

- `packages/contracts/src/lesson-inputs.ts` and contract exports;
- `packages/db/src/schema.ts` and a focused lesson-input repository;
- `services/api` lesson-input route registration;
- `apps/web/src/api-client.ts`, the new teacher component, and narrow Studio/preview composition changes;
- styling only as needed for the new responsive controls.

Tests live beside each affected layer and in the existing browser matrix. Documentation updates include README/current-scope records, source provenance as original LessonQuest code, implementation verification, and mandatory reviews.

No reference repository, Firebase, real school/student record, external AI, external database, credential, paid resource, dependency version, service-worker data policy, existing deployment target, or approved experience lifecycle is changed.

## Rollout and recovery

The schema change is additive and runs only against fresh synthetic PGlite databases in this milestone. No operating migration or data rewrite exists. Local rollback is a reviewed commit revert; preview recovery is the existing **data reset** or full refresh. Delivery uses the existing guarded branch -> exact-head CI -> expected-head `main` merge -> Git-linked Vercel workflow only after the mandatory independent final score exceeds 85 with no critical blocker.

The live verification must use synthetic text and confirm create, return, reopen, and edit without implying full-refresh persistence. Any unavailable CI/deployment credential or unexpected production target is reported rather than bypassed.
