# AI Signal Dashboard - Detailed Implementation Plan

## Executive Summary

현재 `codexia`에 들어간 `signals` 기능은 **demo snapshot을 읽어 웹/Telegram에 노출하는 UI 셸** 수준이다.  
`docs/ai_signal_dashboard_plan.docx`가 요구하는 실제 시스템은 다음이 모두 있어야 한다.

- 실데이터 수집
- 피처 엔지니어링
- 룰/AI 시그널 엔진
- 영속 저장소
- 운영 배치/모니터링
- 알림/변화 감지
- 검증과 백테스트

따라서 다음 구현은 “기존 화면 개선”이 아니라, **현재 셸을 유지한 채 실제 파이프라인과 저장소를 아래에서부터 채우는 작업**으로 정의한다.

핵심 방향은 아래와 같다.

1. `codexia`는 **전달 표면**으로 유지한다.
   - 웹 대시보드
   - Telegram 명령/알림
   - 읽기 전용 API/BFF
2. 무거운 계산과 수집은 **별도 Python pipeline** 으로 분리한다.
3. source of truth는 JSON이 아니라 **PostgreSQL** 로 옮긴다.
4. 현재 demo 구현은 없애지 않고 **개발용 fallback shell** 로만 남긴다.
5. AI는 뒤에 붙이고, 먼저 **룰 기반 기준선 + 백테스트 가능한 저장 구조** 를 만든다.

## Current State Assessment

### 이미 있는 것

- `/signals`, `/signals/[ticker]` 웹 화면
- `/api/signals/*` read API
- Telegram `/signal`, `/briefing`, `/recommend`, `/asset`, `/style`
- 스타일별 필터 개념
- demo/stale/health 노출
- demo snapshot 기반 시연 흐름

### 실제로 없는 것

- 실데이터 수집기
- DB/시계열 저장소
- 피처 스냅샷
- Technical Structure 엔진
- Macro/Sentiment/News 점수화
- Hard Rule Override
- 추천 종목 랭킹의 실데이터 기반 근거
- 배치 실행기/스케줄러
- 운영 모니터링/알림 이력
- 검증/백테스트/모델 버전 관리

### 결론

현재 구현은 **UI mock이 아니라 계약용 shell** 로 취급한다.  
다음 구현 단계에서는 이 셸을 유지하되, 데이터 소스와 계산 엔진을 실체화하는 쪽으로 진행한다.

## Target Architecture

### Delivery Surface

- Next.js 앱(`app/`, `src/presentation`, `src/application/signals`)
- 역할
  - 최신 시그널 조회
  - 상세 종목 조회
  - Telegram 명령 응답
  - 운영용 재실행/헬스 조회
- 주의
  - Next.js는 계산 엔진이 아니다.
  - 실시간 계산/백필/특징량 생성 책임을 가지지 않는다.

### Signal Compute Surface

- 새 디렉터리: `services/ai-signal-pipeline/`
- 언어: Python 3.12
- 패키지 관리: `uv`
- 책임
  - 외부 데이터 수집
  - Raw 저장
  - 정제/결측치 처리
  - 피처 엔지니어링
  - 룰 기반 시그널 계산
  - 추천 종목 랭킹 계산
  - 향후 AI 모델 학습/추론
  - 배치 실행 로그 기록

### Storage Surface

- 새 디렉터리: `db/migrations/signals/`
- DB: PostgreSQL
- 선택 확장: TimescaleDB는 Phase 2 이후 판단
- 원칙
  - migration은 SQL 파일로 관리한다.
  - Python pipeline과 Next.js는 같은 DB를 사용한다.
  - Next.js는 읽기 위주, pipeline은 쓰기 위주로 나눈다.

### Data Flow

1. 외부 수집기 실행
2. Raw 테이블 적재
3. 정제/유효성 검증
4. Feature snapshot 생성
5. Market signal 계산(SPY/QQQ)
6. Recommendation run 계산(후보 universe)
7. Override 적용
8. 최종 결과 저장
9. 변화 감지 알림 발송
10. Next.js/Telegram이 최신 snapshot을 조회

## Proposed Repo Layout

```text
services/
  ai-signal-pipeline/
    pyproject.toml
    src/ai_signal_pipeline/
      config/
      ingestion/
      features/
      signals/
      recommendations/
      notifications/
      jobs/
      backtest/
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
  signals/
```

## Data Model (Initial)

다음 테이블을 phase 1에서 고정한다.

- `signal_assets`
  - ticker, asset_type, name, sector, universe_flags
