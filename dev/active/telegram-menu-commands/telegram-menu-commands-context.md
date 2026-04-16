# Telegram Menu Commands Context

Last Updated: 2026-04-17

## SESSION PROGRESS

### Completed

- `app/api/telegram/route.ts`에 Telegram 메뉴 명령 배열을 추가하고, 최종 메뉴에서 `recent`, `resume`을 제외했다.
- `getMyCommands`와 `setMyCommands`를 이용해 현재 메뉴와 비교 후 동기화하는 helper를 추가했다.
- webhook secret 검증 뒤에 메뉴 동기화를 연결해, 실패 시 로그만 남기고 본 처리는 계속 진행되게 만들었다.
- 실제 실행 진입점인 `src/infrastructure/telegram/poller-runtime.ts` 시작 단계에서도 같은 8개 메뉴를 즉시 동기화하도록 보강했다.
- 이벤트 로그에서 기본 scope 8개 동기화 성공을 확인했고, private/chat scope에 남은 예전 명령을 덮어쓰도록 scope 기반 동기화를 추가했다.
- `/help` 텍스트도 메뉴 기준과 맞게 재정리해, 메뉴 버튼 안내와 추가 명령을 구분했다.
- `workspace` 명령을 Telegram 메뉴에 추가해 작업 폴더를 별도 선택하게 하고, `/new`는 다시 단순 새 세션 생성으로 유지했다.
- 작업 폴더 picker는 inline callback button을 사용하고, callback data는 64-byte 제한을 피하려고 browse-state index 방식으로 구성했다.
- `pnpm exec tsc --noEmit`, `pnpm exec eslint app/api/telegram/route.ts` 검증을 통과했다.
- `pnpm exec eslint src/infrastructure/telegram/poller-runtime.ts` 검증도 통과했다.

## Current Execution Contract

- 코어 영역인 `src/core`는 읽기만 하고 수정하지 않는다.
- 메뉴 등록은 기존 Telegram API 호출 유틸 패턴을 재사용해 `app/api/telegram/route.ts` 안에서 최소 변경으로 처리한다.
- 실패해도 webhook 본 처리에는 영향이 없도록 비치명 처리한다.

## Active Task

- Telegram 입력창 왼쪽 메뉴를 사용자 제공 명령 목록으로 코드에서 직접 동기화한다.

## Next Session Read Order

1. 이 파일
2. `telegram-menu-commands-plan.md`
3. `telegram-menu-commands-tasks.md`
4. `app/api/telegram/route.ts`

## Key Files

- `app/api/telegram/route.ts`
  - Telegram webhook, 명령 파서, 도움말, Telegram API 호출 유틸이 모여 있는 진입점
- `src/infrastructure/telegram/poller-runtime.ts`
  - 실제 로컬 운영 시 Telegram long polling을 시작하는 진입점

## Important Decisions

- 새 파일이나 새 레이어를 만들지 않고 기존 Telegram route 안에서 처리한다.
- Telegram 명령 메뉴는 webhook 진입 시에도 맞추되, 폴러 시작 시점에 먼저 강제 동기화한다.

## Quick Resume

- 현재 작업은 완료 상태다.
- 다음 변경이 있으면 `TELEGRAM_MENU_COMMANDS`와 도움말 문구의 일관성만 함께 확인하면 된다.
