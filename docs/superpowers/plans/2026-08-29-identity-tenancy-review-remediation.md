# Identity/Tenancy Final-Review Remediation Plan

**Goal:** Resolve every scored gap in the independent 77/100 final review, re-establish role revocation at the authoritative database boundary, and make API trace IDs diagnostically useful before requesting a fresh independent review.

**Inputs:**

- `docs/reviews/2026-08-29-phase-1-identity-tenancy-final-review.md`
- `docs/superpowers/plans/2026-08-29-phase-1-identity-tenancy.md`
- `memory/projects/lessonquest.md` final implementation rubric

**Constraints:** Existing repositories/deployments remain read-only; use only synthetic actors and in-memory PGlite; no external data/service; test-first changes only; final acceptance still requires a new independent score of at least 86/100 with no critical blocker.

## Task 1: Enforce current platform-role compatibility

**Files:** `packages/db/test/tenant-repository.test.ts`, `packages/db/src/tenant-repository.ts`

- [x] Add a regression in which a teacher creates an organization/class, is upserted as `STUDENT`, and then cannot create a class, enroll a student, or read through the retained `ORG_ADMIN` membership.
- [x] Observe the test fail with the reproduced unauthorized success.
- [x] Require an active database `users.platform_role` of `TEACHER | SUPER_ADMIN` for privileged organization membership branches.
- [x] Require the student read branch to pair database `platform_role = STUDENT`, organization role `STUDENT`, and active class membership.
- [x] Re-run the targeted DB and API tests. Do not rely on Actor membership claims.

## Task 2: Audit conflicts and prove post-write rollback

**Files:** `packages/db/src/schema.ts`, `packages/db/src/tenant-repository.ts`, `packages/db/test/tenant-repository.test.ts`

- [x] Add a failing test requiring duplicate enrollment to write a minimized `STUDENT_ENROLL / CONFLICT` audit row.
- [x] Extend the audit outcome constraint with `CONFLICT` and write the record before returning the public `409`.
- [x] Add a real fault-injection regression: install a temporary database constraint that rejects `STUDENT_ENROLLED` audit insertion after membership writes, invoke enrollment, and prove organization membership, class membership, and enrollment audit all roll back.
- [x] Preserve the transaction behavior that the new post-write fault-injection regression protects.

## Task 3: Correlate response trace IDs, diagnostics, and audit rows

**Files:** `packages/db/src/schema.ts`, `packages/db/src/tenant-repository.ts`, `packages/db/test/tenant-repository.test.ts`, `services/api/src/app.ts`, `services/api/test/app.test.ts`

- [x] Add failing tests requiring every audit row to carry a UUID `trace_id` and requiring an API `404` response trace ID to match its denied audit row.
- [x] Add an injected synchronous `DiagnosticSink` and a redacted `ApiDiagnosticEvent` containing only trace ID, error code/status/retryability, method, optional UUID tenant/resource IDs, and duration.
- [x] Add a failing internal-error test requiring the response trace ID to match exactly one diagnostic record without body, token, resource name, SQL, stack, or raw exception.
- [x] Generate one trace ID at request start, reuse it in error responses, diagnostics, and repository audit calls, and default direct repository operations to a server UUID.
- [x] Ensure diagnostic-sink failure cannot expose details or change the safe API response.

## Task 4: Correct verification evidence and memory

**Files:** `services/api/test/app.test.ts`, `memory/projects/lessonquest.md`, `README.md`, both implementation plans

- [x] Replace the single-route auth claim with a table covering all four protected route patterns and missing, malformed, and unknown credentials.
- [x] Update the original plan's rollback/auth evidence wording so it matches executable tests.
- [x] Replace the stale database-RED memory marker with the current failed-review/remediation state.
- [x] Document required diagnostics and audit trace correlation without exposing production secrets or real data.

## Task 5: Fresh verification and re-review

- [x] Run targeted contract/auth/DB/API tests, then `corepack pnpm install --frozen-lockfile`, `corepack pnpm check`, `corepack pnpm audit --prod --audit-level high`, and `git diff --check`.
- [x] Confirm all failure reproductions are now blocked and all audit/diagnostic records remain minimized.
- [x] Commit remediation and its verification evidence without pushing or deploying.
- [x] Assign a new independent non-implementing agent to inspect the full implementation plus remediation, rerun checks, and append Attempt 2 to the final-review report.
- [x] Accept only an independent score of 86/100 or higher with no critical blocker.

## Remediation verification record

Fresh evidence from 2026-08-29:

- `corepack pnpm install --frozen-lockfile` used the repository-pinned pnpm 11.24.0 and recognized all five workspace projects.
- Targeted identity/auth/DB/API run: 4 files and 53 tests passed.
- `corepack pnpm check`: lint/format/typecheck/build passed; all 8 files and 96 tests passed with no skips.
- `corepack pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `git diff --check`: no whitespace errors.
- The three reproduced downgrade paths now return `ResourceNotFoundError`; the authenticated stale-teacher API reproduction returns safe `404`.
- Duplicate enrollment writes one minimized conflict audit; forced post-membership audit failure leaves zero student organization membership, class membership, and enrollment audit rows.
- Error response, audit row, and allowlisted diagnostic event share the same UUID trace ID. Tests assert diagnostic keys exactly and prove a throwing sink cannot alter or expose the response.
- Independent Attempt 2 review: **98/100 PASS**, no critical blocker; report appended without altering the preserved Attempt 1 record.
- All fixtures remain synthetic and in-memory. No external source repository, Firebase, network database, deployment, or real student data was accessed or changed.

## Rollback and containment

- All schema and fault-injection changes run only in fresh in-memory PGlite tests.
- Repository/API changes are isolated on `codex/phase1-foundation-contracts` and have task-scoped commits.
- No network database, Firebase project, student record, source repository, deployment, merge, or push is touched.
