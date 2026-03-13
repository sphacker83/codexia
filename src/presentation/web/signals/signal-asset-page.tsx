import Link from "next/link";

import type { SignalAssetResponse } from "@/src/core/signals/types";

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

interface SignalAssetPageProps {
  ticker: string;
  payload: SignalAssetResponse;
}

export function SignalAssetPage({ ticker, payload }: SignalAssetPageProps) {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-8">
      <div
        className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "var(--theme-glow-a)" }}
      />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--theme-muted)]">SIGNAL ASSET DETAIL</p>
              <h1 className="mt-2 text-3xl font-semibold">{ticker.toUpperCase()}</h1>
              <p className="mt-2 text-sm text-[var(--theme-muted)]">
                스냅샷 시각 {formatDateTime(payload.generatedAt)} · 스타일 {payload.style} · {payload.dataMode}
              </p>
            </div>
            <Link
              href={`/signals?style=${payload.style}`}
              className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--theme-muted)]"
            >
              대시보드로 돌아가기
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <article className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{payload.asset.name}</h2>
              <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2 py-1 text-xs text-[var(--theme-muted)]">
                {payload.asset.kind}
              </span>
              {payload.asset.sector ? (
                <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2 py-1 text-xs text-[var(--theme-muted)]">
                  {payload.asset.sector}
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-lg font-semibold">{payload.asset.verdictLabel}</p>
            <p className="mt-3 text-sm text-[var(--theme-muted)]">{payload.asset.summary}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {payload.asset.drivers.map((item) => (
                <span
                  key={`${ticker}-${item}`}
                  className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2 py-1 text-xs text-[var(--theme-muted)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
            <h2 className="text-lg font-semibold">시장 맥락</h2>
            <p className="mt-3 text-sm text-[var(--theme-muted)]">
              레짐: {payload.asset.marketContext.marketLabel}
            </p>
            <p className="mt-2 text-sm text-[var(--theme-muted)]">
              상태: {payload.asset.marketContext.state}
            </p>
            <p className="mt-3 text-sm text-[var(--theme-muted)]">{payload.asset.marketContext.note}</p>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
            <h2 className="text-lg font-semibold">팩터 점수</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(payload.asset.factorScores).map(([key, value]) => (
                <div
                  key={`${ticker}-${key}`}
                  className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3"
                >
                  <p className="text-xs text-[var(--theme-muted)]">{key}</p>
                  <p className="mt-1 text-2xl font-semibold">{Math.round(value)}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
            <h2 className="text-lg font-semibold">기술 / 펀더멘탈</h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--theme-muted)]">
              <p>상대강도: {payload.asset.technical.relativeStrengthPct}%</p>
              <p>셋업: {payload.asset.technical.setup}</p>
              <p>지지: {payload.asset.technical.support}</p>
              <p>저항: {payload.asset.technical.resistance}</p>
              <p>수익성: {payload.asset.fundamentals.profitability}</p>
              <p>현금흐름: {payload.asset.fundamentals.freeCashFlow}</p>
              <p>Debt/EBITDA: {payload.asset.fundamentals.debtToEbitda}</p>
              <p>
                실적까지:{" "}
                {payload.asset.fundamentals.earningsInDays === null
                  ? "N/A"
                  : `${payload.asset.fundamentals.earningsInDays}일`}
              </p>
              <p>평균 거래대금: {payload.asset.fundamentals.avgDailyDollarVolumeM}M</p>
            </div>
          </article>
        </section>

        {payload.asset.components && payload.asset.components.length > 0 ? (
          <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
            <h2 className="text-lg font-semibold">구성 점수</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {payload.asset.components.map((component) => (
                <div
                  key={`${ticker}-${component.id}`}
                  className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3"
                >
                  <p className="text-xs text-[var(--theme-muted)]">{component.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{component.score}</p>
                  <p className="mt-2 text-xs text-[var(--theme-muted)]">{component.summary}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-5 py-4 text-sm text-[var(--theme-muted)]">
          <p>리스크: {payload.asset.riskFlags.join(", ") || "명시된 추가 리스크 없음"}</p>
          <p className="mt-2">{payload.disclaimer}</p>
        </section>
      </div>
    </main>
  );
}
