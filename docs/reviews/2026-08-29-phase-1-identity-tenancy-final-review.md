# Phase 1 Identity and Tenancy Final Review

Review date: 2026-08-29  
Reviewer: Independent non-implementing agent  
Reviewed range: `01d99e1..73a054b`  
Decision threshold: 86/100 or higher and no critical blocker

## Decision

**FAIL — 77/100.** The implementation has one unresolved authorization blocker: changing a user from platform `TEACHER` to `STUDENT` does not revoke the user's existing `ORG_ADMIN` authority, and the downgraded user can still create classes through the authenticated API. The branch must not be accepted, merged, or deployed until this is fixed test-first and a new independent review passes.

## Findings

### 1. High — platform-role downgrade does not revoke organization administration (critical blocker)

`TenantRepository.upsertUser` updates `users.platform_role` but leaves organization memberships unchanged (`packages/db/src/tenant-repository.ts:133-140`). Class creation then requires only an active `TEACHER | ORG_ADMIN` organization membership and an active user, without checking the user's current platform role (`packages/db/src/tenant-repository.ts:210-220`). Enrollment has the same gap (`packages/db/src/tenant-repository.ts:273-287`), while class reads treat any retained teacher/admin membership as privileged (`packages/db/src/tenant-repository.ts:369-391`). The authenticated class route exposes this authority directly (`services/api/src/app.ts:234-243`).

Independent reproduction:

1. Upsert an active `TEACHER`, create an organization, and receive its `ORG_ADMIN` membership.
2. Upsert the same user as platform `STUDENT`.
3. Resolve a local bearer session whose server-owned actor also says `STUDENT`.
4. `POST /organizations/:organizationId/classes` returns `201` and creates a class whose `ownerTeacherId` is the downgraded student.

The probe confirmed the database held `platform_role = 'STUDENT'`, the membership remained `role = 'ORG_ADMIN'`, and the API returned `201`. This is a role-revocation bypass and therefore an unresolved authorization risk under `memory/projects/lessonquest.md:35-45`. Fixing it requires a defined role-compatibility/revocation invariant at the authoritative database boundary and regression coverage for create, enroll, and read after a downgrade.

### 2. Medium — conflicting enrollment mutations are not audited

The duplicate-member path returns `conflict` immediately after its existence query (`packages/db/src/tenant-repository.ts:302-309`) and then throws `ConflictError` without calling `writeAudit` (`packages/db/src/tenant-repository.ts:343-348`). Consequently, a valid authenticated tenant mutation attempt can return `409` without any audit row. This does not satisfy the M2 requirement that every tenant query be guarded and audited (`docs/INTEGRATION_PLAN_V2.md:505-511`) or the approved plan's global requirement that mutations create minimized audit records. The audit vocabulary should represent the conflict/failed attempt without recording request data or names.

### 3. Medium — checked test claims overstate the behaviors actually proved

The approved plan marks as complete a regression in which a failed multi-write mutation leaves no partial membership, class, or audit state (`docs/superpowers/plans/2026-08-29-phase-1-identity-tenancy.md:118-130`). The implemented test only retries an already-existing class member and takes the repository's pre-write conflict branch (`packages/db/test/tenant-repository.test.ts:270-289`; `packages/db/src/tenant-repository.ts:302-309`). No intermediate organization membership, class membership, or audit write is attempted, so the test would pass even if rollback after a later write were broken.

An independent fault-injection probe forced the enrollment audit insert to fail after the membership inserts and observed zero organization-membership, class-membership, and enrollment-audit rows, so the current transaction implementation did roll back. The finding is that the committed regression does not protect that behavior.

The request suite similarly labels one test as covering credentials on every protected route, but it exercises only one GET route with missing and unknown credentials and omits malformed credentials (`services/api/test/app.test.ts:123-136`) despite the checked route-matrix claim (`docs/superpowers/plans/2026-08-29-phase-1-identity-tenancy.md:161-171`). The wildcard middleware is sound on inspection, but the named acceptance evidence is incomplete.

### 4. Medium — response trace IDs cannot be correlated to diagnostics

