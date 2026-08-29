# LessonQuest 통합 계획 V2

상태: Phase 0 설계 확정본  
작성일: 2026-08-29  
대상 저장소: `ranha0924/lessonQuest`  
구현 전제: 기존 저장소와 배포는 모두 읽기 전용으로 유지하고, 필요한 코드·기능·테스트만 출처를 기록해 이 저장소로 선별 이식한다.

## 0. 결정 요약

### 확정한 방식

**기능 단위 선별 이식 + LessonQuest 공통 계약으로 재연결**을 채택한다.

- 기존 저장소에는 커밋, 브랜치, 설정, 데이터, 배포 변경을 하지 않는다.
- 기존 앱 전체를 그대로 복사하지 않는다.
- 검증 가치가 높은 순수 로직, UI 패턴, 보안 경계와 테스트를 선별한다.
- 복사한 코드는 LessonQuest의 타입, tenant 경계, 이벤트 계약과 테스트에 맞게 이식한다.
- 외부 배포를 iframe으로 단순 감싸는 것은 데모·카탈로그 링크에만 사용한다. 내부 이벤트가 필요한 체험은 코드를 이식한 LessonQuest 소유 빌드로 제공한다.
- 운영 Firebase와 실제 학생 데이터는 Phase 1 개발·테스트에 연결하지 않는다.
- 제품 기준은 [PROJECT_CANON.md](./PROJECT_CANON.md)에 고정한다.

### 선택하지 않은 방식

- **전체 앱 복사:** 빠르지만 거대한 단일 파일, 서로 다른 인증 모델과 기술 부채까지 유입된다.
- **기존 API·배포에 직접 의존:** 복사량은 적지만 운영 장애와 데이터에 결합되고 독립 롤백이 어려워진다.
- **처음부터 전면 재작성:** 검증된 학습·운영 로직을 버리고 일정을 키운다.

## 1. 발견한 저장소와 배포 매핑

2026-08-29에 GitHub 저장소, 설정 문서와 실제 HTTP 응답을 대조했다. 아래 URL은 모두 응답 코드 200을 확인했다.

| 제품              | 배포 URL                                    | 실제 저장소                      | 공개 범위 | 판정                                                             |
| ----------------- | ------------------------------------------- | -------------------------------- | --------- | ---------------------------------------------------------------- |
| 통합 플랫폼       | 미배포                                      | `ranha0924/lessonQuest`          | Public    | 초기 README만 있는 신규 통합 대상                                |
| WordQuest         | `https://word-quest-fywr.vercel.app/`       | `ranha0924/wordQuest`            | Private   | 학생 앱, PWA, Firebase, Worker, 기관 기능의 실제 원본            |
| WordQuest Admin   | `https://word-quest-fywr.vercel.app/admin/` | `ranha0924/wordQuest`의 `/admin` | Private   | 별도 저장소가 아닌 같은 제품의 운영 화면                         |
| Science LAB       | `https://free-fall-experiment.vercel.app/`  | `ranha0924/FreeFallExperiment`   | Private   | 생성·검증·승인·sandbox 체험의 실제 원본                          |
| Science 소개 자료 | 별도 발표물                                 | `ranha0924/freeppt`              | Public    | 제품 소스가 아니므로 이식 대상에서 제외                          |
| Rasa 원형         | 확인된 웹 배포 없음                         | `ranha0924/jarvis`               | Private   | 실제 음성 비서 원본. 웹 학습 파트너로 그대로 실행하지 않음       |
| 빈 Rasa 저장소    | 미배포                                      | `ranha0924/rasa`                 | Public    | 실소스가 아닌 빈 저장소                                          |
| BlueMoon          | `https://bluemoon-ecru.vercel.app/`         | `ranha0924/bluemoon`             | Public    | 조사 순서·획득 조건 기반 추리 어드벤처. 분기형으로 표기하지 않음 |
| Earth             | `https://earth-ashy.vercel.app/`            | `ranha0924/Earth`                | Public    | 3D 지구본 사회·지리 탐험                                         |
| Korean            | `https://koreanquiz-liart.vercel.app/`      | `ranha0924/korean`의 `/game`     | Public    | 사건 조사·지역 이동·보스형 학습                                  |
| History           | `https://history-sage-nu.vercel.app/`       | `ranha0924/history`              | Public    | 역사 위키·연결 탐색                                              |
| Hanja Story       | `https://story-silk-rho.vercel.app/`        | `ranha0924/story`                | Public    | 고사성어 비주얼 노벨                                             |

Jarvis는 로컬 Windows 프로그램이므로 LessonQuest용 Rasa 웹 배포 주소가 현재 없다는 결론이다.

## 2. 저장소별 기술스택과 실행 방법

