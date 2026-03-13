import Link from "next/link";

import { ThemeSelector } from "@/components/theme-selector";

export function TopMenuBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--theme-border)] bg-[var(--theme-surface)]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6">
        <Link href="/" className="text-xs font-semibold tracking-wide sm:text-base">
          CodexOS
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/"
            className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2 py-1.5 text-xs font-semibold text-[var(--theme-muted)] transition hover:opacity-90 sm:px-3"
          >
            메인
          </Link>
          <Link
            href="/signals"
            className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2 py-1.5 text-xs font-semibold text-[var(--theme-muted)] transition hover:opacity-90 sm:px-3"
          >
            시그널
          </Link>
          <Link
            href="/agent?new=1"
            className="rounded-md bg-[var(--theme-accent)] px-2 py-1.5 text-xs font-semibold text-[var(--theme-accent-fg)] transition hover:opacity-90 sm:px-3"
          >
            워크스페이스
          </Link>
          <ThemeSelector />
        </nav>
      </div>
    </header>
  );
}
