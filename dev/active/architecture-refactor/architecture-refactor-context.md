# Architecture Refactor Context

## SESSION PROGRESS (2026-03-13)

### ✅ COMPLETED

- 현재 구조와 `docs/ARCHITECTURE.md` 간 차이를 검토했다.
- 주요 구조 부채를 세 군데로 정리했다:
  - `src/application/agent/job-service.ts`의 persistence 혼합
  - `app/api/telegram/route.ts`의 과대 책임
  - `src/presentation/web/agent/use-agent-chat-view-model.ts`의 과대 presentation state
- Dev Docs 트랙 `dev/active/architecture-refactor/`를 생성했다.
- 구현 계획/컨텍스트/체크리스트 문서를 초기화했다.

### 🟡 IN PROGRESS

- 구현은 아직 시작하지 않았다.
- 현재 단계는 계획 문서 고정과 작업 재개용 맥락 정리다.

### ⚠️ 주의 사항

- 워크트리는 이미 더티 상태다.
- 현재 확인된 사용자/기존 변경:
  - `app/api/telegram/route.ts`
  - `components/top-menu-bar.tsx`
  - `app/api/signals/`
  - `app/signals/`
  - `dev/active/ai-signal-dashboard/`
  - `src/application/signals/`
  - `src/core/signals/`
  - `src/infrastructure/signals/`
  - `src/presentation/web/signals/`
- 위 변경은 이번 아키텍처 정렬 작업과 직접 관련 없는 부분이 섞여 있을 수 있으므로, 구현 시 되돌리거나 덮어쓰지 않도록 주의가 필요하다.

## 핵심 파일

**`docs/ARCHITECTURE.md`**
- 목표 계층 구조와 이미 알려진 리스크의 기준 문서

**`src/application/agent/job-service.ts`**
- 현재 agent orchestration 중심 파일
- job JSON persistence와 orchestration이 혼합된 핵심 정리 대상

**`src/infrastructure/agent/session-file-store.ts`**
- session JSON 저장 구현
- 향후 `SessionRepository` 구현체로 재구성할 후보

**`app/api/files/route.ts`**
- route 내부에 파일 순회/캐시 로직이 있음
- service 뒤로 옮겨야 하는 대상

**`app/api/sessions/[sessionId]/route.ts`**
- delete가 infra 구현을 직접 호출하는 대상

**`app/api/telegram/route.ts`**
- Telegram API, 인증, 상태 저장, 첨부/스크린샷, job orchestration이 집중된 대형 route

**`src/presentation/web/agent/use-agent-chat-view-model.ts`**
- session bootstrap, stream consume, file suggestions, composer state를 한 훅에 담고 있음

**`components/session-manager.tsx`**
- shared UI가 아니라 세션 기능 UI
- `src/presentation/web/home`로 이동해야 하는 대상

## 핵심 의사결정

- 이번 작업은 구조 리팩터링이며 외부 계약과 사용자 가시 동작은 유지한다.
- 포트 기반 경계를 도입하되, 클래스 기반 DI 대신 함수 기반 조립 방식을 사용한다.
- JSON 저장소는 유지하고, 저장 구현만 infrastructure로 더 명확히 이동한다.
- `app/api/*`는 infra를 직접 import하지 않는다.
- Telegram 기능 분해는 기능군 기준(job/session/admin)으로 나눈다.
- 테스트 프레임워크는 `vitest`를 기본으로 한다.

## 빠른 재개 안내

1. 이 파일과 `architecture-refactor-plan.md`, `architecture-refactor-tasks.md`를 먼저 읽는다.
2. 구현을 시작한다면 P1부터 진행한다:
   - 포트 정의
   - composition root
   - job/session/files 경계 정렬
3. 그 다음 Telegram route 분해(P3), web presentation 분해(P4), 테스트(P5) 순으로 진행한다.
4. 구현을 시작하기 전 `app/api/telegram/route.ts`의 현재 더티 변경 내용을 먼저 읽고, 병합 전략을 확정한다.
