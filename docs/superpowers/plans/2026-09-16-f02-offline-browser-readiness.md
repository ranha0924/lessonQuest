# F02 browser readiness verification correction

This is a test-only release-gate correction. No application, server, dependency, schema, credential, deployment configuration, teacher registration or AI behavior changes are authorized by it. It preserves all required CI jobs and the existing60-second test limit, with no skips or retries.

## Evidence and cause

Final documentation head b1cbf36 changed no runtime code from previously successful cb79a79. CI35038847962 attempt1 passed full verification, PostgreSQL, audit and demo; the service-preview matrix passed40/42. Tablet and mobile offline-answer cases timed out60seconds. Finally restoring the offline flag masked the original waiting operation, and CI uploaded no trace artifacts. Preserve that limitation: the exact original blocked action cannot be reconstructed from CI logs alone.

Nine unchanged focused local cases and a complete42-case rebuilt preview passed. Code inspection shows enterStudent waits only for the visible quiz button. StudentPlay renders the specification before awaiting durable EXPERIENCE_STARTED staging/delivery; pending authority correctly disables answers until that record is delivered. A controlled browser probe delayed only the IndexedDB completion notification for that first event by1500ms: all three viewports observed visible=true/enabled=false before disconnect, a queued EXPERIENCE_STARTED record, disabled answer controls, and successful recovery on reconnect. This reproduces a concrete race consistent with the CI failure, not proof of every detail of the original timeout.

## Bounded change and verification

1. Preserve attempt1 logs, unchanged reproduction evidence and the controlled probe source. The already requested same-head CI retry is diagnostic only; it cannot certify the forthcoming changed head.
2. In tests/browser/service-preview.spec.ts only, make the offline-answer case explicitly await enabled answer controls before disconnecting. Visibility alone is not its intended precondition. Leave other test flows and production code unchanged.
3. Exercise the actual existing offline-answer case under a test-only1500ms first-start completion-notification delay. Observe RED with the old readiness precondition (bounded action timeout prevents a60-second diagnostic stall), then GREEN with the new enabled-control precondition across desktop/tablet/mobile. Capture the temporary probe source and outputs; do not add a timing injection or instrumentation to production. The existing browser case remains the durable end-to-end regression and the new enabled assertion makes its start precondition explicit.
4. Run the changed case repeatedly and the full42-case browser matrix, scoped lint/type/format checks and diff checks. No broad runtime/DB rerun locally is needed for a test-only assertion; the exact new-head and merged-result CI still run the entire required suite.
5. Assign a nonimplementing independent reviewer to inspect the one-case diff and controlled RED/GREEN, independently execute focused browser checks and record86+ acceptance before commit/push/main delivery. Preserve the historical CI failure. Update the PR/progress accurately, then continue expected-head merge, merged-result CI, exact Production alias/SHA and user-selected real login activation under the existing remote plan.

Rollback is reverting this test-only assertion; it cannot affect saved data or runtime behavior. A fresh runtime failure or evidence inconsistent with this race requires investigation rather than a timeout increase or skipped check.
