# Phase 1 M5/M6 Independent Final Review — Attempt 5

- Date: 2026-08-30
- Reviewer: fifth fresh independent non-implementing agent
- Base: `e5e1e04a0dcc02ff094e811e625c11a3b211bccf`
- Reviewed head: `70ca6aa814ba5bc51ab7f265bc4d04329d60db89`
- Scope: complete base-to-head diff, canon/design/original and remediation plans, plan-gate reviews, failed final-review Attempts 1–4, memory rubric, full repository checks, and fresh adversarial probes
- Decision: **FAIL — 82/100, with a critical answer-safety blocker**

## Verdict

Attempt 5 must not be accepted, merged, deployed, or described as complete. The latest change closes every punctuation, quote, dash, bracket, ordinary whitespace, and case mutation reproduced in Attempt 4. All standard checks pass, and the earlier authorization, revocation, timeout, lifecycle, concurrent-claim, trace, retry, reload, campaign, and aggregate-privacy fixes remain intact. The final gate still fails because Unicode format/mark characters and a letter-shaped symbol can preserve a visibly direct answer while defeating the semantic patterns. Denied/conflicting audit persistence and parts of the planned real-boundary negative/failure matrix also remain incomplete.

## Critical blocker

### 1. Direct-answer safety is bypassed by invisible Unicode separators and a letter-shaped symbol

`normalize` removes `\s`, while `normalizeSemantic` additionally removes only Unicode punctuation and symbols (`packages/rasa/src/output-policy.ts:10-12`). It does not remove format characters (`Cf`) or combining marks (`M`). Those characters can split a direct-answer phrase without visibly changing it. Removing symbols also erases `🅱️` rather than canonicalizing/rejecting the option token, so the English declaration pattern no longer sees a letter between `option` and `is correct` (`packages/rasa/src/output-policy.ts:33-40`).

A fresh direct invocation of the built output-policy boundary rejected all 11 prior literal phrases and all eight Attempt 4 punctuation phrases. It also rejected ordinary case, punctuation, quotes, dash, brackets, slash, newline/tab, non-breaking-space, thin-space, URL, full-width URL, HTML, spaced-HTML, and full-width-HTML probes. However, all of these visibly direct answer instructions were accepted:

```text
ACCEPTED Choose<U+200B> option B.          # ZERO WIDTH SPACE
ACCEPTED Option B<U+2060> is correct.      # WORD JOINER
ACCEPTED B<U+00AD>가 맞아요.               # SOFT HYPHEN
ACCEPTED 2번을<U+034F> 고르세요.           # COMBINING GRAPHEME JOINER
ACCEPTED Mark B<U+FE0F> as your answer.    # VARIATION SELECTOR-16
ACCEPTED Option 🅱️ is correct.             # letter-shaped symbol
```

These are spacing/symbol mutations of already prohibited direct-answer statements and render as ordinary answer instructions to a learner. This violates the canonical invariant that Rasa is not an answer generator and remains a critical learner-safety blocker regardless of the numerical score. The boundary needs a deliberate Unicode policy that removes or rejects default-ignorable/format/mark characters before semantic matching and handles letter-shaped choice symbols without deleting the evidence needed for detection. Regression tests should cover Unicode general categories and representative confusables rather than another finite literal list.

## Medium-severity findings

### 2. Denied and conflicting M5/M6 decisions are still not durably audited

Rasa authorization and request-binding conflicts occur inside the transaction that writes `RASA_HINT_REQUESTED/SUCCEEDED`; authorization failures happen before the insert, and later conflicts roll it back (`packages/db/src/rasa-repository.ts:59-118`). Campaign create/end similarly write only successful audit outcomes (`packages/db/src/gamification-repository.ts:42-134`). No outer post-rollback path persists safely attributable `DENIED` or `CONFLICT` evidence.

This remains below design section 10 and Remediation Plan 3's explicit scored follow-up. The operations fail closed, so this is not a fresh authorization bypass, but incident and abuse evidence remains incomplete.

### 3. The real-boundary acceptance matrix still omits planned negative and failure paths

`apps/web/test/m5-m6-e2e.test.tsx:16-184` proves React → parsed client → Hono → repositories/provider/projector → PGlite for hint persistence/reload, retry-correct and completion projection, concurrent drain attempts, aggregate-only student output, successful trace lineage, terminal-503 exact request-ID retry, campaign end, and replacement. It does not execute these planned cases through that same real browser boundary:

- ambiguous event or hint transport replay with one durable effect;
- unknown/stale actor access;
- membership or lifecycle revocation during provider work;
- projection failure containment and its trace-correlated `CONFLICT` audit;
- denied/conflict audit persistence.

Focused repository/component coverage does verify unknown-actor completed replay denial, mid-provider membership revocation, ignored-signal timeout, durable terminal timeout replay, and retryable request-ID retention. Successful projection trace correlation is executed in the real E2E. The failure-audit argument order is correct by inspection (`packages/db/src/gamification-repository.ts:325-345`), but the shipped suite still does not execute that failure branch.

## Verified improvements and preserved controls

