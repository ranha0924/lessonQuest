# Phase 2 Classrooms Implementation Plan

> **For agentic workers:** Execute tasks inline with `superpowers:executing-plans`; the mandatory final validation is assigned to a separate non-implementing agent. Checkboxes track observable delivery steps.

**Goal:** Deliver teacher class selection, secure student invitations and a persisted class dashboard in the existing synthetic LessonQuest service preview.

**Architecture:** New strict classroom contracts and ClassroomRepository; existing TenantRepository creates classes. Add optional classroom repository routes to Hono and a separate ClassroomApi interface implemented by the existing HTTP factory. Reuse StudioWorkbench, StudentPlay and TeacherProgress without changing the learning ledger.

**Tech Stack:** Existing Node 24.13.0, pnpm 11.24.0, TypeScript 6.0.3, Zod 4.5.2, PGlite, Hono, React and Playwright; no dependency changes.

**Spec:** `docs/superpowers/specs/2026-08-31-phase2-classrooms-design.md`

## Global constraints

- Follow `docs/PROJECT_CANON.md`, `docs/INTEGRATION_PLAN_V2.md` §14, and both mandatory 86/100 gates in `memory/projects/lessonquest.md`.
- Scope is Phase 2 classroom delivery, not Phase 2 completion or production identity/data migration.
- Reference repositories/deployments remain unchanged; original LessonQuest implementation, synthetic data only.
- Use existing cosmic styles. No telemetry, secrets, external data, new infrastructure or paid resources.
- New tables are additive to the fresh/local schema. No persistent deployment DB is migrated.

## Task 1 — strict contracts and transactional repository

Files: create `packages/contracts/src/classrooms.ts`, `packages/contracts/test/classrooms.test.ts`, `packages/db/src/classroom-repository.ts`, `packages/db/test/classroom-repository.test.ts`; modify contracts/db exports, `packages/db/src/schema.ts`, `packages/db/src/decision-audit.ts`.

Interfaces (all require Actor + organizationId + traceId; writes additionally classId/input):

```ts
interface ClassroomSummary {
  id: string;
  organizationId: string;
  name: string;
}
interface ClassInvitation {
  id: string;
  classId: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  status: 'ACTIVE' | 'REVOKED';
}
interface IssuedClassInvitation {
  invitation: ClassInvitation;
  code: string;
}
interface ClassDashboard {
  lessonClass: ClassroomSummary;
  memberCount: number;
  invitation: ClassInvitation | null;
  assignments: Array<{
    assignmentId: string;
    title: string;
    startedCount: number;
    completedCount: number;
    wrongAnswers: number;
    retries: number;
    hintsUsed: number;
  }>;
}
interface RedeemedClassInvitation {
  classId: string;
  className: string;
  outcome: 'JOINED' | 'DUPLICATE';
}
// Repository methods:
// listClasses(actor, org, trace): Promise<ClassroomSummary[]>
// getDashboard(actor, org, classId, trace): Promise<ClassDashboard>
// issueInvitation(actor, org, classId, {maxUses}, trace): Promise<IssuedClassInvitation>
// revokeInvitation(actor, org, classId, invitationId, trace): Promise<{revoked:true}>
// redeemInvitation(actor, org, {code}, trace): Promise<RedeemedClassInvitation>
```

- [x] Write strict contract tests: reject actor/role/damage extras, malformed code, noninteger/out-of-range maxUses; reject leaked code/hash/student identifiers in dashboard responses.
- [x] Write repository tests using fresh PGlite and literal counts. Expected failure is missing contracts/repository. Run `corepack pnpm exec vitest run packages/contracts/test/classrooms.test.ts packages/db/test/classroom-repository.test.ts` and record RED.
- [x] Implement schema/exports then build dependencies. Add `class_invitations` with composite class FK, unique hash, one ACTIVE per class, status/checks and usage bounds. Add composite-scoped redemption uniqueness and member FK. Extend audit allowlists only for CLASS_LISTED, CLASS_DASHBOARD_READ, CLASS_INVITATION_ISSUED/REVOKED/REDEEMED; nullable resourceId for listing/redeem rejection.
- [x] Implement ClassroomRepository parsing, DB current-role/owner/admin guards; run all operations in transactions with durable denied/conflict wrapper. Serialize issuance with class lock; redemption with invite lock; check expiry, issuer, existing student org/class lifecycle, conditional usage capacity and atomic memberships/redemption/audit. Never save plaintext code. Prefer randomUUID twice + createHash (already browser adapted). Accept injected `now` for deterministic deadline tests.
- [x] Implement dashboard SQL over current active students and active/PUBLISHED assignments and `student_progress`, grouping independently to avoid multiplication. Return no student identities; no-store API later. Verify list/empty/dashboard counts, owner/admin/cross-tenant and disabled lifecycle, issue/rotate/revoke, maxUses boundary and concurrent redemption, repeated same-user redemption, denied/conflict audit, forced post-write failure rollback. Example assertions:

```ts
expect(await classrooms.redeemInvitation(student, org, { code }, trace)).toMatchObject({
  outcome: 'JOINED',
});
expect(await classrooms.redeemInvitation(student, org, { code }, trace)).toMatchObject({
  outcome: 'DUPLICATE',
});
expect((await classrooms.getDashboard(teacher, org, classId, trace)).memberCount).toBe(1);
await expect(classrooms.redeemInvitation(otherStudent, org, { code }, trace)).rejects.toThrow(
  ResourceNotFoundError,
);
```

