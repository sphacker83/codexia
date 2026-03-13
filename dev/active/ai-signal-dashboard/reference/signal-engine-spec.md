# AI Signal Dashboard - Signal Engine Spec

## 1. 목적

이 문서는 시그널 공식과 추천 공식의 기준선을 고정한다.  
phase 1은 AI가 아니라 **룰 기반 기준선** 이며, AI는 phase 6에서 shadow mode로만 추가한다.

## 2. Market Signal 대상

- `SPY`
- `QQQ`

## 3. Composite 구조

최종 Composite Score는 아래 가중합으로 계산한다.

- Macro Score: 35
- Technical Structure Score: 40
- Sentiment Score: 15
- News / Consensus Score: 10

공식:

```text
composite =
  macro_score * 0.35 +
  technical_score * 0.40 +
  sentiment_score * 0.15 +
  news_consensus_score * 0.10
```

최종 score는 `round(소수점 2자리)` 로 저장한다.

## 4. Action Mapping

override 적용 전 기준:

- `>= 85`: `Strong Buy`
- `70 ~ 84.99`: `Buy`
- `45 ~ 69.99`: `Hold`
- `30 ~ 44.99`: `Sell`
- `< 30`: `Strong Sell`

override는 score를 바꾸지 않고 `final_action` 의 상한/하한을 조정한다.

## 5. Regime Classification

레짐은 아래 precedence로 판정한다.

### Panic

모두 만족:

- `vix_score <= 20`
- `trend_layer <= 35`
- `structure_layer <= 35`

### Risk-Off

아래 중 2개 이상:

- `macro_score < 45`
- `trend_layer < 45`
- `vix_score <= 35`
- `news_sentiment_score < 40`

### Euphoria

모두 만족:

- `sentiment_score >= 85`
- `technical_score >= 80`
- `gaussian_layer <= 35` 는 아님
- `price_extension_flag = true`

### Recovery

모두 만족:

- 직전 snapshot 대비 composite 상승
- `trend_layer >= 55`
- `structure_layer >= 55`
- `vix_score >= 50`

### Risk-On

모두 만족:

- `macro_score >= 55`
- `technical_score >= 70`
- `sentiment_score >= 65`

### Neutral

- 나머지 전부

## 6. Macro Score

Macro Score는 아래 4개 하위 점수 평균이 아니라 가중합이다.

- Inflation Direction: 30
- Policy Stance: 30
- Labor Resilience: 20
- Curve / Growth Stress: 20

### 6-1. Inflation Direction

입력:

- `cpi_yoy`
- `cpi_yoy_3m_delta`

점수:

- `cpi_yoy <= 2.5` and `delta < 0`: 100
- `cpi_yoy <= 3.5` and `delta <= 0`: 80
- `cpi_yoy <= 4.5`: 55
- `cpi_yoy <= 6.0`: 30
- else: 10

### 6-2. Policy Stance

입력:

- `fed_funds`
- `fed_funds_3m_delta`

점수:

- 금리 인하 중이거나 동결 + 하락 전환 신호: 80~100
- 동결 장기화: 55
- 인상 재개: 20~40

구체 공식:

- `delta <= -0.25`: 90
- `-0.25 < delta <= 0.00`: 70
- `0.00 < delta <= 0.25`: 45
- `delta > 0.25`: 20

### 6-3. Labor Resilience

입력:

- `unrate`
- `unrate_3m_delta`

점수:

- `unrate <= 4.2` and `delta <= 0.1`: 85
- `unrate <= 4.8` and `delta <= 0.2`: 65
- `unrate <= 5.5`: 40
- else: 20

### 6-4. Curve / Growth Stress

입력:

- `t10y2y`

점수:

- `>= 0.50`: 85
- `0.00 ~ 0.49`: 70
- `-0.50 ~ -0.01`: 40
- `< -0.50`: 15

## 7. Technical Structure Score

Technical Score는 아래 가중합으로 계산한다.

- Trend Layer: 25
- Structure Layer: 25
- Action Layer: 20
- Ichimoku Layer: 15
- Gaussian Layer: 15

### 7-1. Trend Layer

입력:

- EMA20, EMA50, EMA100
- slope_20
- close position vs EMA20/50/100

점수 규칙:

- EMA20 > EMA50 > EMA100 and all slopes positive: 90
- EMA20 > EMA50 and close > EMA50: 75
- mixed alignment: 50
- EMA20 < EMA50 < EMA100 and close < EMA50: 20

### 7-2. Structure Layer

입력:

- 최근 swing high/low
- BOS 여부
- MSS 여부
- liquidity sweep flag
- FVG open/filled state

점수 규칙:

- bullish BOS + no bearish MSS + discount zone hold: 85
- mixed structure: 50
- bearish MSS + premium rejection + unresolved downside FVG: 15

### 7-3. Action Layer

입력:

- 지지/저항 반응
- breakout/retest 성공 여부
- 종가 위치
- upper/lower wick ratio

점수 규칙:

