# F01 Final-Gate Remediation Plan Review

Date: 2026-09-07. Review precedes all remediation production edits.

## Evidence and controlling requirements

The correction plan is `docs/superpowers/plans/2026-09-07-f01-final-gate-remediation.md`. The independent unchanged-candidate probes showed uppercase-target identical PUT replay409, NUL retryable500/no write and repeated browser editor lock, plus lone-surrogate replacement or JSON storage failure. The existing source confirms the causes: raw UUID parse output later compares against canonical SQL UUID text, and all three F01 text schemas check only trimming/length. The proposed fixes address these source boundaries; they do not swallow database errors or clear a genuinely uncertain network mutation.

The F01 scope remains the approved synthetic in-tab preview. Rejecting NUL/unpaired surrogates makes the text contract consistent with lossless PostgreSQL-compatible storage. Valid Unicode, field limits and normal whitespace remain supported, and the UI must explain the specific correction while preserving local work. Only F01 repository IDs are canonicalized; global identity contracts and tenant authorization are unchanged.

## Rubric

| Category                               | Evidence                                                                                                                                                                 |      Score |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------: |
| Requirements and scope coverage        | Both independently reproduced findings map to explicit acceptance criteria; invalid text is rejected rather than silently changed; original preview exclusions retained  |      25/25 |
| Architecture and interface quality     | Shared field refinement and F01-local UUID parsing fix the causes once; strict contracts, hashes, database authority and existing retry lifecycle remain intact          |      20/20 |
| Security, privacy and tenant safety    | Distinct target/body and revoked-replay negative tests retained; safe400/no-store/no-write proofs; no content in diagnostics and no real data/external system            |      20/20 |
| Test and verification quality          | Durable RED before edits across contract, DB, HTTP, component and real browser; positive Unicode preservation; full sequential matrix and fresh independent revalidation |      20/20 |
| Execution readiness and recoverability | Exact file map, bounded one-agent correction wave, no dependency/migration, fresh manifest and preserved failed history, reversible synthetic-only change                |      14/15 |
| **Total**                              | **PASS; no critical plan blocker**                                                                                                                                       | **99/100** |

The plan passes the mandatory score strictly greater than85. This authorizes only the planned test-first correction, not acceptance, merge or deployment. The failed implemented candidate remains unaccepted until the corrected result obtains a fresh independent score86+ with no critical blocker.
