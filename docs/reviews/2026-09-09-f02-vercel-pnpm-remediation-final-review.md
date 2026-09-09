# F02 Vercel pnpm correction — independent final review

Reviewer: `f02_vercel_pnpm_final`, a freshly assigned independent agent that did not implement this correction. Baseline: `e6201a65b46645efa50219cc94840288adb13dca`. Reviewed on 2026-09-09 using the code-review and verification-before-completion skills.

**99/100 PASS. No critical blocker or actionable implementation finding remains within this bounded build-tool correction.** This permits committing and pushing the correction for required CI and the existing Git-linked preview. It does not certify successful hosted deployment, production setup, real teacher login, or database provisioning.

## Scope and actual diff

Read `AGENTS.md`, `docs/PROJECT_CANON.md`, the implementation and final-review rubrics in `memory/projects/lessonquest.md`, the correction plan, and its 99/100 pre-implementation review. Inspected the complete three-file implementation/configuration/test delta, not only the implementer's account.

- `scripts/with-project-pnpm.sh` creates the current workspace's ignored bin directory, installs Corepack pnpm shims there, prepends that absolute path for its own process tree, and replaces itself with the supplied command. `set -eu` prevents the child command from running when setup fails, and quoted `exec "$@"` preserves argument boundaries and child status.
- `vercel.json` changes only `buildCommand`. An independent JSON comparison confirmed that the exact previous command, live/demo flags, and command sequencing are preserved inside the wrapper; every other Vercel setting is identical to the baseline.
- `tests/vercel-pnpm.test.ts` uses an owned temporary project with the real repository pin and real Corepack, disables network access, reproduces the stale nested executable, verifies the corrected version and child failure status, and removes only its own fixture.

There is no dependency, application, authorization, AI-denial, credential, database, routing-policy, global package-manager, or reference-repository change. The wrapper is invoked explicitly with `sh`, so an executable file bit is not required.

## Verification evidence

The preserved remote failure in `.verification/f02-vercel-pnpm-deployment-red.log` shows installation with pnpm 11.24.0 followed by nested pnpm 11.22.0 rejecting the project version. The preserved local RED log fails at the missing wrapper after the stale-binary baseline has been observed. Neither the pin nor its version check was weakened.

After the implementer released the shared build outputs, I independently ran:

- `corepack pnpm exec vitest run tests/vercel-pnpm.test.ts tests/vercel-api.test.ts`: **2 files / 4 tests passed**, recorded in `.verification/f02-vercel-pnpm-independent-regression-and-routing.log`. An earlier invocation selected only the pnpm test because its second filter used a nonexistent routing-test filename; its 1-test result is separately preserved and is not counted as routing verification.
- `sh -n` against the actual wrapper and real-Corepack probes in a temporary directory whose path contains spaces: arguments with spaces, shell metacharacters, wildcard text, and an empty argument survive unchanged; repeated invocation still resolves the pinned nested pnpm; a simulated Corepack setup failure returns status 73 and never launches the child. Evidence: `.verification/f02-vercel-pnpm-independent-wrapper.log`.
- Targeted ESLint with zero warnings and Prettier for the changed test/configuration: passed. `git diff --check`: passed.
- An independent scan of all **8 emitted live HTML/JavaScript/source-map files**, using 14 server, secret-name, synthetic-fixture, and build-tool markers: **0 findings**, recorded in `.verification/f02-vercel-pnpm-independent-artifacts.log`.

Inspected the implementer's successful exact `vercel.json` build with a deliberately stale pnpm first on PATH, all nine dependency builds and the live Vite build, plus the recorded lint, root TypeScript, shell, and formatting exits. The earlier formatting failure involved only ignored CLI-generated `.vercel/project.json`; the subsequent full formatting check passed without changing the three reviewed files. Evidence is preserved under `.verification/f02-vercel-pnpm-{status,exact-build,format,types,lint,artifacts}.log`.

The accepted application's earlier full 573-test, PostgreSQL 71-test, integration 80-test, scripted E2E 80-test, demo 12-case, preview 42-case, live 4-case, and audit evidence remains inherited evidence for unchanged application/dependency code. I did not rerun or claim those broad suites as fresh results of this correction review. Required CI must still verify the corrected pushed head.

## Frozen implementation identity

The three SHA-256 entries in `.verification/f02-vercel-pnpm-manifest.log` matched before and after independent execution:

| File                           | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `scripts/with-project-pnpm.sh` | `9ffd9a955e562473f613e200674f6e3ec1b0230b6d44ae50e1d5d385ff37b49b` |
| `tests/vercel-pnpm.test.ts`    | `c78b8aa5d702907266b8fd1b7c5c648cdd5ceeb73041e5c0dd096e53bd5a50b4` |
| `vercel.json`                  | `c1908cfce86b0dca4e9439cdc23f35787cf4698cfecb13039ce6d08ddfeb3a5d` |

## Final score

| Category                                    |      Score | Evidence                                                                                                       |
| ------------------------------------------- | ---------: | -------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      25/25 | Exact original build preserved; the real stale nested-manager defect is reproduced and corrected.              |
| Correctness and code quality                |      20/20 | Small POSIX wrapper; real Corepack resolution, argument preservation, repeated use, and failure behavior pass. |
| Security, privacy, and tenant isolation     |      20/20 | Scoped ignored tool writes; no pin bypass, secret handling, runtime/authority change, or external mutation.    |
| Test and verification evidence              |      20/20 | Durable RED/GREEN, fresh independent regression/probes, exact build evidence, static checks and artifact scan. |
| Operability, recoverability, and provenance |      14/15 | Existing production is retained; hosted success still must be observed after the corrected push.               |
| **Total**                                   | **99/100** | **PASS; no critical blocker to accepting this local correction.**                                              |

Hosted CI, deployed commit/status, and the safe unconfigured API response remain release checks. Existing production and database prerequisites remain in force, and AI stays blocked until billing is implemented and independently verified.
