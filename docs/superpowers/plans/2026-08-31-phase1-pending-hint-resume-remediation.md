# Phase 1 Pending Hint Resume Remediation

Status: independently reproduced; concrete plan before production edits. Preserve Attempt2's failed review and wait for the reviewer to release the frozen candidate before implementing.

## Evidence and scope

The second independent reviewer reproduced the same failure through both a direct StudentPlay remount and the actual DevelopmentPreview teacher→student role switch. A disconnected hint remains RUNNING, but the resumed attempt exposes the pre-hint sequence and permits an answer. Original finalization then appends events behind that client, leaving completion and exact retry at409. Evidence: `/tmp/lessonquest-independent-attempt2-probes.log` and its remount probe. Seven other independent probes passed; they do not override this blocker.

This narrowly extends the prior UI-only remediation: pending hint state must be checked by the server when resuming, because component memory cannot survive unmount. Keep the existing response contract, schema, providers, authorization, preview lifecycle, dependencies and deployment configuration. Allowed production files are `packages/db/src/learning-repository.ts` and `apps/web/src/components/student-play.tsx`; test files are `apps/web/test/phase1-recovery.test.tsx` and `apps/web/test/phase1-negative.test.tsx`. Documentation/evidence changes are allowed. All original Phase1/Vercel boundaries still apply.

## Ordered TDD changes

1. Add durable held-provider/lost-response cases for direct remount and the actual DevelopmentPreview role switch. Before releasing the provider, click 이어하기 and require a real409, no playable answer/completion controls, and a retryable explanatory status. Verify inactive membership still returns404 before pending-state information. Restore membership only in the synthetic fixture, release and await original work, then retry 이어하기: restore one hint and authoritative sequence, answer correctly, complete, and assert exactly one request/action/usage/hint and event sequence0–5. Await detached work in finally.
2. Extend existing negative cases to unmount/resume after REJECTED, FAILED and TIMED_OUT, then answer and complete without phantom hints. Verify a finalization-fault FAILED request and an authorization-revoked FAILED request also stop blocking resume once authority/storage is restored. Preserve their terminal rows and audit evidence. A late timed-out provider must not append new learning events.
3. Observe the intended real-boundary RED before implementation. In `startOrResumeAttempt`, retain all existing authority checks first, then lock the authenticated existing attempt row with `FOR UPDATE`. Before reading its resume state, query organization/attempt-scoped Rasa sessions/requests for QUEUED or RUNNING. Throw the existing ConflictError if found. The same attempt lock coordinates with Rasa preparation/finalization and learning writes; no new state machine, ID generation or speculative sequence repair.
4. In the start handler, explain409 as an earlier request still being processed and leave the existing 이어하기 action available after the request settles. Do not mount the player, leak pending IDs, clear server state, poll indefinitely or pretend a running request was cancelled. Once no nonterminal hint remains, the unchanged resume response includes committed hints/answers/sequence.
5. Run focused real-boundary recovery, negative, flow, learning repository and API tests, full `pnpm check`, integration/E2E and both browser suites. Recompute the complete code/test/tooling manifest. Assign a different fresh independent final reviewer who did not implement this or previous changes, preserve both failed reviews, and require >85/no blocker before delivery.

## Risks and containment

- The server refuses resume while it cannot establish stable hint state. If an unrecoverable storage failure strands RUNNING, continue to fail closed; the synthetic preview can reset its entire tab-local data. Durable worker crash reconciliation belongs to future production-adapter work and is not claimed here.
- This addresses one preview user's remount/role switch and actual repository state. Real PostgreSQL multi-connection behavior, multi-device simultaneous learning and persistent recovery remain outside this Phase1 acceptance claim.
- No pending-state details are returned before existing user/organization/class/assignment authorization. Queries use organization plus authenticated attempt; no cross-tenant request lookup or real data.
- No schema migration or new resources. A reviewed revert restores prior code; preview reset remains explicitly destructive only to synthetic in-memory records. Release still uses existing Git-linked Vercel after mandatory independent/CI gates.
