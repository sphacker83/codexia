"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_MODEL, getModelLabel } from "@/src/core/agent/models";
import type { SessionSummary } from "@/src/core/agent/types";

interface SessionsResponse {
  sessions: SessionSummary[];
}

interface CancelAllActiveJobsResponse {
  cancelledCount?: number;
}

function formatRelativeTime(iso: string): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) {
    return "시간 정보 없음";
  }
  const diffMs = Date.now() - target;
  if (diffMs < 60_000) {
    return "방금 전";
  }
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes}분 전`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}시간 전`;
  }
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function SessionManager() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancellingAll, setIsCancellingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/sessions", { method: "GET", cache: "no-store" });
      if (!response.ok) {
        throw new Error("세션 목록 조회에 실패했습니다.");
      }
      const payload = (await response.json()) as SessionsResponse;
      setSessions(payload.sessions ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "세션 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const onDelete = async (sessionId: string) => {
    if (!window.confirm(`세션 ${sessionId} 을(를) 삭제할까요?`)) {
      return;
    }
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("세션 삭제에 실패했습니다.");
      }
      setSessions((prev) => prev.filter((session) => session.sessionId !== sessionId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "세션 삭제 중 오류가 발생했습니다.");
    }
  };

  const onCancelAllActiveJobs = async () => {
    if (!window.confirm("codexia가 현재 작업 중인 세션을 모두 강제 종료할까요?")) {
      return;
    }

    setIsCancellingAll(true);
    setError(null);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "cancel-all-active-jobs",
        }),
      });
      if (!response.ok) {
        throw new Error("활성 작업 종료에 실패했습니다.");
      }
      const payload = (await response.json()) as CancelAllActiveJobsResponse;
      await fetchSessions();
      if ((payload.cancelledCount ?? 0) === 0) {
        setError("현재 강제 종료할 활성 작업이 없습니다.");
      }
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "활성 작업 종료 중 오류가 발생했습니다.");
    } finally {
      setIsCancellingAll(false);
    }
  };

  const activeSessionCount = useMemo(
    () => sessions.filter((session) => Boolean(session.activeJobId)).length,
    [sessions],
  );

  const content = useMemo(() => {
    if (isLoading) {
      return <p className="text-sm text-[var(--theme-muted)]">세션 목록 불러오는 중...</p>;
    }
    if (sessions.length === 0) {
      return (
        <p className="text-sm text-[var(--theme-muted)]">
          저장된 세션이 없습니다. 워크스페이스에서 첫 메시지를 보내면 자동 생성됩니다.
        </p>
      );
    }
    return (
      <ul className="space-y-3">
        {sessions.map((session) => (
          <li
            key={session.sessionId}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{session.sessionId}</p>
              <p className="text-xs text-[var(--theme-muted)]">{formatRelativeTime(session.updatedAt)}</p>
            </div>
            <p className="mt-1 text-xs text-[var(--theme-muted)]">
              모델: {getModelLabel(session.model || DEFAULT_MODEL)} · 메시지: {session.messageCount}
            </p>
            {session.activeJobId ? (
              <p className="mt-1 text-xs font-medium text-orange-300">작업 중 · {session.activeJobId}</p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <Link
                href={`/agent?sessionId=${encodeURIComponent(session.sessionId)}`}
                className="rounded-md bg-[var(--theme-accent)] px-3 py-2 text-xs font-semibold text-[var(--theme-accent-fg)] transition hover:opacity-90"
              >
                이어서 작업
              </Link>
              <button
                type="button"
                onClick={() => {
                  void onDelete(session.sessionId);
                }}
                className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--theme-muted)] transition hover:opacity-90"
              >
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  }, [isLoading, sessions]);

  return (
    <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">멀티 에이전트 세션 관리</h2>
          <p className="text-xs text-[var(--theme-muted)]">
            워크스페이스 세션 확인, 재진입, 삭제, 활성 작업 강제 종료를 지원합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void onCancelAllActiveJobs();
            }}
            disabled={isCancellingAll || activeSessionCount === 0}
            className="rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-200 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCancellingAll ? "종료 중..." : `작업중 세션 종료 (${activeSessionCount})`}
          </button>
          <button
            type="button"
            onClick={() => {
              void fetchSessions();
            }}
            className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--theme-muted)] transition hover:opacity-90"
          >
            새로고침
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-3 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      {content}
    </section>
  );
}