- `signal_source_runs`
  - source_name, run_type, started_at, finished_at, status, error_message, payload_meta
- `raw_macro_observations`
  - series_key, observation_date, value, source_timestamp
- `raw_market_bars`
  - ticker, timeframe, bar_time, open, high, low, close, volume, source_timestamp
- `raw_sentiment_snapshots`
  - source_key, snapshot_time, value_json, source_timestamp
- `raw_news_items`
  - item_id, ticker, published_at, title, sentiment_score, source_timestamp
- `raw_consensus_snapshots`
  - ticker, snapshot_time, rating_summary, revision_summary, source_timestamp
- `feature_snapshots`
  - ticker, snapshot_time, feature_set_version, features_json
- `technical_layer_snapshots`
  - ticker, snapshot_time, trend_score, structure_score, action_score, ichimoku_score, gaussian_score, details_json
- `signal_snapshots`
  - ticker, snapshot_time, composite_score, market_regime, final_action, override_applied, explanation_json
- `signal_component_scores`
  - snapshot_id, component_key, score, weight, explanation
- `recommendation_runs`
  - snapshot_time, style, market_regime, state, universe_count, selected_count
- `recommendation_items`
  - run_id, ticker, rank, style_score, thesis_json, risk_flags_json
- `notification_events`
  - event_type, snapshot_time, delivery_channel, delivery_status, payload_json
- `pipeline_job_runs`
  - job_name, scheduled_for, started_at, finished_at, status, metrics_json

## Signal Engine Scope

### Market Signal (SPY / QQQ)

- Composite Score = `Macro 35 / Technical 40 / Sentiment 15 / News-Consensus 10`
- Final outputs
  - composite score 0~100
  - regime
  - action (`Strong Buy`, `Buy`, `Hold`, `Sell`, `Strong Sell`)
  - component breakdown
  - override 여부
  - explanation summary

### Technical Structure Engine

다음 5개 하위 레이어를 반드시 별도 함수/모듈로 분리한다.

- Trend Layer
  - 추세 방향, slope, moving average alignment
- Structure Layer
  - BOS, MSS, swing high/low, liquidity sweep, FVG
- Action Layer
  - 지지/저항 반응, breakout/retest, close location
- Ichimoku Layer
  - cloud position, TK relation, lagging span, forward cloud
- Gaussian Layer
  - 25일 centerline deviation, slope, residual band

각 레이어는 `0~100 score + detail json` 을 저장한다.

### Recommendation Engine

- universe
  - 1차: SPY/QQQ 기반 대형주 universe
- 필수 score
  - quality
  - valuation
  - growth
  - technical
  - liquidity
  - risk penalty
- style
  - conservative
  - balanced
  - aggressive
- style는 **공식이 아니라 컷오프와 필터 강도** 를 바꾼다.
- 시장 레짐이 `Risk-Off` 또는 `Panic`이면 recommendation state를 축소/관찰 모드로 전환한다.

### Hard Rule Override

다음은 phase 3 전까지 placeholder로 두지 않고 반드시 구현한다.

- stale data면 강한 액션 차단
- 구조 약세 + 변동성 급등 + 약세 캔들 조합이면 Buy 상한 제한
- earnings blackout window 진입 종목은 conservative 추천 제외
- liquidity floor 미달 종목은 전 스타일 제외

## Implementation Phases

### Phase 0. Re-baseline the Current Shell

목표: 현재 demo 구현을 “진짜 시스템으로 오해되지 않는 상태”로 재정의한다.

- current `signals` 기능을 `demo fallback` 으로 명시
- `SIGNALS_ENABLE_DEMO_MODE` 환경변수 추가
- 운영 모드에서는 DB snapshot이 없으면 빈 성공 응답이 아니라 명시적 health failure를 반환
- Dev Docs를 현재 문서 기준으로 다시 고정

Acceptance:

- demo mode off 상태에서 실데이터 저장소가 없으면 health가 실패로 보인다.
- UI/Telegram이 demo/live를 명확히 구분한다.

### Phase 1. Storage Spine First

목표: 실데이터를 담을 DB 구조와 읽기 계층을 먼저 만든다.

- PostgreSQL 접속 모듈 추가
- `db/migrations/signals/001_init.sql` 작성
- Next.js read repository 추가
- `src/application/signals` 를 DB-backed read path로 교체
- 현재 JSON snapshot 서비스는 `demo fallback` 경로로만 유지

Acceptance:

