import Link from "next/link";
import { SessionManager } from "@/components/session-manager";

const statusItems = [
  { label: "세션 저장", value: "JSON 기반" },
  { label: "응답 방식", value: "Streaming" },
  { label: "실행 모델", value: "Codex CLI" },
];

export default function HomePage() {
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
        <header className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)]/95 px-6 py-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--theme-muted)]">CODEXOS MVP</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            개인 개발 에이전트 메인 화면
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--theme-muted)] sm:text-base">
            프로젝트 진입점입니다. 세션 기반 대화, 스트리밍 응답, Codex 실행을 한곳에서 시작합니다.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/agent?new=1"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--theme-accent)] px-5 py-3 text-sm font-semibold text-[var(--theme-accent-fg)] transition hover:opacity-90"
            >
              에이전트 시작하기
            </Link>
          </div>
        </header>

        <SessionManager />

        <section className="grid gap-4 sm:grid-cols-3">
          {statusItems.map((item) => (
            <article
              key={item.label}
              className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4"
            >
              <p className="inline-flex rounded-full bg-[var(--theme-surface-soft)] px-2 py-1 text-xs font-semibold text-[var(--theme-muted)]">
                {item.label}
              </p>
              <p className="mt-3 text-lg font-semibold">{item.value}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
