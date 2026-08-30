# Phase 1 M5/M6 Independent Final Review — Attempt 7

- Date: 2026-08-30
- Reviewer: seventh fresh independent non-implementing agent
- Base: `e5e1e04a0dcc02ff094e811e625c11a3b211bccf`
- Reviewed implementation head: `5e1cad3844a49dd558ab81c955de3d1cca451fc3`
- Scope: complete base-to-head diff, canon, approved design/original and remediation plans, plan-gate reviews, failed final-review Attempts 1–6, memory rubric, full repository checks, and fresh adversarial probes
- Decision: **FAIL — 81/100, with critical answer/output-safety blockers**

## Verdict

Attempt 7 must not be accepted, merged, deployed, or described as complete. The new explicit ASCII/Hangul output alphabet rejects the previously reproduced Greek/Cyrillic homoglyphs, invisible controls and marks, emoji, enclosed letters, and disguised URL/tag variants. All standard repository checks pass, and the prior authorization, mid-provider revocation, timeout ownership, database lifecycle, conditional projection claim, trace lineage, retry/reload, teacher lifecycle, and aggregate-only student controls remain intact.

The gate still fails because the output policy remains a finite phrase blacklist inside the newly allowed ASCII/Hangul alphabet. Fresh probes accepted ordinary direct-answer statements and imperatives in both English and Korean. The structural policy also accepts common URLs, URI schemes, Markdown/code markup, and entity-encoded markup. Denied/conflicting M5/M6 decisions remain unaudited after rollback, and the real React-to-database E2E still omits several required negative and failure paths.

## Critical blockers

### 1. Ordinary ASCII/Hangul direct answers still pass the Rasa output boundary

The alphabet check at `packages/rasa/src/output-policy.ts:22-34` correctly rejects unexpected scripts and invisible/symbol characters. The semantic decision still depends on the finite expressions at `packages/rasa/src/output-policy.ts:51-70`, however. Those expressions recognize only selected constructions around `answer`, `correct`, `choose`, `option`, and Korean `맞`, `고르`, or `선택`. They do not establish that output is a pedagogical hint rather than an answer.

A fresh built-boundary probe exercised 69 unsafe strings: all 43 prior literal/homoglyph/invisible/URL/tag fixtures plus 26 ordinary English/Korean answer variants. Fifty were rejected, but these 19 visibly direct instructions were accepted:

```text
Answer B.
B is correct.
B is the right answer.
The answer would be B.
Go with B.
Use option B.
Your answer should be B.
Respond with B.
The solution is B.
It is B.
I recommend B.
Circle B.
Tick B.
Press B.
B로 제출하세요.
B를 체크하세요.
B를 누르세요.
B를 택하세요.
선택지는 B입니다.
```

Five safe local conceptual Korean/English hints were accepted, so this result is not caused by the alphabet being universally unusable. The accepted strings disclose or direct a learner to the answer and violate the canonical invariant that Rasa is not an answer generator. This is a critical blocker regardless of score. A secure boundary should validate a constrained hint representation or generate learner-visible text from server-owned templates; adding more blacklist expressions will continue to leave equivalent wording.

### 2. Common URLs, URI schemes, and markup remain accepted

The structural expressions reject only `http://`/`https://` and literal HTML tags (`packages/rasa/src/output-policy.ts:52-53`). The ASCII alphabet therefore permits many other links and markup forms. A fresh 17-string structural probe accepted 14:

```text
www.evil.example
evil.example/path
ftp://evil.example
//evil.example/path
javascript:alert(1)
[click](//evil.example)
[click](www.evil.example)
**bold**
`run()`
![x](//evil.example)
&lt;script&gt;
h-t-t-p-s://evil.example
h.t.t.p.s://evil.example
h/t/t/p/s://evil.example
```

The direct `data:text/html,<b>x</b>` probe was rejected only because its literal tag matched, not because the scheme was prohibited. React currently renders the hint as text, which reduces immediate DOM execution risk, but the approved output contract explicitly requires rejecting URLs, markup, and code-execution instructions before persistence and later reuse. This remains part of the critical learner-output boundary.

## Medium-severity findings

### 3. Denied and conflicting M5/M6 decisions are still not durably audited

Rasa authorization failure occurs before the successful request audit, while changed request-ID reuse and terminal conflicts throw from the transaction and roll back its audit (`packages/db/src/rasa-repository.ts:59-118`). `failRequest` records provider/finalization failures only after a request has reached `RUNNING` (`packages/db/src/rasa-repository.ts:420-450`). Campaign create/end similarly write only successful audit rows and let authorization or active/ended conflicts escape the transaction without post-rollback evidence (`packages/db/src/gamification-repository.ts:42-134`).

These operations fail closed, so this is not an authorization bypass. It remains below design section 10 and Remediation Plan 3's explicit requirement for attributable `DENIED`/`CONFLICT` evidence, materially weakening incident and abuse diagnostics.

### 4. The real React-to-database acceptance matrix remains incomplete

`apps/web/test/m5-m6-e2e.test.tsx:16-184` covers a real React/client/Hono/repository/provider/projector/PGlite happy path, reload, retry-correct plus completion contributions, conditional concurrent drains, aggregate-only student output, successful trace lineage, campaign end/replacement, and terminal-503 request-ID reuse. It still does not execute through that same browser boundary:

