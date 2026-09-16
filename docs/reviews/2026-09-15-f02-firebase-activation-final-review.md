# F02 Firebase credential configuration — independent final review

**97/100 PASS. No critical blocker remains for this bounded credential-registration and configured-runtime stage.**

Reviewer: independent agent `f02_firebase_activation_final`, assigned after the operation and uninvolved in implementation or external configuration changes. This review covers the September 15 activation stage; independent execution completed September 16, 2026 (Asia/Seoul). Reviewed code HEAD is `cb79a79d4858b1d950b9ab56ad8f156bd1b4e02c`. The only working-tree changes in this stage are planning/progress/review documentation. No production source, dependency, schema, role or migration changed for key registration.

This pass permits delivery of the already independently accepted code through the existing authorized PR flow, subject to successful required CI for the final documentation head and merged result, expected-head protection, and an exact matching Git-linked Production deployment. It does not certify that production delivery, real Google login, teacher provisioning, or lesson save/re-login has happened. Those remain separately required. No teacher account may be inferred from a first visitor or email address.

## Inspected scope and operation

Read `AGENTS.md`, `docs/PROJECT_CANON.md`, the final rubric in `memory/projects/lessonquest.md`, the remote-activation plan and its September 15 handoff amendment with 97-point plan review. Inspected the actual pending documentation diff, complete registration/runtime helpers and captured copies, relevant production authentication/configuration/runtime/AI diff against main, current CI and Preview evidence, and the prior independent isolation/connection-timeout reviews.

The dedicated targets are Firebase `lessonquest-df4b0`, service account `lessonquest-auth-verifier@lessonquest-df4b0.iam.gserviceaccount.com` with client ID `108123064709442208355`, Neon `bitter-math-50383085/main` using only `lessonquest_runtime`, and Vercel `web/prj_LzEIlAOSVRxc4upq58WKd12OdoTf` in `ranha0924s-projects`. The user completed the credential download. The operation restricted the local file to mode0600 and privately checked its exact project, service-account identity and RSA key through the accepted server parser. The parser constructs the credential from only project ID, client email and private key; supplied endpoint URLs are not used.

The registration helper first requires successful exact-head CI and the verified isolated Preview, actual local configured-runtime/Firebase-read proof, a fresh project ID/name match, and the exact previous eight-variable metadata. The new variable must initially be absent. It then sends the credential through standard input to the pinned official Vercel CLI, adding only `LESSONQUEST_FIREBASE_SERVICE_ACCOUNT_JSON` as sensitive Production configuration. It does not print secrets, read the OpenAI value, replace an existing credential, retry an uncertain mutation, or change any other resource. The recorded CLI exit is0. Before/after metadata establishes the one addition and exact preservation of every other name/type/target/configuration ID. No secret values were compared or decrypted.

The reviewed helper files exactly match their frozen evidence copies:

- Registration helper SHA-256: `fd719d08c7bc874304f3b94c4b8b304b75567c1f66a85b4101f3034663eb488a`.
- Configured-runtime verifier SHA-256: `56dde8666589bf85ee915d0af310b840d2ff18f98073bcceed8c5bf4400c5101`.

The reviewer did not rerun the registration mutation or display/read credential contents into output.

## Independently executed verification

1. Queried fresh Vercel environment metadata through the official CLI/API, selecting names/type/scope/configuration ID only. The result exactly matches the recorded nine-variable after-state. Firebase server JSON, restricted DB URL and OpenAI key are all sensitive and Production-only. All eight prohibited generic owner-credential names remain absent. The other eight variables are unchanged from the operation's before-state.
2. Independently ran the frozen configured-runtime verifier, exit0. It checks private-file modes and exact dedicated identities/endpoint, exercises the accepted configuration parser, and confirms missing Firebase server configuration is rejected. A fresh random nonexistent Firebase UID lookup returned `auth/user-not-found`, proving the credential can perform the required viewer read without listing users or displaying real records.
3. The same execution initialized the accepted production runtime against the actual restricted Neon connection and returned the following results, each with `cache-control: no-store`:

| Request                  | HTTP | Result                        |
| ------------------------ | ---: | ----------------------------- |
| Health                   |  200 | Successful configured runtime |
| Anonymous session        |  401 | `AUTHENTICATION_REQUIRED`     |
| Malformed bearer session |  401 | `AUTHENTICATION_REQUIRED`     |
| Foreign-origin session   |  403 | `ORIGIN_FORBIDDEN`            |

