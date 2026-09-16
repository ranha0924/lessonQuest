# F01 independent final validation — Attempt 1

Date: 2026-09-07. Reviewer: fresh independent agent `f01_final_validation`, which did not implement any reviewed change and did not modify implementation, index, HEAD, or branch state.

**Verdict: FAIL — 84/100. Do not accept, merge, or deploy this candidate.** Two reproduced correctness findings require remediation and a fresh independent review. The ordinary verification matrix is green, but the exact-replay and recoverable-input requirements do not hold for every accepted input. No tenant leak, operating credential exposure, or generated-content publication bypass was found.

## Candidate and review coverage

- Base: `79e9dde6a8ff2b1f6bb850b2f94135d355f38a2f`.
- Candidate: `c92c3a4af6fd81653a59a35c4758f00e3a1831a2`.
- Branch: `codex/f01-lesson-inputs`.
- Complete range: 16 commits, 32 changed files, 4,840 insertions and 45 deletions. The supplied complete review package was inspected in manageable sections and independently matched byte-for-byte to the actual `git diff --find-renames --unified=10` for this range.
- Frozen implementation/test/config manifest: all **24 files match**, before the independent checks and after them. SHA-256: `87cf18da6e2c59585db4ced09db25923685428e61bec2e7f4b1bd385c9bfdc97`.
- Controlling inputs reviewed: `AGENTS.md`, `docs/PROJECT_CANON.md`, the final rubric in `memory/projects/lessonquest.md`, the F01 design and implementation plan, all three F01 plan-review records, the durable implementer verification record, the SDD progress/deferred-finding ledger, Task 7 report, and relevant earlier task RED/GREEN and correction evidence. The requesting-code-review skill's senior reviewer template supplied the review structure; the repository's mandatory independent rerun requirements controlled verification.

The assessed delivery boundary is the approved **synthetic in-tab PGlite preview**. This review does not demand operating persistence, PostgreSQL multi-connection behavior, external AI, Firebase, or real student data. It does not certify a release; no commit, push, merge, deployment, reference-repository mutation, or external service write was performed.

## Strengths and plan conformance

- F01 uses a separate mutable source resource and does not read or mutate generated experiences or approved versions. Strict shared schemas own field bounds, grade values, ordered unique objectives, ownership projections, revisions, and response parsing. The repository generates ownership and resource identity from authenticated context.
- Current database organization, user, membership status, and role checks precede successful access and exact replay. Teacher ownership, compatible organization-admin management, teacher-only creation, actor/organization-scoped mutation keys, and generic inaccessible-resource responses work in actual PGlite/HTTP probes. In-tab concurrent identical calls create one record or one revision increment; distinct optimistic writers produce one success and one conflict.
- Parameterized writes, mutation evidence, and successful audits share a transaction. Existing durable tests independently reran and proved audit-trigger rollback for both create and update. Audits and error diagnostics remain metadata-only; ordinary markup is stored and rendered as literal text.
- The component retains a complete pending request through actual lost create/update responses and uses generation/request guards against stale results. Confirmed conflicts retain local values until explicit reload. Its capability is supplied only by the intended preview composition; the optional Studio prop preserves unrelated existing fixtures. The reviewed F01-only 256 KiB default makes maximum Korean and escaped text reachable while the explicit configured cap and other routes' 64 KiB default remain effective.
- Browser save, return, reopen, revision 2, reset, layout, focus, targets, contrast, reduced motion, and existing learning flows pass across all three viewports. Independent inspection of freshly generated desktop/mobile revision screenshots found the expected two-column/stacked presentation without clipping. A separate mobile probe also confirmed literal markup and full-refresh removal of saved F01 data.

## Findings

### Critical security/privacy blockers

None found in the approved synthetic-preview scope. The gate nevertheless fails on score and the required behavior below.

### Important — required before acceptance

#### F01-FV-1 — Reject unrepresentable text before it enters permanent retry or changes during storage (P1)

Primary location: `packages/contracts/src/lesson-inputs.ts:6` (the three text schemas). Consequences: `packages/db/src/lesson-input-repository.ts:299`, `services/api/src/app.ts:251`, and `apps/web/src/components/lesson-input-workspace.tsx:301` / `:319`.

The shared text schemas accept NUL and unpaired UTF-16 surrogates. These are not consistently representable by the actual PGlite TEXT/JSONB storage path. I independently exercised the real shared-contract → Hono → repository → fresh PGlite boundary using `before\u0000after` and `before\uD800after` in each text field:

