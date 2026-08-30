# Phase 1 M5/M6 Independent Final Review — Attempt 8

- Date: 2026-08-30
- Reviewer: eighth fresh independent non-implementing agent
- Base: `e5e1e04a0dcc02ff094e811e625c11a3b211bccf`
- Reviewed implementation head: `c07cfc9418433677bfbb76ded6c9da1f73ca459f`
- Scope: complete base-to-head diff, canon, approved design/original and remediation plans, plan-gate reviews, failed final-review Attempts 1–7, memory rubric, full repository checks, and fresh adversarial probes
- Decision: **FAIL — 79/100, with a critical answer/output-safety blocker**

## Verdict

Attempt 8 must not be accepted, merged, deployed, or described as complete. Exact comparison against a separately rendered expected string is a useful protection against a provider substituting arbitrary output, and actual `LocalRasaProvider` outputs at levels 1, 2, and 3 pass the boundary. It does not create the claimed constrained server-owned output set, however: the expected renderer directly interpolates the approved artifact's concept body or simulation prompt. Those strings remain open-ended, so ordinary direct answers, URLs, URI schemes, Markdown, and code are accepted whenever they arrive through those renderer inputs. A fresh 111-case level-by-level injection probe accepted 99 unsafe renderings.

The prior authorization, revocation, timeout, immutable lifecycle, conditional projection claim, trace-lineage, retry/reload, teacher lifecycle, and aggregate-only student controls remain covered and passing. Durable denied/conflict auditing and the real-boundary negative/failure matrix also remain incomplete.

## Critical blocker

### 1. The expected renderer is not constrained; it preserves unsafe artifact text verbatim

`buildLocalHintContent` inserts `conceptSummary` or `simulationSummary` directly into all three learner-visible templates (`packages/rasa/src/local-provider.ts:6-18`). The repository sources those values directly from the approved artifact's concept body and simulation prompt (`packages/db/src/rasa-repository.ts:225-227`) and then computes `expectedContent` from the same values (`packages/db/src/rasa-repository.ts:277-290`). Consequently, the equality check at `packages/rasa/src/output-policy.ts:80-82` proves only that provider and repository rendered the same open-ended input; it does not prove that the rendered hint belongs to a closed, answer-safe output set.

A fresh built-boundary probe injected 37 prior/new unsafe values independently through the level-1/3 concept input and level-2 simulation input, for 111 cases. **99/111 were accepted**, including every level of these representative inputs:

```text
Answer B.
B is correct.
The answer would be B.
Go with B.
It is B.
B로 제출하세요.
선택지는 B입니다.
www.evil.example
ftp://evil.example
javascript:alert(1)
[click](//evil.example)
**bold**
`run()`
&lt;script&gt;
h-t-t-p-s://evil.example
```

The 12 rejected cases were the previously blocked non-ASCII homoglyph/invisible/tag variants; that control remains effective. A separate positive probe confirmed actual local-provider outputs for levels 1–3 are accepted. This means the new equality design preserves safe normal operation, but it does not close the canonical rule that Rasa must not generate answers or the approved requirement to reject URLs, markup, and code before persistence.

The implementation needs a genuinely closed representation: for example, select only server-owned template identifiers and populate them with enumerated/non-rendered structural facts, or independently sanitize/validate every interpolated field before rendering. Merely exact-matching two computations over the same arbitrary strings cannot establish the invariant.

## High-severity test finding

### 2. Remediation 7's advertised regressions do not exercise the vulnerable path

The only changes to `packages/rasa/test/output-policy.test.ts:15-83` pass `expectedContent: valid.content` to the positive case and to every pre-existing unsafe substitution case. All unsafe cases therefore fail immediately because their action content differs from the safe expected string. The test never sets an unsafe value as renderer input and then validates the resulting equal expected/action string. It also does not add Attempt 7's ordinary direct-answer, broad URL/URI, Markdown, or code cases despite the remediation plan promising those RED cases.

Thus the suite's 281 passing tests do not demonstrate the new architectural claim, and the original failure mode is concealed by a mismatch-only assertion.

## Medium-severity findings

### 3. Denied and request-identity conflict decisions still lack durable audit evidence

Rasa authorization failure precedes the successful request audit, while changed request-ID reuse and other conflicts throw inside the transaction and roll back any audit (`packages/db/src/rasa-repository.ts:59-118`). Campaign create/end authorization and lifecycle conflicts similarly escape without a post-rollback durable denied/conflict record; only successful operations and projection processing have explicit durable paths (`packages/db/src/gamification-repository.ts:42-134`, `packages/db/src/gamification-repository.ts:314-337`). These decisions fail closed, so this is not an authorization bypass, but it remains below design section 10 and the prior remediation's diagnostic requirement.

