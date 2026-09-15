# F02 Neon deployment credential isolation — plan review

The actual next-deployment check exposed eight owner-secret names injected outside project-level configuration. The remediation replaces this exact resource/project association with the already working restricted connection; it preserves database resources, data, other associations and billing. This is a bounded correction within the user's existing LessonQuest setup/delivery authorization.

| Category                 |           Score | Evidence                                                                                                                                                                       |
| ------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirements/scope       |           25/25 | Exact web/resource/installation IDs; stops deployment credential injection without changing AI, identity, student scope or other services.                                     |
| Architecture/interfaces  |           19/20 | Official scoped disconnect command; restricted app URL remains Production-only; actual deployment env-name proof replaces insufficient project-only evidence.                  |
| Security/privacy/tenancy |           20/20 | No secret values read, no privileged runtime credential, no credential rotation/role/DDL changes; explicit project, no remove/--all/uninstall.                                 |
| Verification             |           19/20 | Preserved actual RED, exact before/after scope comparison, restricted DB regression, independent86+ gate, matching deployment GREEN and required CI.                           |
| Execution/recovery       |           14/15 | Confirmed CLI59.13.1 syntax, ready checkpoint/previous deployment, reversible exact association, uncertainty inspection before retry. No destructive restore or paid resource. |
| **Total**                | **97/100 PASS** | **No critical blocker to the bounded configuration correction; production release and actual deployed GREEN remain gated.**                                                    |

Prior DB/configuration acceptance remains historical evidence for its explicitly limited scope. Its post-deployment condition failed, so it cannot certify deployed credential isolation. A fresh independent final review and deployed addendum are mandatory for this correction.

The first CLI call rejected the project ID before mutation because installed59.13.1's disconnect handler matches only project names. Actual after-state is unchanged. The revised plan uses explicit name web after checking its API ID; source evidence and attempt1 are retained. Fresh review keeps25/19/20/19/14 = **97/100 PASS**, no scope expansion and no blocking uncertainty about the destination.
