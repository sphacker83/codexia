# AI Signal Dashboard - Task Checklist

## Phase 0. Re-baseline Current Shell

- [x] Architecture/Data/Signal/API/Ops spec 문서 추가
- [x] `signals` 기능을 demo fallback으로 재정의
- [x] `SIGNALS_ENABLE_DEMO_MODE` 환경변수 추가
- [x] production mode에서 DB snapshot이 없을 때 fail-closed health 응답 구현
- [x] UI/Telegram에 demo/live/stale 의미를 더 명확히 표기
- [x] 현재 `dev/active/ai-signal-dashboard/*` 문서를 이번 계획 기준으로 유지

## Phase 1. Storage Spine

- [x] PostgreSQL 연결 전략 확정
- [x] `db/migrations/signals/001_init.sql` 작성
- [x] 초기 테이블 생성
  - [x] `signal_assets`
  - [x] `signal_source_runs`
  - [x] `raw_macro_observations`
  - [x] `raw_market_bars`
  - [x] `raw_sentiment_snapshots`
  - [x] `raw_news_items`
  - [x] `raw_consensus_snapshots`
  - [x] `feature_snapshots`
  - [x] `technical_layer_snapshots`
  - [x] `signal_snapshots`
  - [x] `signal_component_scores`
  - [x] `recommendation_runs`
  - [x] `recommendation_items`
  - [x] `notification_events`
  - [x] `pipeline_job_runs`
- [x] Next.js read repository 추가
- [x] `src/application/signals` 를 DB-backed read path로 전환
- [x] health endpoint가 DB 상태를 읽도록 수정

## Phase 2. Python Pipeline Bootstrap

- [ ] `services/ai-signal-pipeline/pyproject.toml` 생성
- [ ] config 모듈 추가
- [ ] ingestion 패키지 추가
- [ ] features 패키지 추가
- [ ] signals 패키지 추가
- [ ] recommendations 패키지 추가
- [ ] jobs 패키지 추가
- [ ] tests 패키지 추가
- [ ] 기본 CLI 엔트리 작성

## Phase 3. Ingestion Jobs

- [ ] FRED 수집기
  - [ ] CPI
  - [ ] Fed Funds
  - [ ] Unemployment
  - [ ] 10Y-2Y spread
- [ ] 가격/기술 데이터 수집기
  - [ ] SPY
  - [ ] QQQ
  - [ ] universe 종목
- [ ] 펀더멘탈 수집기
  - [ ] profitability
  - [ ] free cash flow
  - [ ] leverage
  - [ ] valuation inputs
- [ ] sentiment/news 입력 인터페이스
- [ ] consensus 입력 인터페이스
- [ ] source run logging
- [ ] retry/fallback 정책 구현

## Phase 4. Feature Engineering

- [ ] macro feature set 정의
- [ ] technical feature set 정의
- [ ] sentiment/news feature set 정의
- [ ] feature snapshot writer 구현
- [ ] feature set versioning
- [ ] fixture dataset 생성

## Phase 5. Rule-Based Signal Engine

- [ ] Trend Layer 구현
- [ ] Structure Layer 구현
- [ ] Action Layer 구현
- [ ] Ichimoku Layer 구현
- [ ] Gaussian Layer 구현
- [ ] market regime 분류기 구현
- [ ] SPY composite score 계산기 구현
- [ ] QQQ composite score 계산기 구현
- [ ] hard rule override 구현
- [ ] signal explanation builder 구현

## Phase 6. Recommendation Engine

- [ ] universe snapshot 관리
- [ ] quality score 계산기
- [ ] valuation score 계산기
- [ ] growth score 계산기
- [ ] technical score 계산기
- [ ] liquidity score 계산기
- [ ] risk penalty 계산기
- [ ] style filter 구현
- [ ] recommendation run 저장
- [ ] recommendation explanation 저장

## Phase 7. Delivery Rewire

- [ ] `/api/signals/overview` live DB snapshot read로 전환
- [ ] `/api/signals/recommendations` live DB snapshot read로 전환
- [ ] `/api/signals/assets/[ticker]` live DB snapshot read로 전환
- [ ] `/api/signals/briefing` snapshot 기반 summary builder로 전환
- [ ] `/api/signals/health` source/job health 기반으로 전환
- [ ] `/signals` UI에 보조지표 블록 추가
- [ ] `/signals/[ticker]` UI에 component drilldown 추가
- [ ] Telegram overview/briefing/recommend parity 확인

## Phase 8. Scheduling and Alerting

- [ ] premarket batch job
- [ ] intraday hourly job
- [ ] close batch job
- [ ] stale alert
- [ ] signal regime change alert
- [ ] recommendation enter/exit alert
- [ ] pipeline failure alert
- [ ] notification dedupe

## Phase 9. Validation and Monitoring

- [ ] migration smoke
- [ ] ingestion smoke
- [ ] feature regression fixture
- [ ] signal regression fixture
- [ ] recommendation regression fixture
- [ ] web/Telegram snapshot parity check
- [ ] stale/fallback test
- [ ] 3회 연속 성공 run 확인

## Phase 10. AI / Backtest

- [ ] dataset builder
- [ ] XGBoost baseline
- [ ] LightGBM baseline
- [ ] prediction table
- [ ] backtest report
- [ ] shadow mode recording
- [ ] model versioning

## Gates

- [ ] Gate A: storage ready
- [ ] Gate B: ingestion ready
- [ ] Gate C: signal ready
- [ ] Gate D: delivery ready
- [ ] Gate E: operations ready
- [ ] Gate F: AI ready
