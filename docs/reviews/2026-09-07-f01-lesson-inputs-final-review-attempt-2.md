# F01 independent final validation — Attempt 2

Actual validation date: **2026-09-08**. The filename retains the requested 2026-09-07 prefix for stable references. Reviewer: fresh independent agent `/root/f01_final_validation_2`, which implemented none of this change and was not the Attempt 1 reviewer. No reviewer subagent was used. Implementation, index, HEAD, and branch state remained unchanged; writes were limited to this report and ignored verification artifacts.

**Verdict: PASS — 98/100, no critical blocker. Both F01-FV-1 and F01-FV-2 are ADDRESSED.** This supplies both the independent whole-branch final gate and the scoped remediation re-review. One nonblocking test-durability follow-up is recorded below.

## Candidate and controlling evidence

- Base: `79e9dde6a8ff2b1f6bb850b2f94135d355f38a2f`.
- Candidate: `3ed98c230a4bd476ebf81df506683c39050d835e`, branch `codex/f01-lesson-inputs`.
- Remediation base: `0cdcd68c1efed3ae7cf984a7ecd90756f85e3067`.
- Whole branch: 18 commits, 35 changed files, 5,524 insertions and 45 deletions. Remediation: 11 files, 492 insertions and 11 deletions; production changes are confined to the F01 text schema, its field guidance, and repository UUID parsing.
- Frozen implementation/test/config set: **24/24 files match before and after independent verification**, aggregate SHA-256 `542a8696dea998684b7e41e3638db2a302ce661a46623d4bf90aef0267591de3`. Every individual entry also matches the remediated manifest in `docs/reviews/2026-09-07-f01-lesson-inputs-verification.md`.
- Both supplied review packages match actual `git diff --find-renames --unified=10` byte-for-byte. Raw broad diff SHA-256: `b5c71d001830559551f0bc8b45d048e43df86d6ca8916458e7d86f859915a7f6`; raw remediation diff: `db962cd9e02dc7c95e15487242269ded3b8eac85087dc31843918e3489c735a3`.
- The first **FAIL 84/100** report remains unchanged, SHA-256 `e9f16d4ab6c456e69a347ef2c0ba723da51f2551116229779091739c7bc57f42`. Its old 24-file manifest remains unchanged at aggregate `87cf18da6e2c59585db4ced09db25923685428e61bec2e7f4b1bd385c9bfdc97`; it is historical evidence, not this candidate's manifest.

I read AGENTS, the project canon, the final 25/20/20/20/15 rubric, the original F01 design and implementation plan, the original plan/task/amendment reviews, the dated text/UUID clarification, the remediation plan and its 99-point review, the preserved failed review, current verification record, implementer recovery report, and both SDD ledgers. Review covered the actual whole-branch runtime/test/config diff in sections, all documentation additions through their candidate files, and the complete scoped correction diff. The senior code-reviewer template supplied plan alignment, severity, strengths, recommendations, and merge-readiness structure; repository requirements controlled the independent full rerun.

The assessed scope is **synthetic in-tab PGlite teacher-source authoring**. No operating authentication, shared or durable backend, Firebase, real student data, external AI, F02 generation, reference-system change, or production migration is claimed or required by this gate. No commit, push, merge, deployment, or external application write was performed. Release verification belongs to the controller after this gate.

## Strengths and whole-branch conformance

- Mutable teacher source is stored independently of generated experiences and immutable approved versions. Shared strict contracts bound fields, grades, objective count/order/uniqueness, request identity, revision, and response projections. Authenticated ownership is server-derived, and client-supplied ownership/tenant fields are rejected.
- Repository reads, writes, and successful replays use current database organization, membership, user status, and compatible roles. Teachers are owner-scoped; authorized organization administrators can manage organization resources while platform-administrator creation remains denied. Independent probes confirmed actor/tenant mutation-key isolation, forged-claim denial, current revocation, and generic foreign/missing resource responses.
- Parameterized source writes, mutation evidence, and successful audits share a transaction. Independently rerun audit-trigger tests prove create/update rollback. Audits and diagnostics are metadata-only. Eight identical concurrent creates or updates produce one mutation effect; distinct optimistic writers produce one success and one safe conflict in one synthetic runtime.
- The editor preserves complete pending requests through genuine uncertain delivery, retains local values on conflict, requires explicit authoritative reload, and guards against stale responses. The real React → HTTP → Hono → PGlite tests confirm save/remount/reopen/revise and exact post-commit lost-response recovery. The existing generated-content controls remain unchanged.
- F01 alone receives the reviewed 256 KiB default body cap; explicit configured caps and other routes' 64 KiB defaults still pass their tests. Auth, Origin, JSON media type, no-store responses, trace metadata, and safe failure envelopes remain active.
- Fresh Chromium runs confirm create/return/reopen/revision/reset, populated text contrast, targets, focus, reduced motion, and existing learning flows at desktop, tablet, and mobile widths. I inspected the fresh desktop/mobile revision screenshots and mobile invalid-text screenshot: the expected two-column/stacked workspace, revision badge, field guidance, and controls are visible without clipping.

