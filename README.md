# LessonQuest

LessonQuest는 선생님이 생성형 AI로 배움의 세계를 만들고, 학생들이 그 안에서 미션·실험·탐험·이야기·공동 보스를 함께 플레이하며 배우는 플랫폼입니다. Rasa는 정답 대신 스스로 답을 찾는 길을 안내하고, 교사는 학생의 과정과 성장을 확인합니다.

현재 구현 범위는 Phase 1 M1–M6입니다. 합성 로컬 인증·기관·반 경계 위에 과학 BlockSpec 생성 파싱, 독립 검증, 격리 미리보기, 교사 승인·반려, 불변 버전, 반 과제, 학생 플레이·이어하기, idempotent 학습 이벤트, 고정형 Rasa 힌트와 반 공동 보스 projection이 연결됩니다.

## Vercel 개발용 서비스 미리보기

루트 `vercel.json`은 `VITE_DEV_PREVIEW=true`로 실제 과학 제작소·학생 플레이·교사 결과 화면을 빌드합니다. HTTP client → Hono API → 기존 저장소 → PGlite 경계를 브라우저의 한 탭 안에서 실행합니다. 교사 화면에서 예제 JSON을 저장·검증·승인·반 배포한 뒤 학생 화면으로 전환하면 실제 학습 기록과 공동 보스 기여를 확인할 수 있습니다.

