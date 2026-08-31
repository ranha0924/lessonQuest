# Phase 2 classrooms — independent final validation

Date: 2026-08-31. Reviewer: independent agent `phase2_final_validation`, newly assigned after implementation and not an implementer of this change.

**Decision: PASS — 96/100. No critical blocker found for the approved synthetic classroom slice.** This satisfies the mandatory independent implementation gate. It is not a claim that all Phase 2 work, production readiness, CI, merge, or deployment is complete.

## Candidate and independence

- Base: `2cf2cd3c3b21e101878a9ca9160d985ee33fc568`; branch: `codex/phase2-classrooms`.
- Reviewed the actual uncommitted tracked diff and every relevant untracked implementation, contract, fixture, test, and planning file. A tracked-only diff would have omitted most of this implementation.
- Read `AGENTS.md`, `PROJECT_CANON.md`, `INTEGRATION_PLAN_V2.md` §14, `memory/projects/lessonquest.md`, the approved classroom design/plan, the 95-point plan review, and the implementer verification record. Inspected the recorded RED failures rather than relying only on the final test count.
- All 24 implementation/test/package-script fingerprints in `/tmp/lq-phase2-implementation-hashes.json` matched during the review. Dependency manifests and lockfile have no dependency changes.
- I did not modify production code. I ran separate repository/API probes from `/tmp` and temporarily added four independent React probes; the temporary repository test file was removed after verification. Only this review document remains as my repository change.

## Rubric

| Category                                    |      Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      25/25 | New class list/create/select, owner/admin management, hashed capped rotating/revocable invitations, authenticated self-enrollment, aggregate current-student dashboard, actual preview wiring, and class-specific Studio remount all match Tasks 1–3. PWA, external identity, real data, and persistent migration remain explicitly excluded.                                                         |
| Correctness and code quality                |      19/20 | Strict shared DTOs, deterministic expiry, class-before-invitation locking, exact duplicate enrollment, specific-ID revocation, rollback, independent assignment aggregation, and stale-result guards passed inspection and probes. The generic retry message leaves the reused class-creation endpoint's ambiguous outcome less clear than invitation recovery; see F2.                               |
| Security, privacy, and tenant isolation     |      20/20 | New operations recheck current database roles, active organization/class/member/user state, and owner/admin authority. Issuer authority is checked before redemption, including replay. Only hashes are stored; response schemas and allowlisted audits omit secrets and learner identities from class aggregates. Guard, IDOR, lifecycle, malformed-auth, no-store, and audit-failure probes passed. |
| Test and verification evidence              |      18/20 | Fresh full check passed 357 tests, lint, formatting, types, and all builds; focused 24 tests and 14 independent adversarial probes passed; final actual-preview Chromium matrix passed 21 cases. Some valuable late-response and fault-path checks exist only in the review probes rather than durable checked-in tests; see F1.                                                                      |
| Operability, recoverability, and provenance |      14/15 | Safe trace-correlated audits, transaction rollback, reissue/redeem/revoke recovery, fresh-memory containment, original-source provenance, and preview limitations are documented. The runbook should distinguish refresh-first recovery for ambiguous class creation from safe invitation retry; see F2. Delivery evidence must still be produced after this gate.                                    |
| **Total**                                   | **96/100** | **PASS, strictly greater than 85, with no critical blocker.**                                                                                                                                                                                                                                                                                                                                         |

## Findings

No blocking finding was reproduced in the reviewed change. The following are small follow-ups, not acceptance blockers for this scope.

### F1 — preserve the independent failure and stale-response probes

`apps/web/test/classrooms-e2e.test.tsx:67` currently concentrates the new UI behavior in two broad cases. `services/api/test/classrooms.test.ts:75` has a useful all-route middleware loop, but the permanently checked-in suite does not preserve every malformed/unknown-credential, issuer-lifecycle, issuance/revocation audit-failure, and late-response case exercised independently here.

The four supplemental React probes passed: late dashboard after class selection, late issued secret after class selection, late join completion after API identity replacement, and remounting the actual Studio when the selected class changes. Promote these and the highest-value rollback/authority probes into focused durable tests so future regressions remain detectable. Current behavior passed; this is a coverage durability gap.

### F2 — clarify recovery after a lost class-creation response

`apps/web/src/components/classroom-manager.tsx:81` uses one retry-or-refresh message for all mutations, while `apps/web/src/components/classroom-manager.tsx:135` reissues class creation without a request identifier. The reused `TenantRepository.createClass` deliberately creates a new UUID on each call. If its success response is lost, another submit can create a second same-name class; refreshing the list first reveals the committed first class.