- breakout 후 retest 성공 + 상단 종가: 85
- 레인지 중앙: 50
- 실패 돌파 + 하단 종가: 20

### 7-4. Ichimoku Layer

입력:

- close vs cloud
- tenkan vs kijun
- chikou alignment
- forward cloud direction

점수 규칙:

- cloud 상단 + TK bullish + chikou clean: 85
- cloud 내부: 50
- cloud 하단 + TK bearish: 20

### 7-5. Gaussian Layer

입력:

- 25일 gaussian centerline
- zscore distance from center
- centerline slope

점수 규칙:

- 상승 slope + 적정 괴리: 75
- 과열 zone: 45
- 하락 slope + 하방 이탈: 20

## 8. Sentiment Score

하위 구성:

- VIX score: 60
- Fear & Greed score: 40

### 8-1. VIX Score

- `VIX < 16`: 85
- `16 <= VIX < 22`: 65
- `22 <= VIX < 30`: 40
- `VIX >= 30`: 15

### 8-2. Fear & Greed Score

- `>= 70`: 80
- `50 ~ 69`: 65
- `30 ~ 49`: 45
- `< 30`: 20

### 8-3. Missing Rule

- Fear & Greed source unavailable 시 VIX만 사용
- component 내부 weight를 100으로 재정규화
- health source status를 `degraded` 로 표시

## 9. News / Consensus Score

하위 구성:

- news sentiment: 70
- analyst consensus: 30

### 9-1. News Sentiment

- 기사별 sentiment 평균
- 최근 48시간 기사만 포함
- ticker relevance 필터 적용

점수:

- avg >= 0.35: 80
- `0.10 ~ 0.34`: 65
- `-0.09 ~ 0.09`: 50
- `-0.34 ~ -0.10`: 35
- `< -0.35`: 15

### 9-2. Analyst Consensus

입력:

- buy/hold/sell 비율
- 최근 30일 변화

점수:

- buy majority and positive revision: 75
- hold majority: 50
- sell majority or negative revision: 25

### 9-3. Missing Rule

- consensus unavailable 시 news only 재정규화
- source status `degraded`

## 10. Hard Rule Override

override는 아래 우선순위로 평가한다.

### O1. Stale Cap

- critical source stale면 `Strong Buy` 금지
- 결과 상한: `Hold`

### O2. Bearish Structure Cap

조건:

- `structure_layer <= 30`
- `ichimoku_layer <= 35`
- `vix_score <= 35`

결과:

- `Buy/Strong Buy` 상한을 `Hold` 로 낮춤

### O3. Extreme Risk Sell

조건:

- `structure_layer <= 20`
- `action_layer <= 20`
- `sentiment_score <= 20`

결과:

- 최소 `Sell`

### O4. Earnings Blackout for Recommendations

- `earningsInDays < style.minNextEarningsDays`
- conservative/balanced는 추천 제외

### O5. Liquidity Floor

- `avgDailyDollarVolumeM < 500`
- 모든 스타일 추천 제외

## 11. Recommendation Formula

최종 style score:

```text
style_score =
  quality * 0.25 +
  valuation * 0.20 +
  growth * 0.15 +
  technical * 0.25 +
  liquidity * 0.15 -
  risk_penalty
```

`0~100` 로 clamp 한다.

### 11-1. Quality

- profitability 35
- free cash flow 35
- leverage 20
- dilution stability 10

### 11-2. Valuation

- earnings yield percentile 40
- ev/fcf percentile 40
- p/s sanity cap 20

### 11-3. Growth

- revenue growth 40
- eps growth 40
- revision trend 20

### 11-4. Technical

- same engine technical score 사용

### 11-5. Liquidity

- avg daily dollar volume percentile

### 11-6. Risk Penalty

- earnings event proximity
- leverage excess
- volatility excess
- valuation extreme extension

## 12. Style Filter

### Conservative

- `style_score >= 68`
- `quality >= 72`
- `liquidity >= 70`
- `risk_penalty <= 26`
- `debt_to_ebitda <= 3`
- `earningsInDays >= 10`
- profitable required
- positive FCF required

### Balanced

- `style_score >= 63`
- `quality >= 64`
- `liquidity >= 60`
- `risk_penalty <= 32`
- `debt_to_ebitda <= 4`
- `earningsInDays >= 5`
- profitable required
- positive FCF required

### Aggressive

- `style_score >= 58`
- `quality >= 55`
- `liquidity >= 50`
- `risk_penalty <= 38`
- `debt_to_ebitda <= 6`
- earnings blackout 없음

## 13. Recommendation State by Regime

- `Panic`: `watch-only`
- `Risk-Off`: `trimmed`
- else: `buy-ready`

출력 개수:

- `watch-only`: 최대 3
- `trimmed`: style limit - 1
- `buy-ready`: style limit

## 14. Determinism Rules

- 같은 raw input + same engine version이면 동일 결과가 나와야 한다.
- source missing fallback 여부도 score detail에 포함한다.
- 모든 score는 `details_json` 또는 `explanation_json`에 근거를 남긴다.
