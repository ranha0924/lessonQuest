# LessonQuest Working Memory

- Canonical product context: `docs/PROJECT_CANON.md`
- Integration architecture: `docs/INTEGRATION_PLAN_V2.md`
- Durable project memory and scoring rubric: `memory/projects/lessonquest.md`
- Review records: `docs/reviews/`

## Non-negotiable workflow

- Do not begin or resume production implementation from an unreviewed plan.
- Score the plan against the project rubric before implementation.
- The score must be **greater than 85**: 86/100 is the minimum passing score.
- Any critical blocker fails the gate regardless of the numeric total.
- If the gate fails, improve the plan and review it again; do not write production code.
- Record the review so a later session can verify why implementation was allowed.
- Planning, review, and memory documentation may be written while implementation is paused.
- After approval, work test-first and verify the full affected scope.
- After implementation, use an independent non-implementing agent for final validation.
- The independent review must score the actual result above 85 (minimum 86/100) with no critical blocker before the work is accepted as complete.
- If final validation scores 85 or lower, fix the findings and request a fresh independent review.
- Never substitute the implementing agent's self-checks for the independent final review.

## Repository safety

- Treat all source repositories other than this LessonQuest workspace as read-only.
- Selectively copy useful code or behavior with provenance; do not modify source repositories.
- Do not connect to production Firebase or use real student data in Phase 1.
- Do not push or deploy without explicit user authorization.

## Delivery preference

- On 2026-08-31, the user gave standing authorization for future requested LessonQuest changes: verify, commit, merge into `main`, push, and deploy to the configured LessonQuest Vercel project without asking for the routine integration choice again.
- This replaces the earlier user-managed deployment preference. Preserve all review gates and repository/data boundaries; verify the actual deployed commit and live URL before claiming success.
- Missing credentials, an unidentified deployment target, or materially expanded/destructive work still requires the user's input. See `AGENTS.md` for the complete delivery rule.