## Scoped remediation verdicts

### F01-FV-1 / P1 — ADDRESSED

The shared refinement at `packages/contracts/src/lesson-inputs.ts:11` rejects U+0000 and lone high/low UTF-16 surrogates in each persistable field without stripping or replacement. The Unicode-mode surrogate pattern allows valid supplementary pairs. The component maps the safe discriminator to field guidance at `apps/web/src/components/lesson-input-workspace.tsx:56`; validation returns before pending mutation state or an API operation is established.

Independent evidence:

- All **2,048** possible lone surrogate code units were rejected in title/content/objectives by both create and update schemas: **12,288 assertions**.
- The real built-package HTTP/PGlite probe exercised NUL, lone high, and lone low surrogates in all three fields for POST and PUT: **18 combinations**, each repeated identically, **36 requests**. Every response was **400 `INVALID_REQUEST`, `retryable: false`, `Cache-Control: no-store`**, with the established redacted envelope. Complete source-row and mutation-row snapshots remained identical after every attempt, including revision and timestamps. Diagnostics and audits contained no submitted marker.
- Supplementary boundary values U+10000/U+10FFFF, emoji, Hangul, combining marks, tabs, LF, CR, and permitted U+0001 round-tripped through create/update/read exactly under existing trim rules. No Unicode normalization or U+FFFD substitution occurred.
- The durable new preview regression passed at **1440×900, 768×1024, and 375×812**. A separate independent **375×812** probe covered all **18 field/create-or-update combinations**. It compared every field's UTF-16 code units before/after rejection, verified the affected field's `aria-invalid` guidance and enabled controls, confirmed unchanged saved-option/revision state, corrected the field, saved successfully, and reopened the exact corrected text. Nine initial creations remained revision 1; nine corrected updates advanced the last resource once per correction to revision 10. No permanent retry lock occurred.
- Existing uncertain create/update component cases and actual post-commit response-loss E2E cases passed. The corrective diff does not relax pending-request locking or replace a genuinely uncertain mutation ID.

The separate mobile probe additionally confirmed literal markup rendering, full-refresh discard, zero external requests, and zero browser errors. Rejected text is editable locally; this is distinct from the unchanged locking policy for an uncertain transport outcome.

### F01-FV-2 / P2 — ADDRESSED

`packages/db/src/lesson-input-repository.ts:63` now lowercases only validated F01 organization/resource UUIDs. Create/list/get/update consume that result before lookup; update consumes it before target hashing and replay comparison. The global UUID schema, mutation IDs, actor parsing, authorization, and operation/body binding are unchanged.

Independent evidence:

- Durable repository and real HTTP uppercase update/replay cases passed with duplicate success, one revision increment, and one mutation row.
- A separate real HTTP/PGlite probe created through a mixed-case organization path, replayed create through uppercase, updated through mixed-case organization/uppercase target, and replayed all **nine lowercase/uppercase/mixed-case organization/target combinations**. Every exact replay returned **200**, `duplicate: true`, the same current resource, and no changed source or mutation row.
- Changed target, changed title/body, changed objective values, and cross-operation reuse retained safe **409** conflicts without further writes. The preserved original probe separately confirmed objective-order binding and canonical object-order/trim equivalence.
- Five current-authority revocations—organization status, membership status, membership role, user status, and platform role—denied **10 exact POST/PUT replays** through mixed/uppercase paths with safe **404**, no-store, and unchanged source/mutation state. Restored authority allowed exact replay again. The separate original probe also passed administrator-demotion and forged-claim checks.
- The original uppercase-target reproduction now returns **200/200**; its stored row remains revision **5** with exactly one matching update mutation. This is a fresh execution of the preserved reproduction against the new candidate, not an inference from lowercase UI behavior.