- ambiguous event or hint transport replay with exactly one durable effect;
- unknown or stale actor access;
- membership/assignment/class lifecycle revocation during provider work;
- projection failure containment and trace-correlated `CONFLICT` audit;
- denied/conflict audit persistence.

Focused repository/component tests retain coverage for authorization replay, membership revocation, timeout/terminal replay, SQL lifecycle guards, and request-ID reuse. They do not replace the approved integrated negative/failure matrix, and no executable failure-projection lineage assertion is shipped.

## Verified improvements and preserved controls

- All previously reported Greek/Cyrillic homoglyphs, invisible controls/marks, emoji, enclosed-letter forms, full-width variants, and disguised URL/tag strings tested in Attempts 1–6 are now rejected by the built output boundary.
- Five safe conceptual Korean/English hints were accepted.
- Current authorization is checked before completed hint replay; membership revocation during provider work prevents finalization.
- Provider completion is bounded by an owned timeout; terminal timeout replay preserves the request identity and retryable classification.
- Assignment Rasa policies, campaigns, terminal requests, projection jobs, learning/audit/action/usage/contribution evidence reject prohibited mutation or deletion in the shipped regression suite.
- Conditional job claiming and repository serialization keep one tested processing attempt per projection job.
- Successful projection audit lineage is asserted against the originating learning-event trace. Failure audit argument order is correct by inspection.
- Teacher UI supports current detail, weekly/special creation, ending, and replacement. Student boss output is restricted to the five aggregate keys.
- The implementation remains synthetic and local-only: no external AI provider, Firebase access, real student data, credential, source-repository mutation, push, merge, or deployment was introduced.

## Independent verification record

All commands were run fresh from `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m5-m6-complete` at implementation head `5e1cad3` before this report commit.

| Command                                                                  | Result                                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile`                                | PASS; lockfile already current                                                                                 |
| `corepack pnpm check`                                                    | PASS; lint, format, typecheck, 25/25 test files and 281/281 tests, all workspace builds, Vite production build |
| `corepack pnpm test:integration`                                         | PASS; 5/5 files and 16/16 tests                                                                                |
| `corepack pnpm test:e2e`                                                 | PASS as scripted; 5/5 files and 14/14 tests, with the matrix gaps above                                        |
| `corepack pnpm audit --prod`                                             | PASS; no known vulnerabilities                                                                                 |
| `git diff --check e5e1e04a0dcc02ff094e811e625c11a3b211bccf..5e1cad3`     | PASS                                                                                                           |
| Changed-file private-key/bearer/external-provider scan                   | PASS; no matches                                                                                               |
| Prior Attempt 1–6 homoglyph/invisible/emoji/enclosed/structural fixtures | PASS; the accumulated prior variants tested here were rejected                                                 |
| Fresh direct-answer probe                                                | FAIL; 19/69 unsafe strings accepted                                                                            |
| Fresh URL/markup probe                                                   | FAIL; 14/17 unsafe strings accepted                                                                            |
| Safe local Korean/English hint controls                                  | PASS; 5/5 accepted                                                                                             |
| Auth/revocation, timeout/replay, SQL guards, claim, privacy probes        | PASS in the fresh full/integration/E2E suites                                                                  |
| `git status --short` before report                                       | Clean                                                                                                          |

One initial changed-file scan command failed before scanning because of reviewer shell quoting (`zsh: unmatched "`). It was corrected and rerun successfully; this was not an implementation failure.

## Final implementation score

| Category                                    |      Score | Evidence                                                                                                                                                                                                                  |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      21/25 | Most M5/M6 behavior and earlier remediations are delivered, but the answer/output-safety invariant, denied/conflict audits, and parts of the approved integrated matrix remain incomplete.                               |
| Correctness and code quality                |      17/20 | Authorization, timeout ownership, immutable state machines, trace order, and claim logic are sound; finite phrase and structural blacklists still accept obvious equivalent outputs.                                    |
| Security, privacy, and tenant isolation     |      13/20 | Tenant/current-role checks fail closed and student boss output is aggregate-only, but direct answers and prohibited links/markup cross the critical learner-output boundary.                                            |
| Test and verification evidence              |      18/20 | All scripted suites and accumulated regressions pass; tests omit ordinary equivalent answer statements, broader URL/markup classes, and several real-boundary negative/failure cases.                                  |
| Operability, recoverability, and provenance |      12/15 | Durable lifecycle evidence, local-only provenance, clean builds/audit, and successful trace lineage are positive; denied/conflict audit loss and unexecuted failure-trace evidence reduce diagnostic confidence.        |
| **Total**                                   | **81/100** | **FAIL**                                                                                                                                                                                                                  |

## Gate decision

**FAIL.** The score is below 86 and critical answer/output-safety blockers remain. Replace or substantially redesign the blacklist-based learner-output boundary test-first, add durable post-rollback denied/conflict audits, and complete the missing real-boundary negative/failure evidence. An eighth fresh independent non-implementing reviewer must validate the next implementation head. No merge, push, deployment, or Phase 1 completion claim is permitted from Attempt 7.