| Input field and value           | Contract | First / identical replay                       | Persisted result                                  |
| ------------------------------- | -------- | ---------------------------------------------- | ------------------------------------------------- |
| NUL in title                    | Accepted | 500 / 500, `INTERNAL_ERROR`, `retryable: true` | No resource/mutation for that request             |
| NUL in content                  | Accepted | 500 / 500, same retryable envelope             | No resource/mutation for that request             |
| NUL in one objective            | Accepted | 500 / 500, same retryable envelope             | No resource/mutation for that request             |
| Lone surrogate in title         | Accepted | 201 / 200 duplicate                            | Stored title is `before\uFFFDafter`, revision 1   |
| Lone surrogate in content       | Accepted | 201 / 200 duplicate                            | Stored content is `before\uFFFDafter`, revision 1 |
| Lone surrogate in one objective | Accepted | 500 / 500, same retryable envelope             | No resource/mutation for that request             |

These are deterministic input failures, not uncertain transport failures. All responses remained safely redacted and `no-store`; rollback protected the failed requests. However, the retry classification makes the form unable to recover by correcting the text. The independent Chromium mobile probe inserted the NUL content through the real labeled textarea, confirmed its exact value before submission, and observed after both initial save and retry:

```text
content = "before\u0000after"
editorDisabled = true
newDisabled = true
status = "입력은 잠겼으며 같은 요청을 안전하게 다시 보낼 수 있습니다."
```

The text remains visible but cannot be corrected within the workspace's retry state. Title/content surrogate substitution additionally reports success after changing accepted text without an explicit normalization rule. This violates the input-correction/text-preservation and safe-retry acceptance criteria in the design and Task 8.

Required correction: define and enforce the representable-text rule in the shared F01 field contract, including NUL and unpaired high/low surrogates, with an actionable field message. Reject deterministic invalid input before persistence without silently stripping or replacing it. Preserve ordinary Hangul, newlines, and valid surrogate pairs. Add RED/GREEN contract, actual HTTP/repository create/update, and component recovery evidence; invalid text must leave existing records/revisions unchanged and remain editable for correction. Do not relax exact pending-request preservation for genuinely uncertain outcomes as a workaround.

Reproduction: `node .superpowers/sdd/2026-09-07-f01-lesson-inputs/final-review-probes.mjs`; detailed first/replay/storage output is in `final-review-logs/08b-adversarial-unicode.log` and `08c-adversarial-storage.log`. The real mobile result is in `final-review-logs/10-browser-probe.log`, produced by `final-review-browser-probe.mjs` against the existing disposable preview server. Its screenshot is `final-review-logs/nul-mobile.png`.

#### F01-FV-2 — Canonicalize accepted UUIDs before replay comparison (P2)

Location: `packages/db/src/lesson-input-repository.ts:63` and `:493`; the update hash is constructed at `:469`.

`uuidSchema` accepts uppercase UUID text, and the repository retains that spelling. PostgreSQL UUID columns return lowercase. The update replay branch compares the lowercase stored `lesson_input_id` with the unchanged caller string, so an identical valid request can conflict with itself.

The fresh HTTP/storage probe used target `81514CED-2FEB-49AF-8B83-CED9725305E4`, expected revision 4, and one fixed mutation ID/body. The first PUT returned **200**, `duplicate: false`, revision **5**. The identical PUT returned **409**, `RESOURCE_CONFLICT`, `retryable: false`. The database still contained one target at revision **5** and exactly one matching mutation row with lowercase `lesson_input_id` and `result_revision: 5`. Thus no second write occurred, but a lost successful response cannot be reconciled through the promised exact replay. The normal UI currently consumes lowercase server IDs, which limits ordinary UI exposure; the accepted HTTP/repository contract still promises exact replay for this valid path.

Required correction: canonicalize F01 UUID identity consistently before hashing/comparing/using replay keys, or explicitly reject noncanonical spellings before any write. Preserve target/operation binding and current authorization. Add an actual repository/API regression for identical uppercase/mixed-case target replay, plus canonical spelling equivalence or explicit rejection according to the chosen contract; verify no additional revision or ledger entry.

