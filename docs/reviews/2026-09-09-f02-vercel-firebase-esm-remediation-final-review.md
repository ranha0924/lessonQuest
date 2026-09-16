# F02 Firebase ESM compatibility — independent final review

**98/100 PASS. No critical blocker in this bounded compatibility correction.** This verdict permits accepting the local patch and proceeding to corrected-head CI and Preview verification. It does not certify hosted activation, a real Google login, database provisioning, or production release.

Reviewer: fresh independent agent `f02_firebase_esm_final`, not involved in implementation. Reviewed on 2026-09-09 against baseline `01e7e253e0595ee99b245bb7aa6718852a1d5867`. Read AGENTS.md, PROJECT_CANON.md, the project-memory rubric, the approved ESM remediation plan and its 98-point review. Applied the code-review and verification-before-completion skills. No implementation, credentials or external systems were modified by this reviewer.

## Scope and concrete findings

- The actual delta is confined to the pinned `jwks-rsa@4.1.0` patch, pnpm workspace/lock registration, two regression files and patch provenance. The separate remote-activation planning/progress documents are outside this implementation verdict. All five frozen implementation/test/config hashes in `.verification/f02-vercel-esm-manifest.log` match after independent checks.
- `patches/jwks-rsa@4.1.0.patch` removes two synchronous `require('jose')` calls and performs native dynamic imports inside the existing asynchronous signing-key function and passport decode error boundary. The installed dependency source matches the patch. Key filtering, supported algorithms, key selection, cryptographic implementation and dependency versions are unchanged. The lock diff only records the exact patch hash and updates the corresponding Firebase dependency edge/snapshot.
- Passport continues to deliver its callback. Its internal function now returns a Promise and decoding completes asynchronously, as documented in `patches/README.md`. An additional independent probe ignored that return value, as a callback consumer does, and verified single callback completion with no unhandled rejection for valid key retrieval, malformed/unsupported tokens, missing kid, HTTP failure, malformed JWKS and an empty key set. No new callback or fail-open defect was found.
- The preserved hosted error and RED logs demonstrate the original initialization crash before the request handler. Fresh child processes with `--no-experimental-require-module` now load the actual Firebase dependency graph, return unconfigured session 503 and unknown/query-route 404, and retain `cache-control: no-store`. This verifies the local reproduction condition; the corresponding corrected hosted responses still need to be observed.
- No authorization, Firebase identity mapping, tenant boundary, schema, AI gate, secret handling or runtime flag was changed. Independent authentication/tenant-negative and AI-default-denial tests pass. Synthetic signing fixtures are not claims about real Firebase credentials or Google login.
- Patch provenance identifies the package and MIT license. The upstream [issue 507](https://github.com/auth0/node-jwks-rsa/issues/507) and [open PR 508](https://github.com/auth0/node-jwks-rsa/pull/508) were independently checked; the local patch is not represented as an upstream release. Keep it pinned until a separately reviewed upstream release passes the same tests and hosted smoke.

No actionable defect requiring a code change was found.

## Independent execution evidence

| Check                                                                                            | Result                                                                                               |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile`                                                        | Exit 0; installed patched source inspected directly                                                  |
| Node-flag regression plus Firebase auth, server runtime, production runtime and Vercel API tests | 60 tests / 6 files passed                                                                            |
| AI generation default-deny and teacher-session tests                                             | 20 tests / 2 files passed                                                                            |
| Additional real loopback JWKS/callback probe under the host Node flag                            | 11 cases passed; 0 unhandled rejections                                                              |
| `corepack pnpm audit`                                                                            | No known vulnerabilities across all dependencies                                                     |
| `corepack pnpm lint`                                                                             | Exit 0                                                                                               |
| `corepack pnpm format:check`                                                                     | Exit 0                                                                                               |
| `corepack pnpm exec tsc --noEmit -p tsconfig.json`                                               | Exit 0                                                                                               |
| Frozen manifest and existing live release artifacts                                              | 5 hashes matched; 10 JS/map/HTML/CSS files scanned for 10 server/secret/fixture markers; no findings |
| `git diff --check`                                                                               | Exit 0                                                                                               |

The extra probe checks same-kid RSA key rotation without cache, rejects verification of the replacement signature with the old key, verifies EC P-384 and Ed25519 keys without an explicit JWK algorithm, rejects missing kid with multiple keys, accepts the existing single-key fallback, makes no JWKS request for malformed/none/HS256 tokens, and surfaces HTTP 503, malformed JSON and empty-JWKS errors through exactly one callback. The durable repository fixture independently exercises RSA/EC signature success and tampering, private/encryption/broken JWK filtering and unknown kid.

Independent outputs are `.verification/f02-vercel-esm-independent-{frozen,node-auth,deny,adversarial,audit,lint,format,types,manifest-assets}.log`; the additional probe is preserved as `.verification/f02-vercel-esm-independent-adversarial-source.log`. An initial overly broad artifact heuristic matched the intentionally public `AI_BILLING_NOT_CONFIGURED` shared contract code in JS and its source map. Inspection of `packages/contracts/src/teacher-session.ts:9` resolved this as an expected public error identifier; the corrected marker list and explanation are recorded in the scan log. No implementation changed to satisfy that probe.

Also inspected the implementer's actual preserved RED (2 intended failures), GREEN (2), complete check (577 tests / 60 files plus lint/format/types/build), focused (78), both audits, live build and browser-export refusal logs. Those build/full-suite results are reviewed implementer evidence, not falsely attributed as fresh independent full-suite runs. The dependency delta does not change the previously reviewed application or PostgreSQL implementation.

## Score and release conditions

| Category                                   |           Score | Evidence                                                                                                                          |
| ------------------------------------------ | --------------: | --------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance  |           25/25 | Exact dependency/loading scope; original host failure reproduced and regression addressed                                         |
| Correctness and code quality               |           20/20 | Minimal two-entry patch; actual installed graph, keys and callback error paths verified                                           |
| Security, privacy and tenant isolation     |           20/20 | No crypto downgrade or flag bypass; auth, tenant and AI denial preserved; no real credentials/data used                           |
| Test and verification evidence             |           19/20 | 80 independent durable tests plus 11 adversarial cases; full check/build evidence inspected; corrected hosted smoke still pending |
| Operability, recoverability and provenance |           14/15 | Exact version/hash, frozen installation and documented provenance; local patch requires tracked upstream replacement              |
| **Total**                                  | **98/100 PASS** | **No critical blocker for accepting this local remediation**                                                                      |

Before remote provisioning or main release, obtain successful required CI for the corrected commit and confirm that its matching Git-linked Vercel Preview returns the intended API 503/404 instead of process 500. The dedicated Firebase credential, approved teacher UID, restricted Neon runtime configuration and actual teacher login/save/reload activation remain separate delivery requirements. Preserve production and unconditional AI denial until those applicable gates pass.
