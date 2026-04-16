Last Updated: 2026-04-17

# External Codex Session Resume - Context

## SESSION PROGRESS

### Completed
- 외부 Codex 세션 요약 소스를 `~/.codex/session_index.jsonl` 전역 인덱스에서 `~/.codex/sessions/YYYY/MM/DD/*.jsonl` 실제 세션 기록으로 전환했다.
- `src/infrastructure/agent/session-file-store.ts`에 `listResumeSessions()`와 외부 Codex 세션 자동 import를 추가했다.
- Telegram/Discord `/session`, `/resume`가 resume 전용 목록을 사용하도록 연결했다.
- Telegram `/session`은 최신순 혼합으로 외부 세션이 묻히는 문제를 막기 위해 `codexia 세션` / `외부 Codex resume 세션` 구간으로 나눠 보여주도록 조정했다.
- Telegram `/session <키워드>`가 title/sessionId/preview 기준 필터를 지원하고, 직전 목록 기준으로 `/resume 1` 선택이 이어지도록 browse state를 추가했다.
- Telegram의 `reply keyboard`/`remove keyboard` 전송이 첫 청크만 보내던 문제를 수정해서, 긴 `/session` 응답에서도 외부 세션 구간이 잘리지 않게 했다.
- 제목이 비어 있는 외부 세션도 구분 가능하도록 텔레그램 목록 라벨을 `시간 | 라벨 | 세션ID 앞부분` 형식으로 바꿨다.
- 아래 reply keyboard 버튼도 제목이 비어 있으면 `시간 · 세션ID 앞부분`을 fallback 라벨로 쓰도록 맞췄다.
- `.codex/sessions`의 `event_msg.user_message`에서 첫 실질 사용자 요청을 conversation preview로 추출해 외부 세션 `lastMessagePreview`에 연결했다.
- 외부 Codex 세션 import 시 `session_meta.payload.cwd`를 읽어 codexia 세션 `defaultWorkingDirectory`에 저장하도록 확장했다.
- Telegram `/workspace`가 chat 기본 작업 폴더를 고르게 하고, 이후 `/new`와 `/resume`이 그 값을 target session `cwd`로 적용하도록 맞췄다.
- `/new`는 다시 단순 새 세션 생성으로 유지하고, 응답에 직전 세션 ID를 함께 표시하도록 조정했다.
- Telegram `/new`가 workspace root 바로 아래 작업 폴더를 inline button으로 보여주고, 선택 즉시 새 세션 + 기본 작업 위치 저장까지 처리하도록 확장했다.
- `src/infrastructure/agent/codex-cli-executor.ts`가 세션별 작업 디렉터리를 받아 Codex/Gemini CLI spawn `cwd`에 적용하도록 확장했다.
- `pnpm exec eslint app/api/telegram/route.ts src/infrastructure/agent/session-file-store.ts src/infrastructure/agent/codex-cli-executor.ts src/infrastructure/agent/codex-resume-session-index.ts src/application/agent/job-service.ts`
- `pnpm exec tsc --noEmit`

### Pending
- 없음

## Current Execution Contract
- `src/core`는 읽기만 하고 수정하지 않는다.
- `codexia/.env.local`은 접근하지 않는다.
- 구현은 기존 세션 흐름(`listSessions`, `loadSession`)을 확장하는 방식으로 최소 변경한다.
- 세션별 작업 디렉터리 메타는 `src/infrastructure/agent/session-file-store.ts` 내부 확장 필드로만 저장하고, 공개 `Session` 타입은 건드리지 않는다.

## Active Task
- codexia의 resume 대상에 실제 로컬 Codex 세션을 포함시키고, 선택 시 codexia 세션으로 import되도록 만든다.
- import/선택 세션 모두 세션별 기본 작업 디렉터리를 유지해 native Codex session continuity와 `cwd`를 함께 맞춘다.

## Read Order For Next Session
1. 이 파일
2. `external-codex-session-resume-plan.md`
3. `external-codex-session-resume-tasks.md`
4. `src/infrastructure/agent/session-file-store.ts`
5. `src/infrastructure/agent/codex-cli-executor.ts`

## Key Files And Roles
- `src/infrastructure/agent/session-file-store.ts`
  - codexia 세션 파일 읽기/쓰기와 세션 목록 집계의 중심.
- `src/infrastructure/agent/codex-resume-session-index.ts`
  - `~/.codex/session_index.jsonl`에서 실제 Codex resume 가능 세션 요약을 읽는다.
- `src/infrastructure/agent/codex-cli-executor.ts`
  - provider resume 시 `codex exec resume <sessionId>`를 실제로 호출하는 실행기.
- `app/api/telegram/route.ts`
  - `/session`, `/resume`, `/new`가 `listResumeSessions()`/`loadSession()` 기반으로 동작하고, `/new`는 작업 폴더 picker를 제공한다.
- `app/api/discord/route.ts`
  - Discord `/session`, `/resume`도 같은 세션 저장소를 사용한다.

## Important Decisions
- 외부 세션의 전체 메시지 전문 복원은 이번 범위에 넣지 않는다.
- 실제 resume 가능성을 위해 외부 세션의 `session id`를 codexia `sessionId`와 `providerSessionId`에 그대로 사용한다.
- 외부 resume 후보는 `~/.codex/sessions` 실제 세션 파일의 최근 전역 pool을 기준으로 읽고, 특정 프로젝트 찾기는 텔레그램 `query` 필터에서 푼다.
- 외부 세션 병합은 resume 전용 목록으로 제한하고, 웹 세션 관리 목록은 기존 로컬 세션만 유지한다.
- Discord는 기존 scope 소유 규칙을 유지하되, UUID 형태의 외부 resume 세션만 예외적으로 표시/전환 허용한다.
- exact session id import는 같은 `.codex/sessions` 트리에서 파일명을 기준으로 찾아 처리한다.
- conversation 표시값은 session title이 비어 있을 때 `.codex/sessions`의 `event_msg.user_message`에서 보일러플레이트를 제거한 마지막 실질 라인으로 만든다.
- `.codex/sessions` 포맷을 codexia가 직접 생성/수정하지 않고, Codex CLI가 만든 실제 session id와 `cwd` 메타만 가져와 local session metadata로 연결한다.
- 세션 기본 작업 디렉터리는 저장 시 workspace-relative label로 정규화하고, 실행 직전에만 absolute `cwd`로 복원한다.
- Telegram 폴더 선택은 top-level workspace 디렉터리만 노출하고, callback payload는 index browse state로 짧게 유지한다.
- `/session` 목록은 선택된 작업 폴더 기준 전역 최근 10개만 보여주고, 로컬/외부 Codex 구간 분리는 제거한다.

## Quick Resume
- 외부 세션 처리가 더 필요하면 `codex-resume-session-index.ts`부터 확인한다.
- resume 표면을 더 늘릴 때는 `listResumeSessions()`를 쓰고, 일반 세션 관리에는 `listSessions()`를 유지한다.
- 세션별 작업 디렉터리 흐름을 볼 때는 `session-file-store.ts -> job-service.ts -> codex-cli-executor.ts` 순서로 읽는다.
- 재검증 명령:
  - `pnpm exec eslint app/api/telegram/route.ts src/infrastructure/agent/session-file-store.ts src/infrastructure/agent/codex-cli-executor.ts src/infrastructure/agent/codex-resume-session-index.ts src/application/agent/job-service.ts`
  - `pnpm exec tsc --noEmit`
