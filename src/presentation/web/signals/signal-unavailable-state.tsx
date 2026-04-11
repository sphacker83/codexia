import { getSignalStatusToneClasses } from "@/src/presentation/web/signals/signal-status-tone";

interface SignalUnavailableStateProps {
  title: string;
  message: string;
}

export function SignalUnavailableState({ title, message }: SignalUnavailableStateProps) {
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

      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-6 py-6">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getSignalStatusToneClasses("danger")}`}>
            SIGNALS UNAVAILABLE
          </span>
          <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">{title}</h1>
          <p className="mt-4 text-sm text-[var(--theme-muted)] sm:text-base">{message}</p>
          <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${getSignalStatusToneClasses("warning")}`}>
            live snapshot이 준비되면 자동으로 live mode로 전환됩니다. 로컬 검증이 목적이면
            `SIGNALS_ENABLE_DEMO_MODE=1`로 demo fallback을 켤 수 있습니다.
          </div>
        </section>
      </div>
    </main>
  );
}