| 저장소               | 기술스택                                                                                    | 로컬 실행                                                                                            | 현재 검증 수단                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `lessonQuest`        | 미정/신규                                                                                   | 아직 없음                                                                                            | Phase 1에서 표준 명령을 만든다                                                                             |
| `wordQuest`          | 의존성 없는 HTML/CSS/JS PWA, Firebase Auth·Firestore, Cloudflare Worker, 정적 Admin         | `python3 -m http.server 8792`; 클라우드 모듈과 SW는 `file://` 대신 HTTP 필요                         | Node `.mjs` 테스트, Playwright 실부팅·오프라인 검증, Worker 순수 로직 테스트. 루트 package manifest는 없음 |
| `FreeFallExperiment` | Vite 6, vanilla JS, Chart.js, Vercel Functions, Anthropic SDK, Postgres, Vitest             | 클라이언트: `cd MomentumExperiment && npm install && npm run dev`; API 포함 실행은 `vercel dev` 필요 | 루트 `npm test`, 클라이언트 `npm test`, 루트 `npm run build`, `npm run smoke`                              |
| `jarvis`             | Python 3.10+, FastAPI, WebSocket, local Whisper, edge-tts, OpenAI/Anthropic, Windows 자동화 | venv 구성 후 `pip install -r requirements.txt`, `python run.py`                                      | `python tools/run_regression.py`와 개별 회귀 스크립트                                                      |
| `Earth`              | React 18, TypeScript, Vite 5, globe.gl, Three.js, Zustand                                   | `npm install && npm run dev`                                                                         | `npm test`, `npm run build`, `npm run e2e`                                                                 |
| `korean/game`        | React 19, TypeScript, Vite 8, Tailwind 4, Zustand                                           | `cd game && npm install && npm run dev`                                                              | `npm test`, `npm run build`                                                                                |
| `bluemoon`           | 단일 HTML/JS, WebAudio, WebP 자산                                                           | `index.html` 직접 실행 또는 정적 HTTP 서버                                                           | 빌드·정식 테스트 없음; 브라우저 흐름 회귀가 필요                                                           |
| `history`            | 정적 HTML/CSS/JS                                                                            | 정적 HTTP 서버                                                                                       | 정식 테스트 없음                                                                                           |
| `story`              | 단일 HTML/JS, PNG 자산                                                                      | `index.html` 직접 실행 또는 정적 HTTP 서버                                                           | 정식 테스트 없음                                                                                           |

원본 저장소의 테스트 결과 기록은 참고 자료일 뿐, LessonQuest 이식본의 통과를 대신하지 않는다. 이식한 로직은 LessonQuest 안에서 새 테스트로 증명한다.

## 3. 현재 인증·DB·배포 구조

### WordQuest

- Firebase Google Auth와 선택적 로그인, Firestore 기반 offline-first 동기화를 사용한다.
- 사용자 상태는 `users/{uid}` 계열 문서와 private state/summary에 나뉜다.
- 역할은 학생·교사·master 중심이며 `ORG_ADMIN`에 해당하는 강한 tenant 권한 모델은 아직 없다.
- 기관은 라벨·UI scope 성격이 강하고, 같은 기관이라는 이유만으로 반 데이터가 자동 공유되지는 않는다.
- Cloudflare Worker가 랭킹, 검증 퀴즈, 출석, 교사 통계와 보스 기여의 신뢰 경계를 담당한다.
- Vercel 정적 배포와 PWA 서비스 워커를 사용한다.
- 기존 데이터를 버리거나 기존 schema를 플랫폼 표준으로 그대로 채택하지 않는다.

### Science LAB

- 교사 패스코드로 저작 API를 fail-closed 처리하지만 계정·기관·역할 모델은 아니다.
- Vercel Functions가 개념, 체험, 검증 API를 제공한다.
- 승인된 개념·체험은 Postgres에 저장되고 학생 허브에서 조회한다.
- 생성 HTML은 `sandbox="allow-scripts"` iframe에서 실행하며 부모와 `postMessage`로 통신한다.
- 생성과 검증 경로가 분리되어 있지만 동일 계열 모델을 사용할 수 있으므로 모델·프롬프트 독립성 정책이 추가로 필요하다.

### Jarvis

- 개인 Windows PC에서 실행되는 로컬 Python 애플리케이션이다.
- 로컬 설정·기억·승인·Action 체계와 음성 입출력 기능이 중심이다.
- 학교용 다중 사용자, tenant DB, 웹 세션 서비스가 아니므로 런타임을 LessonQuest에 포함하지 않는다.

### 콘텐츠 앱

- Earth와 Korean은 React/Vite 앱이며 상태 패턴과 컴포넌트 일부를 옮기기 쉽다.
- BlueMoon, History, Story는 정적 앱이라 전체 페이지보다 데이터 모델·진행 로직·화면 패턴을 분리해 이식해야 한다.
- 현재 각 앱은 공통 인증, ExperienceVersion, Assignment와 LearningEvent 계약을 갖지 않는다.

## 4. 민감정보와 환경변수

값은 복사하거나 문서에 기록하지 않는다. 아래는 위치와 이름만 정리한 것이다.

