# F02 AI default-deny implementation verification

2026-09-09; base389429d. User explicitly selected no payment service and AI blocked by default. This unit adds an authenticated saved-input generation endpoint that unconditionally denies after current repository access checks, and a disabled UI generation control. No OpenAI provider, key lookup, payment service or enable switch was added. Production code/test files are frozen in `.verification/f02-ai-deny-manifest.log`.

## TDD and implementer evidence

- `.verification/f02-ai-deny-red.log`:12 failures/7 passes before implementation, exit1. The generation route returned404 rather than the required explicit denial/strict-body response, no-store was absent for this new path, and the UI control was missing.
- `.verification/f02-ai-deny-green.log`:19 focused HTTP/PGlite + React/API tests passed after initial implementation.
- `.verification/f02-ai-deny-body-red.log`:1 regression failure, exit1. Shared cache matching accidentally granted the new ID-only route F01's larger256KiB body limit. Cache matching was separated; generation keeps the default64KiB limit and a70KiB payload must return413.
- `.verification/f02-ai-deny-check.log`: final full `pnpm check` exit0,544 tests/49 files, lint, formatting, root/web typechecks and all builds. Includes the corrected body bound and assertions that save, reload and revision2 leave AI disabled with no generation request emitted.
- One type-only test annotation required a lint-compatible type import. It was corrected before the passing full check; no runtime behavior changed for that correction.

The real HTTP cases include approved teacher and SUPER_ADMIN with a synthetic server key and AI_ENABLED=true present before API import, forged/absent credentials, current user disablement/role downgrade, cross-tenant access, spoofed paid/role/provider/apiKey/paymentStatus input, origin/media-type/body enforcement, and a forged billing callback. The fixture spies on external fetch after setup and proves zero calls, unchanged lesson revision and mutation count, and no experience creation. Access reads can add the existing safe audit records; this is not a claim that denial creates no audit entry.

## Regression and emitted-artifact evidence

The four-command integration/E2E/demo-browser/preview matrix completed with all exits0 and80/80/12/42 passing cases respectively. `.verification/f02-ai-deny-matrix-status.log` records the statuses; complete logs use `.verification/f02-ai-deny-{integration,e2e,browser,preview}.log`. Fresh emitted-artifact scanning passed across21 JS/map/HTML files in normal, normal-check and preview outputs, with no server SDK, credential or synthetic AI key markers (`.verification/f02-ai-deny-bundle.log`). The production audit is clean. Fresh independent final validation passed99/100 with no critical blocker in `2026-09-09-f02-ai-default-deny-final-review.md`. The reviewer independently passed19 focused cases and22 adversarial probes, verified zero guarded AI environment reads and zero fetch calls, repeated artifact/audit checks and matched all five frozen hashes. The minor diagnostic resourceId note is trace-correlated and nonblocking.

## Delivery limits

This is local code, not a live payment integration or a completed F02 deployment. Google login, approved identity and PostgreSQL building blocks passed their separate local reviews, but server credentials, Neon activation/environment isolation, migrations/bootstrap, server entrypoint and browser login/session wiring still need completion. No key value or actual student data was accessed; no OpenAI call occurred. A key is not required to continue login/storage work while AI remains blocked. Future enablement requires its own verified payment-event/entitlement/quota implementation and gates; no administrator or client override is available now.
