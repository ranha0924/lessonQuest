# F01 Final-Gate Remediation Plan

Date: 2026-09-07

Scope: one bounded correction wave for the independent review of candidate `c92c3a4af6fd81653a59a35c4758f00e3a1831a2`. The original synthetic-preview design and all tenant, privacy, immutable generated-content, dependency and delivery boundaries remain controlling. This does not authorize a live deployment before a new independent PASS.

## Reproduced causes and decisions

1. An uppercase target UUID is accepted by the shared UUID schema and by PostgreSQL lookup. The first update returns 200, but the identical replay returns409 because `LessonInputRepository.update` compares the canonical lowercase stored target against the unnormalized request string. Normalize validated F01 organization/resource identifiers at the existing repository parsing boundary before lookup, hashing, audit target selection and replay comparison. Do not change the global UUID primitive or other repositories. Different targets, actors, organizations and request bodies must remain distinct; replays still recheck current authority.
2. F01's text schemas accept NUL and unpaired UTF-16 surrogates. The API/PGlite boundary returns retryable500 for NUL in all three text fields; lone surrogates in title/content silently become U+FFFD, while objective JSON can fail. A real375px browser probe showed NUL then locks the editor on every retry. Clarify the F01 text domain to well-formed Unicode scalar text excluding U+0000. Reject, never silently strip or replace, unsupported text at the shared contract boundary before any write or pending UI mutation. Preserve ordinary Hangul, valid supplementary characters/emoji, combining marks, tabs/newlines and the existing trimming, field lengths, objective order/uniqueness and supported grades. This is not a general blacklist of control characters or an identity-contract change.

Evidence: the independent review's `final-review-logs/08-adversarial.log`, `08b-adversarial-unicode.log` and `10-browser-probe.log`, and the preserved first final-review report. No real data was used. The full ordinary462-test and39-preview suite passed; these additional probes exposed missing boundary coverage rather than invalidating the recorded ordinary results.

### Task 1: Correct both independent findings and verify the candidate

## File-level correction wave

- `packages/contracts/src/lesson-inputs.ts`: one small reusable persistable-text refinement applied to title, content and each objective. Keep other contracts untouched. Give the UI a stable safe discriminator for this validation reason if required; do not expose submitted text/raw errors.
- `packages/contracts/test/lesson-inputs.test.ts`: rejected NUL, lone high surrogate and lone low surrogate in each text field for create/update; positive exact preservation of valid surrogate pairs, Hangul, combining text and permitted whitespace. Retain bounds and mass-assignment tests.
- `packages/db/src/lesson-input-repository.ts`: canonicalize only the already-validated F01 UUID parsing result before its consumers; do not remove the target binding or weaken the replay hash/authority checks.
- `packages/db/test/lesson-input-repository.test.ts`: mixed/uppercase organization/target lookup and exact update replay produce one revision increment and duplicate success; distinct target/body reuse still conflicts and revoked replay remains denied. Add direct invalid-text rejection/no-write proof where useful.
- `services/api/test/lesson-inputs.test.ts`: real package-built LocalAuth/Hono/PGlite uppercase target update and identical PUT replay return200 with duplicate true and unchanged row/revision/mutation counts. Invalid text in title/content/objectives on POST and PUT returns safe nonretryable400, no-store, and no changed resource/revision/mutation. Valid Unicode round-trips exactly. Diagnostic/audit privacy remains content-free.
- `apps/web/src/components/lesson-input-workspace.tsx`: if needed, distinguish the new unsupported-text validation reason from existing length/duplicate errors with an actionable Korean field message. Keep local fields editable and unchanged, send no request for invalid text, and allow correction then normal save. Do not alter uncertain network retry or stale-conflict semantics.
- `apps/web/test/lesson-input-workspace.test.tsx`: unsupported text shows the right field guidance, retains all text, never calls create/update, and does not enter pending/frozen state; corrected text saves normally. Preserve existing exact retry/conflict tests.
- `tests/browser/service-preview.spec.ts`: durable real-preview NUL regression at all three configured widths: no editor lock, field error and exact local text retained, no saved item, correction succeeds. No threshold/config weakening.
- Documentation: preserve failed review, update the original design with this explicitly dated text/UUID clarification, append fresh evidence and manifest to the existing verification document, and mark only completed remediation steps.

No schema migration, production data operation, added dependency, global UUID normalization, reference-system modification, F02 generation, operating persistence, deployment setting or authorization expansion is permitted.

## Ordered TDD and verification

- [x] Read canon, original spec/plan, first independent findings and this plan; confirm pre-implementation review score strictly greater than85 with no critical plan blocker.
- [x] Add durable contract/repository/API/component/browser regressions FIRST and run them against unchanged production code. Record expected invalid-text acceptance/409 replay/locked-editor failures, not fixture setup failures. Use package-built repositories at the HTTP boundary to preserve error-class identity.
- [x] Fix validated UUID canonicalization; rerun its focused repository/API cases. Then fix the shared text refinement and safe field guidance; rerun text/schema/API/component/browser cases. One cause at a time, one implementing agent, no unrelated cleanup.
- [x] Run the complete final matrix sequentially with correctly propagated command exits: `corepack pnpm check`, `corepack pnpm test:integration`, `corepack pnpm test:e2e`, `corepack pnpm test:browser`, `corepack pnpm test:preview`, `corepack pnpm audit --prod --audit-level high`, and `git diff --check 79e9dde..HEAD` plus working-diff checks before commit.
- [x] Repeat changed-file credential/dependency and emitted normal-build containment checks. Freeze every changed runtime/test/config file with SHA-256 and an aggregate manifest hash; keep review prose outside that hash. Preserve the old candidate/failed review evidence instead of rewriting it as a success.
- [x] Commit the complete bounded fix/evidence candidate. A fresh non-implementing final reviewer must verify both original findings, inspect the full actual branch diff and fix diff, match hashes, independently rerun the required checks/probes and record a new score under `docs/reviews/2026-09-07-f01-lesson-inputs-final-review-attempt-2.md`. This also supplies the scoped fix re-review; it does not replace full independent verification. Completed 2026-09-08 on candidate `3ed98c230a4bd476ebf81df506683c39050d835e`: independent Attempt 2 PASS **98/100**, both findings addressed, no critical or important finding, and all 24 frozen files unchanged.
- [ ] Only after a new score86+ and no critical blocker: exact-head PR CI, guarded main merge, main CI, existing Git-linked Vercel SHA/status and live synthetic save/reopen/revise/reset verification. No duplicate manual deployment.

## Acceptance and recovery

- Identical accepted mixed-case UUID requests are idempotent without weakening scope or different-input conflict detection.
- Unsupported text is rejected deterministically before storage or a frozen retry state, with editable original fields and actionable guidance. Every accepted character round-trips without replacement.
- The ordinary and new regression suites pass, all24+ affected-file hashes match the new candidate, and a different independent reviewer scores it above85 with no critical blocker.
- Recovery is a reviewed local revert of this bounded correction in the synthetic worktree; no operating migration or real records exist. Reset/full refresh remains the preview recovery boundary. Never revert by weakening a required test or erasing the failed review.
