# Phase 2 진행 기록

Phase 2는 WordQuest의 기능을 LessonQuest의 기관 경계와 학습 이벤트 계약에 맞춰 작은 단위로 전달한다. 기존 WordQuest 저장소·서비스와 실제 데이터는 변경하지 않는다.

| 단위                     | 상태                  | 범위                                                                                            |
| ------------------------ | --------------------- | ----------------------------------------------------------------------------------------------- |
| 서버 검증 quiz/boss      | 기존 구현             | Phase 1 학습 API와 공동 보스, 원본 출처가 기록된 순수 보스 규칙                                 |
| 반·초대·교사 대시보드    | 독립 검증 통과 96/100 | 소유 반/기관 관리자 목록, 반 만들기·선택, 만료/한도/재발급/취소 초대, 학생 자기 가입, 과제 현황 |
| PWA와 offline queue      | 독립 검증 통과 91/100 | 설치 shell, 계정·기관별 20건/24시간 queue, exact replay, 세션/초기화 clear                      |
| 기존 계정 및 export 대조 | 전달 완료·94/100      | versioned 합성 export, 명시적 계정·기관 mapping, 결정적 checksum, redacted readiness report     |
| 식별자 C1 제어문자 보완  | 독립 검증 통과 99/100 | U+0000–U+001F·U+007F–U+009F 차단, 네 공용 식별자 경로 회귀 테스트                               |
| 실제 데이터 전환         | 별도 승인 필요        | 백업, dry-run, 사용자 수/학습 합계 checksum, rollback rehearsal 이후 승인                       |

## 반·초대 사용법

1. 개발 미리보기의 **반 관리**를 열고 **새 반 이름 → 반 만들기**를 누른다. 수업할 반을 바꾸면 제작소의 이전 초안·선택 상태가 초기화된다.
2. 초대 인원 한도를 정하고 **초대 코드 발급**을 누른다. 코드를 복사해 전달한다. 코드는 24시간 유효하며 재발급은 이전 코드를 취소한다.
3. **교사 화면**에서 기존 저장→독립 검증→승인→반 배포를 수행한다. 배포 대상은 반 관리에서 선택한 반이다.
4. **학생 화면** 아래의 초대 입력으로 참여한다. 과제가 다시 로드되고 기존 플레이 흐름으로 학습한다.
5. **반 관리**로 돌아와 과제별 현재 학생·시작·완료·오답·재도전·힌트 합계를 확인한다. 필요한 과제만 **학습 과정 보기**로 상세를 연다.

## 안전·복구 범위

- 인증된 현재 활성 학생만 자기 자신을 가입시킬 수 있다. 입력으로 역할이나 대상 학생을 지정하지 못한다. 교사는 자기 반 또는 현재 ORG_ADMIN 범위만 관리한다.
- 코드는 충분한 무작위성을 가진 서버 발급 값이며 DB에는 SHA-256만 저장한다. 원문 코드는 발급 응답과 교사 화면에만 존재하고 URL/저장소/감사/진단에는 넣지 않는다. 화면을 벗어나면 다시 표시하지 않는다.
- 발급 응답이 유실되면 재발급한다. 참여 응답이 유실되면 같은 코드를 다시 제출한다. 현재 유효한 초대의 중복 참여는 한도를 더 사용하지 않는다. 만료·취소·권한철회·비활성 상태가 중복 허용보다 우선한다.
- 반 만들기의 성공 응답이 유실되면 다시 만들기 전에 목록을 새로고침해 생성 여부부터 확인한다. 기존 반 생성 API는 요청 중복을 제거하지 않으므로 바로 다시 제출하면 같은 이름의 반이 추가될 수 있다.
- 대시보드 현재 합계는 비활성 학생/소속을 제외한다. 교사의 개별 과제 상세는 기존 보존된 과거 학습 기록이다. 두 범위가 다를 수 있다.
- 이 공개 사이트는 탭 메모리 기반 합성 개발 환경이다. 새로고침하면 반·초대·가입·학습 기록이 사라진다. 다른 탭/사용자와 공유하지 않으며 운영 인증·영구 저장·외부 AI·Firebase와 연결하지 않는다.
- 실제 운영용 초대 서비스라는 주장은 하지 않는다. 운영 전 요청 제한, 실제 PostgreSQL 동시성, 지속 DB migration·복구, 운영 인증·전달 정책을 검증해야 한다.

