# F02 CI duration — plan review

Read canon/memory rubric, exact workflow and GitHub's timeout annotation before changing scheduling configuration.

| Category                 |           Score | Evidence                                                                                                |
| ------------------------ | --------------: | ------------------------------------------------------------------------------------------------------- |
| Requirements/scope       |           25/25 | Allows the entire required matrix to finish; no check removed.                                          |
| Architecture/interfaces  |           20/20 | Only a job scheduling bound; test-level limits and triggers unchanged.                                  |
| Security/privacy/tenancy |           20/20 | Actions, permissions, sources, runtime and data access unchanged.                                       |
| Verification             |           20/20 | Actual hosted timeout RED, semantic/byte diff and independent review; full corrected CI still required. |
| Execution/recovery       |           14/15 | One reversible line, bounded20minutes and preserved canceled-run evidence.                              |
| **Total**                | **99/100 PASS** | **No blocker to this local scheduling correction; a longer deadline is not test success.**              |
