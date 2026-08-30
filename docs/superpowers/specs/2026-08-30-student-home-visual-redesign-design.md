# Student Home Visual Redesign Design

**Status:** User-approved direction for a bounded Phase 1 demo redesign  
**Date:** 2026-08-30  
**Controlling requirements:** `docs/PROJECT_CANON.md`, especially LessonQuest Play, Rasa answer-safety, server-authoritative class boss progress, and the prohibition on public student comparison

## 1. Scope

Redesign only the synthetic Vercel demo's student experience. The visual direction is **70% Cosmic Quest concept 1 + 30% Neo Academy concept 4**: retain the immersive mission, Rasa companion, and cooperative boss hierarchy from concept 1, while adopting concept 4's brighter surfaces, calmer spacing, and scalable product structure.

This slice preserves the existing wrong answer → Rasa hint → correct retry → class boss progress interaction and the student/teacher demo switch. It does not change the authenticated application, HTTP client, Hono API, PGlite repositories, authorization, learning-event contracts, Rasa provider, boss rules, Vercel deployment settings, or teacher-demo behavior.

## 2. Audience and page job

- **Primary audience:** Korean middle-school students reviewing a playable science mission.
- **Single job:** Make the next mission obvious, let the student resume it, and show safe help and aggregate class progress without public comparison.
- **Secondary audience:** Teachers and stakeholders evaluating the Phase 1 product direction through the synthetic Vercel preview.

## 3. Visual system

### Color tokens

| Token | Value | Use |
|---|---:|---|
| `--lq-void` | `#0b1230` | Navigation rail and high-contrast anchors |
| `--lq-ink` | `#121b35` | Primary text |
| `--lq-orbit` | `#315bea` | Primary action and active state |
| `--lq-ion` | `#20c7df` | Mission trajectory and focus details |
| `--lq-flare` | `#ff7548` | One warm emphasis per view |
| `--lq-sun` | `#ffc85a` | Focus ring and progress highlight |
| `--lq-mist` | `#f4f7ff` | Page background |
| `--lq-surface` | `#ffffff` | Cards and controls |
| `--lq-muted` | `#64708c` | Secondary copy with accessible contrast |

No new font dependency or remote asset is introduced. Headings use the existing Korean-capable rounded system stack with restrained weight; body and controls use Pretendard/Apple SD Gothic Neo/system fallbacks. Numeric progress uses tabular figures.

### Layout

Desktop uses a compact navigation rail, a wide central mission column, and a narrow support rail. Tablet collapses the support rail below the mission. Mobile replaces the rail with a compact top navigation and stacks all cards in content-priority order.

```text
+----------------+--------------------------------+------------------+
| LessonQuest    | streak / overall progress      | profile          |
| Dashboard      +--------------------------------+------------------+
| Missions       | TODAY'S MISSION                | Rasa companion   |
| Class          | trajectory illustration        +------------------+
| Profile        | force & motion / continue      | class boss       |
|                | inline retry flow after start  | aggregate only   |
+----------------+--------------------------------+------------------+
```

### Signature element

The memorable element is a **mission trajectory**: a lightweight inline SVG path with force arrows, nodes, and a small explorer marker. It communicates movement and learning progress rather than serving as ambient decoration. It is authored locally, marked decorative for assistive technology, and uses no network request.

Motion is limited to one trajectory entrance and small control feedback. `prefers-reduced-motion` removes it. No parallax, continuous particle animation, or layout-shifting hover effect is allowed.

## 4. Content and interaction

### Initial student home

- Persistent synthetic-data/reset notice and student/teacher switch remain available.
- The active navigation item is “대시보드”; navigation contains only “대시보드”, “내 미션”, “우리 반”, and “성장 기록”.
- The mission hero shows “오늘의 미션”, “힘과 운동 탐험”, concise supporting copy, and one primary action “탐험 계속하기”.
- Rasa appears as a calm companion and explains that a hint becomes available after a retry-worthy answer; it does not display an answer or actionable choice.
- The boss card shows “우리 반 관성 보스” and only aggregate `32 / 100` progress.
- No market, individual rank, top percentile, class leaderboard, or named student comparison is rendered.

### Mission interaction

Selecting “탐험 계속하기” reveals the existing force-and-motion question inside the mission card without navigating away. The choices remain “질량 2 kg 선택” and “질량 6 kg 선택”. The wrong choice makes the Rasa hint action available; requesting it renders the existing fixed answer-safe level-one content. Selecting the correct choice shows retry success and moves aggregate boss progress from `32 / 100` to `40 / 100`.

Every button remains at least 44 px tall, has a visible focus state, and is reachable by keyboard. State is reset on refresh because this is still a synthetic preview.

## 5. Component boundaries

- `DemoShell` owns only demo-role selection and the synthetic-data toolbar.
- `DemoStudentHome` owns mission-started, wrong-answer, hint-visible, and completed UI state.
- Existing `RasaHintPanel` and `ClassBossCard` remain the authoritative display components for the hint and boss contracts.
- `demo-shell.css` scopes the new visual system below `.demo-shell`; authenticated application styles remain unchanged.

## 6. Accessibility and privacy

- Landmarks: labeled primary navigation, main content, mission section, Rasa aside, and boss section.
- Primary/body contrast targets WCAG 2.1 AA; focus uses a visible 4 px sun ring.
- Meaning is never conveyed by color alone; progress includes literal numeric text.
- Decorative SVG is `aria-hidden="true"`; interactive controls have text labels.
- No real name, student image, credential, API response, Firebase data, external AI output, or external request is added.

## 7. Acceptance criteria

1. Initial render exposes a labeled primary navigation, mission resume action, Rasa companion, and aggregate boss progress.
2. The tested resume → wrong → hint → correct retry flow ends at `40 / 100` and preserves the fixed answer-safe hint.
3. Teacher switching still reaches the existing teacher evidence and its no-public-ranking copy.
4. Student content contains no marketplace, public ranking, top percentile, or student comparison.
5. At 1440 px, 768 px, and 375 px there is no horizontal page overflow and the primary action remains visible.
6. Keyboard focus and reduced-motion behavior remain visible and predictable.
7. Normal non-demo build behavior and the Vercel synthetic demo build both succeed without new dependencies or network-capable assets.

## 8. Containment and rollback

The change is isolated to the demo student component, demo-scoped CSS, focused tests, and preview documentation. Rollback is a commit revert. No schema, persistent row, API, deployment resource, external repository, or real user data is touched.