The controlling observability requirement calls for structured, redacted logs containing `traceId`, tenant/resource identifiers, and duration (`docs/INTEGRATION_PLAN_V2.md:472-493`). The API generates a fresh UUID only while serializing the response (`services/api/src/app.ts:52-63`); `mapError` discards unexpected error details without a redacted diagnostic sink (`services/api/src/app.ts:66-116`), and the error handler records nothing (`services/api/src/app.ts:277`). Audit rows also have no trace identifier. Internal details are correctly hidden from clients, but a reported trace ID cannot locate the corresponding failure, denied access, or duration. Add an injected structured logger or equivalent diagnostic boundary that preserves redaction.

### 5. Low — project memory still points to an obsolete database-RED pause state

`memory/projects/lessonquest.md:84-86` says database production implementation has not begun and directs the next agent back through the pre-implementation gate. That contradicts this branch, the completed plan, and `README.md:5-47`. Because project memory is a controlling handoff artifact, leaving the stale marker can send subsequent work down the wrong workflow. Update it after the failed implementation findings are fixed so it reflects the actual final-review state.

## Verification evidence

- Full diff inspected from base `01d99e1` through HEAD `73a054b`: 23 files, 1,660 insertions, 52 deletions. Production code, tests, workspace configuration, lockfile, documentation, approved plan, and provenance record were reviewed line by line.
- `corepack pnpm install --frozen-lockfile` — exit 0 with all five workspace projects and pnpm 11.24.0. The host's bare `pnpm` was 11.19.0, so Corepack was used to honor the repository pin.
- `corepack pnpm deps:build && corepack pnpm exec vitest run packages/contracts/test/identity.test.ts packages/auth/test/local-auth.test.ts packages/db/test/tenant-repository.test.ts services/api/test/app.test.ts` — exit 0; 4 files and 47 tests passed.
- `corepack pnpm check` — exit 0; lint and formatting passed, typecheck and all package builds succeeded, and 8 test files / 90 tests passed with no skips.
- `corepack pnpm audit --prod --audit-level high` — exit 0; no known vulnerabilities.
- `git diff --check` — exit 0; no whitespace errors.
- `git status --short` was empty before this review report was created. Generated build output remained ignored.
- Source and test inspection found only synthetic UUIDs/tokens and in-memory PGlite fixtures. No Firebase, network PostgreSQL, real student data, external deployment, or existing source repository was accessed or mutated.
- `docs/SOURCE_PROVENANCE.md:5-10` records the identity, auth, database, and API work as native LessonQuest code; the reviewed diff contains no unrecorded source import.

## Rubric score

| Category                                    |      Score | Evidence                                                                                                                                                                                                              |
| ------------------------------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      21/25 | The main teacher-to-student tenant slice, strict inputs, IDOR concealment, and local containment are delivered. Role revocation, complete audit coverage, and structured observability are not.                       |
| Correctness and code quality                |      16/20 | SQL is parameterized, tenant joins are explicit, transactions work under injected failure, and errors are bounded. Retained authority after a role transition and the unaudited conflict branch are correctness gaps. |
| Security, privacy, and tenant isolation     |      13/20 | CORS/origin/body ordering, safe errors, synthetic data, active-status checks, composite tenant keys, and redacted audit fields are strong. The reproduced role-revocation bypass is an authorization blocker.         |
| Test and verification evidence              |      16/20 | All targeted and full checks pass with no skips. The rollback and credential-matrix tests do not fully prove their checked plan claims, and no role-transition regression catches the blocker.                        |
| Operability, recoverability, and provenance |      11/15 | Frozen install, builds, audit, rollback containment, documentation, pinned dependencies, and provenance are good. Trace IDs are not diagnosable and project memory is stale.                                          |
| **Total**                                   | **77/100** | **FAIL; below 86 and an authorization blocker remains.**                                                                                                                                                              |

## Critical blocker check

- Authorization or role-revocation risk unresolved: **Yes** — Finding 1.
- Cross-tenant IDOR exposure found in the tested steady state: **No** — existing/nonexistent resources share the safe `404` shape and database membership is authoritative for tenant lookup.
- Secrets, unsafe logs, or real student data found: **No**.
- Destructive or irreversible migration: **No** — schema and probes use fresh in-memory databases.
- Existing source repository or deployment mutation: **No**.
- Dependency/build/security verification failure: **No**.

## Final verdict

**FAIL.** Score: **77/100**. Fix the authorization blocker and scored gaps, add regression coverage that proves the failure paths, refresh the handoff memory, and request a new independent final review.

---

# Attempt 2 — Independent Final Review

