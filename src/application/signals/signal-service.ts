import {
  SIGNAL_STYLE_OPTIONS,
  type AssetDetailResponse,
  type BenchmarkSignalSnapshot,
  type OverviewBenchmarkResponse,
  type RecommendationCandidateSnapshot,
  type RecommendationItemResponse,
  type RecommendationPreviewResponse,
  type SignalAssetResponse,
  type SignalBriefingResponse,
  type SignalConfidence,
  type SignalHealthBlockResponse,
  type SignalHealthResponse,
  type SignalHealthSnapshot,
  type SignalSnapshot,
  type SignalStyle,
  type SignalsOverviewResponse,
  type SignalRecommendationsResponse,
} from "@/src/core/signals/types";
import { loadSignalSnapshot } from "@/src/infrastructure/signals/snapshot-store";

const STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000;
const SIGNAL_DISCLAIMER =
  "이 기능은 자동매매가 아닌 판단 보조용입니다. 현재 응답은 snapshot 기준이며, 최종 투자 판단은 사용자 책임입니다.";

export function resolveSignalStyle(raw: string | null | undefined): SignalStyle {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "balanced" || normalized === "aggressive") {
    return normalized;
  }
  return "conservative";
}

function getStyleConfig(style: SignalStyle) {
  return SIGNAL_STYLE_OPTIONS.find((item) => item.value === style) ?? SIGNAL_STYLE_OPTIONS[0];
}

function isSnapshotStale(snapshot: SignalSnapshot): boolean {
  if (snapshot.stale) {
    return true;
  }
  const timestamp = Date.parse(snapshot.generatedAt);
  if (!Number.isFinite(timestamp)) {
    return true;
  }
  return Date.now() - timestamp > STALE_THRESHOLD_MS;
}

function toHealthBlock(snapshot: SignalSnapshot): SignalHealthBlockResponse {
  const stale = isSnapshotStale(snapshot);
  const health: SignalHealthSnapshot = snapshot.health;
  return {
    status: stale && snapshot.snapshotMode !== "demo" ? "stale" : health.status,
    summary:
      stale && snapshot.snapshotMode !== "demo"
        ? `${health.summary} snapshot이 오래되어 추천 강도가 자동으로 낮아졌습니다.`
        : health.summary,
    sources: health.sources,
  };
}

function computeStyleScore(candidate: RecommendationCandidateSnapshot): number {
  const weighted =
    candidate.qualityScore * 0.25 +
    candidate.valuationScore * 0.2 +
    candidate.growthScore * 0.15 +
    candidate.technicalScore * 0.25 +
    candidate.liquidityScore * 0.15;
  return Math.round((weighted - candidate.riskPenalty) * 10) / 10;
}

function getRecommendationState(snapshot: SignalSnapshot): "buy-ready" | "watch-only" {
  if (snapshot.marketRegime === "Panic" || snapshot.marketRegime === "Risk-Off") {
    return "watch-only";
  }
  return "buy-ready";
}

function passesStyleProfile(candidate: RecommendationCandidateSnapshot, style: SignalStyle): boolean {
  const config = getStyleConfig(style);
  const earningsBuffer = candidate.earningsInDays ?? Number.POSITIVE_INFINITY;

  return (
    computeStyleScore(candidate) >= config.minScore &&
    candidate.qualityScore >= config.minQualityScore &&
    candidate.liquidityScore >= config.minLiquidityScore &&
    100 - candidate.riskPenalty >= config.maxRiskPenalty &&
    candidate.debtToEbitda <= config.maxDebtToEbitda &&
    earningsBuffer >= config.minNextEarningsDays &&
    (!config.requirePositiveFreeCashFlow || candidate.positiveFreeCashFlow) &&
    (!config.requireProfitability || candidate.isProfitable)
  );
}

function resolveConfidence(score: number, stale: boolean): SignalConfidence {
  if (stale) {
    return score >= 80 ? "medium" : "low";
  }
  if (score >= 80) {
    return "high";
  }
  if (score >= 68) {
    return "medium";
  }
  return "low";
}

function mapOverviewBenchmark(
  benchmark: BenchmarkSignalSnapshot,
  stale: boolean,
): OverviewBenchmarkResponse {
  return {
    ticker: benchmark.ticker,
    name: benchmark.name,
    score: benchmark.score,
    previousScore: benchmark.previousScore,
    confidence: resolveConfidence(benchmark.score, stale),
    action: benchmark.verdictLabel,
    verdictLabel: benchmark.verdictLabel,
    regime: benchmark.regimeLabel,
    summary: benchmark.summary,
    priceChange1d: benchmark.priceChange1d,
    components: benchmark.components,
    drivers: benchmark.drivers.map((item) => item.detail),
    supportingIndicators: [
      {
        label: "신뢰도",
        value: resolveConfidence(benchmark.score, stale),
        tone: resolveConfidence(benchmark.score, stale) === "high" ? "positive" : "neutral",
      },
      {
        label: "1D 변동",
        value: `${benchmark.priceChange1d.toFixed(1)}%`,
        tone: benchmark.priceChange1d >= 0 ? "positive" : "negative",
      },
    ],
  };
}

