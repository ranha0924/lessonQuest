# Dark Demo Main Merge and Vercel Release Plan

## Scope and authority

- User authorization on 2026-08-31: merge the current work into remote `main` and deploy now; future LessonQuest changes follow the same verified delivery workflow.
- Release the already-reviewed synthetic dark student/teacher demo from PR #4, `codex/student-home-redesign` into `ranha0924/lessonQuest:main`.
- Include the user's delivery preference in `AGENTS.md`, `CLAUDE.md`, and `memory/projects/lessonquest.md`, plus this release plan and its reviews. No new production code, dependencies, environment variables, or deployment configuration changes are planned.
- Controlling requirements: `docs/PROJECT_CANON.md`, the Vercel demo preview plan/review, and the unified dark theme plan/final review. The unchanged UI passed independent final validation at 97/100 with no critical blocker.

## Target and baseline

- GitHub PR: https://github.com/ranha0924/lessonQuest/pull/4
- Original head: `2916fd45787414176a2ec15d3d315f460442bd36`; original remote main: `db784b357de75e479daf8043ce40097a02d560a0`.
- Existing Vercel target: team `ranha0924s-projects`, project `web`, project ID `prj_LzEIlAOSVRxc4upq58WKd12OdoTf`, established from Vercel's GitHub status/comment.
- The original head has successful GitHub CI run `33344307805` and a Ready Vercel preview. The production URL must be obtained from deployment evidence, not guessed.
- Keep the existing root `vercel.json`: frozen pnpm install, workspace dependency build, `VITE_DEMO_MODE=true`, static `apps/web/dist`, SPA rewrites, and restrictive security headers.

## Ordered release checklist

1. Preserve the existing delivery-rule edits, review the actual diff, and pass the documented plan gate before any remote mutation.
2. Run fresh `corepack pnpm check`, `corepack pnpm audit --prod`, the demo build, and `git diff --check db784b3`. The existing TDD and independent UI evidence remains valid because runtime files do not change in this release step.
3. Obtain a fresh independent release-readiness review of the actual code lineage, documentation delta, target evidence, and checks. Require at least 86/100 and no critical blocker. The reviewer may edit only its review report.
4. Commit the delivery documentation on the existing feature branch, push without force, and wait for the exact new PR head's CI and Vercel preview to succeed. Recheck head/base and merge using GitHub's expected-head guard without bypassing protections. Preserve commit history with a merge commit.
5. Fetch and fast-forward local `main` to the remote merge commit. Observe the Git-triggered deployment instead of creating a duplicate. Verify the Vercel success status belongs to that exact merge SHA and confirm production environment/domain through available deployment evidence.
6. At the verified live URL, check HTTP success and expected static assets/security headers when observable. Test student initial -> wrong answer -> fixed Rasa hint -> successful retry -> aggregate boss 40/100, teacher switch, dark surfaces, and a SPA deep link. No real credentials or student data are entered into the demo.
7. Report merge SHA, PR status, deployment status, live URL, checks, and any unverified condition accurately. Do not call a queued deployment or an authentication-blocked live smoke test complete.

## Safety, observation, and rollback

- Synthetic static demo only: no backend deployment, Firebase, real student data, external AI, migrations, paid-resource creation, or reference-repository mutation.
- Missing dashboard login does not justify bypassing authentication. Use existing authorized GitHub CI/deployment evidence; ask for dashboard login if needed to establish the production URL/environment or complete live verification.
- Keep previous `main` and release SHAs as recovery anchors. If build, asset loading, security headers, or the core student/teacher flow fails, do not claim completion. Diagnose safely; any code/config repair requires a new plan gate and independent validation before another release.
- A regression can be recovered by a reviewed revert of the release merge or by promoting the previously known-good deployment using authorized Vercel controls. No database rollback is needed. Do not force-push or delete branches/deployments as recovery.
- This bounded static-demo release has no operational backend metrics or on-call recipients. Use build status, live HTTP/assets, and core-flow smoke evidence; do not invent metrics or notify third parties.

## Files

- Existing preference edits: `AGENTS.md`, `CLAUDE.md`, `memory/projects/lessonquest.md`.
- Plan: `docs/superpowers/plans/2026-08-31-dark-demo-release.md`.
- Plan review: `docs/reviews/2026-08-31-dark-demo-release-plan-review.md`.
- Independent readiness review: `docs/reviews/2026-08-31-dark-demo-release-final-review.md`.

## Acceptance

Remote `main` contains the reviewed change and delivery rules; required checks pass; the existing Vercel project successfully deploys the merge SHA; its verified production URL serves the dark synthetic demo and passes the core smoke flow. Any missing production evidence is an explicit incomplete item, not an inferred success.