이는 **합성 계정과 임시 데이터만 사용하는 개발 환경**입니다. DB와 인증 목록이 브라우저 안에 있으므로 운영 보안 경계가 아니며, 실제 학생 정보를 입력하면 안 됩니다. 다른 사용자·탭과 데이터를 공유하지 않고 새로고침 또는 초기화하면 지워집니다. Rasa는 고정된 로컬 힌트이며 외부 AI 생성·회원가입·영구 저장은 연결하지 않았습니다. 첫 실행에는 약 16MB의 DB 실행 파일을 같은 사이트에서 불러옵니다.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm deps:build
VITE_DEMO_MODE=false VITE_DEV_PREVIEW=true corepack pnpm --filter @lessonquest/web build
corepack pnpm --filter @lessonquest/web exec vite preview
```

기존 Git 연결 Vercel 프로젝트가 검증된 `main` 변경을 자동 배포합니다. 별도 프로젝트나 중복 수동 배포를 만들지 않습니다. 변경 승인에는 계획 심사와 독립 최종 심사, CI 통과가 필요합니다. Phase 1의 범위와 검증 결과는 [마무리 기록](docs/PHASE1_COMPLETION.md), 병합 이후의 CI·실제 배포 확인은 해당 변경의 병합 PR 본문에 남깁니다.

기존 다크 디자인 데모도 `VITE_DEMO_MODE=true VITE_DEV_PREVIEW=false`로 따로 빌드할 수 있으며 `pnpm test:browser`로 검증합니다. 두 플래그를 모두 켜면 빌드가 거절됩니다. 개발 미리보기 브라우저 검증은 `pnpm test:preview`입니다. 두 플래그를 모두 끈 일반 빌드에는 미리보기 DB·합성 인증 실행물을 넣지 않습니다.

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
- `packages/science-studio` — 제한된 과학 BlockSpec parser, 독립 validator, 고정 artifact/hash와 네트워크 차단 sandbox document
- `packages/experience-sdk` — 서버가 발급한 문맥·재개 sequence를 고정하고 시작·선택·재도전·완료 이벤트를 만드는 브라우저 SDK
- `packages/gamification` — WordQuest parity를 유지하는 보스 kill switch, 반별 key, HP, 중복 합산과 서버 검증 결과 기반 기여 projection
- `services/api` — Hono 기반 보안 미들웨어와 기관·반·Science Studio·Assignment·Event API application
- `apps/web` — React/Vite 기반 교사 과학 제작소, scripts-only sandbox preview, 학생 탐험·이어하기, 교사 과정 기록
- 각 `test` 디렉터리 — 위조 입력, 권한 상승, IDOR, 비활성 상태, rollback과 오류 redaction 회귀 테스트

## 로컬 M1–M4 API

`services/api`는 네트워크 서버나 운영 adapter를 시작하지 않는 application 패키지입니다. 테스트는 매번 새 in-memory PGlite 데이터베이스와 합성 UUID만 사용합니다.

```text
GET  /health
POST /organizations
POST /organizations/:organizationId/classes
POST /organizations/:organizationId/classes/:classId/members
GET  /organizations/:organizationId/classes/:classId
POST /organizations/:organizationId/experiences/science
POST /organizations/:organizationId/experience-versions/:versionId/validate
GET  /organizations/:organizationId/experience-versions/:versionId/preview
POST /organizations/:organizationId/experience-versions/:versionId/review
POST /organizations/:organizationId/classes/:classId/assignments
GET  /organizations/:organizationId/student/assignments
POST /organizations/:organizationId/assignments/:assignmentId/attempts
GET  /organizations/:organizationId/assignments/:assignmentId/player
POST /organizations/:organizationId/learning-events
GET  /organizations/:organizationId/classes/:classId/assignments/:assignmentId/progress
```

- `/health` 외 경로는 `LocalAuthProvider`가 발급 목록에서 확인한 `dev_` 형식의 불투명 bearer token이 필요합니다.
- `LocalAuthProvider`는 `production` 환경에서 생성 자체를 거부합니다. 운영 인증으로 사용하면 안 됩니다.
- 쓰기 요청은 정확히 일치하는 trusted Origin과 `application/json`만 허용하며, 과학 JSON을 포함하도록 전체 body를 64 KiB로 제한합니다. 생성 specification 문자열은 별도로 32 KiB를 넘을 수 없습니다.
- 역할·소유자·기관은 body에서 받지 않고 활성 사용자와 데이터베이스 membership으로 판단합니다.
- 현재 데이터베이스 platform role과 기관 role의 호환성을 매 요청에 확인하므로 `TEACHER → STUDENT` 강등은 남아 있는 관리자 membership보다 우선합니다.
- 존재하는 타 기관 리소스와 없는 리소스는 같은 `404` 오류 형태를 사용합니다.
- 감사 로그는 trace/Actor/기관/resource UUID, action, outcome만 저장하며 성공·거절·충돌을 기록합니다. token, request body, 이름과 stack/SQL은 저장하지 않습니다.
- `createApp`에는 `DiagnosticSink`를 주입해야 합니다. 오류 응답의 trace ID는 감사 로그 및 allowlist 기반 진단 이벤트와 동일하며, 진단에는 code/status/method/UUID/duration만 포함됩니다.
- API 검증은 Firebase, 네트워크 PostgreSQL, 실제 학생 데이터와 cookie 인증을 사용하지 않습니다. Vercel 개발 미리보기에서도 API를 운영 서버로 실행하지 않습니다.
- 실행 콘텐츠는 자유 HTML/JavaScript가 아닌 엄격한 JSON과 LessonQuest 고정 renderer입니다. 미리보기 iframe은 `sandbox="allow-scripts"`만 사용하고 CSP로 network를 기본 차단합니다.
- 검증과 교사 승인 행은 동일한 canonical artifact SHA-256을 기록합니다. PostgreSQL trigger가 `GENERATED → VALIDATED/REJECTED → APPROVED/PUBLISHED/RETIRED` 전이와 검증 이후 콘텐츠 불변성을 직접 강제합니다.
- 학생은 option ID만 제출하며 정답 여부를 보낼 수 없습니다. 서버가 공개되지 않은 승인 artifact의 answer key로 결과를 판정하고, 이어하기 sequence와 답안 상태도 서버에서 복원합니다.
- 학생 목록·시도·player·event는 동일한 활성 기관/반/소속/과제 기간 조건을 사용합니다. React → HTTP client → Hono → PGlite 통합 테스트가 새로고침 뒤 이어하기와 권위 있는 재도전 projection을 통과합니다.
- M5 Rasa는 결정론적 `local-rasa-v1`만 사용합니다. 네트워크·API key 없이 동작하며 token 추정치와 0원 비용을 기록합니다. 교사는 과제별 사용 여부와 1–3단계 최대 힌트를 명시합니다.
- M6는 반마다 활성 공동 보스 하나를 두고 저장된 정답·재도전·완료 이벤트에서만 기여를 계산합니다. 학생 응답은 반 전체 damage/target만 포함하고 교사 상세는 현재 역할과 반 소유권을 다시 확인합니다.
- M5/M6 검증은 fresh PGlite만 사용합니다. 운영 인증·DB, Firebase, 외부 AI와 실제 학생 데이터는 이 구현 범위에 포함되지 않습니다.
- M5/M6의 권한 거절·요청 충돌은 트랜잭션 롤백 후에도 감사 로그에 남습니다. 힌트 생성 중 권한 철회는 `DENIED`, 동일한 보스 종료 요청의 재전송은 `DUPLICATE`로 기록합니다. 감사 로그의 기관·리소스 UUID는 접근을 시도한 범위를 뜻하며 권한을 부여하지 않습니다. 답안·힌트·제목·토큰·오류 원문은 기록하지 않습니다.
- 감사 저장소 오류는 안전한 `500` 응답으로 처리하며 거절된 학습·보스 작업을 성공시키지 않습니다. 감사 회귀 테스트는 `services/api/test/m5-m6.test.ts`에서 실행되어 전체·통합·E2E 검증 명령에 포함됩니다. Rasa 힌트 최종 저장의 일반 오류는 `RASA_FINALIZATION_FAILED`/`FAILED`로 분류하고 동일 요청 재전송에서도 안전한 `503`을 반환합니다. 실제 권한 철회만 `DENIED`로 기록하며 저장 장애를 권한 거절이나 요청 충돌로 꾸미지 않습니다.
- 학생 화면은 확인되지 않은 답안·완료 이벤트를 동일한 ID로 재전송합니다. 힌트 응답이 유실되면 동일 요청을 확인할 때까지 다른 기록을 막고, 확정된 힌트 생성 실패 뒤에는 별도의 새 요청을 선택할 수 있습니다. 보스 종료 응답이 유실돼도 동일 요청 ID를 유지합니다.
- 비활성 기관에서는 공동 보스 조회·상세·생성·종료와 동일 종료 요청의 재전송을 모두 `404`로 거절하고 `DENIED` 감사 기록을 남깁니다. 활성 사용자·반 소속이 남아 있어도 기관 비활성 상태가 우선합니다.

## 프로젝트 기준

Phase 2의 첫 서비스 전달 단위는 반 만들기·선택, 학생 초대 및 교사 반 대시보드입니다. 개발 미리보기의 **반 관리**에서 사용합니다. 초대 코드는 24시간 만료, 인원 한도, 재발급·취소와 중복 가입 방지를 적용하고, 발급 교사/학생/기관의 현재 권한을 다시 검사합니다. 기존 브라우저 소유 합성 환경의 제한은 동일합니다. PWA/offline queue, 기존 계정 연결 및 실제 데이터 전환은 이 단위에 포함하지 않습니다. [Phase 2 진행 기록과 사용법](docs/PHASE2_PROGRESS.md)을 참고하세요.

추가 classroom API는 `createApp`에 `ClassroomRepository`를 주입했을 때 기존 인증/Origin/JSON 경계 아래에서 활성화됩니다.

```text
GET  /organizations/:organizationId/classes
GET  /organizations/:organizationId/classes/:classId/dashboard
POST /organizations/:organizationId/classes/:classId/invitations
POST /organizations/:organizationId/classes/:classId/invitations/:invitationId/revoke
POST /organizations/:organizationId/class-invitations/redeem
```

초대 원문은 발급 응답/가입 JSON body에만 포함하며 URL, DB, 감사/진단에는 기록하지 않습니다. 교사 현황은 현재 활성 학생들의 반 합계이고, 학생에게는 해당 API를 공개하지 않습니다.

- [프로젝트 기준 메모리](docs/PROJECT_CANON.md)
- [통합 설계서](docs/INTEGRATION_PLAN_V2.md)
- [Phase 1 기반 계약 구현 계획](docs/superpowers/plans/2026-08-29-phase-1-foundation-contracts.md)
- [Phase 1 기관·반·역할 구현 계획](docs/superpowers/plans/2026-08-29-phase-1-identity-tenancy.md)
- [Phase 1 M3–M4 구현 계획](docs/superpowers/plans/2026-08-29-phase-1-m3-m4.md)
- [Phase 1 M3–M4 최종 게이트 보완 계획](docs/superpowers/plans/2026-08-29-phase-1-m3-m4-final-gate-remediation.md)
- [Phase 2 WordQuest 보스 규칙 구현 계획](docs/superpowers/plans/2026-08-29-phase-2-wordquest-boss-rules.md)
- [기관·반·역할 사전 검증 기록](docs/reviews/2026-08-29-phase-1-identity-tenancy-plan-review.md)
- [소스 이식 원장](docs/SOURCE_PROVENANCE.md)

기존 `wordQuest`, `FreeFallExperiment`, `jarvis`, `Earth`, `korean`, `bluemoon`, `history`, `story` 저장소와 배포는 읽기 전용입니다. 필요한 코드만 commit SHA와 출처를 기록해 이 저장소로 선별 이식합니다. 운영 Firebase나 실제 학생 데이터는 개발·테스트에 연결하지 않습니다.