Review date: 2026-08-29
Reviewer: New independent non-implementing agent; no participation in implementation or Attempt 1
Reviewed range: `01d99e1..a4b32cc` (current `HEAD`)
Remediation commits reviewed: `2c8da34`, `a4b32cc`
Decision threshold: 86/100 or higher and no critical blocker

## Attempt 2 decision

**PASS — 98/100.** The Attempt 1 authorization blocker and each scored remediation item are resolved in the actual implementation. Current database roles revoke retained organization authority for class creation, enrollment, and privileged reads; the stale-teacher API reproduction returns a safe `404`; conflicts are audited; a real post-write audit failure rolls back both membership writes; protected routes fail closed for all requested credential cases; and denied error responses, audit rows, and allowlisted diagnostics share one request trace ID. No critical blocker remains.

## Attempt 2 findings

### 1. Low — the exact three-way denied-trace invariant is not locked in one committed regression

The denied-read request test matches the response trace ID to the denied audit row (`services/api/test/app.test.ts:373-404`), while the internal-error test separately checks the diagnostic event's exact allowlist and response correlation (`services/api/test/app.test.ts:321-371`). No committed assertion requires one tenant-denial response to match both its audit row and exactly one diagnostic event. The shared implementation does propagate one trace through `errorResponse` and the repository call (`services/api/src/app.ts:92-125`, `services/api/src/app.ts:331-355`), and the independent probe reproduced the full three-way match. This is a regression-strength gap, not a current authorization, privacy, or observability failure.

No critical, high, or medium findings were identified. Inspection found no new authentication bypass, cross-tenant IDOR, mass-assignment path, unsafe role/status compatibility, origin/CORS/body-order regression, diagnostic or audit data leak, transaction rollback flaw, dependency vulnerability, or stale-build failure within the approved local PGlite milestone.

## Attempt 1 finding reproduction and remediation evidence

- **Role downgrade:** privileged authorization now joins the current active database user role for class creation and enrollment (`packages/db/src/tenant-repository.ts:225-239`, `packages/db/src/tenant-repository.ts:295-313`) and pairs the current platform role with organization/class membership for reads (`packages/db/src/tenant-repository.ts:407-437`). Independent probes returned `ResourceNotFoundError` for create, enroll, and read after `TEACHER → STUDENT`; the stale-teacher bearer session returned API `404`. The committed regressions are at `packages/db/test/tenant-repository.test.ts:156-191` and `services/api/test/app.test.ts:304-319`.
- **Conflict audit:** `CONFLICT` is constrained in the audit schema (`packages/db/src/schema.ts:52-72`) and duplicate enrollment writes `STUDENT_ENROLL / CONFLICT` before returning `ConflictError` (`packages/db/src/tenant-repository.ts:327-382`). The independent probe found exactly one minimized conflict row with the supplied trace ID.
- **Real post-write rollback:** enrollment inserts organization membership, class membership, and success audit inside one transaction (`packages/db/src/tenant-repository.ts:295-367`). The committed fault injection rejects `STUDENT_ENROLLED` only after membership writes and asserts all three counts are zero (`packages/db/test/tenant-repository.test.ts:337-364`). The independent probe reproduced the same zero/zero/zero rollback result.
- **Credential matrix:** the wildcard authentication boundary runs before origin/body parsing on every non-health, non-preflight request (`services/api/src/app.ts:243-290`). The committed 4-route × 3-credential table is at `services/api/test/app.test.ts:135-162`; an independent 12-request probe confirmed every missing, malformed, and unknown credential returns safe `401`.
- **Trace correlation and redaction:** one UUID is created at request start (`services/api/src/app.ts:226-232`), passed into every repository route (`services/api/src/app.ts:295-340`), stored in each audit (`packages/db/src/tenant-repository.ts:96-134`), and reused by the allowlisted diagnostic/error envelope (`services/api/src/app.ts:58-125`). The independent denied-read probe matched the response UUID to one audit row and exactly one diagnostic event whose keys were only `type`, `traceId`, `code`, `status`, `retryable`, `method`, `organizationId`, `resourceId`, and `durationMs`.
- **Diagnostic sink failure:** the sink call is isolated behind `try/catch` (`services/api/src/app.ts:99-125`). Both the committed regression (`services/api/test/app.test.ts:406-430`) and an independent throwing-sink probe preserved the generic safe response without exposing the thrown marker.
- **Memory:** the pause marker accurately preserves Attempt 1's 77/100 failure, the 98/100 remediation gate, the remediated behaviors, and the requirement for this fresh review at the time of scoring (`memory/projects/lessonquest.md:84-88`).

