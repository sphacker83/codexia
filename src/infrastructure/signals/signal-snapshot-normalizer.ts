import type {
  MarketRegime,
  SignalSnapshot,
  SignalSourceStatus,
} from "@/src/core/signals/types";

export function normalizeMarketRegime(raw: unknown): MarketRegime {
  switch (String(raw ?? "").trim().toLowerCase()) {
    case "risk-on":
      return "Risk-On";
    case "risk-off":
      return "Risk-Off";
    case "panic":
      return "Panic";
    case "recovery":
      return "Recovery";
    case "euphoria":
      return "Euphoria";
    default:
      return "Neutral";
  }
}

export function normalizeSourceStatus(raw: unknown): SignalSourceStatus {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (
    normalized === "healthy" ||
    normalized === "degraded" ||
    normalized === "stale" ||
    normalized === "demo" ||
    normalized === "failed"
  ) {
    return normalized;
  }
  if (normalized === "warning") {
    return "degraded";
  }
  if (normalized === "failure" || normalized === "error") {
    return "failed";
  }
  return "demo";
}

export function getDefaultSourceDetail(status: SignalSourceStatus): string {
  switch (status) {
    case "healthy":
      return "source 상태가 정상 범위입니다.";
    case "degraded":
      return "source 일부가 부분 성공 또는 지연 상태입니다.";
    case "stale":
      return "latest source 시각이 오래되었습니다.";
    case "failed":
      return "required source를 읽지 못했습니다.";
    case "demo":
    default:
      return "로컬 demo fallback source입니다.";
  }
}

export function ensureDemoSnapshot(snapshot: SignalSnapshot): SignalSnapshot {
  if (snapshot.snapshotMode === "demo") {
    return snapshot;
  }

  return {
    ...snapshot,
    snapshotMode: "demo",
    health: {
      ...snapshot.health,
      status: snapshot.health.status === "failed" ? "failed" : "demo",
    },
  };
}

function normalizeCanonicalSnapshot(raw: SignalSnapshot): SignalSnapshot {
  return {
    snapshotId: raw.snapshotId || `snapshot-${raw.generatedAt}`,
    generatedAt: raw.generatedAt,
    snapshotMode: raw.snapshotMode,
    marketRegime: normalizeMarketRegime(raw.marketRegime),
    summary: raw.summary,
    stale: Boolean(raw.stale),
    health: {
      status: normalizeSourceStatus(raw.health.status),
      summary: raw.health.summary,
      sources: Array.isArray(raw.health.sources)
        ? raw.health.sources.map((source) => ({
            key: source.key,
            label: source.label,
            source: source.source,
            status: normalizeSourceStatus(source.status),
            updatedAt: source.updatedAt,
            detail: source.detail || getDefaultSourceDetail(normalizeSourceStatus(source.status)),
            summary: source.summary,
          }))
        : [],
    },
    disclaimer: raw.disclaimer,
    benchmarks: Array.isArray(raw.benchmarks) ? raw.benchmarks : [],
    candidates: Array.isArray(raw.candidates) ? raw.candidates : [],
  };
}