function mapRecommendation(
  candidate: RecommendationCandidateSnapshot,
  style: SignalStyle,
  snapshot: SignalSnapshot,
): RecommendationItemResponse {
  const state = getRecommendationState(snapshot);
  const styleConfig = getStyleConfig(style);
  return {
    ticker: candidate.ticker,
    name: candidate.name,
    sector: candidate.sector,
    styleScore: computeStyleScore(candidate),
    thesis: candidate.thesis.join(" / "),
    riskFlags:
      state === "watch-only"
        ? ["시장 레짐이 약세라 관찰 후보만 노출합니다.", ...candidate.riskFlags]
        : candidate.riskFlags,
    verdictLabel: state === "watch-only" ? `${styleConfig.label} 관찰` : `${styleConfig.label} ${candidate.verdictLabel}`,
    drivers: candidate.drivers.map((item) => item.detail),
    qualityScore: candidate.qualityScore,
    valuationScore: candidate.valuationScore,
    growthScore: candidate.growthScore,
    technicalScore: candidate.technicalScore,
    liquidityScore: candidate.liquidityScore,
    riskPenalty: candidate.riskPenalty,
    recommendationState: state,
  };
}

function toRecommendationPreview(item: RecommendationItemResponse): RecommendationPreviewResponse {
  return {
    ticker: item.ticker,
    name: item.name,
    sector: item.sector,
    styleScore: item.styleScore,
    thesis: item.thesis,
    riskFlags: item.riskFlags,
    verdictLabel: item.verdictLabel,
  };
}

function sortCandidates(style: SignalStyle, snapshot: SignalSnapshot): RecommendationCandidateSnapshot[] {
  return [...snapshot.candidates]
    .filter((candidate) => passesStyleProfile(candidate, style))
    .sort((left, right) => computeStyleScore(right) - computeStyleScore(left));
}

function buildAssetDetail(
  snapshot: SignalSnapshot,
  style: SignalStyle,
  benchmark: BenchmarkSignalSnapshot | undefined,
  candidate: RecommendationCandidateSnapshot | undefined,
): AssetDetailResponse {
  if (candidate) {
    const recommendation = mapRecommendation(candidate, style, snapshot);
    return {
      ticker: candidate.ticker,
      name: candidate.name,
      kind: "equity",
      sector: candidate.sector,
      summary: candidate.summary,
      verdictLabel: recommendation.verdictLabel,
      drivers: recommendation.drivers,
      riskFlags: recommendation.riskFlags,
      factorScores: {
        quality: candidate.qualityScore,
        valuation: candidate.valuationScore,
        growth: candidate.growthScore,
        technical: candidate.technicalScore,
        liquidity: candidate.liquidityScore,
        style: recommendation.styleScore,
      },
      technical: {
        relativeStrengthPct: candidate.relativeStrengthPct,
        setup: `기술 점수 ${candidate.technicalScore} / ${candidate.verdictLabel}`,
        support: "seed snapshot 기준 별도 계산 없음",
        resistance: "seed snapshot 기준 별도 계산 없음",
      },
      fundamentals: {
        profitability: candidate.profitability,
        freeCashFlow: candidate.freeCashFlow,
        debtToEbitda: candidate.debtToEbitda,
        earningsInDays: candidate.earningsInDays,
        avgDailyDollarVolumeM: candidate.avgDailyDollarVolumeM,
      },
      marketContext: {
        marketRegime: snapshot.marketRegime,
        marketLabel: snapshot.marketRegime,
        state: getRecommendationState(snapshot),
        note: snapshot.summary,
      },
    };
  }

  const targetBenchmark = benchmark as BenchmarkSignalSnapshot;
  return {
    ticker: targetBenchmark.ticker,
    name: targetBenchmark.name,
    kind: "benchmark",
    summary: targetBenchmark.summary,
    verdictLabel: targetBenchmark.verdictLabel,
    drivers: targetBenchmark.drivers.map((item) => item.detail),
    riskFlags: [],
    factorScores: Object.fromEntries(
      targetBenchmark.components.map((component) => [component.id, component.score]),
    ),
    technical: {
      relativeStrengthPct: targetBenchmark.score,
      setup: targetBenchmark.summary,
      support: "-",
      resistance: "-",
    },
    fundamentals: {
      profitability: "ETF benchmark",
      freeCashFlow: "N/A",
      debtToEbitda: 0,
      earningsInDays: null,
      avgDailyDollarVolumeM: 0,
    },
    marketContext: {
      marketRegime: snapshot.marketRegime,
      marketLabel: snapshot.marketRegime,
      state: getRecommendationState(snapshot),
      note: snapshot.summary,
    },
    components: targetBenchmark.components,
  };
}