| 원본                | 위치/형태                                                 | 항목                                                                                      | 이식 정책                                                                         |
| ------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| WordQuest           | `firebase-config.js`                                      | Firebase 공개 클라이언트 설정, App Check 사이트 키                                        | 운영 값을 Phase 1에 복사하지 않는다. 개발 프로젝트 또는 Emulator 사용             |
| WordQuest Worker    | Cloudflare Worker secrets/env                             | `QUIZ_SECRET`, `ANSWER_SALT`, `PROJECT_NUMBER`, 캡·정책 값                                | 기존 값을 읽거나 복사하지 않는다. LessonQuest 서버 검증 로직은 새 secret으로 구성 |
| WordQuest reminders | GitHub Actions secrets                                    | Firebase/메일 발송 자격 증명                                                              | Phase 1 범위 밖                                                                   |
| Science LAB         | `.env` 또는 Vercel env                                    | `TEACHER_PASSCODE`, `ANTHROPIC_API_KEY`, `POSTGRES_URL`, 선택적 critic·signing·model 설정 | 새 개발 환경 변수로만 구성. 브라우저에 노출 금지                                  |
| Jarvis              | `.env`, `config.yaml`, Google OAuth 파일·token, 로컬 data | AI 키, 개인 OAuth, 로컬 기억·기기 설정                                                    | 어떤 파일이나 값도 이식하지 않음                                                  |
| LessonQuest         | 로컬 `.env.local`, 배포 환경 secret store                 | DB, auth, AI, signing, telemetry                                                          | `.env.example`에는 이름만 기록하고 비밀 스캔을 CI에 추가                          |

로그에는 토큰, 학생 원문 답안, 프롬프트에 포함된 개인정보, 생성 결과 전체를 기본 저장하지 않는다. AI 추적에는 job ID, 모델·프롬프트 정책 버전, token/비용, 지연, 결과 상태와 안전 분류만 우선 저장한다.

## 5. 재사용·Adapter·네이티브 이식 범위

### 재사용 가치가 가장 높은 코드

| 원본        | Phase 1에 선별 이식                                                                                     | 이후 이식                                                                 | 제외                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Science LAB | 생성/검증 분리, 응답 parsing, 승인 전 미리보기, sandbox runner, `postMessage` 패턴, 관련 테스트 fixture | JSON Block 기반 Experience Specification 생성                             | 공유 패스코드, 자유 HTML을 장기 표준으로 사용, 구형 DB 클라이언트 고정                           |
| WordQuest   | 서버 검증 점수·보스 기여 원칙, idempotency·리플레이 방어 아이디어, 역할/반 UX 참고                      | 클래스 코드, 초대, 교사 통계, PWA/offline queue, 기존 사용자 호환 adapter | 대형 `index.html`/`cloud.js` 전체 복사, org 라벨을 tenant 보안으로 간주, 운영 Firebase 직접 연결 |
| Jarvis      | Context→판단→허용 Action 구조, 승인·timeout·감사 패턴                                                   | STT/TTS provider adapter                                                  | Windows 자동화, 임의 화면 조작, 개인 메모리·OAuth, 전체 런타임                                   |
| Earth       | 지도 탐험 상태와 단계/장소 선택 로직, 테스트 가능한 React 패턴                                          | `MAP_EXPLORATION` 네이티브 template                                       | 앱 전체 또는 Three.js stack을 Phase 1에 포함                                                     |
| Korean      | 사건 맵, 단서·문항·보스 상태 모델                                                                       | `CLUE_COLLECTION`, quiz/boss template                                     | 앱 전체 복사                                                                                     |
| BlueMoon    | 데이터 주도 사건/단서/증언/추리 해금 모델                                                               | `CLUE_COLLECTION`/`STORY_SCENE` template                                  | “분기형” 표기, 고정 1000×625 전체 엔진 복사                                                      |
| Story       | 장면·대사·선택 UI 패턴                                                                                  | `STORY_SCENE` template                                                    | 대형 원본 이미지 무선별 복사                                                                     |
| History     | 카드·연결 탐색 정보 구조                                                                                | `TIMELINE`/연결 탐색 template                                             | Phase 1 우선순위 편입                                                                            |

### Adapter 정책

원본 저장소를 수정할 수 없으므로 adapter는 다음 두 위치 중 하나에만 둔다.

1. LessonQuest가 소유하는 **이식본 Experience** 내부 SDK
2. 외부 배포를 여는 **LessonQuest wrapper**

외부 cross-origin 앱은 DOM이나 내부 정답 상태를 읽을 수 없다. 따라서 wrapper가 신뢰할 수 있는 이벤트는 열기·닫기·로드 실패 정도로 제한한다. 퀴즈·완료·보스 기여를 연결하려면 해당 기능을 LessonQuest 이식본에 넣고 공통 SDK로 계측해야 한다.

### 출처 추적

이식할 때 `docs/SOURCE_PROVENANCE.md`에 다음을 기록한다.

- 원본 저장소, commit SHA, 파일 경로
- 복사한 함수·컴포넌트·fixture
- 변경한 보안·데이터 가정
- 원본과의 parity 테스트
- 라이선스 또는 소유권 확인 메모

## 6. 통합 시 가장 큰 충돌 5가지

