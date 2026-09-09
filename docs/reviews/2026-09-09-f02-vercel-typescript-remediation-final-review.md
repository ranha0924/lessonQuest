# F02 Vercel TypeScript correction — independent final review

Date: 2026-09-09. Reviewer: `f02_vercel_ts_final`, a fresh nonimplementing agent. Baseline: `f28e5d71c627445ad88add2fe36be23a6ee94a9c`. Decision: **99/100 PASS; no critical blocker or actionable implementation defect found in this bounded correction.**

## Scope and controlling evidence

Read `AGENTS.md`, `docs/PROJECT_CANON.md`, the final-validation rubric in `memory/projects/lessonquest.md`, the approved TypeScript remediation plan and its 99-point preimplementation review. Inspected the complete new-file contents of `api/tsconfig.json` and `tests/vercel-typescript.test.ts`, the unchanged root/base configurations and API entry, preserved RED/GREEN evidence, and the actual installed `@vercel/node` 12.0.2 compiler implementation. Remote-activation plans in the shared working tree are a separate unit and were not reviewed or changed here.

The compiler's `readConfig` applies `fixConfig` before resolving `extends`; an absent own `module` makes it set `strict=false`. The previous root config therefore combined that override with inherited `exactOptionalPropertyTypes=true`, causing global diagnostic 5052 and skipped emit. The preserved RED log reports exactly that failure. The new API config explicitly selects NodeNext module/resolution, ES2024 and strict mode, while inheriting the existing strict base and restricting its root include to `index.ts`. Root `noEmit` validation, `noEmitOnError`, dependency pins, runtime/authentication/AI behavior and Vercel routing are unchanged.

## Independent verification

All commands exited 0. Evidence is under `.verification/f02-vercel-ts-review-*.log`.

| Check                                                                                                              | Independent result                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm exec vitest run tests/vercel-typescript.test.ts tests/vercel-api.test.ts tests/vercel-pnpm.test.ts` | 3 files, 5 tests passed. Actual API emission, strict compiler options, API routing and nested pnpm behavior passed.                                                                               |
| `node /tmp/lessonquest-vercel-actual-compiler.cjs`                                                                 | Actual installed `@vercel/node` 12.0.2, with local TypeScript 6.0.3, emitted the API entry: 153 bytes plus source map.                                                                            |
| `corepack pnpm lint`                                                                                               | Passed with zero warnings permitted.                                                                                                                                                              |
| `corepack pnpm format:check`                                                                                       | Passed before this report was added; report formatting was checked separately afterward.                                                                                                          |
| `corepack pnpm exec tsc --noEmit -p tsconfig.json`                                                                 | Passed.                                                                                                                                                                                           |
| `corepack pnpm exec tsc --noEmit -p api/tsconfig.json`                                                             | Passed.                                                                                                                                                                                           |
| `node /tmp/lessonquest-vercel-ts-review-adversarial.cjs`                                                           | Independently reproduced skipped emit using the previous root config, emitted the unchanged API with its new config, and confirmed an intentional TS2322 is still rejected by the actual builder. |
| Frozen implementation hashes                                                                                       | Both matched the implementer's manifest before and after the independent checks.                                                                                                                  |
| Diff whitespace check                                                                                              | Passed.                                                                                                                                                                                           |

The additional compiler probe exposes only the installed compiler's existing `register` function in a reviewer-owned in-memory module. Its invalid source is supplied in memory; no implementation file is replaced. It does not initialize or execute the API, access external systems or read credentials. No shared application build output was changed during review.

## Findings and limits

No security, correctness or scope defect was found. The change resolves the reproduced compiler-default conflict without suppressing diagnostics, relaxing the shared strict contract or changing runtime authority. The durable regression includes compiler-option diagnostics, which the observed builder omitted from its failure text, so this failure now has a useful local signal.

The durable test models the relevant defaults from the observed builder version. A future platform-managed builder change can require reviewing that model and repeating the actual-builder probe; the installed compiler is deliberately not added as an application dependency. The current successful local emission does not certify a hosted deployment. Corrected-head required CI, the Git-linked Preview and safe unconfigured API behavior remain delivery checks. Provisioning, main integration, production deployment and actual teacher login remain separately pending.

## Final rubric

| Category                                   |           Score | Evidence                                                                                                                                                                 |
| ------------------------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance  |           25/25 | Two-file correction matches the approved scope; no runtime, data, credential, permission or dependency expansion.                                                        |
| Correctness and code quality               |           20/20 | Nearest explicit API configuration defeats the verified pre-inheritance override while preserving strict base options and normal module resolution.                      |
| Security, privacy and tenant isolation     |           20/20 | No authorization or tenant behavior changed; intentional type errors still stop compilation, and secrets/external systems were not accessed.                             |
| Test and verification evidence             |           20/20 | Intended 5052 RED reviewed; independent focused suite, root/API types, lint/format, actual-builder emission and rejection probes passed.                                 |
| Operability, recoverability and provenance |           14/15 | Bounded reversible config, preserved failure evidence and actual installed source inspection; platform-managed builder version remains an external maintenance boundary. |
| **Total**                                  | **99/100 PASS** | **This correction passes the independent local acceptance gate. Hosted and activation gates remain separate.**                                                           |

Reviewed implementation SHA-256 values:

```text
6b51c57bd0f2bd1579b497e6ee636d6b2651b038274c9b03de266c42bed3d8cd  api/tsconfig.json
501d1c3f0db9b8a285327d007d6bfd90aa89d4184dc9ec8575fd17034541c265  tests/vercel-typescript.test.ts
```