## Task 2 — authenticated API and HTTP contracts

Files: modify `services/api/src/app.ts`, `apps/web/src/api-client.ts`; create `services/api/src/classroom-routes.ts`, `services/api/test/classrooms.test.ts`.

- [x] Test missing routes returning 404 before implementation. Create real fixture with TenantRepository/ClassroomRepository/Hono/auth; verify missing/malformed auth, Origin/media type, strict body, UUID route parsing, cross-org code, student denied teacher reads, current DB downgrade, no-store, safe errors and trace-linked audits.
- [x] Register optional ClassroomRepository in createApp after shared middleware. Routes: GET `/organizations/:organizationId/classes`; GET `.../classes/:classId/dashboard`; POST `.../classes/:classId/invitations`; POST `.../classes/:classId/invitations/:invitationId/revoke`; POST `.../class-invitations/redeem`. Reuse generic readJson/parseRouteUuid and error middleware. Parse every success with shared response schemas.
- [x] Add separate required ClassroomApi (avoids weakening LessonQuestApi or rewriting unrelated fixtures). HTTP factory returns `LessonQuestApi & ClassroomApi`, including existing class creation with strict response parsing. Invitation code only in JSON body, never query/path/telemetry.
- [x] Run focused API + repository tests GREEN; build all packages.

## Task 3 — teacher class workflow, dashboard and student join

Files: create `apps/web/src/components/classroom-manager.tsx`, `apps/web/src/components/join-class.tsx`, `apps/web/src/classrooms.css`, `apps/web/test/classrooms-e2e.test.tsx`; modify `apps/web/src/dev-preview/runtime.ts`, `apps/web/src/dev-preview/development-preview.tsx`, `apps/web/src/app.tsx`, `tests/browser/service-preview.spec.ts`.

- [x] Write real React→HTTP→Hono→PGlite failing test: create class, select it, issue invitation, student joins, existing learning workflow creates/publishes/plays, teacher dashboard shows authoritative literal counts; selecting a class clears old sensitive state and refresh errors clear outdated dashboard data. Include failed/lost issue/redeem response recovery and revoke.
- [x] ClassroomManager loads owner/admin classes, renders creation and selection, dashboard refresh, metadata, one-time code output, maxUses, issue/reissue and specific-ID revoke. Clear old code before issue/revoke and on class/auth change; disable competing operations; hide sensitive results on failed refresh. Use effect cleanup to ignore late reads.
- [x] JoinClass takes ClassroomApi + organizationId + onJoined; code input has autocomplete off; clear on success/unmount; show generic safe error without echoing code. Replaying same code after uncertain error reuses exact body; no local storage. Remount StudentPlay after JOINED/DUPLICATE to reload assignments.
- [x] Wire new repository into preview only. Keep initial class and Phase 1 teaching state unchanged on role switches. On class change remount Studio; initial class remains selected if authorized; permission/load failure does not authorize frontend actions. Standard App receives optional classroomApi for compatibility with existing local host, and preview passes full factory result.
- [x] Add responsive cosmic panels with readable breakable code output and existing keyboard/focus conventions. Add browser test at configured desktop/mobile widths: create→invite→join→return/refresh, old code after rotation fails, new class authoring works without changing old class. Preserve zero remote requests/storage/service workers.
- [x] Run focused UI/API tests and browser preview GREEN.

## Task 4 — verification, independent acceptance and delivery

Files: `docs/PHASE2_PROGRESS.md`, `docs/SOURCE_PROVENANCE.md`, `README.md`, `memory/projects/lessonquest.md`, review records, root `package.json` test script inclusion.

- [x] Add this slice's API/repository/UI tests to relevant integration/E2E scripts. Record provenance as original implementation with no external copy.
- [x] Run `corepack pnpm check`, `corepack pnpm test:integration`, `corepack pnpm test:e2e`, `corepack pnpm audit --prod --audit-level high`, `corepack pnpm test:browser`, `corepack pnpm test:preview`, `git diff --check`. Record exact counts and limits in verification review.
- [x] Assign fresh independent non-implementing agent to inspect actual complete diff and verification, run relevant checks, write scored final review. Do not accept below 86 or with blockers. Fix failed findings test-first under updated reviewed plan, then fresh independent review. Final result: 96/100 PASS, no critical blocker.
- [ ] Commit all reviewed changes on feature branch, push, create PR, wait required CI. Inspect current main and actual merge candidate; merge only passing candidate. Check main CI and Git-linked Vercel deployed SHA/status/live URL, no duplicate manual deployment. Missing access is a blocker, not authority to bypass protections.

## Recovery and trace

Loss of issuance response: reissue rotates previous secret; loss of redemption response: same code/actor returns duplicate while current valid. Revocation is idempotent by invitation ID. Loss of class-creation response: refresh the class list before retrying; the reused creation API is not idempotent and can create another same-name class. Transaction/audit failure rolls back membership/usage. Additive local schema can be abandoned by reverting code/resetting synthetic DB; no destructive migration. Deployment rollback uses prior known-good commit through normal reviewed delivery, never changes reference systems.

The remaining delivery checkbox is a pre-delivery snapshot. The merge PR body records its eventual completion with exact commit, CI, deployment and live verification evidence.

Acceptance: spec functional bullets → Tasks 1–3; security/tenant/code non-disclosure → Tasks 1–2 negative tests; UI recovery/privacy → Task 3; original-source provenance/independent gate/CI/live → Task 4. Remaining Phase 2 PWA queue and externalAuthId/export dry-run are explicitly tracked separately.