1. **인증과 tenant 경계:** WordQuest의 Firebase 사용자·org 라벨과 플랫폼의 `STUDENT/TEACHER/ORG_ADMIN/SUPER_ADMIN` 및 강한 기관 격리가 다르다.
2. **런타임 다양성:** 단일 HTML, React 18/19, Vite 5/8, Python/Windows, Vercel Functions와 Cloudflare Worker가 혼재한다.
3. **데이터 의미:** 각 앱의 완료·정답·힌트·보스 상태가 서로 다른 형태이며 공통 Assignment/Attempt/Event가 없다.
4. **생성 코드의 신뢰:** Science의 자유 HTML 생성은 유용하지만 인증·학생 데이터와 같은 origin/권한에서 실행할 수 없다.
5. **점수 신뢰와 오프라인:** 클라이언트 게임 상태를 그대로 받으면 조작 가능하고, 강한 서버 검증만 적용하면 오프라인 학습이 누락될 수 있다.

해결 순서는 UI 통일보다 identity boundary → schema → event ingestion → server-derived gamification → 화면 순이다.

## 7. 목표 아키텍처

Phase 1은 하나의 웹 셸에서 역할별 route를 제공해 로그인과 계약 중복을 줄인다. 독립 배포·확장이 실제로 필요해질 때만 앱을 분리한다.

```text
Browser
├─ /play                 학생 홈·Experience Player·Rasa
├─ /studio               AI 저작·검증·미리보기·승인
├─ /institution          반·배포·교사 대시보드
└─ /admin                운영·감사·AI 사용량
          │
          ▼
Platform API ── Auth/tenant guard
├─ Experience & Assignment
├─ Event ingestion
├─ Rasa orchestration
├─ Gamification projection
└─ Audit & AI usage
          │
          ├─ PostgreSQL
          ├─ Object storage
          └─ Job queue

AI generation service ──┐
                        ├─ 서로 다른 job/정책/결과
AI validation service ──┘

별도 sandbox origin
└─ generated experience runner
      ↕ schema 검증 postMessage
   Experience Player
```

### 목표 디렉터리

```text
lessonQuest/
├─ apps/
│  ├─ web/
│  └─ experience-runner/
├─ services/
│  ├─ api/
│  ├─ ai-generation/
│  ├─ ai-validation/
│  └─ event-ingestion/
├─ packages/
│  ├─ contracts/
│  ├─ experience-sdk/
│  ├─ experience-player/
│  ├─ auth/
│  ├─ db/
│  ├─ rasa/
│  ├─ gamification/
│  ├─ observability/
│  └─ ui/
├─ experiences/
│  └─ science-vertical-slice/
├─ tests/
│  ├─ contract/
│  ├─ integration/
│  └─ e2e/
└─ docs/
```

### 기술 선택 원칙

- 프런트와 서버 계약은 TypeScript로 통일한다.
- 웹은 React 기반으로 두어 Earth/Korean의 검증된 코드를 이식하기 쉽게 한다.
- workspace는 `pnpm` 기반으로 시작하고 Phase 1에는 불필요한 orchestration 도구를 추가하지 않는다.
- 데이터 원장은 PostgreSQL을 사용하고 schema migration을 코드 리뷰 가능한 파일로 관리한다.
- 인증은 provider adapter 뒤에 둔다. 개발은 Emulator/로컬 계정, 운영 호환은 Firebase Auth adapter를 우선 검토한다.
- 정확한 프레임워크·패키지 버전은 구현 시작 시 공식 지원 상태를 확인한 후 lockfile에 고정한다.

## 8. 공통 데이터 모델

### Identity와 기관

```text
User(id, externalAuthId, displayName, gradeBand, status)
Organization(id, name, status)
OrganizationMember(id, organizationId, userId, role, status)
Class(id, organizationId, ownerTeacherId, name, joinCodeHash, status)
ClassMember(id, organizationId, classId, userId, role, status)
```

- role은 `STUDENT | TEACHER | ORG_ADMIN | SUPER_ADMIN`으로 제한한다.
- 요청 body의 `organizationId`를 권한 근거로 믿지 않는다. 인증된 membership에서 서버가 결정한다.
- 모든 tenant 테이블은 복합 FK 또는 동일한 guard를 통해 cross-tenant 참조를 차단한다.

### Experience와 저작

```text
Experience(id, organizationId, ownerId, title, subject, status)
ExperienceVersion(id, experienceId, version, manifest, specification, artifactRef, contentHash, status)
ExperienceAsset(id, versionId, storageKey, mediaType, size, hash)
ExperienceValidation(id, versionId, validatorPolicyVersion, verdict, findings, createdAt)
ExperienceApproval(id, versionId, teacherId, decision, note, createdAt)
ExperienceTemplate(id, type, schemaVersion, rendererVersion)
```

- 상태 흐름: `DRAFT → GENERATED → VALIDATING → VALIDATED|REJECTED → APPROVED → PUBLISHED|RETIRED`
- 검증 실패본과 교사 반려본도 감사 목적으로 보존한다.
- 승인 뒤 내용 변경은 새 `ExperienceVersion`을 만든다.
- `contentHash`로 승인된 실행물과 실제 제공물을 대조한다.

### 학습과 게임화