function resolveDisclaimer(snapshot: SignalSnapshot): string {
  return snapshot.disclaimer || SIGNAL_DISCLAIMER;
}

export async function getSignalOverview(style: SignalStyle): Promise<SignalsOverviewResponse> {
  const snapshot = await loadSignalSnapshot();
  const stale = isSnapshotStale(snapshot);
  const candidates = sortCandidates(style, snapshot)
    .slice(0, getStyleConfig(style).candidateLimit)
    .map((candidate) => mapRecommendation(candidate, style, snapshot));

  return {
    style,
    dataMode: snapshot.snapshotMode,
    generatedAt: snapshot.generatedAt,
    marketRegime: snapshot.marketRegime,
    marketLabel: snapshot.marketRegime,
    stale,
    summary: snapshot.summary,
    benchmarks: snapshot.benchmarks.map((benchmark) => mapOverviewBenchmark(benchmark, stale)),
    recommendationPreview: candidates.map(toRecommendationPreview),
    health: toHealthBlock(snapshot),
    disclaimer: resolveDisclaimer(snapshot),
    availableStyles: SIGNAL_STYLE_OPTIONS,
  };
}

export async function getSignalsOverview(style: SignalStyle): Promise<SignalsOverviewResponse> {
  return getSignalOverview(style);
}

export async function getSignalRecommendations(
  style: SignalStyle,
  limit?: number,
): Promise<SignalRecommendationsResponse> {
  const snapshot = await loadSignalSnapshot();
  const nextLimit = Math.min(limit ?? getStyleConfig(style).candidateLimit, getStyleConfig(style).candidateLimit);
  return {
    style,
    dataMode: snapshot.snapshotMode,
    generatedAt: snapshot.generatedAt,
    marketRegime: snapshot.marketRegime,
    state: getRecommendationState(snapshot),
    stale: isSnapshotStale(snapshot),
    items: sortCandidates(style, snapshot).slice(0, nextLimit).map((candidate) => mapRecommendation(candidate, style, snapshot)),
    disclaimer: resolveDisclaimer(snapshot),
  };
}

export async function getSignalAsset(
  style: SignalStyle,
  ticker: string,
): Promise<SignalAssetResponse | null> {
  const snapshot = await loadSignalSnapshot();
  const normalizedTicker = ticker.trim().toUpperCase();
  const benchmark = snapshot.benchmarks.find((item) => item.ticker.toUpperCase() === normalizedTicker);
  const candidate = snapshot.candidates.find((item) => item.ticker.toUpperCase() === normalizedTicker);

  if (!benchmark && !candidate) {
    return null;
  }

  return {
    style,
    dataMode: snapshot.snapshotMode,
    generatedAt: snapshot.generatedAt,
    stale: isSnapshotStale(snapshot),
    asset: buildAssetDetail(snapshot, style, benchmark, candidate),
    disclaimer: resolveDisclaimer(snapshot),
  };
}

export async function getSignalAssetDetail(
  style: SignalStyle,
  ticker: string,
): Promise<SignalAssetResponse | null> {
  return getSignalAsset(style, ticker);
}

export async function getSignalBriefing(style: SignalStyle): Promise<SignalBriefingResponse> {
  const overview = await getSignalOverview(style);
  const topNames = overview.recommendationPreview.slice(0, 3).map((item) => item.ticker).join(", ");

  return {
    style,
    dataMode: overview.dataMode,
    generatedAt: overview.generatedAt,
    stale: overview.stale,
    text: [
      `레짐: ${overview.marketLabel}`,
      `요약: ${overview.summary}`,
      `대표 ETF: ${overview.benchmarks.map((item) => `${item.ticker} ${item.action} ${item.score}`).join(" / ")}`,
      `상위 후보: ${topNames || "없음"}`,
    ].join("\n"),
    bullets: [
      `시장 레짐은 ${overview.marketLabel}입니다.`,
      `현재 스타일은 ${getStyleConfig(style).label}입니다.`,
      overview.recommendationPreview.length > 0
        ? `상위 후보는 ${overview.recommendationPreview.slice(0, 3).map((item) => item.ticker).join(", ")} 입니다.`
        : "현재 조건을 통과한 추천 후보가 없습니다.",
      overview.stale ? "snapshot이 오래되어 강한 액션은 억제됩니다." : "snapshot 신선도는 정상 범위입니다.",
    ],
    health: overview.health,
    disclaimer: overview.disclaimer,
  };
}

export async function getSignalHealth(): Promise<SignalHealthResponse> {
  const snapshot = await loadSignalSnapshot();
  return {
    dataMode: snapshot.snapshotMode,
    generatedAt: snapshot.generatedAt,
    stale: isSnapshotStale(snapshot),
    health: toHealthBlock(snapshot),
    disclaimer: resolveDisclaimer(snapshot),
  };
}
