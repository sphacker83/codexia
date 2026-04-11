"use client";

import { MessageContent, StreamingDots, TraceActivityIndicator } from "./message-content";
import type { ChatMessage } from "./agent-chat.types";

export function AgentMessageList({
  isLoadingSession,
  messages,
  messagesContainerRef,
  traceMode,
  waitingSeconds,
}: {
  isLoadingSession: boolean;
  messages: ChatMessage[];
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  traceMode: boolean;
  waitingSeconds: number;
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-[var(--theme-muted)]">
          메시지 리스트 {isLoadingSession ? "(불러오는 중...)" : ""}
        </h2>
      </div>

      <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2 text-sm text-[var(--theme-muted)]">
            아직 메시지가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col space-y-2">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`rounded-md border px-2 py-2 text-sm ${
                  message.role === "user"
                    ? "inline-block w-fit max-w-[80%] self-end border-[var(--theme-accent)] bg-[var(--theme-surface-soft)]"
                    : "w-full max-w-full self-start border-[var(--theme-border)] bg-[var(--theme-bg)]"
                }`}
              >
                {message.role === "assistant" ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
                      {message.responseSeconds ? ` ${message.responseSeconds}s` : ""}
                      {message.status === "streaming" && traceMode ? (
                        <>
                          <span className="ml-1">·</span>
                          <TraceActivityIndicator seconds={waitingSeconds} />
                        </>
                      ) : null}
                      {message.status === "streaming" && !traceMode ? "응답 생성 중" : ""}
                      {message.status === "error" ? "오류" : ""}
                    </p>

                    {message.status === "streaming" && message.content.trim().length === 0 ? (
                      <p className="whitespace-pre-wrap break-words text-[var(--theme-muted)]">
                        <span className="inline-flex items-center gap-2">
                          <StreamingDots />
                          <span className="animate-pulse">응답을 실시간으로 처리 중입니다...</span>
                        </span>
                      </p>
                    ) : (
                      <MessageContent content={message.content} />
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
