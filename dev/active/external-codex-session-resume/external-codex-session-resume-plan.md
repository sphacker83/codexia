Last Updated: 2026-04-17

# External Codex Session Resume - Plan

## Summary
- codexia 세션 resume 대상에 `data/sessions/*.json`만이 아니라 로컬 Codex CLI가 저장한 실제 resume 가능 세션도 포함한다.
- 사용자가 외부 Codex 세션 ID를 선택하면 codexia 로컬 세션으로 import하여 이후에는 일반 세션처럼 이어서 사용할 수 있게 한다.

## Current State Analysis
- 현재 세션 목록은 `src/infrastructure/agent/session-file-store.ts`의 `listSessions()`가 `data/sessions`만 읽어 만든다.
- 세션 전환은 Telegram/Discord/Web 모두 결국 `listSessions()`와 `loadSession()`에 의존한다.
- Codex 실행은 `src/infrastructure/agent/codex-cli-executor.ts`에서 `codex exec resume <sessionId>` 형태를 지원하지만, codexia 쪽에는 외부 Codex 세션을 세션 파일로 materialize 하는 단계가 없다.
- 실제 Codex 로컬 저장소에는 `~/.codex/session_index.jsonl`과 `~/.codex/archived_sessions/*.jsonl`가 존재하며, `codex resume`/`codex exec resume`가 session id 기반 resume를 지원한다.

## Target State
- `listSessions()`가 codexia 로컬 세션과 외부 Codex 세션 인덱스를 병합해 최신순으로 제공한다.
- 외부 Codex 세션 ID가 `loadSession()`으로 들어오면 최소 메타데이터를 가진 codexia 세션 파일로 자동 import한다.
- import된 세션은 `providerSessionProvider="codex"`와 `providerSessionId=<real codex session id>`를 가져 provider resume가 바로 동작한다.

## Result
- 외부 resume 전용 목록은 `listResumeSessions()`로 분리했다.
- 일반 웹 세션 관리 목록은 기존 `listSessions()`를 유지해 삭제 UX 충돌을 피했다.
- Telegram/Discord resume 흐름은 `listResumeSessions()`를 사용하고, exact session id 입력 시 외부 Codex 세션도 자동 import된다.
- import된 외부 Codex 세션의 `session_meta.payload.cwd`를 codexia 세션의 기본 작업 디렉터리 후보로 흡수한다.
- Telegram `workspace` 선택을 chat 기본 작업 폴더로 저장하고, 이후 `/new`와 `/resume`이 target session `cwd`로 복사 적용한다.

## Execution Map

### Phase 1: External Session Discovery
- Codex 로컬 세션 인덱스 경로와 파싱 규칙을 인프라 계층으로 캡슐화한다.
- Acceptance: session id, 제목(thread name), updatedAt을 안정적으로 읽을 수 있다.

### Phase 2: Session Store Integration
- `listSessions()`에서 로컬 세션과 외부 Codex 세션을 병합한다.
- `loadSession()`에서 외부 Codex 세션 자동 import를 지원한다.
- Acceptance: 외부 세션이 목록에 나타나고 선택 시 로컬 세션 파일이 생성된다.

### Phase 3: Verification
- TypeScript/ESLint 검증으로 깨진 import/타입이 없는지 확인한다.
- Acceptance: `npm run lint` 통과 또는 실패 원인이 작업 범위와 무관하게 명확히 보고된다.

## Acceptance Criteria
- `/session`, `/resume`, 웹 세션 목록이 외부 Codex 세션도 보여준다.
- 외부 Codex 세션 ID를 exact match로 선택하면 codexia 세션으로 import된다.
- import된 세션은 후속 실행에서 provider resume 경로를 사용한다.
- `workspace`로 선택한 폴더는 이후 `/new`와 `/resume`에서 target session `cwd`로 적용되고, 첫 실행과 후속 provider resume 모두 같은 작업 디렉터리에서 Codex CLI를 띄운다.
- `src/core` 변경 없이 인프라 계층에서만 해결한다.

## Validation Gates
- `npm run lint`
- `pnpm exec eslint app/api/telegram/route.ts src/infrastructure/agent/session-file-store.ts src/infrastructure/agent/codex-cli-executor.ts src/infrastructure/agent/codex-resume-session-index.ts src/application/agent/job-service.ts`
- `pnpm exec tsc --noEmit`
- 필요 시 간단한 Node import smoke check

## Risks And Mitigations
- Codex 인덱스 포맷 변경 위험
  - 완화: JSONL line-by-line 파싱과 필드 검증을 넣고, 실패 시 외부 세션만 무시한다.
- 외부 세션이 매우 많아 성능 저하 가능
  - 완화: index 파일 기반으로 요약만 읽고, 세부 archived 세션 파싱은 하지 않는다.
- 웹 세션 삭제 UX 혼선
  - 완화: 외부 세션 병합은 resume 전용 목록에만 적용하고, 일반 세션 관리 목록은 로컬 세션만 유지한다.