Reproduction: the same `final-review-probes.mjs`, named case `identical update replay remains exact for an accepted uppercase target UUID`. `final-review-logs/08c-adversarial-storage.log` begins with the exact first response, replay response, stored row, and mutation row. Its nonzero exit is an intentional failing review assertion, not a harness failure.

### Minor

No separate minor finding is required for this candidate. Previous Task 3 evidence gaps and Task 4/6 contrast/proof findings are closed in the actual reviewed diff. The two findings above form the bounded remediation list from this review.

## Independent verification

Commands ran sequentially, with no overlapping PGlite suites. The working tree's runtime/config/test files remained frozen. For logged commands, `/bin/bash -o pipefail -c '<command> 2>&1 | tee <log>'` propagated the real exit through the tool result; no zsh `PIPESTATUS` or blank sidecar was treated as numerical evidence. Environment: Node `v24.13.0`, configured pnpm `11.24.0`.

The focused command was:

```text
corepack pnpm deps:build && corepack pnpm exec vitest run packages/contracts/test/lesson-inputs.test.ts packages/db/test/lesson-input-repository.test.ts services/api/test/lesson-inputs.test.ts apps/web/test/lesson-input-workspace.test.tsx apps/web/test/api-client.test.ts apps/web/test/lesson-inputs-e2e.test.tsx
```

All log paths below are under the ignored `.superpowers/sdd/2026-09-07-f01-lesson-inputs/final-review-logs/` directory.

| Command                                                                                               | Actual exit | Independent result / log                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused command above                                                                                 |           0 | 6 files / 42 tests; `00-focused.log`                                                                                                                                           |
| `corepack pnpm check`                                                                                 |           0 | Lint, repository Prettier, types, all workspace builds, 44 files / 462 tests; normal web 149 modules; `01-check.log`                                                           |
| `corepack pnpm test:integration`                                                                      |           0 | 9 files / 74 tests; `02-integration.log`                                                                                                                                       |
| `corepack pnpm test:e2e`                                                                              |           0 | 12 files / 80 tests; `03-e2e.log`                                                                                                                                              |
| `corepack pnpm test:browser`                                                                          |           0 | 12/12 Chromium cases; demo build 149 modules; `04-browser.log`                                                                                                                 |
| `corepack pnpm test:preview`                                                                          |           0 | 39/39 Chromium cases; normal 149 / preview 230 modules; `05-preview.log`                                                                                                       |
| `corepack pnpm audit --prod --audit-level high`                                                       |           0 | No known vulnerabilities; `06-audit.log`                                                                                                                                       |
| `git diff --check 79e9dde6a8ff2b1f6bb850b2f94135d355f38a2f..c92c3a4af6fd81653a59a35c4758f00e3a1831a2` |           0 | No whitespace errors; `07-range-diff.log`                                                                                                                                      |
| Independent adversarial probe                                                                         |           1 | 16/17 assertion groups passed; exact uppercase replay failed; two initial Unicode characterizations; `08-adversarial.log`                                                      |
| Scoped follow-up of the same probe                                                                    |           1 | Same 16/17 result, six field-specific Unicode characterizations and storage evidence; `08b-adversarial-unicode.log`, `08c-adversarial-storage.log`                             |
| Independent containment/manifest probe                                                                |           0 | Manifest, actual diff package, dependencies, credentials, normal assets and scratch checks; `09-containment.log`, final expanded-marker recheck in `09b-containment-final.log` |
| Independent mobile browser probe                                                                      |           0 | Literal rendering and refresh assertions passed; reproduced permanent NUL retry lock; `10-browser-probe.log`                                                                   |

The follow-up probe runs expanded the already observed Unicode/storage issue and retained the same failing uppercase assertion. They were not successful retries of a product failure. The browser characterization script intentionally reports the observed locked state without asserting that it is acceptable. No mandatory standard command needed a retry. The standard full matrix preceded this report-only addition; report formatting is checked separately.

Passing independent adversarial groups additionally demonstrated eight simultaneous exact creates, eight exact updates, two conflicting writers, canonical object-order/trim replay, objective-order hash binding, actor/tenant mutation-key isolation, old replay returning current revision, forged actor-claim denial, five current-authority revocation variants on both replay operations, administrator demotion, generic foreign/missing HTTP shape, all twelve grades at maximum field sizes, metadata redaction, and absence of generated-experience writes. These concurrency observations apply to one synthetic PGlite runtime only.

### Browser evidence and RED/GREEN provenance

