# Phase 1 M5/M6 Final-Gate Remediation Plan 3

Controlling evidence is independent final review Attempt 3 plus the canon, approved design, original plan, and prior remediation plans. Scope remains local and synthetic.

1. Add RED cases for declarative and imperative direct-answer variants: `B가 맞아요`, `Option B is correct`, `The correct choice is C`, `가장 적절한 것은 B입니다`, and `Mark B as your answer`. Extend deterministic Korean/English choice-answer detection without weakening identifier/label checks.
2. Add RED direct-SQL tests for deleting `rasa_requests` and `boss_projection_jobs`. Register their state-machine triggers for `UPDATE OR DELETE` and reject deletion before any transition evaluation.
3. Add RED failed-projection audit lineage evidence. Correct `(id, trace_id)` argument order so both successful and failed jobs retain source ingestion trace correlation.
4. Extend real-boundary coverage where practical for terminal retry, reload, campaign end/replacement, and failure lineage. Preserve focused repository tests for authorization revocation that requires controlled provider timing.
5. Run the complete check, integration, E2E, audit, diff and credential scans. A fourth fresh independent reviewer must rerun all prior adversarial probes and score above 85 without blockers.

Denied/conflict audit durability is a required scored follow-up: add outer post-rollback audit handling where an attributable existing actor/tenant/resource can be recorded safely, without leaking authorization outcomes or weakening fail-closed behavior.

No external provider, Firebase, real student data, secret, push, merge, or deployment is in scope. Rollback is local commit reversion.
