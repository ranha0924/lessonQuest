# Phase 1 M5/M6 Final-Gate Remediation Plan 2

This plan closes every finding in independent final review Attempt 2. Canon, the approved design, the original plan, and the first remediation plan remain controlling. Scope stays synthetic and local.

1. Add RED output-policy cases for Korean letter-choice imperatives and English `select`/`pick` choice imperatives, including punctuation/case variants. Reject direct positional, letter, identifier, and label instructions while retaining safe conceptual hints.
2. Add RED direct-SQL tests for deleting campaigns and updating/deleting `assignment_rasa_policies`. Make campaigns undeletable and assignment Rasa policy immutable after insertion. Existing legal campaign end remains the only mutation.
3. Add a RED browser/client test proving retryable hint HTTP failures preserve the exact request ID. Clear an ID only after success or a terminal non-retryable response; keep it across 503/transport ambiguity.
4. Replace random projection audit trace IDs with the source learning event's original trace-correlated audit trace ID. Add a RED evidence assertion joining projection and ingestion audits.
5. Extend the real boundary tests with exact hint retry after 503, reload evidence, campaign end/replacement, and the highest-risk authorization negatives. Keep full aggregate-only and lifecycle assertions.
6. Run targeted RED/GREEN checks, `pnpm check`, integration, E2E, audit, complete base-to-head diff check, and credential/provider scan. A third, different independent reviewer must reproduce all prior probes and score above 85 without a critical blocker.

Rollback remains local branch reversion; no external mutation, deployment, provider, secret, Firebase, or real student data is introduced.