- DB migration 적용 가능
- `GET /api/signals/health` 가 DB 상태를 반환
- demo fallback 없이도 빈 snapshot/헬스 응답 구조가 유지됨

### Phase 2. Raw Ingestion and Feature Snapshot Backbone

목표: 문서의 데이터 파이프라인을 실제로 시작한다.

- Python 프로젝트 초기화
- FRED 수집기
- 가격/기술 데이터 수집기
- 펀더멘탈 수집기
- sentiment/news 수집기 인터페이스
- source run logging
- raw -> cleaned -> feature snapshot 흐름 구현

Acceptance:

- 최소 30 영업일 backfill 가능
- 같은 입력으로 feature snapshot이 재현 가능
- 수집 실패/부분 성공/전일 fallback 상태가 DB에 기록됨

### Phase 3. Rule-Based Signal Engine

목표: AI 전 단계의 기준선을 완성한다.

- SPY/QQQ market signal 계산기
- 5-layer technical engine
- sentiment/news score
- composite score
- hard rule override
- recommendation engine

Acceptance:

- fixture 날짜 기준으로 SPY/QQQ 결과가 deterministic
- component score 합산과 final action이 설명 가능
- recommendation run 결과가 DB에 저장됨

### Phase 4. Delivery Surface Rewire

목표: 현재 UI/Telegram을 demo가 아닌 DB snapshot 기반으로 전환한다.

- `/api/signals/*` 를 live DB snapshot 조회로 전환
- `/signals` 에 상단 카드/구성 점수/보조지표/헬스 상태 고정
- `/signals/[ticker]` 에 factor/technical/fundamental drilldown 추가
- Telegram 명령이 같은 snapshot id를 사용하도록 정렬
- daily briefing / change alert format 확정

Acceptance:

- 같은 시각에 웹/Telegram 결과가 동일 snapshot id를 참조
- stale 상태와 source 상태가 동일하게 보인다.
- mobile 10초 스캔 UX가 성립한다.

### Phase 5. Jobs, Monitoring, Alerting

목표: 수동 실행이 아니라 운영 가능한 시스템으로 만든다.

- Python CLI job runner
- premarket / intraday / close batch job
- pipeline metrics 저장
- stale/failed alert 발송
- 관리자용 rerun/rebuild endpoint
- notification dedupe

Acceptance:

- 배치 스케줄 3종이 수동/자동 모두 실행 가능
- 실패 시 health와 Telegram 에러 알림이 남는다.
- source stale이 UI와 Telegram에 반영된다.

### Phase 6. AI and Backtest

목표: 문서의 Macro AI를 실제 검증 가능한 형태로 추가한다.

- 학습용 dataset builder
- XGBoost/LightGBM baseline
- prediction table 추가
- backtest 리포트 생성
- model versioning
- shadow mode로 production score와 병행 기록

Acceptance:

- 룰 기반 결과와 AI 결과를 같은 기간에서 비교 가능
- model version / feature set version / training range 추적 가능
- benchmark 통과 전까지 user-facing action은 AI-only로 바뀌지 않는다.

## Validation and Gates

### Gate A - Storage Ready

- migration 성공
- DB-backed health endpoint 동작
- demo off 시 fail-closed 동작

### Gate B - Ingestion Ready

- 30일 backfill 완료
- 3회 연속 성공 run
- source timestamp / fallback 기록 확인

### Gate C - Signal Ready

- SPY/QQQ deterministic regression fixture 통과
- recommendation fixture 통과
- override fixture 통과

### Gate D - Delivery Ready

- 웹/Telegram snapshot parity 확인
- stale/demo/live badge 일관성 확인
- mobile viewport 수동 검증

### Gate E - Operations Ready

- 스케줄 실행
- 실패 알림
- rerun 가능
- job log 확인

### Gate F - AI Ready

- backtest baseline 생성
- feature leakage 점검
- shadow mode 기록

## Explicit Non-Goals

- 자동 주문
- 증권사 체결 연동
- 포지션 관리 자동화
- 사용자 포트폴리오 자동 리밸런싱

## Recommended Immediate Next Slice

다음 구현 세션은 **Phase 0 + Phase 1** 만 끝내는 것을 목표로 한다.

- 현재 demo shell을 feature-flagged fallback으로 격하
- PostgreSQL schema 추가
- DB-backed `health` 와 `latest snapshot read` 뼈대 추가
- demo JSON 의존을 기본 경로에서 제거

이 4개가 끝나야 이후 수집기/엔진 작업이 “붙일 자리”를 갖는다.
