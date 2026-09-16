# F02 Firebase identity adapter verification

2026-09-09 KST. Base `bdfdc15`, branch `codex/f02-live-authoring`. Local adapter scope only; no live authentication, production database migration, generation or release is certified here. Plan review96/100 PASS preceded implementation.

## Delivered candidate

The node-only `@lessonquest/auth/firebase` subpath composes an explicitly configured Firebase Admin14.3.0 app with `verifyIdToken(token,true)`, a Google/project/uid/tenant claim policy, current approved SQL identity lookup, safe failures, deadline/late-result suppression and a16-request underlying-operation bound. No default credential fallback or local/emulator authentication is accepted. Only the named SDK app is disposed.

The new read-only FirebaseIdentityRepository resolves a pre-approved `(project_id,uid)` link against current active users and compatible active memberships in active organizations in one SQL snapshot. Existing repositories still recheck authorization during each operation. Unknown users are never created. The local schema gains a constrained identity table; no remote schema was executed. The initial Google adapter supports alphanumeric/colon/underscore/hyphen uid strings up to128 characters; arbitrary custom-provider identifiers and Firebase tenants remain unsupported and fail closed.

## RED/GREEN and implementation findings

- First attempted test was blocked by pnpm's unresolved build-script choices; this is **not** behavioral RED. Inspected @firebase/util and protobufjs install scripts, retained both as explicitly disabled, and completed install. No runtime autoconfiguration was baked in.
- Minimal adapter behavioral RED: **29 failures /6 skipped**, exit1, `.verification/f02-firebase-behavior-red.log`. Claims, input validation, current actor copies and error redaction failed before policy implementation.
- New storage RED: **5 failures**, exit1, `.verification/f02-firebase-db-red.log`; the new relation did not yet exist.
- Undefined project config RED: **1 failure**, exit1, `.verification/f02-firebase-config-red.log`. Runtime string validation was then added instead of allowing RegExp coercion.
- `.verification/f02-firebase-control-red.log` and `...credential-red.log` are named historical artifacts but **passed** when run. They are supporting regression checks, not failing TDD evidence.
- Focused provider/store GREEN:44 tests. Composed provider/store/real HTTP GREEN:51 tests before the last undefined-config regression. Final full check includes all52 new tests.
- Initial SDK app test incorrectly assumed the SDK preserved Credential object identity; the corrected assertion checks the copied object and unchanged credential callback. The actual malformed-JWT SDK path rejects before any access-token or identity query. This proves factory wiring/invalid-token handling; it does not substitute for live signed-token/revocation testing.
- First type build needed explicit `types:["node"]` in the server-capable auth package under TypeScript6. Tests were adjusted to explicit resolved mock promises and bound credential assertions to satisfy lint. No lint/type safety rule was disabled.
- Initial audit found moderate uuid9 advisory GHSA-w5hq-g745-h8pq. The plan review records narrow gaxios6.7.1/teeny-request9.0.0 overrides to uuid11.1.1. Original failing audit is retained in `.verification/f02-firebase-audit-before-fix.log`. Consumer-relative CommonJS v4 calls and patched v5 buffer bounds passed without network in `.verification/f02-firebase-uuid-probe.log`.

## Implementer verification

| Check                                       | Result                                                    | Evidence                                                     |
| ------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm check` before uuid fix                | Exit0,528 tests/48 files, lint/format/types/builds        | `.verification/f02-firebase-check-before-dependency-fix.log` |
| `pnpm check` after uuid fix                 | Exit0,528 tests/48 files, lint/format/types/builds        | `.verification/f02-firebase-check.log`                       |
| `pnpm audit --prod` after fix               | Exit0, no known vulnerabilities                           | `.verification/f02-firebase-audit.log`                       |
| Consumer uuid compatibility/bounds          | Exit0                                                     | `.verification/f02-firebase-uuid-probe.log`                  |
| Browser import of server subpath            | Exit0: Vite rejects `./firebase` under browser conditions | `.verification/f02-firebase-browser-boundary.log`            |
| `test:integration`                          | Exit0,80 tests                                            | `.verification/f02-firebase-test-integration.log`            |
| `test:e2e`                                  | Exit0,80 tests                                            | `.verification/f02-firebase-test-e2e.log`                    |
| `test:browser`                              | Exit0,12 tests                                            | `.verification/f02-firebase-test-browser.log`                |
| `test:preview`                              | Exit0,42 tests (1.7m)                                     | `.verification/f02-firebase-test-preview.log`                |
| Emitted browser assets and final diff check | Exit0,21 emitted assets; diff clean                       | Final controller verification                                |

An initial browser-boundary probe expected the previous Vite error wording; the current Vite/Rolldown correctly blocked the import but failed that overly narrow message assertion. The successful rerun asserts the observed browser-conditions export denial, without changing package exports or runtime code.

## Frozen implementation and independent review

The11 production/test/package/config SHA-256 entries are frozen in `.verification/f02-firebase-manifest.log`. A newly assigned non-implementing agent `f02_firebase_identity_final` is inspecting the actual tracked and untracked diff and independently executing checks/probes. Its final report belongs in `docs/reviews/2026-09-09-f02-firebase-identity-final-review.md`. All required checks passed. The independent final review subsequently scored **99/100 PASS with no critical blocker** for this local adapter unit.

## Live setup and remaining objective

The controller inspected only the explicitly authorized LessonQuest Vercel/Firebase/Neon configuration. Vercel `web` is Git-linked to LessonQuest, Neon `neon-aero-jacket` is connected, and Google provider/web app exist. Neon console email activation, Preview branch isolation, OpenAI/Firebase server secrets, allowed production domain, PostgreSQL adapter/migration, explicit initial teacher registration, live API/browser login, generation and release remain outstanding. The OpenAI secret form has only its variable name prefilled for the user; no key value was read or written by the controller. No student data, reference repository, remote schema or remote deployment was modified. Full F02 remains in progress.
