"use client";

import { useEffect, useRef, useState } from "react";

import { useTheme } from "@/components/theme-provider";

export function ThemeSelector() {
  const { theme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="테마 선택"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-muted)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3a9 9 0 1 0 9 9c0-2-1.7-2.8-3-2.8h-2.3c-1.1 0-2 .9-2 2a2.7 2.7 0 0 0 2.7 2.7h1.1" />
          <circle cx="7.5" cy="9" r="1" />
          <circle cx="9.5" cy="6.5" r="1" />
          <circle cx="13.5" cy="6.5" r="1" />
        </svg>
      </button>

      {isOpen ? (
        <section className="absolute right-0 top-14 z-30 w-80 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4 shadow-xl">
          <h2 className="text-sm font-semibold">테마 선택</h2>
          <p className="mt-1 text-xs text-[var(--theme-muted)]">
            메인 화면에서 선택한 테마가 모든 페이지에 동일하게 적용됩니다.
          </p>

          <div className="mt-3 grid gap-2">
            {themes.map((themeOption) => {
              const isSelected = themeOption.id === theme;
              return (
                <button
                  key={themeOption.id}
                  type="button"
                  onClick={() => {
                    setTheme(themeOption.id);
                    setIsOpen(false);
                  }}
                  className={`rounded-lg border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-[var(--theme-accent)] bg-[var(--theme-surface)] shadow-sm"
                      : "border-[var(--theme-border)] bg-[var(--theme-bg)] hover:bg-[var(--theme-surface)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{themeOption.label}</p>
                      <p className="mt-1 text-xs text-[var(--theme-muted)]">{themeOption.description}</p>
                    </div>
                    <div className="shrink-0" aria-hidden="true">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/15"
                          style={{ background: themeOption.variables["--theme-bg"] }}
                        />
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/15"
                          style={{ background: themeOption.variables["--theme-surface"] }}
                        />
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/15"
                          style={{ background: themeOption.variables["--theme-accent"] }}
                        />
                      </div>
                      <span
                        className="mt-1.5 block h-1.5 w-14 rounded-full"
                        style={{ background: themeOption.variables["--theme-glow-a"] }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
