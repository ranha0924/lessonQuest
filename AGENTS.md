# LessonQuest Agent Rules

These rules apply to every implementation task in this repository.

## Mandatory implementation gate

1. Read `docs/PROJECT_CANON.md` and the applicable implementation plan.
2. Write or update a concrete plan before changing production code.
3. Review the plan with the rubric in `memory/projects/lessonquest.md` and record the evidence and score under `docs/reviews/`.
4. Implementation is authorized only when the final score is strictly greater than 85 (86/100 or higher) and no critical blocker remains.
5. A score of 85 or lower requires plan revision and a fresh review. Do not implement while the gate is failing.
6. After the gate passes, use test-driven development and run the planned verification.
7. When implementation is ready, assign final validation to an independent agent that did not implement the reviewed change.
8. The independent agent must inspect the actual diff and verification evidence, run relevant checks, record a score under `docs/reviews/`, and report concrete findings.
9. Do not accept, merge, deploy, or claim the implementation complete unless the independent final-validation score is strictly greater than 85 (86/100 or higher) and no critical blocker remains.
10. A final score of 85 or lower requires fixes followed by a fresh independent review.

Documentation and planning changes needed to evaluate the gate are allowed before the gate passes. Production code, migrations, and deployment changes are not. The implementing agent may run its own checks, but those checks never replace the required independent final validation.

## Project boundaries

- Existing source repositories and deployments are read-only. Copy only selected, attributable code, functions, or tests into this repository.
- Do not access Firebase or real student data during Phase 1.
- Keep organization data tenant-scoped and fail closed on authorization uncertainty.
- Never push, deploy, or mutate an external system unless the user explicitly requests it.
