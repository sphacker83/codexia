# AI Signal Dashboard - API & Telegram Contract Spec

## 1. 목적

웹과 Telegram이 같은 snapshot을 보도록 API 계약을 고정한다.

## 2. Canonical Read Model 원칙

- 모든 read endpoint는 `latest snapshot_time` 또는 명시된 `snapshot_time` 기준으로 응답한다.
- 웹과 Telegram은 같은 시각에 같은 endpoint를 읽으면 같은 `snapshot_time` 을 반환해야 한다.
- phase 1에서는 `snapshot_time` 을 응답에 반드시 포함한다.

## 3. Read Endpoints

### 3-1. `GET /api/signals/overview`

query:

- `style`: `conservative|balanced|aggressive`

response:

- `snapshotTime`
- `dataMode`
- `marketRegime`
- `marketLabel`
- `summary`
- `stale`
- `health`
- `benchmarks[]`
- `recommendationPreview[]`
- `availableStyles[]`
- `disclaimer`

`benchmarks[]` 필드:

- `ticker`
- `name`
- `compositeScore`
- `previousScore`
- `action`
- `confidence`
- `regime`
- `components[]`
- `drivers[]`
- `supportingIndicators[]`

### 3-2. `GET /api/signals/recommendations`

query:

- `style`
- `limit`

response:

- `snapshotTime`
- `style`
- `marketRegime`
- `state`
- `stale`
- `items[]`
- `disclaimer`

`items[]`:

- `ticker`
- `name`
- `sector`
- `styleScore`
- `thesis`
- `riskFlags`
- `verdictLabel`
- `drivers`
- `recommendationState`

### 3-3. `GET /api/signals/assets/[ticker]`

query:

- `style`

response:

- `snapshotTime`
- `style`
- `stale`
- `asset`
- `disclaimer`

`asset`:

- `ticker`
- `name`
- `kind`
- `sector`
- `summary`
- `verdictLabel`
- `factorScores`
- `technical`
- `fundamentals`
- `drivers`
- `riskFlags`
- `marketContext`
- `components?`

### 3-4. `GET /api/signals/briefing`

query:

- `style`

response:

- `snapshotTime`
- `style`
- `text`
- `bullets[]`
- `stale`
- `health`
- `disclaimer`

### 3-5. `GET /api/signals/health`

response:

- `snapshotTime`
- `dataMode`
- `stale`
- `health`
- `sources[]`
- `disclaimer`

## 4. Admin Endpoints

phase 1부터 아래 2개를 예약한다.

### 4-1. `POST /api/signals/admin/jobs/run`

body:

- `jobName`
  - `premarket_full`
  - `intraday_hourly`
  - `close_finalize`
  - `weekly_universe_refresh`
- `force`

### 4-2. `GET /api/signals/admin/jobs`

query:

- `limit`

response:

- latest pipeline job runs
- latest source runs

## 5. API Failure Rules

- malformed query: 400
- unknown ticker: 404
- no live snapshot and demo disabled: 503
- internal read failure: 500

## 6. Telegram Command Contract

### 6-1. `/signal`

- `overview` endpoint 사용
- 벤치마크 2개만 요약
- health summary 1줄 포함

### 6-2. `/briefing`

- `briefing` endpoint 사용
- 최대 bullet 4개

### 6-3. `/recommend [count]`

- `recommendations` endpoint 사용
- `count` 기본 5, 최대 10

### 6-4. `/asset <ticker>`

- `asset` endpoint 사용
- ticker는 uppercase normalize

### 6-5. `/style <value>`

- chat별 preference 저장
- 값
  - `conservative`
  - `balanced`
  - `aggressive`

## 7. Telegram Formatting Rules

- 첫 줄에 `demo`, `stale`, `snapshotTime` 노출
- 결론부터 먼저
- 리스크는 최대 3개
- 투자주의 문구 1줄 고정
- 웹과 의미가 다른 축약을 만들지 않는다.

## 8. Web UI Contract

### 8-1. `/signals`

상단:

- SPY / QQQ 현재 score
- action
- regime
- snapshotTime

중단:

- component breakdown
- recommendation table

하단:

- VIX / Fear & Greed / curve / health source 상태

### 8-2. `/signals/[ticker]`

- factor scores
- technical detail
- fundamentals detail
- market context
- risk flags

## 9. Snapshot Parity Rule

다음은 항상 일치해야 한다.

- `/signals` 상단 기준 시각
- `/signal` 기준 시각
- `/briefing` 기준 시각
- `/recommend` 에서 참조한 recommendation run 시각

같은 시각에 다르면 버그로 본다.
