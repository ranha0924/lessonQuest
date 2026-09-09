# F02 asynchronous authentication plan review

Date: 2026-09-08. Reviewer: implementing controller before production edits. This pre-implementation review does not replace independent final validation.

Scope: local async-auth compatibility prerequisite only, per `docs/superpowers/plans/2026-09-08-f02-async-auth-boundary.md`. Canon, AGENTS, F01 approved behavior and the 25/20/20/20/15 memory rubric control this review.

| Category                               |      Score | Evidence                                                                                                                                                                                                    |
| -------------------------------------- | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements and scope coverage        |      24/25 | Acceptance 1–5 trace server-owned authentication, write ordering, concurrency isolation and local compatibility to the real-login spec. Subsequent full-F02 units are retained explicitly.                  |
| Architecture and interface quality     |      19/20 | One structural interface, synchronous/async union and one await maintain existing provider and error boundary. No arbitrary SDK dependency is added to preview builds.                                      |
| Security, privacy and tenant safety    |      20/20 | Identity resolves before repository access, current tenant checks remain, reverse-order concurrency and safe rejection are tested. No remote account, data or credential access is required for this scope. |
| Test and verification quality          |      19/20 | Real HTTP/PGlite RED cases, synchronous regression and complete suite commands are defined. The external verifier is replaced only at its explicit latency/failure boundary.                                |
| Execution readiness and recoverability |      14/15 | Exact five production/test areas, existing versions, commands, independent gate, no-schema revert and original provenance are specified. Live Firebase and deployment are explicitly not certified.         |
| Total                                  | **96/100** | **PASS for this bounded local prerequisite. No critical blocker within this scope.**                                                                                                                        |

External Firebase console verification currently requires user Google sign-in; live Vercel/Neon configuration and OpenAI key access remain unverified. They block live integration/release and cannot be bypassed or treated as tested by this plan. They are not required to execute the fully local compatibility change above. No approval of broader runtime modifications, remote schema changes, or deployment follows from this score.

Test correction during GREEN: the initial new test additionally expected `no-store` on `/organizations`. Inspection showed the existing global middleware sets that header only on F01 lesson-input routes. That assertion was outside this plan's acceptance criteria and was removed; async failure status, safe body/diagnostics and no writes remain enforced. No caching behavior was changed to satisfy an incorrect baseline assumption. The future live API plan must cover no-store across authenticated responses before production identity/data rollout.
