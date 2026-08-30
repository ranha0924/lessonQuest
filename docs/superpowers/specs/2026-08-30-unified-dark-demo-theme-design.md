# Unified Dark Demo Theme Design

- **Status:** User-approved bounded visual revision
- **Date:** 2026-08-30
- **Scope:** The complete synthetic Vercel demo, including student and teacher views
- **Controlling requirements:** `docs/PROJECT_CANON.md` and the accepted student-home behavior in `docs/superpowers/specs/2026-08-30-student-home-visual-redesign-design.md`

## Direction

Unify the entire synthetic demo as a dark, game-forward mission interface. The current alternating white and dark cards are removed. Background, navigation, student mission, Rasa, class boss, supporting cards, teacher header, and teacher evidence panels all use a related navy-black surface family. White is reserved for text and graphic highlights rather than large surfaces.

This is a visual-only revision. The student resume → wrong answer → fixed Rasa hint → correct retry → aggregate boss progress flow and the teacher-switch behavior remain unchanged.

## Palette and hierarchy

| Token          |     Value | Role                                    |
| -------------- | --------: | --------------------------------------- |
| `--lq-black`   | `#050817` | Page and toolbar background             |
| `--lq-void`    | `#0b1230` | Navigation and dominant mission surface |
| `--lq-surface` | `#111b3e` | Standard card surface                   |
| `--lq-raised`  | `#17244d` | Raised controls and secondary panels    |
| `--lq-paper`   | `#f7f9ff` | Primary text and light SVG detail only  |
| `--lq-muted`   | `#9dadd0` | Secondary text                          |

Action accents remain orbit blue `#315bea`, ion cyan `#20c7df`, sun yellow `#ffc85a`, and flare orange `#ff7548`. They mark active state, guidance, progress, and primary action rather than creating light card backgrounds.

Surface depth comes from one-pixel cool-blue borders, restrained shadows, and the four dark levels. No white, cream, pale-blue, or pale-yellow panel background remains. The mission trajectory stays the signature element; no new image, font, dependency, animation, or network asset is introduced.

## Student view

- The demo toolbar and active role control remain dark; the selected role uses orbit blue instead of white.
- Navigation, mission hero, question, weekly growth, Rasa companion, boss, and next-session card use the shared dark surface ladder.
- Choice controls use the raised surface with light text. Retry, Rasa hint, and success states use dark amber, dark teal, and dark green fills with explicit text and borders.
- The yellow primary action remains the only large bright filled control.
- Existing semantic landmarks, local SVG, numeric progress, 44 px targets, visible focus, and reduced-motion behavior remain intact.

## Teacher view

- The existing teacher markup and copy remain unchanged.
- The workbench background joins the page rather than presenting a light canvas.
- All teacher evidence panels use the standard/raised dark surfaces, light text, muted metadata, and the same accent hierarchy as the student view.
- Approval and boss evidence remain visually distinct through green and orange borders without pale panel fills.

## Acceptance criteria

1. `DemoShell` declares a single `data-theme="dark"` contract that wraps both roles.
2. The initial and resumed student states contain no large light surface; computed background colors for the toolbar, navigation, mission, growth, Rasa, boss, next session, question, choices, retry, hint, and success regions stay in the dark surface family.
3. The teacher workbench and all three teacher evidence panels use the same dark surface family.
4. Text, focus, progress, and action accents remain legible; every rendered button and demo-navigation link remains at least 44 px tall.
5. The three required widths have no horizontal overflow, the existing student flow reaches `40 / 100`, teacher switching works, and reduced motion removes the trajectory entrance.
6. Normal and demo builds pass with no API, DB, auth, provider, dependency, deployment setting, remote asset, or real-data change.

## Containment and rollback

Changes are limited to the demo theme marker, demo-scoped stylesheet, focused test, and documentation. Rollback is a commit revert. No persistent or external system is touched.