### 4. The real React-to-database acceptance matrix is still incomplete

`apps/web/test/m5-m6-e2e.test.tsx:16-184` covers the happy path, reload, correct retry/completion contributions, concurrent drains, aggregate-only output, successful trace lineage, campaign end/replacement, and terminal-503 request-ID reuse. It still does not execute through the same React/client/Hono/repository/PGlite boundary:

- ambiguous event or hint delivery replay with exactly one durable effect;
- unknown/stale actor and tenant access;
- membership, assignment, or class revocation during provider work;
- projection failure containment with trace-correlated conflict audit;
- durable denied/request-identity conflict audit behavior.

Focused repository tests cover several underlying controls, but they do not satisfy the approved integrated negative/failure matrix.

## Preserved controls

- Current actor, organization membership, class membership, assignment/version/policy, and attempt state are checked before hint replay and again before finalization.
- Owned provider timeout and terminal retry identity remain covered.
- Database triggers protect append-only evidence and forward-only/immutable Rasa, campaign, and projection state.
- Conditional projection claims prevent the tested duplicate processing race; successful and failed projection audit argument order is correct.
- Student boss output remains aggregate-only; teacher controls support active detail, end, and replacement.
- No external AI provider, Firebase access, real student data, credential, source-repository mutation, push, merge, or deployment was introduced.

## Independent verification record

All commands were run fresh from `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m5-m6-complete` at implementation head `c07cfc9` before this report commit.

| Command / probe | Result |
| --- | --- |
| `corepack pnpm install --frozen-lockfile` | PASS; lockfile already current |
| `corepack pnpm check` | PASS; lint, format, typecheck, 25/25 files and 281/281 tests, all workspace builds, Vite production build |
| `corepack pnpm test:integration` | PASS; 5/5 files and 16/16 tests |
| `corepack pnpm test:e2e` | PASS as scripted; 5/5 files and 14/14 tests, with the matrix gaps above |
| `corepack pnpm audit --prod` | PASS; no known vulnerabilities |
| `git diff --check e5e1e04a0dcc02ff094e811e625c11a3b211bccf..c07cfc9` | PASS |
| Changed-file private-key/bearer/external-provider scan | PASS; no matches |
| Actual `LocalRasaProvider` output at levels 1–3 | PASS; 3/3 accepted by `validateHintOutput` |
| Prior homoglyph/invisible controls represented in fresh probe | PASS; tested non-ASCII/invisible variants rejected |
| Server-rendered direct-answer/URL/markup/code injection probe | **FAIL; 99/111 unsafe level/input combinations accepted** |
| Authorization/revocation, timeout/replay, SQL guards, claim/privacy controls | PASS in fresh full/integration/E2E suites |
| `git status --short` before report | Clean |

An initial reviewer secret-scan command passed a newline-delimited filename list as one zsh argument and produced a file-name error rather than scanning. It was corrected to NUL-delimited `xargs -0` and rerun successfully; this was a reviewer-command issue, not an implementation failure.

## Final implementation score

| Category | Score | Evidence |
| --- | ---: | --- |
| Requirement and approved-plan conformance | 20/25 | Most M5/M6 behavior is present, but the canonical answer-safe learner boundary, durable denied/conflict audits, and parts of the approved integrated matrix remain incomplete. |
| Correctness and code quality | 16/20 | Equality is correctly enforced, but both sides consume the same open-ended artifact strings, so the architectural security claim does not hold. Other lifecycle, authorization, timeout, and projection controls remain sound. |
| Security, privacy, and tenant isolation | 13/20 | Tenant and current-role checks fail closed and student output is aggregate-only; direct answers, links, markup, and code still cross the learner-output boundary via renderer inputs. |
| Test and verification evidence | 18/20 | All scripted suites pass, but remediation tests prove only unequal substitution rejection and omit the renderer-input threat plus several real-boundary negative/failure paths. |
| Operability, recoverability, and provenance | 12/15 | Local-only provenance, builds/audit, lifecycle evidence, and successful trace lineage are strong; denied/conflict audit loss reduces diagnostic durability. |
| **Total** | **79/100** | **FAIL** |

## Gate decision

**FAIL.** The score is below 86 and a critical Rasa answer/output-safety blocker remains. Constrain or independently validate every value interpolated by the server-owned renderer, add regression tests that set unsafe renderer inputs while action and expected content are equal, preserve safe local outputs at levels 1–3, then obtain a ninth fresh independent non-implementing review. No merge, push, deployment, or Phase 1 completion claim is permitted from Attempt 8.
