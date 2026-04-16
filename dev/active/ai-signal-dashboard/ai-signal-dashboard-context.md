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

## SESSION NOTE (2026-04-11)

- Telegram help text의 최상단 우선순위를 재정리했다.
- 도움말 맨 위에서 Signal 관련 명령을 제거하고, 메뉴 버튼 추천 TOP 5를 `/run`, `/status`, `/jobs`, `/session`, `/help` 기준으로 노출한다.
- 세션 관련 UX는 `/s` 별칭을 추가하고, 사용자가 보게 되는 재개 표기를 `/resume`으로 통일했다.
- 중복으로 반복되던 `/status`, `/session`, `/help` 설명은 하나만 남기도록 정리했다.
- 헬프 메시지는 메뉴 10개 목록으로 축약하지 않고, 기존 설명 중심 구조를 유지한 채 상단 추천 블록만 남긴다.
- `model`과 `effort`는 세션 선택처럼 reply keyboard로 목록 선택이 가능하도록 확장했다.
- 선택 메뉴는 목록 조회/입력 실패 시 유지되고, 실제 선택이 완료되면 키보드를 제거해 입력창을 원복한다.
- `model`과 `effort` 버튼 라벨에는 번호만 두지 않고, 실제 선택 대상 이름을 함께 표시해 바로 읽히도록 정리했다.
- 앱 내부 Codex 실행기는 `cdx` alias와 같은 효과가 나도록 `--dangerously-bypass-approvals-and-sandbox` 기본 인자를 사용하게 맞췄다.
- 앱 내부 Codex 실행기는 spawn env에서 `CODEX_SANDBOX_NETWORK_DISABLED=0`을 명시해 부모 프로세스의 네트워크 차단 플래그를 덮어쓰도록 조정했다.
- 검증은 `pnpm exec eslint app/api/telegram/route.ts` 로 수행했다.

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