## Independent commands and results

Environment: Node `v24.13.0`, pnpm `11.24.0`. Standard commands and PGlite suites ran sequentially. Logged pipelines used `/bin/bash` with `set -o pipefail`, and the tool returned the actual exit. Logs/scripts below are under ignored `.superpowers/sdd/2026-09-07-f01-final-gate-remediation/attempt-2-logs/`.

The focused selection was:

```text
corepack pnpm exec vitest run packages/contracts/test/lesson-inputs.test.ts packages/db/test/lesson-input-repository.test.ts services/api/test/lesson-inputs.test.ts apps/web/test/lesson-input-workspace.test.tsx apps/web/test/api-client.test.ts apps/web/test/lesson-inputs-e2e.test.tsx
```

| Command or independent probe                              | Actual exit | Result                                                                                                                                      | Evidence                       |
| --------------------------------------------------------- | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Focused selection above after dependency builds           |           0 | 6 files / 53 tests                                                                                                                          | `00b-focused-exit.log`         |
| `corepack pnpm check`                                     |           0 | Lint, full formatting, types, 44 files / 473 tests, all workspace builds; normal web 149 modules                                            | `01-check.log`                 |
| `corepack pnpm test:integration`                          |           0 | 9 files / 80 tests                                                                                                                          | `02-integration.log`           |
| `corepack pnpm test:e2e`                                  |           0 | 12 files / 80 tests                                                                                                                         | `03-e2e.log`                   |
| `corepack pnpm test:browser`                              |           0 | Demo 149 modules; 12/12 Chromium cases                                                                                                      | `04-browser.log`               |
| `corepack pnpm test:preview`                              |           0 | Normal 149 / preview 230 modules; 42/42 Chromium cases                                                                                      | `05-preview.log`               |
| `corepack pnpm audit --prod --audit-level high`           |           0 | No known vulnerabilities                                                                                                                    | `06-audit.log`                 |
| Exact base-to-candidate and working `git diff --check`    |           0 | No whitespace errors                                                                                                                        | `07-range-diff.log`            |
| `node --input-type=module < …/remediation-probes.mjs.txt` |           0 | 6 groups; 12,288 surrogate assertions, 36 invalid HTTP attempts, Unicode preservation, 9 casing combinations, conflicts, 10 revoked replays | `08-remediation-probes.log`    |
| Preserved original `final-review-probes.mjs`              |           0 | 17/17 adversarial groups; six additional text characterizations now show rejected contracts, safe 400/400, and no stored row                | `09-authority-concurrency.log` |
| `node --input-type=module < …/containment.mjs.txt`        |           0 | Manifest/history/package matches, dependencies, credentials, normal output                                                                  | `10-containment.log`           |
| `node --input-type=module < …/browser-probes.mjs.txt`     |           0 | 18 mobile correction cases; literal rendering, refresh discard, zero external requests/errors                                               | `11-browser-probes.log`        |

The first focused invocation printed 53 passing tests, but its logging wrapper omitted pipefail; its wrapper exit was not accepted as numerical test-exit evidence. The standalone focused selection was rerun with correct propagation and exited 0 as shown. There was no product failure in the independent matrix. All historical implementer failures, including the audit-test timeout and harness/expectation corrections, remain preserved rather than relabeled as independent successes.

For the full check, the three pre-existing ignored `final-review-*.mjs` scripts were temporarily relocated into a `mktemp` directory under an EXIT trap because flat-config ESLint discovers them despite Git ignore. Exactly those scripts were restored, with matching before/after SHA-256:

- Browser: `15292956a3ad8436916c86560b0cb51192546fdca51d2477f9ac8fa8ab3c8ff6`.
- Containment: `75434d55e8b3a9f1bff9991cb66670d56da958924f9a1336f46d72089a8d37bc`.
- Adversarial: `d9a68a873ad8d36afd8658c3ba7be81cb905daddf28d0ce538be28abc5eacfc5`.

`01-check.log` ends with `CHECK_EXIT=0 RESTORED_HASHES_MATCH=true`. No ESLint configuration, rule, threshold, test timeout, or formatter coverage of durable files was weakened. This review's executable probe sources use ignored `.mjs.txt` files executed through Node stdin. The disposable browser server was stopped after the probe; no user server was changed.

