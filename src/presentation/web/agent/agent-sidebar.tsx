"use client";

import Link from "next/link";

import { ThemeSelector } from "@/components/theme-selector";

export function AgentSidebar({
  hasValidSessionId,
  sessionId,
}: {
  hasValidSessionId: boolean;
  sessionId: string;
}) {
  return (
    <aside className="flex h-full flex-col gap-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
      <div>
        <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--theme-fg)]">
          CodexOS
        </Link>
        <p className="mt-1 text-xs text-[var(--theme-muted)]">개인 개발 AI 에이전트</p>
      </div>

      <nav className="flex items-center gap-2">
        <Link
          href="/"
          className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--theme-muted)] transition hover:opacity-90"
        >
          메인
        </Link>
        <Link
          href="/agent?new=1"
          className="rounded-md bg-[var(--theme-accent)] px-3 py-2 text-xs font-semibold text-[var(--theme-accent-fg)] transition hover:opacity-90"
        >
          에이전트
        </Link>
        <ThemeSelector />
      </nav>

      <div className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2">
        <p className="text-sm font-semibold">코덱스 에이전트</p>
        <p className="mt-1 text-xs text-[var(--theme-muted)]">
          메인 화면에서 선택한 테마가 이 페이지에도 동일하게 적용됩니다.
        </p>
        <p className="mt-2 text-xs text-[var(--theme-muted)]">
          Session ID: {hasValidSessionId ? sessionId : "생성 중..."}
        </p>
      </div>
    </aside>
  );
}
