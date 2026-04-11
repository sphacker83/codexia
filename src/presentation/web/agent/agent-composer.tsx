"use client";

import {
  DEFAULT_MODEL,
  SUPPORTED_MODELS,
  getModelLabel,
  isSupportedModel,
  modelSupportsReasoningEffort,
} from "@/src/core/agent/models";
import {
  DEFAULT_REASONING_EFFORT,
  SUPPORTED_REASONING_EFFORTS,
  isSupportedReasoningEffort,
} from "@/src/core/agent/reasoning";

import { ContextCapacityDonut } from "./message-content";
import { INPUT_PANEL_WIDTH_CLASS, MAX_INPUT_LENGTH, type AgentChatViewModel } from "./agent-chat.types";

function getResponseStatusLabel(phase: AgentChatViewModel["responsePhase"]): string {
  return phase === "waiting" ? "요청 대기 중" : "답변 생성 중";
}

function formatSuggestionLabel(filePath: string, query: string): string {
  if (!query) {
    return filePath;
  }

  const normalizedPath = filePath.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const index = normalizedPath.indexOf(normalizedQuery);

  if (index < 0) {
    return filePath;
  }

  const start = Math.max(0, index - 20);
  const end = Math.min(filePath.length, index + query.length + 20);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < filePath.length ? "..." : "";
  return `${prefix}${filePath.slice(start, end)}${suffix}`;
}