The fresh eight-state preview measurements reported no violations, minimum target **44 px**, minimum contrast **8.235958813134527:1**, and maximum audited surface luminance **0.019797328993540628** at all three widths. Base badge/error contrast measured **9.466140054462286:1 / 6.923835590694159:1**; cosmic measured **10.239195606496041:1 / 10.37222266103891:1**. Existing injected 20 px target and 1:1 contrast faults were detected by the demo suite. These are selected rendered-state measurements, not a complete WCAG certification.

## Containment and provenance

All dependency sections across **11 package manifests** are unchanged from the whole-branch base. The lockfile, workspace dependency catalog, authentication package, global UUID primitive, service-worker policy, CI/Vercel settings, and Playwright configurations are unchanged. The root package's only change adds the planned test paths to integration/E2E scripts.

The fresh normal output contains **8 files**, including **5 HTML/CSS/JS/source-map files** inspected for ten markers: preview bearer prefix, both synthetic actor IDs, PGlite package/runtime/WASM names, and sample title/objective/body values. There were zero marker matches and zero PGlite/initdb/mount/nodefs/opfs artifact filenames. The normal-build fail-closed browser cases also passed. Added-line credential scans found zero private-key, AWS, GitHub, Google, OpenAI, Slack, JWT, or Firebase-configuration shapes; manual diff inspection identified only synthetic fixture/header/code/prose authorization values.

F01 provenance is explicitly original LessonQuest code. New schema objects are additive for fresh synthetic databases; source/mutation/audit rollback and reset/revert containment are demonstrated without operating migration claims. The existing PGlite eval/preview-bundle and runner color warnings remain non-failing dependency/environment warnings. Historical RED/GREEN evidence aligns with the bounded code changes; this reviewer witnessed the current GREEN/probes, not earlier implementer executions.

## Findings and recommendations

### Critical and Important

None found in the approved scope. The two Attempt 1 required findings are closed by the evidence above.

### Minor — nonblocking test durability

**F01-FV2-N1 / P3:** `apps/web/test/lesson-input-workspace.test.tsx:164` exercises invalid text during create with one unsupported character class per field; `tests/browser/service-preview.spec.ts:113` locks down NUL/content/create at all widths. The full update/all-field correction behavior currently has this review's passing ignored mobile probe rather than a checked-in UI regression. Preserve a representative invalid-update field matrix in the durable suite so a future divergence between create/update validation is caught automatically. Current API coverage already includes all 18 field/method combinations, and the independently executed mobile matrix confirms today's behavior; this is not a current functional blocker.

For repeatable future reviews, retain the documented ignored-probe isolation wrapper or use a clean candidate checkout. Historical scratch must not be mistaken for candidate lint failures or erased to make a check pass. Required CI, main integration, deployed SHA/status, and live synthetic verification remain separate release steps owned by the controller.

## Score and final assessment

| Final rubric category                       |      Score | Evidence and deduction                                                                                                                                                                                                 |
| ------------------------------------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      25/25 | Complete bounded F01 flow and dated clarification hold; no unauthorized F02/backend/deployment expansion.                                                                                                              |
| Correctness and code quality                |      20/20 | Both root causes corrected at shared boundaries; exact replay, lossless accepted text, editable rejection, transactions, revisions, and stale-response behavior pass.                                                  |
| Security, privacy, and tenant isolation     |      20/20 | Fresh active-authority/tenant/actor/admin probes, safe HTTP/metadata, literal text, and normal-build containment pass.                                                                                                 |
| Test and verification evidence              |      19/20 | Full fresh matrix and adversarial/UI probes pass; one point withheld for the nonblocking durable invalid-update UI coverage gap.                                                                                       |
| Operability, recoverability, and provenance |      14/15 | Reset/revert and transactional recovery, trace-only diagnostics, preserved history, dependencies, and provenance are clear; one point withheld for manual scratch-isolation requirements in the local review workflow. |
| **Total**                                   | **98/100** | **PASS — exceeds 85; no critical blocker.**                                                                                                                                                                            |

**Ready to merge: Yes, subject to the repository's required exact-head CI and guarded release workflow.** Candidate `3ed98c230a4bd476ebf81df506683c39050d835e` satisfies the independent final gate for synthetic F01 authoring. This report accepts that candidate's implementation and closes both scoped findings; it does not certify an operating backend or an already completed release.
