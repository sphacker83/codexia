# AI Signal Dashboard - Architecture Spec

## 1. 목적

이 문서는 `docs/ai_signal_dashboard_plan.docx`를 실제 구현 구조로 내리기 위한 아키텍처 정본이다.  
이 문서의 목표는 “어디에 무엇을 구현할지”를 고정해, 구현자가 저장 위치나 런타임 경계를 다시 결정하지 않게 하는 것이다.

## 2. 시스템 경계

### 2-1. Delivery App

현재 저장소(`codexia`)의 Next.js 앱은 다음 책임만 가진다.

- 최신 시그널 조회 API
- 추천 종목/종목 상세 조회 API
- 웹 UI 렌더링
- Telegram 명령 처리
- 운영 trigger endpoint

하지 않는 일:

- 외부 데이터 수집
- 피처 계산
- 시그널 계산
- 백테스트
- 스케줄링 본체

### 2-2. Compute Pipeline

새 Python 서비스 `services/ai-signal-pipeline/`는 다음 책임을 가진다.

- 외부 데이터 수집
- universe 동기화
- raw 적재
- 정제/결측치 처리
- feature snapshot 생성
- technical/macro/sentiment/news score 계산
- composite score 및 override 계산
- recommendation run 계산
- notification payload 생성 및 발송
- backfill/replay/backtest

## 3. 런타임 구성

### 3-1. Canonical Runtime

- `web`: Next.js App Router
- `telegram`: Next.js `app/api/telegram/route.ts`
- `pipeline`: Python CLI jobs
- `storage`: PostgreSQL

### 3-2. 배포 단위

- 프로세스 A: Next.js app
- 프로세스 B: Telegram poller
- 프로세스 C: Python pipeline batch runner
- 프로세스 D: PostgreSQL

### 3-3. 데이터 소스 원칙

- 소스별 adapter를 분리한다.
- 계산 엔진은 adapter raw 결과를 직접 참조하지 않고 normalized model만 읽는다.
- provider 변경은 adapter만 바꾸면 되도록 설계한다.

## 4. 디렉터리 구조

```text
services/
  ai-signal-pipeline/
    pyproject.toml
    src/ai_signal_pipeline/
      config/
      shared/
      ingestion/
        adapters/
        jobs/
      universe/
      features/
      signals/
      recommendations/
      notifications/
      backtest/
      cli/
    tests/

db/
  migrations/
    signals/

src/
  core/signals/
  application/signals/
  infrastructure/signals/
  presentation/web/signals/

app/
  api/signals/
  api/telegram/
  signals/
```

## 5. Python Pipeline 내부 경계

### 5-1. config

- env parsing
- provider key loading
- timezone/job schedule config

### 5-2. shared

- datetime helpers
- score normalization helpers
- DB session/connection helpers
- logging helpers

### 5-3. ingestion

- provider adapter
- raw fetcher
- raw validation
- source run logging

### 5-4. universe

- SP500/QQQ seed 로딩
- weekly refresh
- manual diff review 대상 생성

### 5-5. features

- macro feature builder
- technical feature builder
- sentiment/news feature builder
- feature snapshot persistence

### 5-6. signals

- market regime classifier
- macro score calculator
- technical structure engine
- sentiment/news score calculator
- composite aggregator
- override engine

### 5-7. recommendations

- candidate universe filter
- factor score calculator
- style filter
- ranking

### 5-8. notifications

- Telegram briefing payload
- Discord webhook payload
- dedupe

### 5-9. backtest

- replay runner
- metric calculator
- model evaluation reports

## 6. Next.js 내부 경계

### 6-1. `src/core/signals`

- API response type
- style/regime/action enum
- UI shared constants

### 6-2. `src/infrastructure/signals`

- PostgreSQL read repository
- fallback demo snapshot loader
- health reader

### 6-3. `src/application/signals`

- DB read model orchestration
- overview/recommendation/briefing response assembly
- Telegram 공통 formatter 입력 모델

### 6-4. `app/api/signals`

- thin route handler
- query parsing
- service call

### 6-5. `src/presentation/web/signals`

- 대시보드
- 상세
- 운영 상태 블록

## 7. 저장소 전략

### 7-1. Source of Truth

- production/staging: PostgreSQL
- local demo/dev fallback: `data/signals/demo-snapshot.json`

### 7-2. Fail Policy

- `SIGNALS_ENABLE_DEMO_MODE=1` 이면 fallback 허용
- production에서 DB가 비어 있으면 `health=degraded/stale` 가 아니라 `health=failure equivalent` 로 처리
- 웹/Telegram에서 `demo`를 `live`처럼 보이게 하지 않는다.

## 8. 스케줄링 전략

Canonical timezone은 `America/New_York` 로 고정한다.

- `premarket_full`
  - 월~금 08:15 ET
- `intraday_hourly`
  - 월~금 10:30 / 11:30 / 12:30 / 13:30 / 14:30 / 15:30 ET
- `close_finalize`
  - 월~금 16:20 ET
- `weekly_universe_refresh`
  - 토요일 06:00 ET

DST 보정은 OS local timezone이 아니라 timezone-aware scheduler 기준으로 처리한다.

## 9. 운영 정책

- 모든 pipeline run은 `pipeline_job_runs` 에 기록
- 모든 source fetch는 `signal_source_runs` 에 기록
- 모든 notification은 `notification_events` 에 기록
- batch는 idempotent 해야 한다.
- 같은 `job_name + scheduled_for` 조합은 하나만 성공 상태를 허용한다.

## 10. 환경 변수

### Next.js

- `DATABASE_URL`
- `SIGNALS_ENABLE_DEMO_MODE`
- `SIGNALS_SNAPSHOT_FILE` (local only)

### Pipeline

- `DATABASE_URL`
- `FRED_API_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `SIGNAL_TELEGRAM_BOT_TOKEN`
- `SIGNAL_DISCORD_WEBHOOK_URL`
- `SIGNAL_PIPELINE_ENV`
- `SIGNAL_LOG_LEVEL`

## 11. 구현 순서 강제

다음 순서를 바꾸지 않는다.

1. DB spine
2. raw ingestion
3. feature snapshots
4. rule signal engine
5. recommendation engine
6. read model/API
7. notifications
8. backtest
9. AI

이 순서를 어기면 UI가 다시 mock 데이터로 돌아가거나, signal logic이 저장 구조 없이 흩어질 위험이 크다.
