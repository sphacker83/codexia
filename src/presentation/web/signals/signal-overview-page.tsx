import Link from "next/link";

import type { SignalsOverviewResponse } from "@/src/core/signals/types";
import { getSignalStatusToneClasses } from "@/src/presentation/web/signals/signal-status-tone";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusTone(status: SignalsOverviewResponse["health"]["status"]): string {
  switch (status) {
    case "healthy":
      return getSignalStatusToneClasses("success");
    case "degraded":
      return getSignalStatusToneClasses("warning");
    case "stale":
      return getSignalStatusToneClasses("danger");
    case "failed":
      return getSignalStatusToneClasses("danger");
    default:
      return getSignalStatusToneClasses("info");
  }
}

function getStatusLabel(status: SignalsOverviewResponse["health"]["status"]): string {
  switch (status) {
    case "healthy":
      return "정상";
    case "degraded":
      return "주의";
    case "stale":
      return "지연";
    case "failed":
      return "실패";
    default:
      return "데모";
  }
}

function getModeSummary(payload: SignalsOverviewResponse): string[] {
  const summaries: string[] = [];

  if (payload.dataMode === "demo") {
    summaries.push("DEMO는 로컬 시드 snapshot입니다. 실데이터 파이프라인을 대체하지 않습니다.");
  } else {
    summaries.push("LIVE는 저장된 실데이터 snapshot 기준입니다.");
  }

  if (payload.stale) {
    summaries.push("STALE은 snapshot 시각이 오래되어 강한 액션이 자동으로 낮아진 상태입니다.");
  }

  return summaries;
}

interface SignalOverviewPageProps {
  payload: SignalsOverviewResponse;
}

export function SignalOverviewPage({ payload }: SignalOverviewPageProps) {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-8">
      <div
        className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "var(--theme-glow-a)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 right-6 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "var(--theme-glow-b)" }}
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-1 text-[var(--theme-muted)]">
                  AI SIGNAL DASHBOARD
                </span>
                <span className={`rounded-full border px-3 py-1 ${getStatusTone(payload.health.status)}`}>
                  {payload.dataMode === "demo" ? "DEMO SNAPSHOT" : "LIVE SNAPSHOT"}
                </span>
                {payload.stale ? (
                  <span className={`rounded-full border px-3 py-1 ${getSignalStatusToneClasses("danger")}`}>
                    STALE SNAPSHOT
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{payload.marketLabel}</h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--theme-muted)] sm:text-base">
                {payload.summary}
              </p>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2">
                  시장 레짐 <strong className="ml-1 text-base">{payload.marketRegime}</strong>
                </span>
                <span className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2">
                  기준 시각 <strong className="ml-1 text-base">{formatDateTime(payload.generatedAt)}</strong>
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-[var(--theme-muted)]">
                {getModeSummary(payload).map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>

            <div className="min-w-[16rem] rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--theme-muted)]">추천 스타일</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {payload.availableStyles.map((option) => {
                  const active = option.value === payload.style;
                  return (
                    <Link
                      key={option.value}
                      href={`/signals?style=${option.value}`}
                      className={
                        active
                          ? "rounded-lg bg-[var(--theme-accent)] px-3 py-2 text-sm font-semibold text-[var(--theme-accent-fg)]"
                          : "rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-sm font-semibold text-[var(--theme-muted)]"
                      }
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-[var(--theme-muted)]">
                {payload.availableStyles.find((option) => option.value === payload.style)?.description}
              </p>
            </div>
          </div>

          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${getSignalStatusToneClasses("warning")}`}>
            {payload.disclaimer}
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          {payload.benchmarks.map((asset) => (
            <article
              key={asset.ticker}
              className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[var(--theme-muted)]">{asset.ticker}</p>
                  <h2 className="mt-2 text-xl font-semibold">{asset.name}</h2>
                </div>
                <Link
                  href={`/signals/${encodeURIComponent(asset.ticker)}?style=${payload.style}`}
                  className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--theme-muted)]"
                >
                  상세 보기
                </Link>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
                  <p className="text-xs text-[var(--theme-muted)]">액션</p>
                  <p className="mt-1 text-lg font-semibold">{asset.action}</p>
                </div>
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
                  <p className="text-xs text-[var(--theme-muted)]">레짐</p>
                  <p className="mt-1 text-lg font-semibold">{asset.regime}</p>
                </div>
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
                  <p className="text-xs text-[var(--theme-muted)]">점수</p>
                  <p className="mt-1 text-lg font-semibold">{asset.score}</p>
                </div>
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
                  <p className="text-xs text-[var(--theme-muted)]">1D 변화</p>
                  <p className="mt-1 text-lg font-semibold">
                    {asset.priceChange1d >= 0 ? "+" : ""}
                    {asset.priceChange1d.toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {asset.components.map((component) => (
                  <div
                    key={`${asset.ticker}-${component.id}`}
                    className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{component.label}</p>
                      <p className="text-sm text-[var(--theme-muted)]">
                        {component.score} / {component.weight}%
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-[var(--theme-muted)]">{component.summary}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--theme-muted)]">
                {asset.drivers.map((driver) => (
                  <span
                    key={`${asset.ticker}-${driver}`}
                    className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2 py-1"
                  >
                    {driver}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <article className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">추천 종목</h2>
                <p className="mt-1 text-sm text-[var(--theme-muted)]">
                  현재 스타일 기준 상위 후보 프리뷰입니다.
                </p>
              </div>
              <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--theme-muted)]">
                {payload.style}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {payload.recommendationPreview.map((recommendation) => (
                <article
                  key={recommendation.ticker}
                  className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{recommendation.ticker}</h3>
                        <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--theme-muted)]">
                          {recommendation.verdictLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--theme-muted)]">
                        {recommendation.name} · {recommendation.sector}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--theme-muted)]">스타일 점수</p>
                      <p className="text-2xl font-semibold">{Math.round(recommendation.styleScore)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--theme-muted)]">핵심 포인트</p>
                      <p className="mt-2 text-sm text-[var(--theme-muted)]">{recommendation.thesis}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--theme-muted)]">리스크</p>
                      <ul className="mt-2 space-y-1 text-sm text-[var(--theme-muted)]">
                        {(recommendation.riskFlags.length > 0 ? recommendation.riskFlags : ["추가 리스크 표시 없음"]).map(
                          (item) => (
                            <li key={`${recommendation.ticker}-risk-${item}`}>- {item}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Link
                      href={`/signals/${encodeURIComponent(recommendation.ticker)}?style=${payload.style}`}
                      className="rounded-lg bg-[var(--theme-accent)] px-3 py-2 text-xs font-semibold text-[var(--theme-accent-fg)]"
                    >
                      종목 상세
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
            <h2 className="text-lg font-semibold">헬스 상태</h2>
            <p className="mt-2 text-sm text-[var(--theme-muted)]">{payload.health.summary}</p>
            <div className="mt-4 space-y-3">
              {payload.health.sources.map((indicator) => (
                <div
                  key={indicator.key}
                  className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{indicator.label}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusTone(indicator.status)}`}>
                      {getStatusLabel(indicator.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--theme-muted)]">{indicator.detail}</p>
                  {indicator.updatedAt ? (
                    <p className="mt-2 text-[11px] text-[var(--theme-muted)]">{formatDateTime(indicator.updatedAt)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
