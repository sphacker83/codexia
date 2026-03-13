# AI Signal Dashboard - Ops & Validation Spec

## 1. 목적

이 문서는 배치 실행, 운영 모니터링, 테스트, 게이트를 고정한다.

## 2. Job Definitions

### 2-1. `premarket_full`

시각:

- weekdays 08:15 ET

책임:

- macro refresh
- daily market bars refresh
- sentiment/news refresh
- feature snapshot 생성
- SPY/QQQ signal 계산
- recommendation run 계산
- daily briefing 생성

### 2-2. `intraday_hourly`

시각:

- weekdays 10:30 / 11:30 / 12:30 / 13:30 / 14:30 / 15:30 ET

책임:

- intraday market bars refresh
- VIX/sentiment refresh
- technical layer 재계산
- signal/briefing delta 계산
- change alert 발송

### 2-3. `close_finalize`

시각:

- weekdays 16:20 ET

책임:

- official close 기준 daily finalize
- recommendation run finalize
- final signal snapshot 저장

### 2-4. `weekly_universe_refresh`

시각:

- Saturday 06:00 ET

책임:

- SP500/QQQ seed diff 생성
- `signal_assets` 갱신 제안

## 3. Alert Rules

### 3-1. Delivery Channels

- Telegram
- Discord webhook

### 3-2. Alert Types

- pipeline failure
- stale source
- market regime change
- signal action change
- recommendation entry
- recommendation exit

### 3-3. Dedupe

dedupe key:

```text
{event_type}:{snapshot_time}:{ticker_or_market}:{channel}
```

같은 key는 한 번만 발송한다.

## 4. Health Rules

### 4-1. Global Health

- `healthy`
  - critical source 모두 fresh
  - latest job success
- `degraded`
  - 일부 optional source stale 또는 partial
- `stale`
  - critical snapshot stale
- `failed`
  - latest required job failed and live snapshot 없음

### 4-2. Critical Sources

- macro
- market bars
- technical snapshot

optional:

- news
- consensus
- fear_greed

## 5. Validation Matrix

### 5-1. Storage Validation

- migration applies cleanly
- rollback path documented
- unique constraints 검증
- idempotent rerun 검증

### 5-2. Ingestion Validation

- FRED fetch smoke
- market fetch smoke
- fundamentals fetch smoke
- source timestamp write 검증
- fallback flag write 검증

### 5-3. Feature Validation

- feature schema regression
- missing data fallback
- versioned feature snapshot 저장 검증

### 5-4. Signal Validation

- fixed fixture date에서 deterministic 결과
- regime classification fixture
- override fixture
- stale cap fixture

### 5-5. Recommendation Validation

- style별 threshold fixture
- earnings blackout fixture
- liquidity exclusion fixture
- regime watch-only fixture

### 5-6. Delivery Validation

- web/Telegram snapshot parity
- `/signals` mobile layout smoke
- telegram formatting smoke
- admin rerun smoke

## 6. Backtest Metrics

phase 1에서 최소 저장해야 할 지표:

- 1D / 5D / 20D forward return by action bucket
- Buy 이후 평균 성과
- Sell 이후 방어 효과
- Hold 구간 unnecessary entry 억제율
- max drawdown by action bucket
- hit rate

## 7. Required Fixtures

다음 fixture 세트를 만든다.

- `fixtures/macro/`
- `fixtures/market/`
- `fixtures/news/`
- `fixtures/consensus/`
- `fixtures/signal_dates/`

필수 시나리오:

- recovery
- risk-on
- risk-off
- panic
- euphoria
- stale-data
- earnings-blackout

## 8. Promotion Gates

### Gate A: Storage Ready

- DB migration success
- read repository success
- health endpoint success

### Gate B: Ingestion Ready

- 30 영업일 backfill success
- 3회 연속 batch success

### Gate C: Signal Ready

- deterministic fixture pass
- override fixture pass
- recommendation fixture pass

### Gate D: Delivery Ready

- web/Telegram parity pass
- stale/demo/live badge pass
- mobile smoke pass

### Gate E: Operations Ready

- scheduler success
- rerun success
- failure alert success
- dedupe success

### Gate F: AI Ready

- baseline backtest complete
- shadow mode logging complete
- leakage review complete

## 9. Stop Rules

아래 중 하나라도 발생하면 다음 phase로 넘어가지 않는다.

- latest snapshot이 demo인데 live처럼 노출됨
- source stale인데 강한 Buy/Sell 유지
- recommendation run이 snapshotTime parity를 깨뜨림
- rerun이 duplicate row를 생성
- Telegram과 web 결과가 다른 snapshot 기준으로 나감
