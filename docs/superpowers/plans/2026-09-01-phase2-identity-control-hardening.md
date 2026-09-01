# Phase 2 Identity Control-Character Hardening Plan

**Goal:** Close the independently reproduced C1-control gap in opaque source identity keys before any real exporter or identity data can consume the transition contract.

**Base:** `79e9dde6a8ff2b1f6bb850b2f94135d355f38a2f`

**Branch:** `codex/phase2-identity-control-hardening`

**Architecture:** Keep the existing strict v1 contracts and pure reconciliation API unchanged. Extend the single shared opaque-identifier predicate so Unicode general category `Cc` is represented by its exact code-point ranges: C0 U+0000–U+001F, DEL/C1 U+007F–U+009F. Reject inputs without trimming or normalization. Accepted-input canonical JSON and checksums remain unchanged.

**Controlling finding:** `docs/reviews/2026-09-01-phase2-identity-export-final-review.md` F1.

## Constraints

- Use only synthetic strings. Do not access Firebase, WordQuest services, real student data, credentials, persistent databases or paid resources.
- Do not add I/O, a real exporter, CLI, API, auth adapter, DB schema, migration or browser/runtime import.
- Do not change transition formats, version 1 shapes, finding codes, checksum encoding, opaque-key length bounds or the existing edge-whitespace rule.
- Do not silently remove or normalize characters. Invalid input must continue to fail with the constant public `DataTransitionValidationError` through the pure package API.
- Add no dependency or external version change. The existing local workspace link remains the only data-transition dependency.
- Production edits begin only after the plan scores at least 86/100 with no critical blocker. Completion requires a fresh non-implementing reviewer to score the actual candidate at least 86/100 with no critical blocker.

## File map

| File                                                                        | Responsibility                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/contracts/test/data-transition.test.ts`                           | C1 boundaries and shared contract rejection RED/GREEN       |
| `packages/data-transition/test/identity-reconciliation.test.ts`             | constant-error/redaction regression for C1 input            |
| `packages/contracts/src/data-transition.ts`                                 | exact Unicode `Cc` code-point rejection                     |
| `docs/reviews/2026-09-01-phase2-identity-control-hardening-verification.md` | implementer evidence and limits                             |
| `docs/reviews/2026-09-01-phase2-identity-control-hardening-final-review.md` | independent final gate                                      |
| `docs/PHASE2_PROGRESS.md`, `memory/projects/lessonquest.md`                 | status and retained real-transition boundary                |
| `docs/superpowers/plans/2026-09-01-phase2-identity-export.md`               | completed PR/CI/Vercel delivery checkboxes from prior slice |

## Task 1 — reproduce the exact gap

- [x] Add contract table cases for U+0080, U+0085 and U+009F embedded in otherwise valid synthetic `externalAuthId` values. Prove all are rejected rather than normalized.
- [x] Exercise the shared schema through export `externalAuthId`, export `legacyOrganizationKey`, account mapping `externalAuthId` and organization mapping `legacyOrganizationKey` so no identity-key path bypasses the predicate.
- [x] Retain the existing C0/DEL cases and add adjacent accepted-boundary evidence where it does not conflict with the existing edge-whitespace rule.
- [x] Add a pure-package case proving C1 input throws only the constant `DataTransitionValidationError`, with no raw identifier, Zod input, cause or stack serialized into the public error value.
- [x] Run the two focused files and record RED showing C1 values are accepted before production code changes.

## Task 2 — implement the minimal shared correction

- [x] Change `containsControlCharacter` to reject code points U+0000–U+001F and U+007F–U+009F. Keep code-point iteration so surrogate pairs are not split and avoid a lint-banned control-character regex.
- [x] Do not alter schema messages, shapes, versions, canonicalization, hashes, mappings or reconciliation behavior.
- [x] Rerun the focused files GREEN and confirm the pinned source/mapping checksums remain exactly unchanged.

## Task 3 — regression and containment evidence

- [x] Run `corepack pnpm check`, integration, E2E, demo browser, service-preview browser, production audit and `git diff --check` without increasing timeouts.
- [x] Rebuild normal/demo/preview outputs and scan JS/source maps for all transition formats, the package name, privileged-role finding and synthetic fixture identifiers. Require zero matches.
- [x] Inspect the lockfile and dependency manifests; require no dependency/version change.
- [x] Update Phase 2 progress and project memory. State that this closes F1 but does not authorize a real exporter, real-data dry run or migration.
- [x] Record exact RED/GREEN/final counts, warnings, scope and containment in the implementer verification report.
- [x] Freeze SHA-256 hashes for implementation/test/script files before independent review.

## Task 4 — independent gate and authorized delivery

- [x] Assign a fresh non-implementing agent to inspect the actual diff and manifest, rerun focused/full/containment checks and adversarial boundary probes, and score the five project rubric categories.
- [x] The result was 99/100 with no critical blocker, so the conditional test-first remediation path was not required.
- [ ] After a passing review, commit the exact candidate, push, open a PR and require exact-head CI. Confirm `main` remains the expected base and merge only with the reviewed head SHA.
- [ ] Verify exact-merge main CI, the existing Git-linked Vercel deployment and the live synthetic preview/asset isolation. Record all release evidence in the PR body.

## Acceptance and recovery

- U+0080, U+0085 and U+009F fail every opaque source-key input path.
- Existing valid fixture checksums and readiness reports are unchanged.
- Public invalid-input errors remain constant and redacted.
- No operating runtime, browser bundle, dependency, external repository or data system gains transition code or access.
- Recovery is a normal code revert: this change writes no state and performs no external operation before the authorized delivery step.
- Any real Firebase export, backup, aggregate checksum, dry run, write, rollback rehearsal or migration remains a separate gated task requiring explicit scope authority.
