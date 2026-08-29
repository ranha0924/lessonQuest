# Phase 1 Identity and Tenancy Implementation Plan

> Execute with `superpowers:executing-plans` and `superpowers:test-driven-development`. Final acceptance requires an independent non-implementing agent review.

**Goal:** Provide a synthetic local authentication boundary and a tenant-safe vertical slice in which a teacher creates an organization and class, enrolls a test student, and cross-tenant or role-escalation attempts fail closed and are auditable.

**Architecture:** `@lessonquest/contracts` owns strict public inputs. `@lessonquest/auth` resolves opaque development bearer tokens to server-owned actors and cannot initialize in production. `@lessonquest/db` uses PostgreSQL-compatible PGlite integration tests and treats database membership/status as the authorization source of truth. `@lessonquest/api` exposes a narrow Hono API with exact-origin checks, restrictive CORS, bounded JSON bodies, security headers, generic errors, and trace IDs.

**Tech stack:** Node 24, pnpm 11.24.0, TypeScript 6.0.3, Vitest 4.1.11, Zod 4.5.2, Hono 4.13.5, PGlite 0.5.8.

**Controlling requirements:** `docs/PROJECT_CANON.md`; `docs/INTEGRATION_PLAN_V2.md` sections 7, 8, 12, 13 M1/M2, and 18.

**Pre-implementation gate:** `docs/reviews/2026-08-29-phase-1-identity-tenancy-plan-review.md`. Only the remaining Tasks 3–6 are authorized by that review; Tasks 1–2 predate the gate and are recorded as completed baseline work.

## Global constraints

- Existing source repositories and deployments remain read-only. This milestone is native LessonQuest code and copies no source implementation.
- Use synthetic UUIDs and fresh in-memory PGlite databases only. Do not connect to Firebase, network PostgreSQL, or real student data.
- Request bodies never determine roles, ownership, or tenant authorization. Database-backed active memberships are authoritative.
- Every tenant query includes an organization guard. Existing and nonexistent cross-tenant resources share the same public `404` behavior.
- All SQL request values use positional parameters. UUID, role, status, uniqueness, and tenant relationships also have database constraints.
- State-changing requests require exact trusted-origin equality before the body is read. JSON bodies are content-type checked and limited to 8 KiB.
- Local bearer auth is development/test-only and refuses production construction. Browser cookie auth is explicitly out of scope.
- Mutations and denied tenant access create redacted audit records without request payloads, tokens, names, or student-sensitive content.
- Schema setup is idempotent and transactional. This local empty-database schema creates no production migration or destructive data path.
- No production behavior is added without first observing its test fail for the intended reason.
- No completion claim, merge, push, or deploy occurs before the independent final review scores at least 86/100 with no critical blocker.

## File map

```text
packages/contracts/src/identity.ts          actor and strict request schemas
packages/contracts/test/identity.test.ts    mass-assignment and bounds tests

packages/auth/src/local-auth.ts             development bearer resolver
packages/auth/test/local-auth.test.ts       environment/token tests

packages/db/src/schema.ts                   transactional local schema bootstrap
packages/db/src/tenant-repository.ts        tenant queries, status guards, audit writes
packages/db/src/index.ts                    public database exports
packages/db/test/tenant-repository.test.ts  real PGlite isolation/status/audit tests

services/api/src/app.ts                     security middleware and routes
services/api/src/index.ts                   public API exports
services/api/test/app.test.ts               request-level security/integration tests

docs/reviews/*                              pre-implementation and independent final reviews
```

---

### Task 1: Identity and request contracts — completed baseline

**Files:** `packages/contracts/src/identity.ts`, `packages/contracts/test/identity.test.ts`, `packages/contracts/src/index.ts`

- [x] Observe missing-module RED for strict identity/request schemas.
- [x] Implement server-owned `Actor` roles/memberships and strict organization/class name inputs.
- [x] Verify mass-assignment, UUID, duplicate membership, and length failures.
- [x] Commit as `fed210d feat: define identity and tenant inputs`.

### Task 2: Fail-closed local authentication — completed baseline

**Files:** `packages/auth/src/local-auth.ts`, `packages/auth/test/local-auth.test.ts`, package configuration

- [x] Observe missing-provider RED.
- [x] Implement opaque `dev_` bearer resolution, actor validation/copying, and production refusal.
- [x] Verify missing, malformed, unknown, mutable-copy, invalid-session, and production failures.
- [x] Commit as `fa734bf feat: add fail-closed local authentication`.

---

### Task 3: Strict student-enrollment input

**Files:**

