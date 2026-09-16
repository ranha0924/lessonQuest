# F02 Firebase ESM compatibility — plan review

Read canon/memory rubric, actual hosted errors, current pinned dependency source and upstream issue/release metadata before dependency changes.

| Category                 |           Score | Evidence                                                                                                                                    |
| ------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements/scope       |           25/25 | Restores server initialization and actual key retrieval without enabling AI or changing Firebase authority.                                 |
| Architecture/interfaces  |           19/20 | Pinned pnpm patch uses supported asynchronous ESM import; passport callback integration explicitly covered.                                 |
| Security/privacy/tenancy |           20/20 | No crypto downgrade, verification bypass, runtime flag override, real tokens or external test data.                                         |
| Verification             |           20/20 | Actual host flag RED, loopback generated key/negative checks, frozen install, full check/audits/artifact scan and independent gate.         |
| Execution/recovery       |           14/15 | Concrete two dependency files plus patch/lock/config/test, preserved failures and upstream attribution; remove only after verified release. |
| **Total**                | **98/100 PASS** | **No critical blocker to the local compatibility correction. Hosted activation remains conditional.**                                       |