## PWA·오프라인 학습 기록 사용법

1. 온라인 상태에서 사이트를 한 번 연다. manifest와 service worker가 설치되고 같은 사이트의 shell·정적 자산이 준비된다. 데모와 세션이 없는 일반 빌드는 worker를 등록하지 않는다.
2. 호스트가 학생 세션에 `lqs_<64 lowercase hex>` 형식의 불투명한 계정 저장 키를 제공하면 시작·답안·재도전·완료 이벤트가 전송 전에 IndexedDB에 기록된다. 키는 인증 토큰이나 화면에 표시할 사용자 ID가 아니다.
3. 연결이 끊기면 학생 화면에 대기 건수가 나타난다. 같은 과제에서 다른 쓰기는 차단된다. 연결이 돌아오면 2→4→8→16→32→최대 60초 간격으로 같은 이벤트 ID와 본문을 전송한다. **대기 기록 지금 보내기**로 즉시 시도할 수도 있다.
4. **이 기기의 대기 기록 지우기**는 현재 계정·기관 범위만 지우고 과제를 다시 열도록 안내한다. 호스트의 `lessonquest:session-ended` 이벤트와 공개 미리보기의 **데이터 초기화**도 같은 범위를 지운다. 일반 컴포넌트 전환·새로고침은 queue를 지우지 않는다.
5. 권한·기관·반·과제 생명주기와 strict validation의 비재시도 오류는 기록을 삭제하고 재로그인/과제 재진입을 안내한다. 다른 계정이나 기관으로 기록을 옮기거나 재생하지 않는다.

## PWA·저장 경계

- 범위당 최대 20건, 생성 후 24시간까지만 유지한다. IndexedDB 값은 strict `ClientLearningEvent`, 생성 시각, 시도 횟수와 다음 시도 시각뿐이다. bearer token, 정답 여부, 제목, 힌트, 생성 콘텐츠, 학생 프로필과 진단 원문은 저장하지 않는다.
- Rasa 힌트, attempt 생성, 과제/player 읽기, 초대와 교사 기능은 offline queue 대상이 아니다. Background Sync도 쓰지 않으므로 durable credential이 없다.
- worker는 성공한 same-origin navigation/static GET만 캐시한다. Authorization 요청, `/health`, `/organizations/` 및 `/api/` 경로, cross-origin, opaque/error/non-OK 응답은 캐시하지 않는다. 오래된 cache 제거도 `lessonquest-shell-*` 이름에만 한정한다.
- 첫 온라인 방문 전에는 offline shell을 보장하지 않는다. 공개 Vercel 미리보기의 API/DB는 탭 메모리 PGlite이므로 offline 새로고침은 새 합성 DB로 shell을 여는 시연이다. queue의 reload 복구를 운영 기능으로 주장하려면 지속 API, 재수립된 로그인 세션, 운영 브라우저 정책을 별도로 검증해야 한다.
- IndexedDB를 사용할 수 없는 환경은 기존 메모리 재전송 동작을 유지한다. 저장 공간 오류는 localStorage나 토큰 저장으로 우회하지 않는다.

## 기존 계정·export 대조 준비 범위