4. Independently ran five focused test files: server runtime, production runtime/configuration, Firebase API authentication, AI default denial, and Firebase auth provider. **71/71 tests passed**, exit0. These checks exercise identity/revocation and failure boundaries, configuration rejection, runtime lifecycle, and unconditional unpaid-generation denial. No paid provider request or teacher bootstrap occurred.
5. Inspected exact-head CI `34926453666`: SHA `cb79a79d4858b1d950b9ab56ad8f156bd1b4e02c`, completed/success, with full verification, actual PostgreSQL persistence/concurrency, production audit, and all three browser modes successful. The prior timeout review independently records73 PostgreSQL tests, stable577 full tests and unchanged implementation fingerprints. A complete broad suite was not rerun for this configuration-only stage.
6. Inspected the matching READY Preview record `dpl_BtBidn2uvXsgmuvbGDz8UchHSFK3`: exact SHA, no owner credentials or Production app/OpenAI environment names, and actual session503/unknown404/query404 JSON/no-store responses. This intentionally unconfigured Preview is isolation evidence, not live authentication proof. `git diff --check` passes.

Independent evidence under `.verification/`: `f02-firebase-activation-independent-metadata.log`, `f02-firebase-activation-independent-runtime.log`, `f02-firebase-activation-independent-runtime-error.log`, and `f02-firebase-activation-independent-focused.log`. The runtime stderr contains only expected sanitized anonymous/invalid-auth diagnostics. Operation evidence is `f02-firebase-env-{before,after,registration}.log`, the captured helper sources/manifest, and `f02-firebase-configured-runtime{,-error}.log`.

## Findings and limits

No actionable authorization, tenant-isolation, credential-handling or collateral-change blocker was found in this bounded operation. The runtime still requires a verified Google identity and an existing explicit database mapping; initialization performs no automatic registration. The AI route still reaches unconditional `AI_BILLING_NOT_CONFIGURED` after authentication, strict input and ownership checks, with no OpenAI key lookup, provider construction or privileged bypass. The focused denial tests passed independently.

One nonblocking documentation precision issue was reported and fixed during review: older progress paragraphs still described Firebase registration and the timeout commit's CI as pending after later paragraphs recorded their completion. Independently re-read the corrected transitional statements: they now reference the later completed evidence while preserving the still-pending production/login claims. The final diff check passes.

The read-only credential lookup and local configured-runtime success do not establish that a newly deployed function can use the registered credential, nor do they establish successful real Google sign-in. The exact Production deployment must be verified after integration; then the user's explicitly chosen account and verified own UID must precede the approved bootstrap and persistent sample save/re-login check. The local runtime test does not read back the sensitive Vercel value. These deliberate remaining delivery steps are not replaced by mock or Preview evidence.

The two earlier generic DB failures remain unattributed. The separately observed idle connection timeout and its reviewed fifteen-second correction have distinct actual RED/GREEN and independent verification; they must not be retroactively presented as explaining every generic failure. No blanket availability claim is made. The previous deployment and DB recovery branch remain retained; recovery has not been restore-tested. This review authorizes no credential replacement, paid resource, destructive operation, student-data access, other-project change or AI activation.

## Rubric

| Category                                   |           Score | Evidence                                                                                                                                         |
| ------------------------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance  |           25/25 | Exact dedicated credential and one Production variable; user handoff complete; no unauthorized account or resource expansion.                    |
| Correctness and code quality               |           19/20 | Frozen guarded operator, exact metadata comparison, accepted parser/runtime and independently successful real read/probes.                       |
| Security, privacy and tenant isolation     |           20/20 | Private file/stdin handling, scoped target, no value output, fail-closed auth, explicit identity mapping and unchanged AI denial.                |
| Test and verification evidence             |           19/20 | Independent live metadata/runtime/read and71 tests; exact-head successful CI and isolated Preview; hosted configured/login proof still required. |
| Operability, recoverability and provenance |           14/15 | Preserved source/hash/evidence and prior failures; bounded operation with retained rollback resources, no restore exercise.                      |
| **Total**                                  | **97/100 PASS** | **No critical blocker within this configuration stage; remaining delivery and real-login checks remain mandatory.**                              |
