# LessonQuest

LessonQuest는 선생님이 생성형 AI로 배움의 세계를 만들고, 학생들이 그 안에서 미션·실험·탐험·이야기·공동 보스를 함께 플레이하며 배우는 플랫폼입니다. Rasa는 정답 대신 스스로 답을 찾는 길을 안내하고, 교사는 학생의 과정과 성장을 확인합니다.

현재 구현 단계는 Phase 1의 기반 계약과 기관·반·역할 경계입니다. 승인된 Experience, 학습 이벤트, Rasa Context/Action, 격리 runner 메시지뿐 아니라 합성 로컬 인증, PostgreSQL 호환 tenant 저장소, 기관·반 API까지 검증합니다.

## 개발 환경

- Node.js 24 이상
- pnpm 11.24.0 (`packageManager`로 고정)

```bash
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check`는 lint, formatting, typecheck, 전체 테스트와 package build를 순서대로 실행합니다.

## 현재 패키지

- `packages/contracts` — Experience Manifest, LearningEvent, Rasa, sandbox bridge, identity와 요청 runtime schema
- `packages/auth` — 불투명한 개발용 bearer token을 서버 소유 Actor로 해석하는 로컬 인증 경계
- `packages/db` — PGlite 기반 PostgreSQL 호환 기관·반·학생 소속, tenant guard와 최소 감사 로그
- `services/api` — Hono 기반 보안 미들웨어와 기관·반 API application
- 각 `test` 디렉터리 — 위조 입력, 권한 상승, IDOR, 비활성 상태, rollback과 오류 redaction 회귀 테스트

## 로컬 기관·반 API

`services/api`는 네트워크 서버나 운영 adapter를 시작하지 않는 application 패키지입니다. 테스트는 매번 새 in-memory PGlite 데이터베이스와 합성 UUID만 사용합니다.

```text
GET  /health
POST /organizations
POST /organizations/:organizationId/classes
POST /organizations/:organizationId/classes/:classId/members
GET  /organizations/:organizationId/classes/:classId
```

- `/health` 외 경로는 `LocalAuthProvider`가 발급 목록에서 확인한 `dev_` 형식의 불투명 bearer token이 필요합니다.
- `LocalAuthProvider`는 `production` 환경에서 생성 자체를 거부합니다. 운영 인증으로 사용하면 안 됩니다.
- 쓰기 요청은 정확히 일치하는 trusted Origin과 `application/json`만 허용하며 body를 8 KiB로 제한합니다.
- 역할·소유자·기관은 body에서 받지 않고 활성 사용자와 데이터베이스 membership으로 판단합니다.
- 현재 데이터베이스 platform role과 기관 role의 호환성을 매 요청에 확인하므로 `TEACHER → STUDENT` 강등은 남아 있는 관리자 membership보다 우선합니다.
- 존재하는 타 기관 리소스와 없는 리소스는 같은 `404` 오류 형태를 사용합니다.
- 감사 로그는 trace/Actor/기관/resource UUID, action, outcome만 저장하며 성공·거절·충돌을 기록합니다. token, request body, 이름과 stack/SQL은 저장하지 않습니다.
- `createApp`에는 `DiagnosticSink`를 주입해야 합니다. 오류 응답의 trace ID는 감사 로그 및 allowlist 기반 진단 이벤트와 동일하며, 진단에는 code/status/method/UUID/duration만 포함됩니다.
- 이 단계는 Firebase, 네트워크 PostgreSQL, 실제 학생 데이터, cookie 인증과 배포를 사용하지 않습니다.

## 프로젝트 기준

- [프로젝트 기준 메모리](docs/PROJECT_CANON.md)
- [통합 설계서](docs/INTEGRATION_PLAN_V2.md)
- [Phase 1 기반 계약 구현 계획](docs/superpowers/plans/2026-08-29-phase-1-foundation-contracts.md)
- [Phase 1 기관·반·역할 구현 계획](docs/superpowers/plans/2026-08-29-phase-1-identity-tenancy.md)
- [기관·반·역할 사전 검증 기록](docs/reviews/2026-08-29-phase-1-identity-tenancy-plan-review.md)
- [소스 이식 원장](docs/SOURCE_PROVENANCE.md)

기존 `wordQuest`, `FreeFallExperiment`, `jarvis`, `Earth`, `korean`, `bluemoon`, `history`, `story` 저장소와 배포는 읽기 전용입니다. 필요한 코드만 commit SHA와 출처를 기록해 이 저장소로 선별 이식합니다. 운영 Firebase나 실제 학생 데이터는 개발·테스트에 연결하지 않습니다.
