# F02 idle connection timeout — plan gate

Reviewed against PROJECT_CANON and the project-memory rubric before production edits. The actual idle-state first-query timeout is now reproduced, superseding the earlier absence of a failed-stage diagnosis for this new observation. The prior generic failures remain inconclusive.

| Category                      |           Score | Evidence                                                                                                                                                              |
| ----------------------------- | --------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements and scope        |           25/25 | Restores bounded DB startup connectivity needed by authorized teacher storage; exact endpoint; no payment/auth/tenant expansion.                                      |
| Architecture and interfaces   |           19/20 | One shared pool setting15seconds; existing60second function limit and unchanged SQL/transaction limits; no retries or provider fallback.                              |
| Security, privacy and tenancy |           20/20 | TLS/binding, restricted role/readiness, fail-closed sanitized errors, pool cap and AI denial unchanged; no real records/DDL/credential operations.                    |
| Tests and verification        |           19/20 | Actual idle RED plus real disposable PostgreSQL relay regression, bounded stall/recovery negative case, complete affected/full checks and actual idle GREEN required. |
| Readiness and recovery        |           14/15 | Exact file steps, installed driver behavior inspected, no dependency change, previous production retained, fresh independent86+ gate and deployment checks.           |
| **Total**                     | **97/100 PASS** | **No blocker to the bounded implementation and verification. Actual corrected idle proof and independent acceptance remain required.**                                |

The plan changes no billing plan or compute suspension policy. Fifteen seconds is a bounded candidate supported by the observed five-second failure and must pass the actual idle diagnostic; failure requires new investigation, not repeated blind increases. This gate does not approve live activation before Firebase/teacher and release verification.

Independent code inspection clarified that the same pg-pool setting also bounds checkout waiting when the pool is full. The plan now explicitly records that finite15second acquisition wait. This is an inherent effect of the reviewed single-setting change, with unchanged pool cap and SQL limits; the bounded score remains97/100 and scope is unchanged.
