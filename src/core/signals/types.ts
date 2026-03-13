export type SignalStyle = "conservative" | "balanced" | "aggressive";

export type SignalRecommendationStyle = SignalStyle;

export type SignalSnapshotMode = "demo" | "live";

export type SignalSourceStatus = "healthy" | "degraded" | "stale" | "demo";

export type MarketRegime =
  | "Risk-On"
  | "Neutral"
  | "Risk-Off"
  | "Panic"
  | "Recovery"
  | "Euphoria";

export type RecommendationState = "buy-ready" | "trimmed" | "watch-only";

export type DriverImpact = "positive" | "negative" | "neutral";
export type SignalConfidence = "high" | "medium" | "low";

export interface SignalRecommendationStyleConfig {
  value: SignalStyle;
  label: string;
  description: string;
  candidateLimit: number;
  minScore: number;
  minQualityScore: number;
  minLiquidityScore: number;
  maxRiskPenalty: number;
  maxDebtToEbitda: number;
  minNextEarningsDays: number;
  requireProfitability: boolean;
  requirePositiveFreeCashFlow: boolean;
}

export interface SignalDriver {
  label: string;
  impact: DriverImpact;
  detail: string;
}

export interface SignalFactorComponent {
  id: string;
  label: string;
  score: number;
  weight: number;
  summary: string;
}

export interface SignalHealthSource {
  key: string;
  source?: string;
  label: string;
  status: SignalSourceStatus;
  updatedAt: string;
  detail: string;
  summary?: string;
}

export interface SignalHealthSnapshot {
  status: SignalSourceStatus;
  summary: string;
  sources: SignalHealthSource[];
}

export interface BenchmarkSignalSnapshot {
  ticker: string;
  name: string;
  kind: "benchmark";
  score: number;
  previousScore: number;
  verdictLabel: string;
  regimeLabel: MarketRegime;
  priceChange1d: number;
  summary: string;
  components: SignalFactorComponent[];
  drivers: SignalDriver[];
}

export interface RecommendationCandidateSnapshot {
  ticker: string;
  name: string;
  kind: "equity";
  sector: string;
  summary: string;
  qualityScore: number;
  valuationScore: number;
  growthScore: number;
  technicalScore: number;
  liquidityScore: number;
  riskPenalty: number;
  profitability: string;
  freeCashFlow: string;
  isProfitable: boolean;
  positiveFreeCashFlow: boolean;
  debtToEbitda: number;
  earningsInDays: number | null;
  avgDailyDollarVolumeM: number;
  relativeStrengthPct: number;
  verdictLabel: string;
  thesis: string[];
  riskFlags: string[];
  drivers: SignalDriver[];
}

export interface SignalSnapshot {
  snapshotId: string;
  generatedAt: string;
  snapshotMode: SignalSnapshotMode;
  marketRegime: MarketRegime;
  summary: string;
  stale: boolean;
  health: SignalHealthSnapshot;
  disclaimer: string;
  benchmarks: BenchmarkSignalSnapshot[];
  candidates: RecommendationCandidateSnapshot[];
}

export interface SignalHealthBlockResponse {
  status: SignalSourceStatus;
  summary: string;
  sources: SignalHealthSource[];
}

export interface OverviewBenchmarkResponse {
  ticker: string;
  name: string;
  score: number;
  compositeScore?: number;
  previousScore: number;
  confidence: SignalConfidence;
  action: string;
  verdictLabel: string;
  regime: MarketRegime;
  summary: string;
  priceChange1d: number;
  components: SignalFactorComponent[];
  drivers: string[];
  supportingIndicators: Array<{
    label: string;
    value: string;
    tone: DriverImpact;
  }>;
}

export interface RecommendationItemResponse {
  ticker: string;
  name: string;
  sector: string;
  styleScore: number;
  thesis: string;
  riskFlags: string[];
  verdictLabel: string;
  drivers: string[];
  qualityScore: number;
  valuationScore: number;
  growthScore: number;
  technicalScore: number;
  liquidityScore: number;
  riskPenalty: number;
  recommendationState: RecommendationState;
}

export interface RecommendationPreviewResponse {
  ticker: string;
  name: string;
  sector: string;
  styleScore: number;
  thesis: string;
  riskFlags: string[];
  verdictLabel: string;
}

export interface SignalsOverviewResponse {
  style: SignalStyle;
  dataMode: SignalSnapshotMode;
  snapshotMode?: SignalSnapshotMode;
  demo?: boolean;
  generatedAt: string;
  marketRegime: MarketRegime;
  marketLabel: string;
  stale: boolean;
  summary: string;
  benchmarks: OverviewBenchmarkResponse[];
  recommendationPreview: RecommendationPreviewResponse[];
  health: SignalHealthBlockResponse;
  disclaimer: string;
  availableStyles: SignalRecommendationStyleConfig[];
}

