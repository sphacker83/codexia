---
trigger: always_on
---

# GEMINI.md

이 파일은 이 저장소에서 Gemini 에이전트가 `.agents/workflows` 자산(스킬/훅/에이전트/명령어/Dev Docs)을 최대한 활용하도록 하는 운영 규칙입니다.

## 1) 기본 원칙

- 모든 응답은 기본적으로 한국어로 작성한다.
- 프로젝트 구조를 추측하지 않는다. 필요 정보가 없으면 먼저 확인한다.
- 단순 수정은 빠르게 처리하고, 복잡한 작업은 문서화부터 시작한다.
- `.agents/workflows`는 "있으면 참고"가 아니라 "기본 워크플로우"로 사용한다.

## 2) 작업 시작 체크리스트

작업 시작 시 아래 순서로 판단한다.

1. 요청이 어떤 범주인지 분류한다.
2. 해당 범주에 맞는 스킬을 선택한다.
3. 복잡 작업(대략 2시간+, 다단계, 멀티세션 가능)인지 판단한다.
4. 복잡 작업이면 `dev/active/...` 3파일(plan/context/tasks)부터 만들거나 갱신한다.
5. 구현 후에는 `context/tasks`를 최신 상태로 업데이트한다.

## 3) 스킬 사용 규칙 (`.agents/workflows/skills`)

### 3-1. 스킬 선택 우선순위

- 스킬/훅/트리거/`skill-rules.json`/Gemini 설정 작업: `skill-developer`
- 프론트엔드(Next.js/React/TS/UI) 작업: `frontend-dev-guidelines`
- 백엔드/API/검증/서비스 계층 작업: `backend-dev-guidelines`
- 인증 라우트 테스트/디버깅: `route-tester`
- 에러 처리/모니터링/Sentry 관련: `error-tracking`

### 3-2. 스킬 적용 방식

- 스킬이 명시되었거나 요청 맥락이 스킬 설명과 맞으면 반드시 해당 `SKILL.md`를 먼저 읽는다.
- `SKILL.md`는 필요한 부분만 읽고, 추가 리소스는 필요한 파일만 점진적으로 로드한다.
- 여러 스킬이 겹치면 최소 집합만 선택하고 적용 순서를 짧게 공유한다.
- `skill-rules.json` 수정이 필요한 경우, 경로 패턴(`pathPatterns`)을 현재 저장소 구조 기준으로 맞춘다.

## 4) Dev Docs 규칙 (`dev/README.md`)

복잡 작업은 반드시 Dev Docs 패턴을 따른다.

- 경로: `dev/active/[task-name]/`
- 파일:
  - `[task-name]-plan.md`
  - `[task-name]-context.md`
  - `[task-name]-tasks.md`

### 4-1. 생성/갱신 기준

- 생성: 복잡 기능, 대규모 리팩터링, 멀티세션 가능 작업
- 생략 가능: 단순 버그, 단일 파일 소규모 수정
- 문서 우선: 구현 전에 최소 AC/리스크/테스트 시나리오를 문서에 고정
- 세션 종료 전: `context`와 `tasks`를 반드시 갱신

### 4-2. 사이드 플랜 트랙

- 메인 트랙과 별개 요구사항은 `사이드 플랜 트랙`으로 분리한다.
- 별도 디렉터리와 3파일을 동일 규칙으로 유지한다.
- 우선순위는 `P0/P1/P2`로 명시한다.

## 5) 훅 사용 규칙 (`.agents/workflows/hooks`, `.agents/workflows/settings.json`)

현재 기본 훅 구성:

- `UserPromptSubmit`: `skill-activation-prompt.sh`
- `PostToolUse`: `post-tool-use-tracker.sh`
- `Stop`: `error-handling-reminder.sh`

원칙:

- 훅/설정 작업 시 `AGENT_WORKFLOWS_INTEGRATION_GUIDE.md` 절차를 따른다.
- `settings.json`을 통째로 덮어쓰지 않고 필요한 훅 섹션만 병합한다.
- 훅 복사 후 실행 권한을 확인한다(`chmod +x`).
- TypeScript 훅은 의존성 설치 여부를 확인한다(`.agents/workflows/hooks/package.json`, `npm install`).

## 6) 에이전트 사용 규칙 (`.agents/workflows/agents`)

- 복잡하고 다단계인 작업은 전용 에이전트 사용을 우선 검토한다.
- 일반적으로 바로 사용 가능한 에이전트:
  - `code-architecture-reviewer`
  - `code-refactor-master`
  - `documentation-architect`
  - `flutter-developer` (Flutter 코드 작업일 때)
  - `frontend-architecture-designer`
  - `frontend-error-fixer`
  - `refactor-planner`
  - `plan-reviewer`
- 인증 전제(JWT 쿠키)가 필요한 작업에서만:
  - `auth-route-tester`
  - `auth-route-debugger`