function normalizeLegacySnapshot(raw: Record<string, unknown>): SignalSnapshot {
  const generatedAt = String(raw.generatedAt ?? new Date().toISOString());
  const marketSummary = (raw.marketSummary ?? {}) as Record<string, unknown>;
  const marketAssets = Array.isArray(raw.marketAssets) ? raw.marketAssets : [];
  const recommendationCandidates = Array.isArray(raw.recommendationCandidates)
    ? raw.recommendationCandidates
    : [];
  const dataFreshness = Array.isArray(raw.dataFreshness) ? raw.dataFreshness : [];

  return {
    snapshotId: `legacy-${generatedAt}`,
    generatedAt,
    snapshotMode: "demo",
    marketRegime: normalizeMarketRegime(marketSummary.regime),
    summary: String(marketSummary.briefing ?? marketSummary.headline ?? "데모 시드 스냅샷입니다."),
    stale: false,
    health: {
      status: "demo",
      summary: "로컬 시드 스냅샷을 정규화해 사용 중입니다.",
      sources: dataFreshness.map((item) => {
        const source = item as Record<string, unknown>;
        return {
          key: String(source.sourceId ?? source.label ?? "snapshot"),
          label: String(source.label ?? source.sourceId ?? "Snapshot"),
          status: normalizeSourceStatus(source.status),
          updatedAt: String(source.updatedAt ?? generatedAt),
          detail: String(source.note ?? "로컬 시드 스냅샷"),
        };
      }),
    },
    disclaimer: String(
      marketSummary.alert ??
        "실데이터 파이프라인 전까지는 로컬 시드 스냅샷을 표시합니다. 자동매매가 아닌 판단 보조용입니다.",
    ),
    benchmarks: marketAssets.map((item) => {
      const asset = item as Record<string, unknown>;
      const components = Array.isArray(asset.components) ? asset.components : [];
      const bullish = Array.isArray(asset.reasonsBullish)
        ? asset.reasonsBullish.map((value) => String(value))
        : [];
      const bearish = Array.isArray(asset.reasonsBearish)
        ? asset.reasonsBearish.map((value) => String(value))
        : [];
      return {
        ticker: String(asset.ticker ?? ""),
        name: String(asset.name ?? ""),
        kind: "benchmark" as const,
        score: Number(asset.score ?? 0),
        previousScore: Math.max(0, Number(asset.score ?? 0) - 4),
        verdictLabel: String(asset.action ?? "Hold"),
        regimeLabel: normalizeMarketRegime(asset.regime ?? marketSummary.regime),
        priceChange1d: Number(asset.dailyChangePct ?? 0),
        summary: String(asset.summary ?? ""),
        components: components.map((component) => {
          const factor = component as Record<string, unknown>;
          return {
            id: String(factor.key ?? factor.id ?? factor.label ?? "factor"),
            label: String(factor.label ?? factor.key ?? "Factor"),
            score: Number(factor.score ?? 0),
            weight: Number(factor.weight ?? 0),
            summary: String(factor.summary ?? ""),
          };
        }),
        drivers: [...bullish, ...bearish].slice(0, 5).map((reason, index) => ({
          label: reason,
          impact: index < bullish.length ? "positive" as const : "negative" as const,
          detail: reason,
        })),
      };
    }),
    candidates: recommendationCandidates.map((item) => {
      const candidate = item as Record<string, unknown>;
      const thesis = Array.isArray(candidate.thesis)
        ? candidate.thesis.map((value) => String(value))
        : [];
      const risks = Array.isArray(candidate.risks)
        ? candidate.risks.map((value) => String(value))
        : [];
      return {
        ticker: String(candidate.ticker ?? ""),
        name: String(candidate.name ?? ""),
        kind: "equity" as const,
        sector: String(candidate.sector ?? ""),
        summary: thesis[0] ?? String(candidate.action ?? "대형주 시드 후보"),
        qualityScore: Number(candidate.qualityScore ?? 0),
        valuationScore: Number(candidate.valuationScore ?? 0),
        growthScore: Number(candidate.growthScore ?? 0),
        technicalScore: Number(candidate.technicalScore ?? 0),
        liquidityScore: Number(candidate.liquidityScore ?? 0),
        riskPenalty: Math.max(0, 100 - Number(candidate.riskScore ?? 0)),
        profitability: `ROA ${Number(candidate.roaPct ?? 0).toFixed(1)}%`,
        freeCashFlow: `FCF Margin ${Number(candidate.freeCashFlowMarginPct ?? 0).toFixed(1)}%`,
        isProfitable: Number(candidate.roaPct ?? 0) >= 10,
        positiveFreeCashFlow: Number(candidate.freeCashFlowMarginPct ?? 0) > 0,
        debtToEbitda: Number(candidate.debtToEquity ?? 0),
        earningsInDays:
          candidate.nextEarningsDays === null || candidate.nextEarningsDays === undefined
            ? null
            : Number(candidate.nextEarningsDays),
        avgDailyDollarVolumeM: Number(candidate.avgDollarVolumeMillions ?? 0),
        relativeStrengthPct: Number(candidate.technicalScore ?? 0),
        verdictLabel: String(candidate.action ?? "Hold"),
        thesis,
        riskFlags: risks,
        drivers: thesis.map((reason) => ({
          label: reason,
          impact: "positive" as const,
          detail: reason,
        })),
      };
    }),
  };
}

export function normalizeSnapshot(raw: unknown): SignalSnapshot {
  if (raw && typeof raw === "object" && "snapshotMode" in raw && "benchmarks" in raw && "candidates" in raw) {
    return normalizeCanonicalSnapshot(raw as SignalSnapshot);
  }
  return normalizeLegacySnapshot(raw as Record<string, unknown>);
}