- Modify: `packages/contracts/test/identity.test.ts`
- Modify: `packages/contracts/src/identity.ts`
- Modify: `packages/contracts/src/index.ts`

**Interface:** `addClassMemberInputSchema` / `AddClassMemberInput` accepts only `{ userId: UUID }`. The server derives the `STUDENT` role and all tenant/class IDs from the route and database.

- [x] Add a test whose named break is accepting injected `role`, `organizationId`, `classId`, or malformed `userId`.
- [x] Run `pnpm exec vitest run packages/contracts/test/identity.test.ts` and observe failure because the export does not exist.
- [x] Implement the minimum strict schema and export.
- [x] Run the targeted test, then `pnpm test && pnpm typecheck && pnpm lint`.
- [x] Commit only contract changes.

### Task 4: PostgreSQL-compatible tenant repository and audit trail

**Files:**

- Existing RED/config: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/test/tenant-repository.test.ts`, `pnpm-lock.yaml`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/tenant-repository.ts`
- Create: `packages/db/src/index.ts`

**Interfaces:**

- `initializeSchema(db)`
- `TenantRepository.upsertUser(actor)`
- `createOrganization(actor, name)`
- `createClass(actor, organizationId, name)`
- `addStudentToClass(actor, organizationId, classId, studentUserId)`
- `getClass(actor, organizationId, classId)`
- `AuthorizationError`, `ResourceNotFoundError`, `ConflictError`

**Schema:**

- `users(id UUID, platform_role, status)`
- `organizations(id UUID, name, created_by, status, created_at)`
- `organization_members(organization_id, user_id, role, status)`
- `classes(id UUID, organization_id, owner_teacher_id, name, status, created_at)`
- `class_members(organization_id, class_id, user_id, role, status, created_at)`
- `audit_logs(id UUID, trace_id UUID, occurred_at, actor_user_id, organization_id, action, resource_type, resource_id, outcome)`

Use `ACTIVE | DISABLED` status checks, role checks, primary/unique keys, foreign keys, and composite tenant keys. `classes(organization_id, owner_teacher_id)` references an organization membership. `class_members(organization_id, class_id)` references the class tenant pair and `(organization_id, user_id)` references the organization membership.

- [x] Expand the real PGlite tests. Each test names the production break it catches and proves:
  - schema initialization is idempotent;
  - a teacher creates an organization and receives an active `ORG_ADMIN` membership;
  - organization creation, class creation, and enrollment each produce a redacted success audit row;
  - a teacher/ORG_ADMIN creates and reads a class;
  - enrolling an active student atomically creates active organization and class memberships with server-derived `STUDENT` roles;
  - a forged actor membership absent from the database cannot create/read/enroll;
  - another user and a modified organization/class UUID receive `ResourceNotFoundError`, and denied tenant access is audited;
  - a student cannot create an organization;
  - disabled users, organizations, memberships, classes, and class memberships fail closed;
  - invalid UUID/role/status values, duplicate membership IDs, and cross-tenant foreign keys fail at the database layer;
  - a failed multi-write mutation leaves no partial membership/class/audit state.
- [x] Run `pnpm exec vitest run packages/db/test/tenant-repository.test.ts`; the already-created test must still fail because production modules are absent. Confirm new expectations also remain unsatisfied.
- [x] Implement `initializeSchema` as one `BEGIN`/`COMMIT` unit with rollback on error and idempotent DDL.
- [x] Implement the repository with `crypto.randomUUID()`, positional SQL parameters, active-status predicates, same-query tenant membership joins, and transactions for multi-write mutations.
- [x] For a denied tenant lookup, write only IDs/action/outcome to `audit_logs`; never record names, bodies, authorization headers, or stack traces.
- [x] Run the targeted tests, then `pnpm test && pnpm typecheck && pnpm lint && pnpm build`.
- [x] Commit database files and the exact PGlite lockfile change.

### Task 5: Authenticated organization/class API

**Files:**

- Create: `services/api/package.json`
- Create: `services/api/tsconfig.json`
- Create: `services/api/test/app.test.ts`
- Create: `services/api/src/app.ts`
- Create: `services/api/src/index.ts`
- Modify: root `package.json`, `tsconfig.json`, `pnpm-lock.yaml`

**Interface:** `createApp({ auth, repository, trustedOrigin, maxBodyBytes?: 8192 })`

**Routes:**

```text
GET  /health
POST /organizations
POST /organizations/:organizationId/classes
POST /organizations/:organizationId/classes/:classId/members
GET  /organizations/:organizationId/classes/:classId
```

