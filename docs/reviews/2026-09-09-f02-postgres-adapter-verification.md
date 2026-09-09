# F02 PostgreSQL adapter implementer verification

2026-09-09; base20b3672. Scope: approved local PostgreSQL adapter plan and documented concurrency/lifecycle refinements. No remote connection, DDL, deployment, student data or OpenAI call occurred. Independent final validation passed98/100 with no critical blocker; see2026-09-09-f02-postgres-adapter-final-review.md. Acceptance is limited to this local adapter. Runtime/config/test files are frozen in `.verification/f02-postgres-manifest.log` (22 files).

## TDD evidence

- `.verification/f02-postgres-red.log`: five failures against the no-operation adapter scaffold. The first harness incorrectly returned exit0 because an upstream exit hook replaced process.exitCode. This is not a successful check; it is preserved as failed assertions only. A concurrency setup promise also caused an unhandled rejection and timeout before real implementation.
- `.verification/f02-postgres-red-exit.log`: persistence assertion remains RED after explicit exit propagation; command exit1. The overlap test now observes either setup completion or failure rather than leaving a rejected promise unhandled.
- `.verification/f02-postgres-config-red.log`: unsafe-configuration assertions fail against the stub; exit1.
- `.verification/f02-postgres-first-green.log`: initial32 checks passed, but fast connection startup did not reliably overlap duplicate writes. This did not establish the required concurrency guarantee.
- `.verification/f02-postgres-race-red.log`: invocation-owned test trigger holds inserts150ms, reproducing the duplicate-create race (1 failure/31 pass; exit1). Tenant+actor membership-row locking before fresh authority and ledger reads closes it. Exact update replay and revision conflict tests also run on independent pools.
- `.verification/f02-postgres-connection-red.log`: terminating an owned checked-out backend caused two uncaught connection errors; exit1 despite the local assertion passing. A client error listener now remains active through rollback/release.
- `.verification/f02-postgres-detached-red.log`: a detached failed SQL query was incorrectly reported committed; exit1. Query draining now detects the failure before COMMIT.
- `.verification/f02-postgres-green.log`: final36 real-PostgreSQL tests pass, including all above regressions, persistence after pool recreation, SQL value types, one-client transactions, concurrent-client separation, close/escaped-handle rejection, strict TLS/config, current identity/role/tenant enforcement and audit-failure rollback. Exit0.

## Verification status

- `pnpm check`: exit0,528 tests/48 files, lint, formatting, root/web typecheck, all workspace builds and Vite production build. `.verification/f02-postgres-check.log`.
- `pnpm audit --prod`: exit0, no known vulnerabilities. `.verification/f02-postgres-audit.log`.
- Frozen install after exact native-package build approvals: exit0; inspected Darwin ARM64/Linux x64 hydrate scripts only reconstruct package-local symlinks. Existing disabled Firebase/protobuf install scripts remain disabled.
- Dedicated command and regression matrix all passed: PostgreSQL36, integration80, E2E80, demo-browser12, preview42. `.verification/f02-postgres-matrix-status.log` records all five exit0 results, with complete logs `.verification/f02-postgres-{postgres,integration,e2e,browser,preview}.log`. Actual Vite browser resolution rejects the node-only PostgreSQL subpath; all21 emitted JS/map/HTML artifacts lack driver/adapter/test-credential markers (`.verification/f02-postgres-browser-boundary.log`).

## Limits and recovery

This validates a local storage building block, not live F02. Production still needs versioned migrations/application roles, Neon activation/environment isolation, Firebase server credentials and approved-domain/bootstrap configuration, server entrypoint and browser login/session lifecycle, and generation/payment controls. User chose no payment service: external AI must remain default-denied even if a key exists; no generation provider is implemented in this unit. Unsupported URL channel_binding=require is rejected, not silently downgraded; TLS certificates are always validated in production mode. An operational connection must use supported explicit semantics.

Revert this bounded commit to restore concrete PGlite types. The helper creates and cleans only its own synthetic cluster and never touches a user's existing PostgreSQL service. Linux binary execution will be verified by the existing mandatory CI job; local execution is Darwin ARM64. Do not infer remote readiness or full release from the local score.

## Independent-review cleanup correction

The independent reviewer reproduced SIGTERM during helper setup leaving one temporary directory (`.verification/f02-postgres-independent-interrupt.log`). Preserved as RED, then corrected before acceptance using the inspected public async-exit-hook unhookEvent API with exact dev-only2.0.1 dependency. Only our process's upstream signal handlers are replaced; our finally now owns stop/removal before exit. No production adapter code changed. The final22-file manifest was regenerated.

Repeated helper suite passes36/36 (`.verification/f02-postgres-cleanup-green.log`). Own setup-phase and active-test SIGTERM probes exit143 with no cluster directory left (`.verification/f02-postgres-cleanup-interrupt-green.log`). Frozen install, helper ESLint, affected Prettier files, production audit and diff checks pass after the dependency/helper correction. Original full528-test and browser matrix remain applicable to unchanged runtime/test/config files; independent final scoring must inspect the corrected helper and repeat interruption checks.