export interface SignalRecommendationsResponse {
  style: SignalStyle;
  dataMode: SignalSnapshotMode;
  snapshotMode?: SignalSnapshotMode;
  demo?: boolean;
  generatedAt: string;
  marketRegime: MarketRegime;
  state: RecommendationState;
  stale: boolean;
  items: RecommendationItemResponse[];
  disclaimer: string;
}

export interface AssetDetailResponse {
  ticker: string;
  name: string;
  kind: "benchmark" | "equity";
  sector?: string;
  summary: string;
  verdictLabel: string;
  drivers: string[];
  riskFlags: string[];
  factorScores: Record<string, number>;
  technical: {
    relativeStrengthPct: number;
    setup: string;
    support: string;
    resistance: string;
    changePercent?: number;
  };
  fundamentals: {
    profitability: string;
    freeCashFlow: string;
    debtToEbitda: number;
    earningsInDays: number | null;
    avgDailyDollarVolumeM: number;
    positiveFreeCashFlow?: boolean;
    earningsDays?: number | null;
    metrics?: Array<{
      label: string;
      value: string;
    }>;
  };
  marketContext: {
    marketRegime: MarketRegime;
    regime?: MarketRegime;
    marketLabel: string;
    state: RecommendationState;
    note: string;
    summary?: string;
  };
  components?: SignalFactorComponent[];
}

export interface SignalAssetResponse {
  style: SignalStyle;
  dataMode: SignalSnapshotMode;
  snapshotMode?: SignalSnapshotMode;
  demo?: boolean;
  generatedAt: string;
  stale: boolean;
  asset: AssetDetailResponse;
  disclaimer: string;
}

export interface SignalBriefingResponse {
  style: SignalStyle;
  dataMode: SignalSnapshotMode;
  snapshotMode?: SignalSnapshotMode;
  demo?: boolean;
  generatedAt: string;
  stale: boolean;
  text: string;
  bullets: string[];
  health: SignalHealthBlockResponse;
  disclaimer: string;
}

export interface SignalHealthResponse {
  dataMode: SignalSnapshotMode;
  generatedAt: string;
  stale: boolean;
  health: SignalHealthBlockResponse;
  disclaimer: string;
}

export type SignalOverviewResponse = SignalsOverviewResponse;
export type SignalAssetDetailResponse = SignalAssetResponse;

export const SIGNAL_STYLE_OPTIONS: SignalRecommendationStyleConfig[] = [
  {
    value: "conservative",
    label: "보수적",
    description: "품질, 현금흐름, 이벤트 리스크 기준을 가장 엄격하게 적용합니다.",
    candidateLimit: 4,
    minScore: 68,
    minQualityScore: 72,
    minLiquidityScore: 70,
    maxRiskPenalty: 26,
    maxDebtToEbitda: 3,
    minNextEarningsDays: 10,
    requireProfitability: true,
    requirePositiveFreeCashFlow: true,
  },
  {
    value: "balanced",
    label: "균형형",
    description: "품질과 성장, 기술 구조를 균형 있게 반영합니다.",
    candidateLimit: 5,
    minScore: 63,
    minQualityScore: 64,
    minLiquidityScore: 60,
    maxRiskPenalty: 32,
    maxDebtToEbitda: 4,
    minNextEarningsDays: 5,
    requireProfitability: true,
    requirePositiveFreeCashFlow: true,
  },
  {
    value: "aggressive",
    label: "공격형",
    description: "성장성과 모멘텀을 더 넓게 허용합니다.",
    candidateLimit: 6,
    minScore: 58,
    minQualityScore: 55,
    minLiquidityScore: 50,
    maxRiskPenalty: 38,
    maxDebtToEbitda: 6,
    minNextEarningsDays: 0,
    requireProfitability: false,
    requirePositiveFreeCashFlow: false,
  },
];

export function isSignalStyle(value: string): value is SignalStyle {
  return SIGNAL_STYLE_OPTIONS.some((item) => item.value === value);
}

export function resolveSignalStyleValue(raw: string | null | undefined): SignalStyle {
  if (!raw) {
    return "conservative";
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "보수적") {
    return "conservative";
  }
  if (normalized === "균형" || normalized === "균형형") {
    return "balanced";
  }
  if (normalized === "공격적" || normalized === "공격형") {
    return "aggressive";
  }
  if (isSignalStyle(normalized)) {
    return normalized;
  }
  return "conservative";
}

export function getSignalStyleConfig(style: SignalStyle): SignalRecommendationStyleConfig {
  return SIGNAL_STYLE_OPTIONS.find((item) => item.value === style) ?? SIGNAL_STYLE_OPTIONS[0];
}