- `@lessonquest/data-transition`은 호출자가 메모리로 제공한 strict v1 WordQuest identity export와 명시적 LessonQuest 계정·기관 mapping만 검증한다. 배열 순서와 관계없는 canonical JSON과 SHA-256을 만들고, 누락·중복·충돌·미사용 mapping을 모두 차단 finding으로 반환한다.
- 원본 `externalAuthId`와 legacy 기관 key는 권한이 아니다. 결과에는 raw source ID 대신 SHA-256 fingerprint만 기록한다. `MASTER`는 항상 `PRIVILEGED_ROLE_REQUIRES_REVIEW`로 readiness를 차단하며 `ORG_ADMIN`이나 `SUPER_ADMIN`으로 승격되지 않는다.
- 전환 계약은 전용 `@lessonquest/contracts/data-transition` subpath로만 공개된다. 기존 contracts barrel, API, auth, DB와 web runtime은 새 패키지를 import하지 않으며 normal·demo·preview 브라우저 산출물에도 형식·finding·fixture 표식이 없다.
- 후속 hardening 후보는 공용 opaque 식별자 검사에서 C0와 DEL/C1 전체 U+0000–U+001F·U+007F–U+009F를 거절한다. U+0080·U+0085·U+009F와 export/mapping의 네 키 경로, 고정 오류 redaction을 회귀 테스트로 고정했고 기존 checksum은 바꾸지 않았다.
- 이 단위는 Firebase exporter, 파일 reader, CLI, API, DB schema/column, auth adapter, migration, 실제 데이터 dry-run 또는 write 도구가 아니다. 실제 전환은 백업·합계 checksum·rollback rehearsal와 별도 승인을 거쳐야 한다.

## 검토 기록

- [설계](superpowers/specs/2026-08-31-phase2-classrooms-design.md)
- [구현 계획](superpowers/plans/2026-08-31-phase2-classrooms.md)
- [사전 검토 95/100](reviews/2026-08-31-phase2-classrooms-plan-review.md)
- [독립 최종 검토 96/100 — 차단 문제 없음](reviews/2026-08-31-phase2-classrooms-final-review.md)
- [검증 결과와 적용 한계](reviews/2026-08-31-phase2-classrooms-verification.md)
- [PWA·offline 설계](superpowers/specs/2026-09-01-phase2-pwa-offline-design.md)
- [PWA·offline 구현 계획](superpowers/plans/2026-09-01-phase2-pwa-offline.md)
- [PWA·offline 사전 검토 97/100](reviews/2026-09-01-phase2-pwa-offline-plan-review.md)
- [PWA·offline 구현 검증](reviews/2026-09-01-phase2-pwa-offline-verification.md)
- [PWA·offline 독립 최종 검토 Attempt 1 — 80/100 실패](reviews/2026-09-01-phase2-pwa-offline-final-review.md)
- [PWA·offline 독립 최종 검토 Attempt 2 — 82/100 실패](reviews/2026-09-01-phase2-pwa-offline-final-review-attempt-2.md)
- [PWA·offline 독립 최종 검토 Attempt 3 — 80/100 실패](reviews/2026-09-01-phase2-pwa-offline-final-review-attempt-3.md)
- [PWA·offline 독립 최종 검토 Attempt 4 — 91/100 통과](reviews/2026-09-01-phase2-pwa-offline-final-review-attempt-4.md)
- [Identity export readiness 설계](superpowers/specs/2026-09-01-phase2-identity-export-design.md)
- [Identity export readiness 구현 계획](superpowers/plans/2026-09-01-phase2-identity-export.md)
- [Identity export readiness 사전 검토 98/100](reviews/2026-09-01-phase2-identity-export-plan-review.md)
- [Identity export readiness 구현 검증](reviews/2026-09-01-phase2-identity-export-verification.md)
- [Identity export readiness 독립 최종 검토 94/100 — 차단 문제 없음](reviews/2026-09-01-phase2-identity-export-final-review.md)
- [Identity C1 hardening 구현 계획](superpowers/plans/2026-09-01-phase2-identity-control-hardening.md)
- [Identity C1 hardening 사전 검토 99/100](reviews/2026-09-01-phase2-identity-control-hardening-plan-review.md)
- [Identity C1 hardening 구현 검증](reviews/2026-09-01-phase2-identity-control-hardening-verification.md)
- [Identity C1 hardening 독립 최종 검토 99/100 — 차단 문제 없음](reviews/2026-09-01-phase2-identity-control-hardening-final-review.md)