```text
Assignment(id, organizationId, experienceVersionId, classId, startsAt, dueAt, status)
Attempt(id, assignmentId, studentId, startedAt, completedAt, status)
LearningEvent(id, organizationId, actorId, attemptId, type, occurredAt, receivedAt, payload)
StudentProgress(assignmentId, studentId, projectionVersion, progress)
GamificationProfile(organizationId, studentId, xp, badges)
ClassBossCampaign(id, organizationId, classId, rulesVersion, state)
BossContribution(id, campaignId, studentId, sourceEventId, amount, reason)
```

`StudentProgress`, XP와 보스 상태는 이벤트에서 다시 계산 가능한 projection이다. `BossContribution.sourceEventId`는 unique로 두어 중복 데미지를 막는다.

### Rasa·AI·운영

```text
RasaSession(id, organizationId, studentId, assignmentId, policyVersion)
RasaMessage(id, sessionId, role, redactedContent, createdAt)
RasaAction(id, sessionId, action, target, status, createdAt)
AIJob(id, organizationId, kind, status, modelPolicyVersion, inputHash, outputRef)
AIUsage(id, jobId, provider, model, inputTokens, outputTokens, cost, latencyMs)
AuditLog(id, organizationId, actorId, action, resource, result, occurredAt)
FeatureFlag(id, organizationId, key, enabled, config)
```

## 9. Experience 계약

### Manifest 최소 schema

```json
{
  "schemaVersion": 1,
  "id": "science_inertia_01",
  "version": 1,
  "title": "급정거하는 버스",
  "subject": "science",
  "gradeBands": ["middle1"],
  "type": "simulation",
  "entrypoint": "/runner/science_inertia_01/1",
  "organizationId": "org_001",
  "authorId": "teacher_123",
  "status": "approved",
  "learningObjectives": ["관성을 실제 상황에 적용한다"],
  "capabilities": ["quiz", "rasa", "class_boss"],
  "createdWithAI": true,
  "contentHash": "sha256:..."
}
```

서버가 승인 상태·조직·assignment·content hash를 확인한 뒤 짧은 수명의 runner session을 발급한다.

### LearningEvent envelope

```json
{
  "schemaVersion": 1,
  "eventId": "uuid",
  "type": "QUESTION_ANSWERED",
  "organizationId": "org_001",
  "assignmentId": "asg_101",
  "attemptId": "att_201",
  "experienceId": "science_inertia_01",
  "experienceVersion": 1,
  "stepId": "q_04",
  "sequence": 7,
  "occurredAt": "2026-08-29T03:20:10Z",
  "payload": {
    "correct": false,
    "attempt": 1,
    "elapsedMs": 18400
  }
}
```

허용 type:

```text
EXPERIENCE_STARTED
STEP_VIEWED
QUESTION_ANSWERED
ANSWER_RETRIED
HINT_USED
RASA_OPENED
CHOICE_MADE
BOSS_DAMAGE_EARNED
EXPERIENCE_COMPLETED
EXPERIENCE_EXITED
ERROR_REPORTED
```

규칙:

- SDK가 UUID event ID와 attempt 내 증가 sequence를 만든다.
- ingestion은 인증 사용자·assignment와 envelope의 관계를 검증한다.
- `(organizationId, eventId)` unique로 재전송을 idempotent 처리한다.
- `occurredAt`은 학습 시간 분석에 쓰고, 권한·마감·점수 판정은 서버 `receivedAt`과 정책을 함께 사용한다.
- 정답 원문과 정답 판정 권한은 클라이언트에 불필요하게 노출하지 않는다.
- `BOSS_DAMAGE_EARNED`는 클라이언트가 직접 보내는 권위 이벤트가 아니다. 서버 projection이 검증된 원천 이벤트로부터 파생해 기록한다.

### SDK와 runner 메시지

모든 메시지는 `channel`, `schemaVersion`, `sessionId`, `nonce`, `type`, `payload`를 가진다. 부모와 runner 모두 허용 origin, source window, nonce와 runtime schema를 검증한다.

generated runner는 별도 origin에서 다음 제한을 기본값으로 사용한다.

- iframe sandbox는 `allow-scripts`만 허용하고 `allow-same-origin`, forms, popups, top navigation을 허용하지 않는다.
- CSP는 network deny를 기본으로 하고 승인된 asset CDN만 선택적으로 연다.
- runner에는 auth token, DB credential, 학생 프로필 전체를 전달하지 않는다.
- 메시지 payload size, event rate와 총 실행 시간을 제한한다.

## 10. Rasa Context/Action 계약

### Context

```json
{
  "schemaVersion": 1,
  "sessionId": "rasa_301",
  "student": { "id": "stu_1", "gradeBand": "middle1" },
  "learning": {
    "subject": "science",
    "unit": "force_and_motion",
    "experienceId": "science_inertia_01",
    "experienceVersion": 1,
    "sceneId": "bus_scene",
    "stepId": "q_04",
    "questionSummary": "버스가 급정거할 때 몸의 움직임",
    "recentResponses": [{ "correct": false, "misconceptionTag": "force_direction" }],
    "usedHintLevels": [1]
  },
  "teacherPolicy": {
    "learningObjectives": ["관성을 실제 상황에 적용한다"],
    "maxHintLevel": 2,
    "forbidFinalAnswer": true
  }
}
```

