# Architecture Refactor Plan

작성일: 2026-03-13
트랙: `dev/active/architecture-refactor`
우선순위: `P0`

## 목표

`docs/ARCHITECTURE.md`에 정의된 계층 구조를 실제 코드에도 반영한다.

이번 리팩터링의 목적은 동작 변경이 아니라 책임 경계 정렬이다.

- `app/`는 진입점만 담당
- `src/presentation`은 adapter/UI 상태만 담당
- `src/application`은 use case/orchestration만 담당
- `src/infrastructure`는 JSON 저장, CLI 실행, Telegram/Bot API, 스크린샷, 파일 인덱싱 같은 구현만 담당
- `src/core`는 타입/정책/프롬프트 계산만 유지

## 성공 조건

- 외부 HTTP 계약(`/api/agent`, `/api/agent/stream`, `/api/jobs/*`, `/api/sessions*`, `/api/telegram`)은 유지된다.
- `app/api/*` 아래 어떤 route도 `src/infrastructure/*`를 직접 import 하지 않는다.
- `src/application/agent/job-service.ts`는 job 파일 저장 구현을 포함하지 않고 orchestration 중심으로 축소된다.
- `app/api/telegram/route.ts`는 request entry만 남기고 기능별 모듈로 분해된다.
- 루트 `components/`에는 shared UI만 남고, 세션 관리 UI는 `src/presentation/web/...`로 이동한다.
- lint warning이 0이 되고, 핵심 application/route/telegram 흐름 테스트가 추가된다.

## 현재 상태 요약

- 웹 메인 agent 흐름은 상대적으로 구조가 잘 잡혀 있으나, `job-service` 안에 job JSON persistence가 섞여 있다.
- `app/api/sessions/[sessionId]`와 `app/api/files`는 route 레벨에서 infra/파일 시스템 로직을 직접 가진다.
- `app/api/telegram/route.ts`는 Telegram API, 인증, 상태 저장, 첨부 처리, 스크린샷, job orchestration, 응답 포맷팅이 한 파일에 집중되어 있다.
- `src/presentation/web/agent/use-agent-chat-view-model.ts`는 session bootstrap, SSE stream, file suggestions, composer state를 한 훅에 담고 있다.
- 루트 `components/session-manager.tsx`는 shared UI가 아니라 도메인 기능 UI다.

## 리팩터링 원칙

- 구현 스타일은 함수형 유틸/팩토리 기반으로 유지하고, 무거운 IoC 컨테이너는 도입하지 않는다.
- JSON 파일 저장소와 단일 프로세스 가정은 유지한다.
- SQLite 이전, 웹 인증 추가, API 계약 변경, Telegram 기능 확장은 이번 범위에 포함하지 않는다.
- route -> presentation/application -> infrastructure 방향만 허용하고, 역방향/우회 import는 금지한다.
- 분해 후에도 제품 동작과 데이터 포맷은 그대로 유지한다.

## 구현 단계

### P0. Dev Docs와 목표 경계 고정

- `dev/active/architecture-refactor/` 3문서(plan/context/tasks) 생성
- 핵심 acceptance criteria 고정
- 관련 더티 워크트리와 현재 구조적 리스크 기록

### P1. 포트와 composition root 도입

- `src/application`에 포트 기반 경계 추가
- 기본 포트:
  - `AgentJobRepository`
  - `SessionRepository`
  - `AgentRunner`
  - `WorkspaceFileSearchService`
  - `TelegramStateStore`
  - `TelegramBotClient`
- `src/infrastructure/composition`에 web/telegram용 조립점 추가

수용 기준:

- route는 조립점과 presentation/application만 참조한다.
- application은 `fs`, `spawn`, Telegram HTTP 구현을 직접 다루지 않는다.

### P2. agent/session/files 경계 정렬

- `job-service`에서 job JSON read/write/list 구현을 `src/infrastructure/agent/job-json-repository`로 이동
- 기존 `session-file-store`는 `SessionRepository` 구현으로 재구성
- session CRUD/clear/title/model/reasoning 변경은 repository + application service 조합으로 제공
- `app/api/files`의 파일 순회/캐시/정렬 로직을 service 뒤로 이동
- `app/api/sessions/[sessionId]`의 delete도 application service 뒤로 이동

수용 기준:

- `app/api/files`와 `app/api/sessions/[sessionId]`에 infra import가 없다.
- `job-service`는 orchestration과 상태 전이만 남는다.

### P3. Telegram route 분해

- `presentation/server/telegram`에 request entry, command parser, callback parser, response formatter 배치
- `infrastructure/telegram`에 bot client, state store, attachment service, screenshot service 배치
- `application/telegram`에 명령 처리 orchestration 배치
- 명령군 분리:
  - job: `run/status/jobs/cancel`
  - session: `new/resume/title/clear/model/reasoning/session`
  - admin: `start/id/ping/eventLog`

수용 기준:

- `app/api/telegram/route.ts`는 secret 검증 -> update parse -> handler 위임 -> `{ ok: true }` 응답만 담당한다.
- Telegram 관련 lint warning이 제거된다.

### P4. web presentation 정리

- `use-agent-chat-view-model`을 다음 훅으로 분리
  - `use-agent-session-bootstrap`
  - `use-agent-stream`
  - `use-file-suggestions`
  - `use-agent-composer-state`
- 현재 view model은 위 훅들을 합성하는 facade로 축소
- `components/session-manager.tsx`를 `src/presentation/web/home`으로 이동
- 루트 `components/`에는 theme/layout/shared UI만 남김

수용 기준:

- `src/presentation/web/agent` 내부 훅 책임이 명확히 분리된다.
- 루트 `components/`에 도메인 fetch/세션 관리 컴포넌트가 남지 않는다.

### P5. 테스트/검증 마무리

- 테스트 프레임워크는 `vitest`로 통일
- application/service/route/telegram parser 기준 테스트 추가
- 최종 검증:
  - `npm run lint`
  - `npx tsc --noEmit`
  - 신규 vitest 스위트

## 핵심 테스트 시나리오

- job 생성, 중복 active job 방지, stale job 복구, cancel, trace/fast 완료
- session 생성/삭제/clear/title/model/reasoning 변경
- file search query, limit, protected path, excluded dir 처리
- telegram command parser, callback parser, auth bypass, session switch, run/status/cancel handler
- route smoke: `/api/agent/stream`, `/api/sessions/[sessionId]`, `/api/files`, `/api/telegram`

## 리스크

- `app/api/telegram/route.ts`는 현재 더티 워크트리 상태라, 분해 전에 기존 변경을 정확히 읽고 병합 방향을 맞춰야 한다.
- `job-service` 분리 시 stale recovery와 cancel 동작이 깨질 가능성이 가장 높다.
- view model 분리는 동작 변경이 아닌 상태 흐름 분해여야 하므로 SSE 재연결/재시도 회귀에 주의해야 한다.
- 테스트 기반 없이 대규모 이동만 하면 회귀 탐지가 어렵다. 최소한 parser/service smoke는 초반부터 추가한다.

## 완료 후 기대 효과

- 문서상의 계층 구조가 import 그래프에도 반영된다.
- Telegram과 agent 영역의 변경 영향 범위가 줄어든다.
- 이후 SQLite 이전이나 웹 인증 추가를 infra/application 단위 작업으로 분리할 수 있다.