- [x] Pin Hono 4.13.5 exactly and create a real in-memory database request fixture.
- [x] Write request tests whose named breaks prove:
  - health is public and returns `{ status: 'ok' }`;
  - every response has baseline security headers;
  - CORS emits an allow-origin header only for the exact trusted origin and trusted preflight;
  - every non-health route rejects missing, malformed, or unknown bearer tokens with `401`;
  - state-changing routes reject a missing/lookalike origin with `403` before malformed or oversized bodies are parsed;
  - non-JSON bodies return `415`, invalid/unknown-field JSON returns `400`, and bodies over 8 KiB return `413`;
  - a teacher creates an organization/class, enrolls a synthetic student, and reads the class;
  - client-injected role/owner/tenant fields never change authorization;
  - another teacher receives the same `404` envelope for existing and nonexistent tenant resources;
  - error envelopes contain exactly `{ error: { code, message, retryable, traceId } }`, with a UUID trace ID and no stack, SQL, token, body, or resource name.
- [x] Run `pnpm exec vitest run services/api/test/app.test.ts` and observe missing-module RED.
- [x] Implement security headers, restrictive CORS, auth, exact-origin-before-body, body limit/content-type parsing, route UUID parsing, and generic error mapping.
- [x] Keep `/health` dependency-free; all other routes use the injected real auth/repository boundaries.
- [x] Run targeted tests and `pnpm check && pnpm audit --prod --audit-level high`.
- [x] Commit only the API/config/lockfile changes.

### Task 6: Documentation, fresh verification, and independent acceptance

**Files:**

- Modify: `README.md`
- Modify: this plan
- Create: `docs/reviews/2026-08-29-phase-1-identity-tenancy-final-review.md` (independent agent only)

- [x] Document package roles, synthetic fixtures, endpoints, non-production local auth, audit data minimization, and exact local verification commands.
- [x] Mark completed plan checkboxes and format all changed files.
- [x] Reinstall from the frozen lockfile and run fresh implementer verification:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm audit --prod --audit-level high
git diff --check
git status --short
```

- [x] Confirm no skipped tests, no external data/network service use, no unrecorded copied source, and no unexpected files in the diff.
- [x] Commit documentation and the completed plan. Do not claim milestone completion yet.
- [x] Spawn a new independent agent that did not implement the changes. Give it the canon, approved plan/review, full branch diff, final-review rubric, and authority to run tests but not edit during scoring.
- [x] Require the reviewer to save a line-referenced findings report and numeric score in the final-review file.
- [x] If the score is 85 or lower or any critical blocker exists, fix findings test-first.
- [x] Request a fresh independent review after remediation.
- [x] Accept the milestone only after an independent score of at least 86/100 with no critical blocker.

## Implementer verification record

Fresh verification on 2026-08-29:

- `pnpm install --frozen-lockfile` — lockfile current, five workspace projects recognized.
- `pnpm check` — lint and formatting clean; typecheck/build succeeded; 8 test files and 90 tests passed with no skips.
- `pnpm audit --prod --audit-level high` — no known vulnerabilities.
- `git diff --check` — no whitespace errors.
- Test fixtures used in-memory PGlite and synthetic UUIDs/tokens only. No Firebase, network PostgreSQL, real student data, external deployment, or source repository was accessed or changed during implementation.
- `docs/SOURCE_PROVENANCE.md` records this milestone as native LessonQuest code with no copied source.

Independent Attempt 2 verification on 2026-08-29:

- A new non-implementing agent inspected the full implementation and remediation and independently reran the required checks and focused probes.
- Final score: **98/100 PASS**, with no critical blocker.
- One low test-strength finding remains: the full response/audit/diagnostic three-way denied-trace invariant was independently reproduced but is split across two committed regression tests.
- The final verdict is recorded in `docs/reviews/2026-08-29-phase-1-identity-tenancy-final-review.md`.

## Explicit exclusions

- Browser/cookie login, password storage, Firebase compatibility, production PostgreSQL networking, invitations, join-code UX, full role-specific frontend routing, and deployment.
- Real student records or production data migration.
- Audit export/retention policy and production tamper-resistant log storage; this milestone only proves minimal append-only application writes in local PostgreSQL-compatible storage.

## Rollback and containment

- All databases are fresh in-memory test instances; closing PGlite discards milestone data.
- Each multi-row mutation is transactional so failures roll back locally.
- No existing repository, deployment, Firebase project, or production schema is mutated.
- Commits are scoped per task and the branch is not pushed or merged without explicit user authorization.