- All 19 phrases from Attempts 1–4 are rejected, including punctuation, quotes, dash, bracket, slash, case, and ordinary whitespace mutations.
- Literal, full-width, and spaced URL/HTML probes are rejected; safe Korean conceptual hints are accepted.
- Current database authorization runs before completed hint replay, and membership revocation during provider work prevents finalization (`packages/db/test/rasa-repository.test.ts:126-160`).
- `Promise.race` bounds providers that ignore `AbortSignal`; requests durably reach `TIMED_OUT`, and terminal retry preserves the same request ID/classification (`packages/db/test/rasa-repository.test.ts:161-192`, `apps/web/test/m5-m6-e2e.test.tsx:141-180`).
- Assignment Rasa policies, campaigns, terminal requests, projection jobs, and append-only evidence reject prohibited update/delete operations (`packages/db/src/schema.ts:462-541`).
- Conditional `UPDATE ... RETURNING` claiming plus serialized repository draining leaves one attempt per job under concurrent calls (`packages/db/src/gamification-repository.ts:207-239`, `apps/web/test/m5-m6-e2e.test.tsx:65-81`).
- Successful and failed projection audit calls bind the job ingestion trace ID in the correct argument position (`packages/db/src/gamification-repository.ts:309-345`); successful lineage is asserted for all three real-E2E jobs.
- Teacher UI loads current detail, supports weekly/special creation, ends an active campaign, and permits replacement. Student boss output remains exactly the five aggregate keys.
- No external AI provider, Firebase access, real student data, credential, source-repository mutation, push, merge, or deployment was introduced.

## Independent verification record

All commands were run fresh from `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m5-m6-complete` at reviewed head `70ca6aa` before this report commit.

| Command                                                                  | Result                                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm check`                                                    | PASS; lint, format, typecheck, 25/25 test files and 268/268 tests, all workspace builds, Vite production build |
| `corepack pnpm test:integration`                                         | PASS; 5/5 files and 16/16 tests                                                                                |
| `corepack pnpm test:e2e`                                                 | PASS as scripted; 5/5 files and 14/14 tests, with the matrix gaps above                                        |
| `corepack pnpm audit --prod`                                             | PASS; no known vulnerabilities                                                                                 |
| Focused Rasa/repository/gamification/real-E2E run                        | PASS; 4/4 files and 35/35 tests                                                                                |
| `git diff --check e5e1e04a0dcc02ff094e811e625c11a3b211bccf..HEAD`        | PASS                                                                                                           |
| Changed-file credential/private-key/external-provider scan               | PASS; no matching implementation secret/provider endpoint                                                      |
| Prior 11 literal plus Attempt 4 eight-phrase probe                       | PASS; 19/19 rejected                                                                                           |
| Punctuation/case/quote/dash/bracket/slash/ordinary-space probe           | PASS; direct-answer variants rejected                                                                          |
| URL/HTML and safe conceptual-hint probe                                  | PASS; malicious forms rejected and two conceptual hints accepted                                               |
| Unicode format/mark/letter-symbol mutation probe                         | FAIL; six visibly direct answer variants accepted                                                              |
| Auth replay/revocation, timeout/terminal retry, SQL guards, claim probes | PASS in fresh full/focused suites                                                                              |
| Failure projection trace probe                                           | Correct argument order by inspection; no shipped executable regression evidence                                |
| `git status --short` before report                                       | Clean                                                                                                          |

## Final implementation score

| Category                                    |      Score | Evidence                                                                                                                                                                                                              |
| ------------------------------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      21/25 | Most M5/M6 behavior and all earlier lifecycle remediations are delivered, but the core answer-safety invariant, denied/conflict audits, and parts of the required integrated matrix remain incomplete.                |
| Correctness and code quality                |      17/20 | Authorization, timeout ownership, terminal retry, immutable state machines, trace argument order, and claim logic are sound; Unicode normalization remains incomplete and the failure path lacks executable evidence. |
| Security, privacy, and tenant isolation     |      14/20 | Tenant/current-role checks fail closed and student output is aggregate-only, but invisible Unicode and letter-shaped symbol mutations still disclose direct answers, which is a critical learner-safety defect.       |
| Test and verification evidence              |      18/20 | Full suites and broad prior regressions pass; current tests omit Unicode format/mark/confusable mutations and several browser-level negative/failure cases.                                                           |
| Operability, recoverability, and provenance |      12/15 | Durable lifecycle evidence, local-only provenance, clean builds/audit, and successful trace lineage are positive; denied/conflict audit loss and unexecuted failure-trace evidence reduce diagnostic confidence.      |
| **Total**                                   | **82/100** | **FAIL**                                                                                                                                                                                                              |

## Gate decision

**FAIL.** The score is below 86 and a critical answer-safety blocker remains. Fix Unicode default-ignorable/format/mark and letter-shaped choice-symbol handling test-first, add durable post-rollback denied/conflict audits, and complete the missing real-boundary negative/failure evidence. A sixth fresh independent non-implementing reviewer must validate the new head. No merge, push, deployment, or Phase 1 completion claim is permitted from Attempt 5.
