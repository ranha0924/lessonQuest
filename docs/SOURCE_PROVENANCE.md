# LessonQuest 소스 이식 원장

기존 저장소는 모두 읽기 전용이다. 외부 저장소의 함수, 컴포넌트, 데이터 모델 또는 테스트 fixture를 LessonQuest로 이식할 때 이 표의 행을 같은 커밋에 추가한다.

| LessonQuest 경로        | 원본 저장소 | 원본 commit | 원본 경로 | 이식한 symbol/fixture      | 변경한 가정                | parity test                  | 소유권·라이선스 메모    |
| ----------------------- | ----------- | ----------- | --------- | -------------------------- | -------------------------- | ---------------------------- | ----------------------- |
| `packages/contracts/**` | 해당 없음   | 해당 없음   | 해당 없음 | LessonQuest 공통 계약 계층 | 통합 설계서에서 새로 정의  | `packages/contracts/test/**` | LessonQuest 원작성 코드 |
| `packages/auth/**`      | 해당 없음   | 해당 없음   | 해당 없음 | 합성 로컬 인증 경계        | 이 milestone에서 새로 정의 | `packages/auth/test/**`      | LessonQuest 원작성 코드 |
| `packages/db/**`        | 해당 없음   | 해당 없음   | 해당 없음 | tenant 저장소와 감사 로그  | 이 milestone에서 새로 정의 | `packages/db/test/**`        | LessonQuest 원작성 코드 |
| `services/api/**`       | 해당 없음   | 해당 없음   | 해당 없음 | 기관·반 application API    | 이 milestone에서 새로 정의 | `services/api/test/**`       | LessonQuest 원작성 코드 |

## 기록 규칙

- 원본 저장소 이름만 적지 않고 전체 `owner/repository`와 40자리 commit SHA를 기록한다.
- 파일 전체를 복사했다는 표현 대신 실제 이식한 함수·컴포넌트·fixture를 적는다.
- 인증, tenant, 데이터 저장, 브라우저 권한처럼 원본과 달라진 가정을 명시한다.
- 같은 입력에 대한 원본과 이식본 결과를 비교할 수 있으면 parity test 경로를 기록한다.
- 원본 저장소의 파일, 브랜치, 설정, 배포와 운영 데이터는 수정하지 않는다.