export function AgentComposer({ viewModel }: { viewModel: AgentChatViewModel }) {
  const {
    input,
    inputLength,
    isLoading,
    errorMessage,
    responsePhase,
    waitingSeconds,
    activeCommand,
    reasoningLogs,
    activeJobId,
    selectedModel,
    selectedReasoningEffort,
    traceMode,
    contextCapacityStats,
    fileSuggestions,
    isSuggestionLoading,
    selectedSuggestionIndex,
    atTokenStart,
    canRetry,
    inputRef,
    setSelectedModel,
    setSelectedReasoningEffort,
    setTraceMode,
    handleInputChange,
    handleMessageKeyDown,
    handleSubmit,
    handleRetry,
    handleSuggestionSelect,
    closeFileSuggestions,
    hasValidSessionId,
  } = viewModel;

  const isSendDisabled = !hasValidSessionId || isLoading || inputLength === 0;
  const supportsReasoningEffort = modelSupportsReasoningEffort(selectedModel);

  return (
    <form className={`mt-3 shrink-0 bg-transparent ${INPUT_PANEL_WIDTH_CLASS}`} onSubmit={handleSubmit}>
      <div className="relative w-full">
        <div className="relative w-full">
          <textarea
            id="message"
            name="message"
            rows={4}
            value={input}
            ref={inputRef}
            onChange={handleInputChange}
            onKeyDown={handleMessageKeyDown}
            placeholder="메시지를 입력하세요."
            disabled={isLoading}
            className="relative z-10 w-full resize-y rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2 pr-14 pb-10 text-sm outline-none transition focus:border-2 focus:border-[var(--theme-accent)] focus:ring-0 disabled:opacity-60"
            onBlur={() => {
              window.setTimeout(() => {
                closeFileSuggestions();
              }, 120);
            }}
          />

          {atTokenStart !== null ? (
            <div className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-48 overflow-y-auto rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] p-2">
              <p className="mb-2 text-xs font-medium leading-none text-[var(--theme-muted)]">파일 추천</p>
              {isSuggestionLoading ? (
                <p className="text-xs leading-none text-[var(--theme-muted)]">파일 목록을 불러오는 중...</p>
              ) : fileSuggestions.length === 0 ? (
                <p className="text-xs leading-none text-[var(--theme-muted)]">일치하는 파일이 없습니다.</p>
              ) : (
                <ul className="space-y-0">
                  {fileSuggestions.map((suggestion, index) => {
                    const isActive = index === selectedSuggestionIndex;
                    return (
                      <li key={suggestion.path}>
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleSuggestionSelect(suggestion.path);
                          }}
                          className={`w-full rounded-md px-2 py-1 text-left text-xs leading-none ${
                            isActive
                              ? "bg-[var(--theme-accent)]/15 text-[var(--theme-accent)]"
                              : "text-[var(--theme-fg)] hover:bg-[var(--theme-surface-soft)]"
                          }`}
                        >
                          {formatSuggestionLabel(suggestion.path, viewModel.input.slice(atTokenStart + 1))}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSendDisabled}
            className="absolute right-2 bottom-2 z-20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent)] text-base font-medium text-[var(--theme-accent-fg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="전송"
          >
            <span aria-hidden="true" className="leading-none">
              ↑
            </span>
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="message" className="block text-sm font-medium text-[var(--theme-muted)]">
            메시지 입력
          </label>
          <span className="text-xs text-[var(--theme-muted)]">
            {inputLength.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--theme-muted)]">실행 모델</span>
          <select
            value={selectedModel}
            onChange={(event) => {
              if (isSupportedModel(event.target.value)) {
                setSelectedModel(event.target.value);
              }
            }}
            disabled={isLoading}
            className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2 py-1 text-xs text-[var(--theme-fg)] outline-none focus:border-2 focus:border-[var(--theme-accent)] focus:ring-0 disabled:opacity-60"
          >
            {SUPPORTED_MODELS.map((model) => (
              <option key={model} value={model}>
                {getModelLabel(model || DEFAULT_MODEL)}
              </option>
            ))}
          </select>

          <span className="text-xs text-[var(--theme-muted)]">사고수준</span>
          <select
            value={selectedReasoningEffort}
            onChange={(event) => {
              if (isSupportedReasoningEffort(event.target.value)) {
                setSelectedReasoningEffort(event.target.value || DEFAULT_REASONING_EFFORT);
              }
            }}
            disabled={isLoading || !supportsReasoningEffort}
            title={
              supportsReasoningEffort
                ? undefined
                : "현재 모델은 사고수준 override를 지원하지 않습니다."
            }
            className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2 py-1 text-xs text-[var(--theme-fg)] outline-none focus:border-2 focus:border-[var(--theme-accent)] focus:ring-0 disabled:opacity-60"
          >
            {SUPPORTED_REASONING_EFFORTS.map((reasoningEffort) => (
              <option key={reasoningEffort} value={reasoningEffort}>
                {reasoningEffort}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1 text-xs text-[var(--theme-muted)]">
            <input
              type="checkbox"
              checked={traceMode}
              onChange={(event) => setTraceMode(event.target.checked)}
              disabled={isLoading}
              className="h-3.5 w-3.5 rounded border-[var(--theme-border)] bg-[var(--theme-surface-soft)]"
            />
            Trace
          </label>

          {contextCapacityStats ? (
            <ContextCapacityDonut
              used={contextCapacityStats.used}
              applied={contextCapacityStats.total}
              remaining={contextCapacityStats.remaining}
              historyUsed={contextCapacityStats.historyUsed}
              historyBudget={contextCapacityStats.historyBudget}
              requested={contextCapacityStats.requested}
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--theme-muted)]">
        {isLoading && !traceMode ? (
          <span className="animate-pulse">
            {getResponseStatusLabel(responsePhase)} ({waitingSeconds}s)
            {activeJobId ? ` · ${activeJobId}` : ""}
          </span>
        ) : null}
      </div>

      {traceMode && (activeCommand || reasoningLogs.length > 0) ? (
        <div className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2 text-xs text-[var(--theme-muted)]">
          {activeCommand ? <p className="mb-2 animate-pulse">실행 중: {activeCommand}</p> : null}
          {reasoningLogs.length > 0 ? (
            <div className="mb-2 space-y-1">
              <p className="font-semibold">사고 로그</p>
              {reasoningLogs.slice(-3).map((log, index) => (
                <p key={`${index}-${log.slice(0, 24)}`} className="line-clamp-2 whitespace-pre-wrap">
                  {log}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {canRetry ? (
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--theme-muted)] transition hover:opacity-90"
          >
            재시도
          </button>
        ) : null}
      </div>
    </form>
  );
}