This is inherited endpoint behavior that the plan explicitly chose to reuse, and it does not defeat invitation capacity, tenant isolation, or enrollment idempotence. Prefer a refresh-first instruction for class creation in the UI/runbook; a broader idempotent creation API can be separately planned. Invitation issuance and redemption recovery already have the promised semantics.

## Independently executed evidence

1. `corepack pnpm check` — exit 0. **35 test files / 357 tests passed**; ESLint, Prettier, root/web TypeScript checks, every workspace package build, and normal Vite build passed. Full log: `/tmp/lq-phase2-independent-check.log`.
2. Focused `vitest run` over classroom contracts, repository, API, real React→HTTP→Hono→PGlite tests, HTTP-client tests, and four temporary review tests — exit 0. **6 files / 24 tests passed**. Log: `/tmp/lq-phase2-independent-focused.log`. The temporary `apps/web/test/phase2-independent-review.test.tsx` was then removed; its source remains at `/tmp/lq-phase2-independent-ui.test.tsx` for inspection.
3. `node /tmp/lq-phase2-independent-probes.mjs` — exit 0. **14 independent probes passed**. Log: `/tmp/lq-phase2-independent-probes.log`. Cases covered:
   - All new teacher/invitation operations and redemption replay after teacher disablement/demotion, organization-membership disablement/demotion, ownership transfer, organization disablement, and class disablement.
   - Already-enrolled students consume no new seat; 12 concurrent same-student requests produce one JOINED and 11 DUPLICATE outcomes with exactly one consumed seat.
   - Failure of issuance success auditing rolls back rotation; failure of revocation success auditing rolls back revocation, leaving the previous code usable.
   - Cross-class and cross-tenant invitation IDs cannot revoke another invitation; current ORG_ADMIN authority works, then ceases to work after demotion without ownership.
   - Multiple assignments and students produce literal independent sums; nonmembers, disabled assignments, and students whose platform role changes are excluded; no student UUID, code, or hash appears in dashboard JSON.
   - Every new route rejects malformed/unknown credentials; successful reads are no-store; a denied-audit write failure produces a safe no-store 500 without the code or exception text in response/diagnostics.
4. Exact `corepack pnpm test:preview` — exit 0, **21/21 Chromium cases passed in 47.5 seconds**, across **1440×900, 768×1024, and 375×812**. Both normal-containment and preview builds passed. Each viewport completed new class → issue → rotate → publish → reject old code → join → play/complete → teacher dashboard → select original class. Existing authoring/sandbox, recovery, reset/reload, role switch, and normal-build isolation cases also passed. The suite observed zero external requests, unexpected service workers, or browser errors. Existing selected cosmic measurements retained 44px minimum targets and minimum measured contrast 8.2359 with no recorded violations; this is not a complete WCAG certification of every new surface. I also inspected the mobile classroom screenshot for wrapping and layout. Terminal session: `97960`; ignored screenshots: `test-results/service-preview-classroom--dbe0c--play-and-teacher-dashboard-{desktop,tablet,mobile}/phase2-classroom.png`.
5. `git diff --check` passed; all 24 candidate implementation fingerprints matched. No dependency versions, Vercel configuration, reference repositories, or real data were changed by this review.

## Other inspected evidence and limits

- The implementer separately passed integration **52**, E2E **67**, and legacy demo Chromium **12**, and completed an authorized production dependency audit with no known vulnerabilities. These are implementer results, not independently rerun counts. My optional independent audit attempt hit sandbox DNS failure; its escalated retry was interrupted while awaiting approval, so I do not count it as a completed independent audit. I inspected the unchanged dependency manifests/lockfile and retain the successful implementer audit evidence.
- Existing PGlite direct-eval and chunk-size build warnings remain. The current preview's strict CSP and normal-build exclusion still passed the browser tests; the warnings do not establish production database readiness.
- PGlite concurrency probes prove behavior in the supported synthetic runtime. They do not substitute for multi-connection PostgreSQL testing, operating rate limits, persistent migrations, durable worker recovery, production authentication, or real student privacy operations. These remain outside this slice as the approved plan states.
- The plan's later Git/CI/Vercel steps correctly follow independent acceptance. Before delivery is claimed, check the actual merge candidate and required CI, then verify the deployed commit, status, and live flow. This review does not authorize bypassing those gates or expanding into reference systems or real data.

The reviewed synthetic implementation may proceed to the separately required integration and delivery checks. The two nonblocking findings do not require production edits for this acceptance; any later implementation change still requires appropriate verification and independent review.
