# AI Signal Dashboard - Context

## SESSION PROGRESS (2026-03-13)

### CURRENT REALITY

- 현재 `signals` 구현은 `demo snapshot + read API + web/Telegram shell` 이다.
- phase1 범위의 PostgreSQL storage spine과 live read path는 반영됐다.
- 문서가 요구하는 실데이터 수집/저장/점수화/모니터링 전체는 아직 없다.
- 따라서 현재 구현을 “MVP 완료”로 취급하면 안 되고, “phase1 storage spine 완료” 수준으로 본다.

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

### WHAT CHANGED IN THIS SESSION

- PostgreSQL migration 추가
  - `db/migrations/signals/001_init.sql`
- DB connection/runtime 추가
  - `src/infrastructure/db/postgres.ts`
  - `src/infrastructure/signals/migrate-runtime.ts`
- live read repository 추가
  - `src/infrastructure/signals/postgres-signal-repository.ts`
  - `src/infrastructure/signals/signal-snapshot-normalizer.ts`
- snapshot store 전환
  - PostgreSQL live read 우선
  - `SIGNALS_ENABLE_DEMO_MODE=1` 일 때만 JSON fallback 허용
- 운영 문서/README 갱신

### WHAT IS STILL MISSING

- Python ingestion pipeline
- pipeline writer -> `signal_delivery_snapshots` 적재 경로
- live seed data / 운영 snapshot 생성기
- raw data ingestion jobs
- feature/technical score writer
- live DB writer
- scheduled jobs
- stale/failure alerting automation
- backtest / AI training path

## IMPLEMENTATION POSITIONING

### Delivery Surface

- `codexia` Next.js 앱은 계속 유지
- 역할: 웹 UI, Telegram, read API, 운영 trigger

### Compute Surface

- 새 Python pipeline 추가 예정
- 역할: 수집, 피처, 점수화, 추천, 배치, 알림

### Storage Surface

- agent/session/job 상태는 JSON 유지
- SignalForge live snapshot source of truth는 PostgreSQL
- JSON signal snapshot은 fallback/demo only

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
- `src/infrastructure/db/*`
- `src/infrastructure/signals/postgres-*`

### Detailed Specs

- `dev/active/ai-signal-dashboard/reference/architecture-spec.md`
- `dev/active/ai-signal-dashboard/reference/data-contract-spec.md`
- `dev/active/ai-signal-dashboard/reference/signal-engine-spec.md`
- `dev/active/ai-signal-dashboard/reference/api-telegram-contract-spec.md`
- `dev/active/ai-signal-dashboard/reference/ops-validation-spec.md`

## NEXT EXECUTION TARGET

다음 실제 구현 배치는 아래만 잡는다.

1. Python/live writer가 `signal_delivery_snapshots` 를 적재하도록 연결
2. source runner가 `signal_source_runs` 를 실제 health source로 채우도록 연결
3. seed/live 데이터 1세트를 넣어 `/api/signals/health` 를 live-green까지 검증
4. phase2 pipeline bootstrap 문서와 실행 스크립트 추가

이 범위를 통과해야 phase2 수집기 작업을 본격 시작한다.
