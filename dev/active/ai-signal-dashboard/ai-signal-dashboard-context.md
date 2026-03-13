# AI Signal Dashboard - Context

## SESSION PROGRESS (2026-03-13)

### CURRENT REALITY

- 현재 `signals` 구현은 `demo snapshot + read API + web/Telegram shell` 이다.
- 문서가 요구하는 실데이터 수집/저장/점수화/모니터링은 아직 없다.
- 따라서 현재 구현을 “MVP 완료”로 취급하면 안 된다.

### WHAT EXISTS NOW

- 웹 경로
  - `/signals`
  - `/signals/[ticker]`
- API
  - `/api/signals/overview`
  - `/api/signals/recommendations`
  - `/api/signals/assets/[ticker]`
  - `/api/signals/briefing`
  - `/api/signals/health`
- Telegram
  - `/signal`
  - `/briefing`
  - `/recommend`
  - `/asset`
  - `/style`

### WHAT IS STILL MISSING

- PostgreSQL schema
- Python ingestion pipeline
- raw data tables
- feature snapshots
- technical structure engine
- rule-based composite signal engine
- recommendation run persistence
- scheduled jobs
- stale/failure alerting
- backtest / AI training path

## IMPLEMENTATION POSITIONING

### Delivery Surface

- `codexia` Next.js 앱은 계속 유지
- 역할: 웹 UI, Telegram, read API, 운영 trigger

### Compute Surface

- 새 Python pipeline 추가 예정
- 역할: 수집, 피처, 점수화, 추천, 배치, 알림

### Storage Surface

- JSON은 fallback/demo only
- source of truth는 PostgreSQL

## KEY DECISIONS

- 현재 demo shell은 지우지 않는다. 대신 `fallback/dev mode` 로 격하한다.
- 저장소를 만들기 전에는 feature 추가를 더 하지 않는다.
- AI보다 룰 기반 기준선과 저장 구조를 먼저 만든다.
- Telegram과 웹은 항상 같은 snapshot id를 보게 해야 한다.
- style은 scoring formula를 바꾸지 않고 filter strength만 바꾼다.

## FILES THAT MATTER NOW

### Current Shell

- `app/signals/*`
- `app/api/signals/*`
- `src/application/signals/signal-service.ts`
- `src/core/signals/types.ts`
- `app/api/telegram/route.ts`

### Planned New Surfaces

- `services/ai-signal-pipeline/`
- `db/migrations/signals/`
- `src/infrastructure/signals/db-*`

### Detailed Specs

- `dev/active/ai-signal-dashboard/reference/architecture-spec.md`
- `dev/active/ai-signal-dashboard/reference/data-contract-spec.md`
- `dev/active/ai-signal-dashboard/reference/signal-engine-spec.md`
- `dev/active/ai-signal-dashboard/reference/api-telegram-contract-spec.md`
- `dev/active/ai-signal-dashboard/reference/ops-validation-spec.md`

## NEXT EXECUTION TARGET

다음 실제 구현 배치는 아래만 잡는다.

1. demo fallback flag 도입
2. PostgreSQL schema/migration 추가
3. DB-backed signal read repository 추가
4. `/api/signals/health` 를 live storage 상태 기준으로 전환

이 범위를 통과해야 phase 2 이후 수집기 작업을 시작한다.
