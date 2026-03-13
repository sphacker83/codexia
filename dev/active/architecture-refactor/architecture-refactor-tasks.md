# Architecture Refactor Tasks

## P0 Dev Docs ✅ COMPLETE

- [x] `dev/active/architecture-refactor/` 트랙 생성
- [x] plan/context/tasks 3문서 생성
- [x] 현재 구조 문제와 acceptance criteria 정리

## P1 포트와 composition root ⏳ NOT STARTED

- [ ] `src/application` 포트 정의 추가
- [ ] `AgentJobRepository`, `SessionRepository`, `AgentRunner`, `WorkspaceFileSearchService`, `TelegramStateStore`, `TelegramBotClient` 인터페이스 고정
- [ ] `src/infrastructure/composition` 조립점 추가
- [ ] route/application/presentation 의 import 방향 점검

## P2 agent/session/files 경계 정렬 ⏳ NOT STARTED

- [ ] job JSON persistence를 `job-service`에서 분리
- [ ] `session-file-store`를 repository 구현체로 재구성
- [ ] session 관련 application service 정리
- [ ] `app/api/files` 로직을 service 뒤로 이동
- [ ] `app/api/sessions/[sessionId]` delete를 application service 뒤로 이동

## P3 Telegram route 분해 ⏳ NOT STARTED

- [ ] Telegram request entry, parser, formatter 분리
- [ ] bot client / state store / attachment / screenshot infrastructure 분리
- [ ] job/session/admin handler 분리
- [ ] `app/api/telegram/route.ts`를 thin entry로 축소
- [ ] Telegram lint warning 0 달성

## P4 web presentation 정리 ⏳ NOT STARTED

- [ ] `use-agent-session-bootstrap` 분리
- [ ] `use-agent-stream` 분리
- [ ] `use-file-suggestions` 분리
- [ ] `use-agent-composer-state` 분리
- [ ] `use-agent-chat-view-model`을 facade로 축소
- [ ] `components/session-manager.tsx`를 `src/presentation/web/home`로 이동
- [ ] 루트 `components/`를 shared UI 전용으로 정리

## P5 테스트와 검증 ⏳ NOT STARTED

- [ ] `vitest` 도입
- [ ] job-service 테스트 추가
- [ ] session service 테스트 추가
- [ ] file-search service 테스트 추가
- [ ] telegram parser/handler 테스트 추가
- [ ] route smoke 테스트 추가
- [ ] `npm run lint` 통과
- [ ] `npx tsc --noEmit` 통과

## Quick Resume

- 다음 실행 단계는 `P1 포트와 composition root`다.
- 구현 전 반드시 현재 더티 워크트리, 특히 `app/api/telegram/route.ts` 변경 상태를 다시 확인한다.