## Verification evidence

- Inspected the complete `01d99e1..a4b32cc` diff: 26 files, 2,172 insertions, 57 deletions, including source, tests, configuration, lockfile, plans, reviews, memory, README, and provenance. Remediation commits `2c8da34` and `a4b32cc` were separately inspected.
- `corepack pnpm install --frozen-lockfile` — exit 0; all five workspace projects recognized; lockfile current; pnpm 11.24.0.
- `corepack pnpm deps:build && corepack pnpm exec vitest run packages/contracts/test/identity.test.ts packages/auth/test/local-auth.test.ts packages/db/test/tenant-repository.test.ts services/api/test/app.test.ts` — exit 0; 4 files and 53 tests passed.
- `corepack pnpm check` — exit 0; lint and formatting passed, typecheck and every package build succeeded, and 8 files / 96 tests passed with no skips.
- `corepack pnpm audit --prod --audit-level high` — exit 0; no known vulnerabilities.
- `git diff --check` — exit 0 on the scoring worktree before this append. A separate range check reports only intentional Markdown hard-break spaces in review metadata, including the Attempt 1 report that this review was required to preserve; no production, test, or configuration whitespace error was found.
- Independent compiled-code probes (not committed fixtures) reproduced downgrade denial across three repository paths and the stale API; a minimized conflict audit; forced post-write rollback; all 12 credential cases; response/audit/diagnostic trace equality; throwing-sink safety; and serialized duplicate enrollment producing one success plus one audited conflict.
- `git status --short` was empty before appending Attempt 2. Fixtures and probes used only synthetic UUIDs/tokens and fresh in-memory PGlite databases. No Firebase, network PostgreSQL, real student data, external deployment, source repository, merge, or push was accessed or changed.
- `docs/SOURCE_PROVENANCE.md:5-13` records the identity/auth/database/API work as native LessonQuest code; no unrecorded copied source was found.

## Attempt 2 rubric score

| Category                                    |      Score | Evidence                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance   |      25/25 | The M1/M2 teacher-to-student slice, tenant guards/audits, remediation tasks, exclusions, and acceptance conditions are delivered without scope expansion.                                                                                                                      |
| Correctness and code quality                |      20/20 | Current-role joins close all reproduced downgrade paths; tenant SQL is parameterized and guarded; conflict/error behavior is deterministic; real post-write failure proves transaction rollback.                                                                               |
| Security, privacy, and tenant isolation     |      20/20 | Authentication fails closed, body authority is strict, IDOR responses are concealed, role/status combinations fail closed, origin/body ordering is safe, and audits/diagnostics expose only allowlisted identifiers and metadata.                                              |
| Test and verification evidence              |      19/20 | All targeted/full checks and independent probes pass. One point is withheld because the exact denied response + audit + diagnostic three-way invariant is not asserted in one committed regression.                                                                            |
| Operability, recoverability, and provenance |      14/15 | Trace diagnostics, audit correlation, local transactional containment, pinned dependencies, documentation, current pre-review memory, and native provenance are adequate. Production diagnostic transport and tamper-resistant audit retention remain explicitly out of scope. |
| **Total**                                   | **98/100** | **PASS; above 85 with no critical blocker.**                                                                                                                                                                                                                                   |

## Attempt 2 critical blocker check

- Authorization or role-revocation risk unresolved: **No** — all reproduced downgrade paths fail closed using current database authority.
- Cross-tenant IDOR or mass-assignment path found: **No** — tenant joins and strict request schemas remain effective.
- Secrets, diagnostic/audit leakage, or real student data found: **No**.
- Mutation conflict unaudited or post-write rollback unproved: **No**.
- Destructive/irreversible migration or external-system mutation: **No** — fresh in-memory schema only.
- Build, dependency, lockfile, or high-severity audit failure: **No**.
- Acceptance criteria unverifiable: **No** — required behaviors were exercised in committed tests and independent probes.

## Attempt 2 final verdict

**PASS. Score: 98/100. No critical blocker.** Phase 1 identity/tenancy satisfies the mandatory independent final-validation gate. The low regression-strength finding may be addressed in follow-up, but it does not reopen the corrected authorization, tenant-isolation, or observability behavior.