원문 교재·학생 식별정보 전체 대신 필요한 최소 context와 요약을 전달한다.

### 허용 Action

```text
OPEN_EXPERIENCE
GO_TO_STEP
NEXT_STEP
PREVIOUS_STEP
SHOW_HINT
EXPLAIN_SIMPLER
READ_TEXT
PLAY_AUDIO
PLAY_VIDEO
SHOW_IMAGE
ASK_REFLECTION
REQUEST_TEACHER_HELP
```

Action 응답 예시:

```json
{
  "action": "SHOW_HINT",
  "experienceId": "science_inertia_01",
  "stepId": "q_04",
  "level": 2,
  "content": "정답을 고르기 전에 몸과 버스의 운동 상태가 각각 어떻게 바뀌는지 비교해 보자."
}
```

- 모델 출력은 schema와 allowlist를 통과해야 한다.
- 최종 정답·정답 선택지 직접 지시는 교사 정책에 따라 차단한다.
- 화면은 Action을 다시 권한·현재 상태와 대조한 후 실행한다.
- `REQUEST_TEACHER_HELP`는 도움 요청 상태만 만들며 외부 메시지를 자동 발송하지 않는다.
- Phase 1은 텍스트 힌트 하나에 집중하고 STT/TTS는 후속 provider adapter로 둔다.

## 11. AI 생성·검증·승인 파이프라인

```text
Teacher input
  → GENERATE_SPEC job
  → Experience Specification + quiz + Rasa guidance
  → GENERATE_ARTIFACT job
  → deterministic schema checks
  → independent VALIDATE_CONTENT job
  → sandbox preview
  → teacher approve/reject
  → immutable ExperienceVersion
  → assignment publish
```

핵심 정책:

- 생성과 검증은 별도 job, 별도 prompt policy와 결과 저장소를 사용한다.
- 가능하면 생성 모델과 검증 모델 또는 최소한 실행 context를 분리한다.
- validator는 학습 목표 정합성, 사실성, 정답 유일성, 연령 적합성, 안전성과 실행 제한을 검사한다.
- 자동 수정은 새 draft를 만들며 원본 결과를 덮지 않는다.
- timeout, token·비용 ceiling, retry budget과 circuit breaker를 둔다.
- provider 오류가 나도 기존 승인 콘텐츠의 학생 플레이는 계속 가능해야 한다.
- 장기적으로 자유 HTML보다 검증 가능한 JSON Block specification을 기본 생성물로 전환한다.

Phase 1 Block 최소 집합:

```text
CONCEPT_CARD
PREDICTION
SIMULATION
QUIZ
REFLECTION
```

## 12. 오류 처리와 관측성

API 오류 envelope:

```json
{
  "error": {
    "code": "EXPERIENCE_VALIDATION_FAILED",
    "message": "체험 검증을 통과하지 못했습니다.",
    "retryable": false,
    "traceId": "trace_..."
  }
}
```

- 사용자에게는 복구 행동이 있는 한국어 메시지를 보여주고 내부 stack·provider 응답은 숨긴다.
- AI job은 `QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED/TIMED_OUT` 상태와 heartbeat를 가진다.
- 이벤트 전송 실패는 브라우저의 제한된 queue에 저장하고 지수 backoff로 재전송한다.
- event ingestion과 projection을 분리해 보스 계산 실패가 학습 이벤트 저장을 되돌리지 않게 한다.
- sandbox 오류는 runner session만 종료하고 플랫폼 로그인 세션에 영향을 주지 않는다.
- 구조화 로그에 `traceId`, `organizationId`, resource ID, 정책 버전, duration을 남기되 비밀과 학생 민감 원문은 redaction한다.
- AI 실패율·비용, event 지연, Rasa 힌트 거절, sandbox violation, cross-tenant 접근 차단을 지표화한다.

## 13. Phase 1 Vertical Slice 구현 계획

### M1. 플랫폼 기반과 계약

- workspace, 타입 검사, lint, unit/contract test와 CI를 만든다.
- Experience Manifest, Event, Rasa Context/Action schema를 테스트 우선으로 작성한다.
- 개발 DB, migration, seed와 local auth provider를 만든다.

완료 조건: 새 checkout에서 한 명령으로 설치·검사·테스트·빌드가 가능하고, 잘못된 tenant/event/action fixture가 거절된다.

### M2. 기관·반·역할

- 한 로그인에서 역할별 route를 분기한다.
- 교사가 기관과 반을 만들고 테스트 학생이 반에 소속되게 한다.
- 모든 query에 tenant guard와 audit를 적용한다.

완료 조건: 다른 기관 ID를 바꿔 넣는 API·UI 시도가 모두 거절된다.

### M3. Science Studio 이식

- Science LAB의 생성 parsing, validation 구조와 sandbox 패턴을 출처 기록 후 이식한다.
- 자유 HTML을 그대로 표준화하지 않고 최소 Block specification과 제한된 simulation artifact를 만든다.
- 교사 preview, validation report, 승인·반려와 불변 버전을 구현한다.