- 에이전트 파일에 하드코딩 경로가 있으면 현재 프로젝트 경로로 치환한다.

### 6-2. 에이전트 스펙 주입 원칙(필수)

- 에이전트 호출 시 이름만 전달하지 않는다.
- 실행 전에 반드시 해당 에이전트 파일(`.agents/workflows/agents/<agent-name>.md`)을 읽고, 핵심 규칙/절차/출력 형식을 호출 메시지에 반영한다.
- 최소 포함 요소:
  - 책임 범위(파일/기능)
  - 강제 규칙(아키텍처/테스트/DI/문서화 등)
  - 기대 산출 형식
- 요약 주입이 아닌 원문 기반 주입이 필요한 작업(고난도/규칙 엄수)은 에이전트 스펙 블록을 그대로 포함해 호출한다.

### 6-1. 멀티 에이전트 오케스트레이션 원칙

- 멀티 에이전트로 진행하는 작업에서 **메인 에이전트는 직접 구현/수정 작업을 하지 않는다**.
- 메인 에이전트 역할은 오케스트레이션에 한정한다.
  - 작업 분해
  - 적절한 서브 에이전트 선정(`explorer`/`worker`/`awaiter`)
  - 병렬 실행/의존성 순서 조정
  - 결과 취합/충돌 조정
  - 검증 게이트 실행 지시 및 통과 여부 확인
  - 최종 보고 정리
- 파일 수정, 테스트 실행, 장시간 대기 작업은 원칙적으로 서브 에이전트에 위임한다.
- 서브 에이전트에 작업을 줄 때는 반드시 책임 범위(파일/기능 단위)를 명시한다.
- 예외는 사용자의 명시적 요청이 있는 경우에만 허용한다(예: "메인이 직접 즉시 수정").
- 개발 에이전트는 Dev Docs `조건부 강제` 규칙을 따른다.
  - 게이트 기준: 대략 2시간+, 다단계, 멀티세션 가능 작업
  - 게이트 통과 시: 구현 전에 `dev/active/[task]/`의 `plan/context/tasks` 3파일을 먼저 만들거나 갱신
  - 구현 중: 각 서브 에이전트는 **자기 책임 범위 변경분만** `context/tasks`에 즉시 반영
  - 세션 마감/인수인계: `/dev-docs-update` 또는 동등 절차로 최신 상태 동기화
  - 게이트 미통과(단순/단일 파일/짧은 수정): Dev Docs 생략 가능

## 7) 슬래시 명령어 활용 (`.agents/workflows/commands`)

- 계획 수립 시작: `/dev-docs`
- 컨텍스트 압축/세션 마감 전 정리: `/dev-docs-update`
- 인증 라우트 연구/테스트 보조: `/route-research-for-testing`

명령어 사용 시 경로 가정(`dev/active`, API 경로)을 현재 저장소 구조와 맞춘다.

## 8) 통합/수정 작업 공통 체크리스트 (`AGENT_WORKFLOWS_INTEGRATION_GUIDE.md`)

스킬/훅/에이전트/명령어를 손댈 때 아래를 기본으로 확인한다.

1. 구조 확인 질문(단일 앱/모노레포, 코드 위치, 스택)
2. 필요한 항목만 선별 적용(초기에는 과도한 일괄 적용 금지)
3. JSON 유효성 검증
   - `cat .agents/workflows/skills/skill-rules.json | jq .`
   - `cat .agents/workflows/settings.json | jq .`
4. 훅 실행 권한 검증
   - `ls -la .agents/workflows/hooks/*.sh`
5. 훅 의존성 검증(필요 시)
   - `ls .agents/workflows/hooks/node_modules/`

## 9) 금지/주의

- `.agents/workflows/settings.json` 전체를 예시 파일로 덮어쓰지 않는다.
- 스킬을 한 번에 전부 추가하지 않는다.
- `tsc-check` 계열 Stop 훅은 검증 없이 추가하지 않는다.
- 스택 불일치(예: React 스킬을 Vue 프로젝트에 그대로 적용) 상태로 강행하지 않는다.

## 10) 빠른 실행 가이드

- 프론트 UI 버그 수정: `frontend-dev-guidelines` 확인 -> 구현 -> 필요 시 `frontend-error-fixer` 에이전트
- Flutter 기능 구현/리팩터링: `flutter-dev-guidelines` 확인 -> 필요 시 `flutter-developer` 에이전트
- API/인증 라우트 검증: `route-tester` 확인 -> 인증 전제 확인 -> 테스트
- 스킬 트리거 이상: `skill-developer` 확인 -> `skill-rules.json`/훅 설정 점검
- 장기 작업 시작: `/dev-docs`로 3파일 생성 후 구현 시작
- 세션 마감 전: `/dev-docs-update`로 문서 동기화
