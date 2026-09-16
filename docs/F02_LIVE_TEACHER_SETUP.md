# F02 live teacher runtime setup

Local implementation and test fixtures do not establish live authentication or remote persistence. AI generation is unconditionally denied until a separately reviewed payment-verification implementation exists. An OpenAI key is unnecessary for this release and cannot enable generation.

The live application exposes Google login, approved teacher spaces and the F01 lesson editor. Server routes are limited to GET /api/session, GET /api/health and the existing lesson-input collection/item/generation routes. A current verified Google identity must match an operator-approved internal teacher and active organization membership. There is no first-visitor registration, email linking, client paid flag, admin exception, synthetic seed, or student/publishing runtime shortcut.

## Required configuration

Use only the existing dedicated Firebase project lessonquest-df4b0 and the confirmed LessonQuest Neon database. Complete the target, preview-isolation and recovery checks in F02_PERSISTENT_STORAGE_SETUP before remote provisioning. The migration owner credential and role are distinct from the application login; never use marketplace DATABASE_URL as the application fallback. Runtime readiness is read-only, checks its ledger-bound restricted login and actual schema grants, and returns safe 503 when configuration or storage is uncertain. No startup DDL/bootstrap is performed.

Production-only server variables:

- LESSONQUEST_DATABASE_URL: restricted app login URL for the provisioned lessonquest schema, with verified TLS and compatible channel-binding configuration. Store as a Vercel Secret.
- LESSONQUEST_FIREBASE_SERVICE_ACCOUNT_JSON: service_account JSON for lessonquest-df4b0. Store directly as a Vercel Secret. Only project ID, service-account email and RSA private key are passed to Firebase Admin; JSON token URLs are not trusted. Never put this in source, chat or VITE_ variables.
- LESSONQUEST_FIREBASE_PROJECT_ID: lessonquest-df4b0.
- LESSONQUEST_TRUSTED_ORIGIN: exact https://web-phi-lyart-72.vercel.app for the current verified production domain. Request origins and browser Origin headers must agree with this configured value. Preview has no live access until its separate target and credentials are explicitly configured.

Public build variables from Firebase's web-app settings:

- VITE_FIREBASE_PROJECT_ID: lessonquest-df4b0.
- VITE_FIREBASE_AUTH_DOMAIN: lessonquest-df4b0.firebaseapp.com.
- VITE_FIREBASE_APP_ID: 1:817389279169:web:3e16da1ed799bb22544140.
- VITE_FIREBASE_API_KEY: the Firebase web configuration key, entered directly into Vercel configuration. This web SDK identifier is public; it is not the Admin/OpenAI secret.

Add web-phi-lyart-72.vercel.app to Firebase Authentication's approved domains. Google provider must be enabled. The SDK uses session persistence and Google popup login; browser tokens are never copied into application storage/window/logs. Logout/account change aborts outstanding requests, clears the editor and discards late token/JSON responses. Unknown/unauthorized users receive a registration-status screen with their own noncredential UID for explicit operator registration. It does not claim whether an account is missing or revoked.

Run the reviewed operator bootstrap only for the user's explicitly chosen Firebase UID. It creates one private teacher space, no class/student/admin. Then verify a non-sensitive lesson can be saved, revised and reopened after sign-out/new login on the actual deployed SHA. Check anonymous/other account denial and AI_BILLING_NOT_CONFIGURED without making an OpenAI request.

## Build and verification

Vercel's existing Git-linked build selects VITE_LIVE_MODE=true and both synthetic flags false. The unnamed /api/(.*) rewrite precedes SPA fallback (named captures would add unwanted query parameters) and the root api/index.ts exports a Fetch handler. Only Google/Firebase's required auth script/frame/connect origins are added to CSP; live CSP does not permit script eval or Wasm eval. API responses are no-store. Existing synthetic-preview browser tests explicitly permit Wasm only in their disposable preview harness because PGlite needs it.

pnpm test:live builds an ordinary live bundle with missing public config plus a separate test-only BrowserAuth fixture. Its loopback Hono/PGlite server and synthetic credentials exist only under tests. The test server applies the actual configuration through official @vercel/routing-utils6.5.0 before forwarding requests; its development-only path-to-regexp dependency is scoped to patched6.3.0. The browser checks prove UI/HTTP/SQL save and reload behavior, not actual Google authentication. The disposable PostgreSQL suite separately exercises Firebase verification doubles, Hono gateway and restricted persistent pools. Full check, PostgreSQL, integration/E2E, demo/preview/live browser suites, production audit and emitted artifact containment precede independent final review. CI includes the live browser matrix.

The Firebase SDK is pinned at 12.18.0; Firebase Admin remains 14.3.0. New code is authored in this repository. API conventions were checked against https://vercel.com/docs/functions/runtimes/node-js and https://firebase.google.com/docs/auth/web/google-signin on 2026-09-09. No reference repository was copied or changed.

Release requires the independent final gate, merged-result/CI checks and verified production deployment SHA/status/URL. Code rollback uses the previous reviewed commit/deployment and preserves saved database content. Missing external credentials or setup prevent live completion; they do not trigger a synthetic fallback or unlock AI.