완료 조건: 생성 실패·검증 실패는 게시할 수 없고, 승인본 hash가 바뀌면 실행이 거절된다.

### M4. 배포와 학생 플레이

- 승인된 ExperienceVersion을 반 Assignment로 배포한다.
- 학생 홈, player, 이어하기와 공통 SDK event를 구현한다.
- event ingestion과 교사 결과 projection을 연결한다.

완료 조건: 시작·오답·재시도·완료 이벤트가 중복 없이 저장되고 교사 화면에 나타난다.

### M5. Rasa 힌트

- 현재 step과 오답·사용 힌트가 포함된 최소 context를 구성한다.
- 정답 금지 정책과 `SHOW_HINT` schema를 적용한다.
- 호출·결과·token·비용·오류를 기록한다.

완료 조건: context 없는 요청, 허용되지 않은 Action과 정답 직접 제공 결과가 거절된다.

### M6. 공동 보스와 대시보드

- WordQuest의 서버 검증 원칙을 LessonQuest event projection으로 이식한다.
- 오답 후 재시도·향상·완료 등 교사가 선택한 규칙으로 기여를 계산한다.
- 개인 공개 순위 없이 반 전체 진행도와 교사용 상세를 제공한다.

완료 조건: 클라이언트가 임의 damage 값을 보내도 반영되지 않고 같은 event 재전송이 중복 기여하지 않는다.

### Phase 1 최종 시나리오

한 E2E 테스트가 다음 전체 흐름을 검증한다.

```text
교사 로그인 → 기관/반 생성 → 과학 개념 생성 → 독립 검증
→ sandbox 미리보기 → 승인 → 반 배포 → 학생 로그인/완료
→ Rasa 힌트 → 이벤트 저장 → 서버 보스 기여 → 교사 결과 확인
```

## 14. 이후 단계 마이그레이션

### Phase 2 — WordQuest 기능 이식

- 원본 배포와 저장소를 변경하지 않는다.
- 클래스·초대·교사 dashboard·PWA queue·서버 검증 quiz/boss 로직을 작은 단위로 이식한다.
- 기존 Firebase 사용자 연결은 `externalAuthId` mapping과 read-only export 검증부터 시작한다.
- 실제 전환은 dry-run 대조, 백업, 사용자 수·학습 합계 checksum, rollback rehearsals 이후 별도 승인으로 진행한다.
- 전환 기간에는 기존 WordQuest가 계속 동작한다.

### Phase 3 — 체험 유형 확장

1. Science LAB 확장
2. Earth의 `MAP_EXPLORATION`
3. Korean/BlueMoon의 조사·단서·추리 template
4. Hanja Story의 `STORY_SCENE`
5. History의 연결 탐색·timeline

각 체험은 한 번에 하나씩 이식하고 contract/E2E를 통과한 뒤 다음 체험으로 넘어간다.

### Phase 4 — 운영·상용화

- 조직별 AI 사용량·비용 budget
- 보호자 동의와 개인정보 처리 ledger
- 콘텐츠 신고·감사·롤백
- 백업, PITR, 복구 훈련과 운영 runbook
- 리포트 export
- 결제·플랜은 위 안전 기준과 운영 준비가 끝난 뒤 착수

## 15. 예상 수정 파일

Phase 1 구현 시 만들거나 수정할 예상 경로다. 세부 파일은 구현 계획에서 더 작은 작업 단위로 확정한다.

```text
package.json
pnpm-workspace.yaml
.gitignore
.env.example
.github/workflows/ci.yml

apps/web/**
apps/experience-runner/**
services/api/**
services/ai-generation/**
services/ai-validation/**
services/event-ingestion/**

packages/contracts/**
packages/experience-sdk/**
packages/experience-player/**
packages/auth/**
packages/db/**
packages/rasa/**
packages/gamification/**
packages/observability/**
packages/ui/**

experiences/science-vertical-slice/**
tests/contract/**
tests/integration/**
tests/e2e/**

docs/PROJECT_CANON.md
docs/INTEGRATION_PLAN_V2.md
docs/SOURCE_PROVENANCE.md
docs/runbooks/**
```

기존 `wordQuest`, `FreeFallExperiment`, `jarvis`, `Earth`, `korean`, `bluemoon`, `history`, `story` 저장소의 파일은 수정 목록에 포함하지 않는다.

## 16. 테스트·보안 검증 계획

### 자동 테스트

- **Unit:** 이식한 parser, 상태 계산, 힌트 정책, 점수·보스 projection
- **Contract:** Manifest, Event, Rasa Context/Action과 `postMessage`
- **Integration:** auth/tenant guard, DB transaction, idempotent ingestion, AI job 상태
- **Parity:** 원본 fixture에 대해 이식 전후 핵심 순수 로직 결과 비교
- **E2E:** 교사 저작부터 학생 완료·교사 결과까지 하나의 vertical slice
- **Accessibility:** 키보드, focus, 의미 구조, 색 대비와 reduced motion
- **Security:** cross-tenant IDOR, role escalation, origin/nonce/schema 위조, event replay, XSS, sandbox network·navigation, secret scan
- **Resilience:** AI timeout·429·provider failure, DB 일시 오류, offline event 재전송, 중복 webhook/job