반·초대 단위는 구현 검증과 독립 심사를 거쳐 전달됐다. PWA·offline 독립 심사 Attempt 1은 API 응답 shell 캐시와 손상된 조직 레코드 재생을 찾아 80/100으로 실패했다. Attempt 2는 세션 종료 후 늦은 전달 오류 재저장과 손상 primary key 중복을 찾아 82/100으로 실패했다. Attempt 3는 그 수정은 확인했지만 세션 종료가 초기 put/prune과 교차할 때의 재저장과 동시 enqueue FIFO 위반을 찾아 80/100으로 실패했다. enqueue 전체를 lifecycle 세대와 FIFO staging lock에 묶고 단일 전달 예약으로 수정했다. Attempt 4는 실제 diff, 26개 파일 해시, 전체 382개 테스트, E2E 77개와 33개 서비스 미리보기 브라우저 검증을 독립 실행한 뒤 91/100, 치명적 차단 문제 없음으로 통과했다. 이 변경은 PR #9로 `main`에 병합됐다.

Identity export readiness 후보는 합성 입력만 사용해 focused 41개, 전체 423개, 통합 52개, E2E 77개, demo browser 12개와 service preview browser 33개를 통과했다. 첫 산출물 격리 검사는 contracts root barrel 때문에 transition 표식이 웹 번들에 포함된 것을 찾아냈고, 전용 subpath와 회귀 테스트로 수정한 뒤 세 웹 모드의 JS/source map에서 표식 부재를 확인했다. 독립 최종 심사는 동일 행렬, 13개 finding probe, 37개 산출물 byte scan과 13/13 해시를 확인해 94/100, 치명적 차단 문제 없음으로 통과했다. 이 후보는 PR #10의 검토 head `ab2274c90d3016a79e60231a065f2ba427238be7`에서 CI를 통과하고 `main`의 `79e9dde6a8ff2b1f6bb850b2f94135d355f38a2f`로 병합됐다. main CI, 기존 Git 연동 Vercel 배포와 live preview/asset 격리도 확인했다.

그 심사의 비차단 F1을 닫는 C1 hardening 후보는 계획 99/100 통과 후 U+0080·U+0085·U+009F가 허용되는 4건 RED를 재현했다. 공용 코드포인트 조건 한 곳만 수정한 뒤 focused 48개, 전체 430개, 통합 52개, E2E 77개, demo browser 12개와 service preview browser 33개, audit와 세 웹 모드 18개 JS/source map 격리 검사를 통과했다. 의존성·lockfile·runtime/schema/version/checksum은 바뀌지 않았다. 새 독립 reviewer는 같은 전체 행렬, 3/3 해시와 40-path 경계 probe를 확인해 99/100, 치명적 차단 문제 없음으로 통과시켰다. exact-head delivery 전까지 이 hardening 후보의 출시를 인증하지 않으며, 실제 exporter·실데이터 dry-run·migration은 계속 별도 승인 범위다. 이 문서는 Phase 2 전체 완료를 뜻하지 않는다.

Attempt 4의 비차단 후속 항목은 retry metadata 저장 실패 시 즉시 재시도될 수 있는 경로와 reload 상태 콜백 안에서 동기 dispose될 때 남는 비활성 online listener다. 현재 합성 미리보기의 서버 권위, 범위 clear, exact replay, 저장 최소화에는 영향을 주지 않지만 지속 backend에 연결하기 전에 수정한다.

비차단 후속 작업은 독립 심사에서 통과한 지연 응답·권한 변경·감사 실패 probe의 상시 회귀 테스트 편입과 반 생성의 중복 요청 처리다. 현재 반 생성 복구 절차는 위의 목록 새로고침 우선 안내를 따른다.
