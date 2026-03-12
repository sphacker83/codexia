import { Suspense } from "react";

import AgentPageClient from "./page-client";

export default function AgentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen px-4 py-10 sm:px-8">
          <div className="mx-auto w-full max-w-5xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 text-sm text-[var(--theme-muted)]">
            로딩 중...
          </div>
        </main>
      }
    >
      <AgentPageClient />
    </Suspense>
  );
}

