# Vercel Demo Preview Independent Final Review

- Review date: 2026-08-30
- Reviewer: independent non-implementing agent `vercel_demo_final_review`
- Reviewed range: `c0cb870dd8e5516632c42e9fb3cda34554bf1eca..35c5d28b66aff562c03acccd1bb4f3b26047b00d`
- Decision: **PASS — 88/100, no critical blocker**

## Scope and evidence inspected

I read `docs/PROJECT_CANON.md`, `docs/superpowers/plans/2026-08-30-vercel-demo-preview.md`, the 98/100 plan review, and the final-validation rubric in `memory/projects/lessonquest.md`. I inspected the complete nine-file implementation diff, the reused Rasa/boss components, the web entry point, package scripts, generated Vite output, and Vercel configuration. I did not modify implementation files.

The preview is an explicitly labeled, reset-on-refresh synthetic UI. `DemoShell` owns only React state and fixed strings/UUIDs; it contains no API client, Firebase adapter, external-AI provider, persistence, credential, or real student data. `main.tsx` selects it only when the build-time value is exactly `VITE_DEMO_MODE=true`; the existing session/API path remains in the non-demo branch. The tested student path is wrong choice → fixed level-1 Rasa hint → correct retry → aggregate boss progress from 32/100 to 40/100. The teacher switch exposes assignment policy, aggregate process counts, and boss evidence while explicitly withholding individual ranking.

`vercel.json` uses a frozen pnpm install, builds workspace dependencies before the demo web build, publishes `apps/web/dist`, rewrites SPA routes to `index.html`, and applies `nosniff`, frame denial, no-referrer, and a restrictive CSP including `connect-src 'none'`, `frame-src 'none'`, `object-src 'none'`, and `form-action 'none'`. README instructions and the warning that this is not an API/DB/auth/Firebase/external-AI deployment match the delivered behavior. No deployment, push, or external-system mutation was performed.

## Findings

### Non-blocking quality gaps

1. **The demo production bundle still contains the normal HTTP client and session branch.** `apps/web/src/main.tsx:4-5` statically imports `App` and `createHttpLessonQuestApi`, so Vite retains `fetch`, authorization-header construction, `window.lessonQuestSession`, and API route strings even in a `VITE_DEMO_MODE=true` artifact. The constant-true demo branch prevents that client from being constructed at runtime, and the deployed CSP independently blocks connections, so I did not reproduce an API/Firebase/external-AI call or credential exposure. Still, this is weaker containment than a separate compile-time demo entry or dynamic import and costs security/code-quality points.
2. **The plan names `apps/web/src/demo-api.ts`, but the implementation uses direct component-local state.** The smaller implementation still satisfies the user-visible static-demo acceptance criteria and reduces attack surface, but the plan should have been amended to record this architectural substitution.
3. **Automated preview coverage is one focused happy-path component test.** It proves the required interaction and aggregate-only teacher copy, while the full suites protect the normal application. It does not directly import the built `main.tsx` in both flag states, exercise first-correct/role-round-trip state behavior, or run a deployed-browser SPA deep-link/header smoke test. The last item appropriately remains unavailable until deployment is separately authorized.
4. **The Vite bundle publishes a source map and includes dormant normal-app code.** No secret marker was found, and this is acceptable for a synthetic preview, but disabling public source maps and splitting the entry would improve preview minimization.

### Critical blockers

None. The implementation does not access real student data, Firebase, an external AI service, or credentials; it does not deploy anything; and the runtime demo branch plus CSP fail closed against network access.

## Independent verification run

All commands were run fresh from `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m5-m6-complete` at reviewed commit `35c5d28`.

| Command/check                                                       | Result                                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm check`                                               | PASS: lint, Prettier, typecheck, all workspace builds, Vite normal build, 26 test files / 282 tests                             |
| `corepack pnpm test:integration`                                    | PASS: 5 files / 16 tests                                                                                                        |
| `corepack pnpm test:e2e`                                            | PASS: 5 files / 14 tests                                                                                                        |
| `corepack pnpm audit --prod`                                        | PASS: no known vulnerabilities                                                                                                  |
| `VITE_DEMO_MODE=true corepack pnpm --filter @lessonquest/web build` | PASS: 130 modules; `dist/index.html`, CSS, JS, and source map emitted                                                           |
| `corepack pnpm exec vitest run apps/web/test/demo-shell.test.tsx`   | PASS: 1 file / 1 test                                                                                                           |
| Parsed `vercel.json` assertions                                     | PASS: framework, frozen install, demo build flag, output directory, SPA rewrite, and CSP directives                             |
| Generated-bundle content probe                                      | PASS for required demo labels and credential markers; documented dormant API client presence (`STATIC_API_CLIENT_PRESENT=true`) |
| Changed-file credential-pattern scan                                | PASS: no recognized private key/cloud token markers                                                                             |
| `git diff --check c0cb870..35c5d28`                                 | PASS                                                                                                                            |

An intentionally stricter first artifact probe rejected the bundle because it found `fetch(`. Inspection found two occurrences: React's module-preload support and the dormant normal `createHttpLessonQuestApi` implementation. The built condition is visibly `VITE_DEMO_MODE: "true"`; therefore the latter branch is unreachable in normal page execution, while `connect-src 'none'` provides defense in depth. I preserved this evidence as Finding 1 instead of incorrectly claiming the bundle contains no network-capable code.

## Rubric score

| Category                                    |      Score | Evidence                                                                                                                                                                                                  |
| ------------------------------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      23/25 | Required synthetic student/teacher preview, Rasa/retry/boss flow, normal-path branch, Vercel files, and documentation are present. Deduction for the unrecorded `demo-api.ts` → local-state substitution. |
| Correctness and code quality                |      16/20 | Required interaction works and reused components keep contracts consistent. Static normal-app imports enlarge the demo bundle; one happy-path test leaves mode-entry and state-edge behavior implicit.    |
| Security, privacy, and tenant isolation     |      18/20 | Fixed synthetic data only, no secret/real data/Firebase/external AI, exact opt-in flag, no deployment, restrictive CSP. Deduction because dormant API/auth code remains shipped in the demo artifact.     |
| Test and verification evidence              |      18/20 | Full unit/type/lint/build, integration, E2E, audit, focused UI test, config parsing, bundle inspection, secret scan, and diff check passed. No authorized deployed-browser/deep-link/header smoke exists. |
| Operability, recoverability, and provenance |      13/15 | README accurately explains root/build/output/limitations and the plan defines commit-revert containment. No deployment evidence by design; source-map and dormant-code minimization remain follow-ups.    |
| **Total**                                   | **88/100** | **PASS: score is greater than 85 and no critical blocker remains.**                                                                                                                                       |

## Final decision

The Vercel synthetic demo preview is acceptable as **ready-to-deploy configuration**, not as an operating backend and not as evidence of a successful Vercel deployment. Deployment still requires explicit user authorization. Before any production-like public preview containing more than fixed synthetic data, split the demo into a dedicated entry so the HTTP/authenticated application code is absent from the artifact, then add an authorized deployed-browser deep-link and response-header smoke test.
