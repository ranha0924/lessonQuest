# Vercel Demo Preview Plan

## Scope

Prepare a static Vercel preview of the completed local M5/M6 experience without deploying the local Hono/PGlite test backend or exposing synthetic bearer tokens as production authentication. Add an explicit build-time demo mode that uses an in-browser, reset-on-refresh synthetic `LessonQuestApi`, a teacher/student role switcher, Vite monorepo build configuration, SPA rewrite/security headers, and deployment documentation.

## TDD and files

1. Add a web test that renders the demo shell, switches teacher/student views, exercises a wrong answer → fixed safe Rasa hint → retry/completion path, and confirms aggregate-only boss data.
2. Implement `apps/web/src/demo-api.ts` with fixed synthetic UUIDs/content and no network, persistence, secret, or real data. Implement `apps/web/src/demo-shell.tsx` and activate it only when `VITE_DEMO_MODE=true`; normal authenticated startup remains unchanged.
3. Add root `vercel.json` with frozen pnpm install, workspace dependency build plus demo Vite build, `apps/web/dist` output, SPA rewrite, and baseline security headers. Add README deployment and limitation notes.
4. Verify demo and normal builds, full checks, integration/E2E, dependency audit, generated `dist/index.html`, and absence of secrets/network endpoints. Obtain a fresh independent final review above 85 with no blocker before calling the preview ready.

## Safety and containment

The preview is visibly labeled synthetic, resets on refresh, performs no fetch in demo mode, and is not an authentication/database deployment. No Vercel deployment is executed without explicit user authorization. Revert the local preview commit to roll back.
