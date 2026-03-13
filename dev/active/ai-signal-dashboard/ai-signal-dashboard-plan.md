# AI Signal Dashboard - Implementation Plan

## Summary
- Codexia에 별도 시그널 대시보드와 Telegram 명령을 추가한다.
- 현재 저장소 스택에 맞춰 Next.js + TypeScript + JSON snapshot 기반 MVP로 구현한다.
- 외부 실데이터가 없을 때는 demo snapshot으로 동작하고, API/UI/Telegram 모두 demo 상태를 명시한다.

## Acceptance Criteria
- `/signals`, `/signals/[ticker]`, `/api/signals/*`가 동작한다.
- Telegram에서 `/signal`, `/briefing`, `/recommend`, `/asset`, `/style`을 사용할 수 있다.
- 추천 스타일은 `conservative`, `balanced`, `aggressive`를 지원한다.
- stale/demo/health/source 상태가 UI와 Telegram 모두에 노출된다.

## Risks
- 초기 버전은 실데이터 수집이 없어 demo snapshot 품질에 의존한다.
- UI/API 작업이 병렬 진행 중이므로 shape 변경은 최소화해야 한다.

## Validation
- `pnpm lint`
- `pnpm build`
