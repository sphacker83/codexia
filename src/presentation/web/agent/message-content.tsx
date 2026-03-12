"use client";

import type { ReactNode } from "react";

interface ParsedLink {
  href: string;
  label?: string;
}

type TextToken =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label?: string };

function parseMessageTokens(content: string): TextToken[] {
  const tokens: TextToken[] = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"')\]]+)/g;
  let lastIndex = 0;

  for (const match of content.matchAll(pattern)) {
    const full = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      tokens.push({ type: "text", value: content.slice(lastIndex, index) });
    }

    const markdownLabel = match[1];
    const markdownHref = match[2];
    const bareHref = match[3];

    if (markdownHref) {
      tokens.push({ type: "link", href: markdownHref, label: markdownLabel || markdownHref });
    } else if (bareHref) {
      tokens.push({ type: "link", href: bareHref });
    } else if (full) {
      tokens.push({ type: "text", value: full });
    }

    lastIndex = index + full.length;
  }

  if (lastIndex < content.length) {
    tokens.push({ type: "text", value: content.slice(lastIndex) });
  }

  if (tokens.length === 0) {
    return [{ type: "text", value: content }];
  }

  return tokens;
}

function splitTextWithLineBreaks(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split("\n");
  const nodes: ReactNode[] = [];

  parts.forEach((part, index) => {
    if (part.length > 0) {
      nodes.push(
        <span key={`${keyPrefix}-text-${index}`} className="break-words">
          {part}
        </span>,
      );
    }

    if (index < parts.length - 1) {
      nodes.push(<br key={`${keyPrefix}-br-${index}`} />);
    }
  });

  return nodes;
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/")[1];
      return id ? id.slice(0, 20) : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v")?.slice(0, 20) || null;
      }

      if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2]?.slice(0, 20) || null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function buildYouTubeLinks(tokens: TextToken[]): ParsedLink[] {
  const byHref = new Map<string, ParsedLink>();

  for (const token of tokens) {
    if (token.type !== "link") {
      continue;
    }

    const videoId = extractYouTubeVideoId(token.href);
    if (!videoId) {
      continue;
    }

    if (!byHref.has(token.href)) {
      byHref.set(token.href, { href: token.href, label: token.label });
    }
  }

  return [...byHref.values()];
}

function toFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function MessageContent({ content }: { content: string }) {
  const tokens = parseMessageTokens(content);
  const youtubeLinks = buildYouTubeLinks(tokens);

  return (
    <div className="space-y-3">
      <p className="break-words">
        {tokens.map((token, index) => {
          if (token.type === "text") {
            return (
              <span key={`token-text-${index}`}>{splitTextWithLineBreaks(token.value, `token-${index}`)}</span>
            );
          }

          const linkText = token.label?.trim().length ? token.label : token.href;
          return (
            <a
              key={`token-link-${index}`}
              href={token.href}
              target="_blank"
              rel="noreferrer noopener"
              className="break-all text-[var(--theme-accent)] underline underline-offset-2 hover:opacity-90"
            >
              {linkText}
            </a>
          );
        })}
      </p>

      {youtubeLinks.length > 0 ? (
        <div className="grid gap-2">
          {youtubeLinks.map((link, index) => {
            const videoId = extractYouTubeVideoId(link.href);
            if (!videoId) {
              return null;
            }

            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            return (
              <a
                key={`yt-thumb-${index}`}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="overflow-hidden rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailUrl}
                  alt={link.label ? `${link.label} 썸네일` : "YouTube 썸네일"}
                  loading="lazy"
                  className="h-auto w-full object-cover"
                />
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--theme-accent)]"
        style={{ animationDuration: "0.8s", animationDelay: "0ms" }}
      />
      <span
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--theme-accent)]"
        style={{ animationDuration: "0.8s", animationDelay: "0.16s" }}
      />
      <span
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--theme-accent)]"
        style={{ animationDuration: "0.8s", animationDelay: "0.32s" }}
      />
    </span>
  );
}

const TRACE_ACTIVITY_ICON_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'%3E%3Ccircle cx='25' cy='25' r='20' stroke='%23d1d5db' stroke-width='6' fill='none' stroke-linecap='round' opacity='0.35' /%3E%3Cpath d='M25 5a20 20 0 0 1 20 20' stroke='%23007bff' stroke-width='6' fill='none' stroke-linecap='round' /%3E%3C/svg%3E";

export function TraceActivityIndicator({ seconds }: { seconds: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--theme-accent)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={TRACE_ACTIVITY_ICON_SRC} alt="" className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      <span className="font-semibold tabular-nums">{seconds}s</span>
    </span>
  );
}

export function ContextCapacityDonut({
  used,
  applied,
  remaining,
  historyUsed,
  historyBudget,
  requested,
}: {
  used: number;
  applied: number;
  remaining: number;
  historyUsed: number;
  historyBudget: number;
  requested: number;
}) {
  const safeUsed = Math.max(0, toFiniteNumber(used));
  const safeApplied = Math.max(0, toFiniteNumber(applied));
  const safeRemaining = Math.max(0, toFiniteNumber(remaining));
  const safeHistoryUsed = Math.max(0, toFiniteNumber(historyUsed));
  const safeHistoryBudget = Math.max(0, toFiniteNumber(historyBudget));
  const safeRequested = Math.max(0, toFiniteNumber(requested));
  const percentUsed = safeApplied > 0 ? Math.min(100, Math.max(0, (safeUsed / safeApplied) * 100)) : 0;
  const normalizedPercent = Number.isFinite(percentUsed) ? percentUsed : 0;
  const isAtCapacity = safeApplied > 0 && safeUsed >= safeApplied;
  const percentText = (isAtCapacity ? 100 : Math.min(99.9, normalizedPercent)).toFixed(1);
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeLength = (circumference * normalizedPercent) / 100;

  return (
    <div className="group relative inline-flex h-8 w-8 items-center justify-center">
      <svg className="-rotate-90" width={32} height={32} viewBox="0 0 32 32" aria-hidden="true">
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          strokeWidth={4}
          className="stroke-[var(--theme-border)]"
        />
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          className="stroke-[var(--theme-accent)] transition-all"
          strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
          strokeDashoffset={0}
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute text-[10px] font-semibold tabular-nums text-[var(--theme-fg)]">
        {percentText}%
      </span>
      <div className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-1 w-max max-w-[16rem] -translate-x-1/2 rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2 py-1 text-[11px] text-[var(--theme-muted)] opacity-0 transition group-hover:scale-100 group-hover:opacity-100">
        <p className="whitespace-nowrap">총 사용량: {safeUsed.toLocaleString()} / {safeApplied.toLocaleString()}</p>
        <p className="whitespace-nowrap">남은 컨텍스트: {safeRemaining.toLocaleString()}</p>
        <p className="whitespace-nowrap">대화 기록: {safeHistoryUsed.toLocaleString()} / {safeHistoryBudget.toLocaleString()}</p>
        <p className="whitespace-nowrap">모델 상한: {safeRequested.toLocaleString()}</p>
      </div>
    </div>
  );
}