### 구현 완료 주장 전 필수 명령

Phase 1 scaffolding에서 다음 표준 명령을 제공한다.

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

명령 출력과 실패/skip 수를 완료 보고에 그대로 기록한다. 테스트를 실행하지 못한 항목은 통과로 표시하지 않는다.

### 수동 검증

- 교사·학생 두 역할 브라우저 세션
- 모바일 viewport와 느린 네트워크
- 생성물 검증 실패/반려/재생성
- runner CSP와 sandbox 실제 브라우저 확인
- Rasa가 정답 대신 단계적 힌트를 주는지 교육 검수
- 반 공동 보스에서 개인 공개 비교가 없는지 확인

## 17. 배포와 롤백

### 배포

- dev → preview → staging → production 순으로 승격한다.
- DB migration과 기능 flag를 application deploy와 분리한다.
- 생성 runner는 플랫폼과 다른 origin에 배포한다.
- Phase 1 production 연결 전 synthetic student/teacher로 staging E2E를 통과한다.
- AI provider budget과 kill switch를 먼저 설정한다.

### 롤백

- 기존 앱 저장소·배포를 건드리지 않으므로 LessonQuest 실패가 기존 서비스 중단으로 이어지지 않는다.
- application은 직전 immutable 배포로 되돌린다.
- schema 변경은 expand → backfill → switch → contract 순으로 하고 즉시 destructive drop을 하지 않는다.
- projection은 append-only event에서 재생성 가능하게 한다.
- 문제가 있는 ExperienceVersion은 retire하고 이전 승인 버전을 다시 배포한다.
- Firebase 기존 데이터 전환은 별도 백업·dry-run·checksum·복구 훈련 없이는 실행하지 않는다.

## 18. 보안·개인정보·비용 리스크

| 위험                        | 영향      | Phase 1 대응                                                        |
| --------------------------- | --------- | ------------------------------------------------------------------- |
| 기관 간 데이터 노출         | 매우 높음 | 서버 membership 기반 tenant guard, IDOR 통합 테스트, 감사 로그      |
| 미성년자 개인정보·동의 부재 | 매우 높음 | synthetic data만 사용, 최소 수집, 운영 전 동의 ledger 설계          |
| 생성 HTML의 XSS·데이터 접근 | 매우 높음 | 별도 origin, strict sandbox/CSP, token 미전달, message schema·nonce |
| AI 오답·부적절 콘텐츠       | 높음      | 독립 검증, 교사 승인, 정책 버전, 반려·rollback                      |
| 클라이언트 점수 조작        | 높음      | 서버 원천 이벤트 검증과 projection, idempotency                     |
| AI 비용 폭증                | 높음      | org/job budget, token ceiling, timeout, queue, cache, kill switch   |
| WordQuest 데이터 유실       | 매우 높음 | Phase 1 운영 연결 금지, read-only export, checksum·rollback 선행    |
| 로그의 민감정보 노출        | 높음      | redaction, 최소 보존, 접근 제어, content 대신 hash/reference        |
| free-tier/단일 관리자 의존  | 중~높음   | staging capacity test, 역할 분리, break-glass 감사, 백업/PITR 계획  |

## 19. 예상 작업량

한 명의 엔지니어가 기존 코드를 이해한 상태에서 품질 검증까지 수행하는 보수적 범위다. AI 도움은 반복 작업을 줄일 수 있지만 보안·교육 검수 시간을 없애지는 않는다.

| 작업                           |           예상 |
| ------------------------------ | -------------: |
| 기반, 계약, DB, CI             |       3–5 인일 |
| 인증·기관·반 tenant guard      |       3–5 인일 |
| Science 생성·검증·sandbox 이식 |       5–8 인일 |
| Assignment·Player·Event        |       4–6 인일 |
| Rasa 최소 힌트                 |       2–4 인일 |
| 공동 보스·교사 결과            |       3–5 인일 |
| 보안·접근성·E2E·배포 hardening |       4–6 인일 |
| **Phase 1 합계**               | **24–39 인일** |

작업은 milestone별로 배포 가능한 작은 단위로 자른다. Phase 1 완료 전에 다른 체험 전체 이식을 병렬로 벌이지 않는다.

## 20. Phase 0 완료 조건과 다음 승인

Phase 0에서 완료한 것:

- URL과 실제 저장소 매핑
- 원본 문서·기술스택·실행·인증·DB·배포·테스트 조사
- 재사용/제외/후속 이식 범위 구분
- WordQuest 기관·동기화·서버 검증 구조 분석
- Science 생성·검증·승인·sandbox 구조 분석
- Jarvis 실제 소스와 Rasa 추출 범위 확인
- 공통 architecture, data, event, Rasa, 보안, 테스트와 rollback 설계

제품 코드는 아직 수정하지 않는다. 이 문서 검토가 끝나면 다음 순서로 진행한다.

1. Phase 1 세부 구현 계획과 첫 milestone 파일 목록 확정
2. contract 테스트부터 작성
3. 최소 구현
4. 전체 검증과 결과 보고
