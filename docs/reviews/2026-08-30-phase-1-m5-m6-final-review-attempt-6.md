# Phase 1 M5/M6 Independent Final Review — Attempt 6

- Date: 2026-08-30
- Reviewer: sixth fresh independent non-implementing agent
- Base: `e5e1e04a0dcc02ff094e811e625c11a3b211bccf`
- Reviewed head: `90a316f223f086299da182065d7504a1d9c6111e`
- Scope: complete base-to-head diff, canon/design/original and remediation plans, plan-gate reviews, failed final-review Attempts 1–5, memory rubric, full repository checks, and fresh adversarial probes
- Decision: **FAIL — 82/100, with a critical answer-safety blocker**

## Verdict

Attempt 6 must not be accepted, merged, deployed, or described as complete. The latest change correctly closes the six exact Unicode format/mark/symbol strings from Attempt 5, all 19 earlier direct-answer fixtures, arbitrary punctuation/symbol separation, enclosed and mathematical letters, full-width text, case, and ordinary whitespace. All standard checks pass, and the prior authorization, revocation, timeout, database lifecycle, concurrent claim, trace, retry, reload, teacher lifecycle, and aggregate-privacy controls remain intact.

The gate still fails because visually confusable Greek/Cyrillic letters evade the finite English semantic markers while leaving a visibly direct answer instruction. The raw URL/HTML controls also still operate on a normalization that retains Unicode format/mark characters, allowing disguised links and tags through. Denied/conflicting M5/M6 audit persistence and parts of the approved real-boundary negative/failure matrix remain incomplete.

## Critical blocker

### 1. Homoglyph substitutions still permit visibly direct answer instructions

`normalizeSemantic` now retains only Unicode letters and numbers, which removes `Cf`, `M`, punctuation, symbols, and arbitrary separators (`packages/rasa/src/output-policy.ts:12-16`). That closes the exact Attempt 5 cases. However, it preserves Greek and Cyrillic letters without mapping or rejecting mixed-script semantic tokens. The forbidden expressions then recognize only ASCII spellings of `option`, `correct`, `choose`, `select`, and `pick` (`packages/rasa/src/output-policy.ts:35-50`).

A fresh direct invocation of the built boundary accepted these visibly direct instructions; the substituted characters are Greek omicron or Cyrillic `о`, `Ѕ`, and `Р`:

```text
ACCEPTED Οption B is correct.
ACCEPTED Optiоn B is correct.
ACCEPTED Option B is cοrrect.
ACCEPTED Chоose B.
ACCEPTED Chооse option B.
ACCEPTED Ѕelect B.
ACCEPTED Рick choice C.
ACCEPTED Οption 🅱️ is cοrrect.
ACCEPTED Ｃhоoѕe Ⓑ.
```

These render close enough to the prohibited phrases to disclose the answer to a learner and violate the canonical invariant that Rasa is not an answer generator. This remains a critical blocker regardless of score. The boundary needs a deliberate mixed-script/confusable policy, preferably rejecting unexpected scripts in English answer-marker neighborhoods or applying a reviewed confusable skeleton before matching. Regression evidence must cover representative cross-script substitutions in every marker, not only the literals above.

### 2. Unicode format/mark insertion bypasses URL and HTML rejection

The raw `normalize` function removes only JavaScript whitespace (`packages/rasa/src/output-policy.ts:10-11`), and the URL/HTML expressions are evaluated against both that value and the letters/numbers-only semantic value (`packages/rasa/src/output-policy.ts:33-34,61`). The semantic value necessarily removes URL punctuation and tag brackets, while the raw value preserves embedded `Cf`/`M`. Fresh probes accepted:

```text
ACCEPTED h<U+200B>ttps://evil.example
ACCEPTED h<U+2060>ttps://evil.example
ACCEPTED http<U+200B>s://evil.example
ACCEPTED javascript<U+200B>:alert(1)
ACCEPTED [click](h<U+200B>ttps://evil.example)
ACCEPTED <<U+200B>script>alert(1)<<U+200B>/script>
ACCEPTED <<U+034F>script>alert(1)<<U+034F>/script>
```

React currently renders hint content as text, reducing immediate DOM execution risk, but the approved output contract explicitly rejects URL and HTML content before persistence and later reuse. This is part of the same critical output-safety boundary. Apply the format/mark canonicalization to URL/tag detection as well, or reject default-ignorable/combining characters before all policy checks.

## Medium-severity findings

### 3. Denied and conflicting M5/M6 decisions are still not durably audited

Rasa authorization failure occurs before the successful request audit, while request-binding conflicts occur within the transaction and roll that audit back (`packages/db/src/rasa-repository.ts:59-118`). Campaign create/end likewise record only successful operations (`packages/db/src/gamification-repository.ts:42-134,408-420`). There is still no outer post-rollback path that writes safely attributable `DENIED` or `CONFLICT` evidence.

This does not create a new authorization bypass: the operations fail closed. It remains below design section 10 and Remediation Plan 3's explicit scored follow-up, weakening incident and abuse diagnostics.

### 4. The real React-to-database acceptance matrix remains incomplete

`apps/web/test/m5-m6-e2e.test.tsx:16-184` executes hint persistence/reload, retry-correct and completion projection, concurrent drains, aggregate-only student output, successful trace lineage, terminal-503 request-ID reuse, campaign end, and replacement. It still does not execute through that same browser boundary:

