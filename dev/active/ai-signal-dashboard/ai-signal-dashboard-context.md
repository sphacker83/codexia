# AI Signal Dashboard - Context

## SESSION PROGRESS (2026-03-13)

### COMPLETED
- JSON-backed signal snapshot 서비스와 `/api/signals/*` route를 구현했다.
- `demo/stale/style/health` 정보를 웹과 Telegram이 같은 shape로 소비하도록 정리했다.
- `/signals`, `/signals/[ticker]`, 상단 메뉴 링크를 추가했다.
- Telegram `/signal`, `/briefing`, `/recommend`, `/asset`, `/style` 명령을 연결했다.
- `pnpm lint`, `pnpm build` 검증을 통과했다.

## Key Decisions
- phase 1은 DB 대신 `data/signals/demo-snapshot.json`을 source of truth로 사용한다.
- 웹 UI와 Telegram은 같은 application service를 재사용한다.
- 추천 스타일은 점수 공식을 바꾸지 않고 필터/컷오프만 바꾼다.

## File Ownership
- 데이터/API: `src/core/signals`, `src/application/signals`, `src/infrastructure/signals`, `app/api/signals`
- UI: `app/signals`, `src/presentation/web/signals`, `components/top-menu-bar.tsx`
- Telegram: `app/api/telegram/route.ts`
