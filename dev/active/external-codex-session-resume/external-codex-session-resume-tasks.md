Last Updated: 2026-04-17

# External Codex Session Resume - Tasks

## Phase Status
- Phase 1 Discovery: completed
- Phase 2 Integration: completed
- Phase 3 Verification: completed

## Checklist
- [x] 실제 Codex CLI의 resume 엔트리포인트와 로컬 세션 저장소를 확인한다.
- [x] 구현 범위를 `src/infrastructure/agent`로 제한한다.
- [x] 외부 Codex 세션 인덱스 파서를 구현한다.
- [x] `listResumeSessions()`에 외부 Codex 세션 병합을 추가한다.
- [x] `loadSession()`에 외부 Codex 세션 자동 import를 추가한다.
- [x] 외부 Codex 세션의 `cwd` 메타를 codexia 세션 기본 작업 디렉터리로 흡수한다.
- [x] Telegram `/workspace`가 chat 기본 작업 폴더를 저장하고, `/new`/`/resume`이 그 값을 적용하도록 연결한다.
- [x] Telegram `/workspace` 폴더 picker를 `workspace` 상단 단독 버튼 + 나머지 3열 그리드로 재배치한다.
- [x] `/new` 응답에 직전 세션 ID를 표시한다.
- [x] `/session` 목록을 선택된 작업 폴더 기준 전역 최근 10개로 재구성한다.
- [x] Telegram `/session` 선택 UI를 reply keyboard 대신 inline keyboard로 전환한다.
- [x] Telegram `/session` 본문을 `기본 작업 위치` + 세션 목록만 보이도록 단순화한다.
- [x] Telegram 메뉴 명령 순서를 `workspace, sessions, new, stop, model, effort, help`로 재작성하고 한국어 설명을 갱신한다.
- [x] Telegram 세션 메뉴 진입점을 `resume` 하나로 통합하고, `/resume` 무인자 입력이 세션 목록 UI를 열도록 맞춘다.
- [x] Telegram 세션 hidden alias(`/session`, `/sessions`, `/s`)를 제거하고 `resume`만 남긴다.
- [x] Telegram help/명령 안내에서 `cancel`, `recent`, `sessions`, 중복 `resume`, `run`, `log` 노출을 제거한다.
- [x] Telegram help를 평문 위주로 다시 써서 포맷 깨짐과 중복 노출을 줄인다.
- [x] Telegram help의 중복 `workspace` 안내를 제거한다.
- [x] Telegram `/model`, `/effort`를 inline button 선택 방식으로 전환한다.
- [x] Telegram 공식 중지 명령을 `/stop`으로 바꾸고 `/cancel`은 별칭으로만 유지한다.
- [x] Telegram inline 메뉴들에 공통 `닫기` 버튼을 추가한다.
- [x] Telegram 세션 전환 후 이전 세션 picker 메시지는 갱신하지 않고 버튼만 제거한다.
- [x] Telegram 세션 전환 후 기존 picker 메시지를 갱신하고, 이전/현재 세션 제목을 함께 표시한다.
- [x] Telegram 작업 폴더 선택 후 이전 workspace picker 메시지를 갱신하고 새 메시지는 보내지 않는다.
- [x] Telegram `/fork` 명령으로 현재 세션을 새 분기 세션으로 복제한다.
- [x] Telegram `/new`가 workspace root 폴더 picker를 띄우고, 선택 결과를 새 세션 기본 작업 위치로 저장하도록 연결한다.
- [x] 세션 기본 작업 디렉터리를 실제 CLI spawn `cwd`에 연결한다.
- [x] `pnpm exec eslint ...`, `pnpm exec tsc --noEmit`로 검증한다.
- [x] Dev Docs를 실제 결과에 맞게 갱신한다.

## 작업 전 필독
- `codexia/.env.local` 접근 금지
- `src/core` 수정 금지
- 기존 Telegram/Discord/Web 흐름을 깨지 않도록 `listSessions()`/`loadSession()` 기반 확장만 수행

## Original Code References
- `src/infrastructure/agent/session-file-store.ts`
- `src/infrastructure/agent/codex-cli-executor.ts`
- `app/api/telegram/route.ts`
- `app/api/discord/route.ts`

## Implementation Targets
- `src/infrastructure/agent/codex-resume-session-index.ts`
- `src/infrastructure/agent/session-file-store.ts`
- `app/api/telegram/route.ts`
- `app/api/discord/route.ts`

## Validation References
- `pnpm exec eslint app/api/telegram/route.ts src/infrastructure/agent/session-file-store.ts src/infrastructure/agent/codex-cli-executor.ts src/infrastructure/agent/codex-resume-session-index.ts src/application/agent/job-service.ts`
- `pnpm exec eslint app/api/telegram/route.ts`
- `pnpm exec tsc --noEmit`

## Documentation Follow-up
- 구현 완료 후 plan/context/tasks에 실제 변경 파일과 검증 결과 반영