- ambiguous event or hint transport replay with one durable effect;
- unknown/stale actor access;
- membership or lifecycle revocation during provider work;
- projection failure containment and its trace-correlated `CONFLICT` audit;
- denied/conflict audit persistence.

Focused repository/component tests cover the highest-risk authorization, revocation, timeout, terminal replay, SQL lifecycle, and request-ID behaviors. The failed projection audit argument order is correct by inspection (`packages/db/src/gamification-repository.ts:325-345`), but shipped executable evidence still does not exercise that failure branch.

## Verified improvements and preserved controls

- All 25 prior direct-answer literals from Attempts 1–5 are rejected, including Unicode `Cf`/`M`, emoji, enclosed-letter, full-width, punctuation, case, and ordinary spacing variants.
- Arbitrary punctuation/symbol separators are removed before semantic matching. Enclosed, mathematical, regional-indicator, and keycap letters in otherwise recognized answer phrases are rejected.
- Three safe Korean conceptual hints were accepted. Literal/full-width URLs and ordinary/spaced HTML controls were rejected.
- Current database authorization runs before completed hint replay, and membership revocation during provider work prevents finalization.
- Provider completion is bounded with an owned timeout; terminal timeout replay preserves classification and request identity.
- Assignment Rasa policies, campaigns, terminal requests, projection jobs, and append-only evidence reject prohibited mutation/deletion.
- Conditional job claiming and repository serialization preserve one projection attempt per job under the tested concurrent drains.
- Successful and failed projection audits bind the source ingestion trace ID; successful lineage is asserted in the real E2E.
- Teacher UI covers current detail, weekly/special creation, ending, and replacement. Student boss output remains restricted to the five aggregate keys.
- No external AI provider, Firebase access, real student data, credential, source-repository mutation, push, merge, or deployment was introduced.

## Independent verification record

All commands were run fresh from `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m5-m6-complete` at reviewed head `90a316f` before this report commit.

| Command                                                                  | Result                                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm check`                                                    | PASS; lint, format, typecheck, 25/25 test files and 274/274 tests, all workspace builds, Vite production build |
| `corepack pnpm test:integration`                                         | PASS; 5/5 files and 16/16 tests                                                                                |
| `corepack pnpm test:e2e`                                                 | PASS as scripted; 5/5 files and 14/14 tests, with the matrix gaps above                                        |
| `corepack pnpm audit --prod`                                             | PASS; no known vulnerabilities                                                                                 |
| Focused Rasa/repository/gamification/real-E2E run                        | PASS; 4/4 files and 41/41 tests                                                                                |
| `git diff --check e5e1e04a0dcc02ff094e811e625c11a3b211bccf..90a316f`     | PASS                                                                                                           |
| Prior Attempt 1–5 direct-answer fixture probe                            | PASS; 25/25 rejected                                                                                           |
| Unicode `Cf`/`M`/`P`/`S`, emoji, enclosed-letter, case/spacing probe     | PASS for the tested prior and arbitrary-separator variants                                                     |
| Cross-script homoglyph answer probe                                      | FAIL; nine visibly direct variants accepted                                                                    |
| URL/HTML controls                                                        | FAIL; literal/full-width controls rejected, but seven format/mark-disguised forms accepted                     |
| Safe conceptual-hint controls                                            | PASS; 3/3 accepted                                                                                             |
| Auth replay/revocation, timeout/terminal retry, SQL guards, claim probes | PASS in fresh full/focused suites                                                                              |
| Failure projection trace probe                                           | Correct argument order by inspection; no shipped executable regression evidence                                |
| `git status --short` before report                                       | Clean                                                                                                          |

## Final implementation score

| Category                                    |      Score | Evidence                                                                                                                                                                                                         |
| ------------------------------------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      21/25 | Most M5/M6 behavior and all earlier lifecycle remediations are delivered, but the answer/output-safety invariant, denied/conflict audits, and parts of the required integrated matrix remain incomplete.         |
| Correctness and code quality                |      17/20 | Authorization, timeout ownership, immutable state machines, trace order, and claim logic are sound; separate raw/semantic normalization leaves mixed-script and disguised URL/HTML gaps.                         |
| Security, privacy, and tenant isolation     |      14/20 | Tenant/current-role checks fail closed and student output is aggregate-only, but homoglyph direct answers and disguised links/tags cross a critical learner-output boundary.                                     |
| Test and verification evidence              |      18/20 | All scripted suites and the exact Attempt 5 regressions pass; tests omit cross-script confusables, format/mark URL/HTML variants, and several real-boundary negative/failure cases.                              |
| Operability, recoverability, and provenance |      12/15 | Durable lifecycle evidence, local-only provenance, clean builds/audit, and successful trace lineage are positive; denied/conflict audit loss and unexecuted failure-trace evidence reduce diagnostic confidence. |
| **Total**                                   | **82/100** | **FAIL**                                                                                                                                                                                                         |

## Gate decision

**FAIL.** The score is below 86 and critical answer/output-safety blockers remain. Fix mixed-script/confusable direct-answer handling and apply the Unicode policy to URL/HTML detection test-first. Add durable post-rollback denied/conflict audits and complete the missing failure/negative real-boundary evidence. A seventh fresh independent non-implementing reviewer must validate the next head. No merge, push, deployment, or Phase 1 completion claim is permitted from Attempt 6.
