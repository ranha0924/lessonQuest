# F02 persistent storage setup

2026-09-09. Local implementation instructions, not proof of remote provisioning. AI remains blocked. The actual Google browser/session/runtime wiring is still a following unit.

## Required boundary

The server uses a dedicated `lessonquest` PostgreSQL schema through a restricted login role. Schema migration and teacher registration run only with a separate schema-owner credential. App credentials can read approved identities/current authority and read/write F01 lesson content; they cannot modify identities, authority, audit history, migration history or schema objects. No server/build startup runs migration SQL.

The Vercel marketplace's owner DATABASE_URL must not be used as the application credential. Create an independent login role with no administrative/replication flags or membership in other roles, store its password only in the server's secret configuration, and provide its name as LESSONQUEST_RUNTIME_ROLE to the migration command. The migration checks effective grants plus exact schema/table/function/column ACLs and owners. It refuses PUBLIC/third-party access, runtime grant options, extra privileges, unsafe roles or drifted state. Other ordinary principals must not receive membership in that runtime role, even with inheritance disabled or only SET/ADMIN rights. Membership held solely by the already trusted current schema owner is permitted. Both directions are checked again at final grant validation. The immutable ledger binds the single runtime role, and bootstrap repeats the same role/ACL validation before writing. Do not paste credentials into chat, docs or command-line arguments.

## Before any remote execution

1. Verify the dedicated Neon resource is `neon-aero-jacket` / `bitter-math-50383085`, attached only to LessonQuest `web`; do not use the other service's resource.
2. Finish Neon email activation and verify production/preview database isolation. A preview must not receive production write credentials.
3. Record the expected host/database from the verified connection target without revealing its user/password. Confirm the new dedicated target contains no real/student data; create a recoverable Neon checkpoint/branch within the authorized free allocation. Stop if a new paid resource or destructive operation would be required.
4. Require the implementation's independent final score86/100+ and clean relevant CI before executing it remotely. Retain the previous Vercel deployment and its exact commit for recovery.

These external prerequisites are not yet completed by this document. All local tests use the owned disposable PostgreSQL harness.

## Explicit operator commands

Build the packages first with `pnpm deps:build`. Configure the following in a trusted local environment or an approved secure runner; never print their values:

- LESSONQUEST_MIGRATION_DATABASE_URL: separate owner connection, strict verified TLS, never the application URL.
- LESSONQUEST_EXPECTED_DATABASE_HOST and LESSONQUEST_EXPECTED_DATABASE_NAME: exact verified destination; mismatch fails before a connection.
- LESSONQUEST_RUNTIME_ROLE: existing standalone restricted login role; no grants to an owner/admin role.

Run `node scripts/provision-lessonquest.js migrate`. This transaction creates only a new dedicated schema, imports the pinned initial snapshot, records version/checksum/object inventory, and grants the narrow runtime access. A known identical setup returns unchanged. Unknown existing schema, changed checksum/version/inventory, unsafe role or unexpected effective privilege fails without automatic repair. SQL errors return only a safe generic failure. The command prints only status/version.

To register the explicit first teacher, additionally set:

- LESSONQUEST_FIREBASE_PROJECT_ID: lessonquest-df4b0.
- LESSONQUEST_BOOTSTRAP_FIREBASE_UID: the exact teacher's UID from the dedicated Firebase project, explicitly supplied by the operator. Never an email-domain match or first visitor.
- LESSONQUEST_BOOTSTRAP_ORGANIZATION_NAME: the name of this teacher's new private lesson space.

Run `node scripts/provision-lessonquest.js bootstrap-teacher`. This creates only TEACHER authority, a unique verified-identity mapping and one private organization/membership. It prints created/unchanged plus internal user/organization UUIDs. An exact healthy repetition reuses the same IDs only when that user has one identity mapping and one membership, and the private organization contains only that teacher. It refuses disabled, conflicting or expanded mappings; it never promotes an existing account, restores disabled access or joins an existing institution automatically. The runtime role cannot execute this registration.

## Recovery

DDL, grants, migration ledger and bootstrap writes are transactional. A failed fresh initialization leaves no partial schema, and failed bootstrap leaves no partial user/identity/organization. Do not use DROP SCHEMA or edit the ledger to repair a live mismatch. Investigate the safe failure, retain the checkpoint, and prepare an additive reviewed migration or restore plan. Reverting application code does not delete saved lessons.

The schema inventory detects missing/extra names and signatures; it is not a semantic attestation against a malicious database owner rewriting object bodies and ledger values. The owner credential must remain separate from the runtime and never be exposed through an HTTP route.