The 39-case preview run includes F01 create/return/reopen/revise/reset at 1440×900, 768×1024 and 375×812. The eight-state audit across three viewports reported no violations, minimum target 44 px, minimum measured contrast `8.235958813134527:1`, and maximum audited surface luminance `0.019797328993540628`. The separate semantic case measured base badge/error at `9.466140054462286:1` / `6.923835590694159:1`, and cosmic badge/error at `10.239195606496041:1` / `10.37222266103891:1`. Existing keyboard traversal and reduced-motion assertions passed. The unchanged demo control-fault test still detected injected 20 px targets and 1:1 contrast. This is measured coverage of the selected states, not a complete WCAG certification.

Historical RED evidence is consistent with the inspected history and reports: missing contract/repository modules, missing routes and insufficient body limit, missing component/client methods, and missing preview composition preceded their implementations. The initial browser RED ran before Task 5 wiring under the recorded preflight ruling. The genuine Task 4 low-contrast failures were separately corrected. Task 6's RGB(A) change addressed a computed `color(srgb)` helper-parser incompatibility, **not newly low contrast**. Its later input-value membership failure led to the narrow `.value` measurement correction. I reran current GREEN and adversarial behavior; I did not relabel historical implementer observations as independently witnessed past executions.

### Containment, provenance, and Task 7 gate

The independent scanner verified all dependency sections across **11 package manifests** unchanged and `pnpm-lock.yaml` unchanged. It scanned all **5 normal emitted HTML/CSS/JS/source-map files** for ten preview markers: `dev_`, both actor UUIDs, PGlite package/runtime/WASM markers, preview draft title, fixture title/objective ID and representative fixture body. It found zero matches and no PGlite/initdb/mount/nodefs/opfs artifact filenames. The normal-build browser case also passed without loading preview database assets.

Added-line scans found zero private-key, AWS, GitHub, Google, OpenAI, Slack, JWT or Firebase-configuration pattern matches. Manual diff inspection classified authorization text as synthetic fixtures or API header/code/prose; new data fixtures are synthetic. New code has original LessonQuest provenance and no reference-source change. Existing PGlite direct-eval, bundle-size, and runner color-environment warnings did not fail builds or change dependency provenance.

Task 7's actual small diff conforms to its approved amendment: `.prettierignore` adds only `.superpowers/`; runtime, tests and durable documentation remain formatter-covered. The scratch Task 1 report is untracked, ignored and retained with SHA-256 `45c1ebd96f301d8d19e61791fe9cc015c3d48593a4106a480fd0e6fdf63b47a4`; its substantive evidence is in the durable verification record. The API test now sends explicit byte-accurate oversized `Content-Length` separately from its streamed-body case, and checks distinctive objective absence in errors, diagnostics and audits. The Task 7 housekeeping/evidence scope passes inspection and its covering fresh checks. This does not override the whole-branch failures above.

## Score and final assessment

| Final rubric category                       |      Score | Evidence and deduction                                                                                                                                                             |
| ------------------------------------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      21/25 | Intended synthetic save/list/reopen/update boundary is delivered; accepted Unicode input and exact uppercase replay violate the correction/preservation/retry guarantees.          |
| Correctness and code quality                |      15/20 | Clear strict contracts, tenant transactions and stale-response handling; deterministic storage/Unicode mismatch and inconsistent UUID identity handling remain.                    |
| Security, privacy, and tenant isolation     |      20/20 | Current-role and tenant probes pass; ownership, admin/create separation, safe errors, audits and containment hold. No critical security/privacy blocker found.                     |
| Test and verification evidence              |      16/20 | Full independent matrix and meaningful negative/rollback/browser evidence pass; accepted-identity and text-representation boundaries escaped durable coverage and fail new probes. |
| Operability, recoverability, and provenance |      12/15 | Synthetic reset/revert boundary, no dependencies/external mutations, and provenance are clear; permanent retry locking and ambiguous exact replay need repair before acceptance.   |
| **Total**                                   | **84/100** | **FAIL: below the required 86 and required behavior remains defective.**                                                                                                           |

**Ready to merge: No.** Preserve this Attempt 1 verdict. Record a concrete remediation plan and its gate, implement the two findings with RED/GREEN coverage, regenerate the frozen manifest, and assign a different fresh independent reviewer. No operating backend expansion is needed to resolve either finding.
