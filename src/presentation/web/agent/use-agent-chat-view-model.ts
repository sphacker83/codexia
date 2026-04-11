"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { computePromptBuildMeta } from "@/src/core/agent/prompt-builder";
import {
  DEFAULT_MODEL,
  SUPPORTED_MODELS,
  getModelContextLength,
  isSupportedModel,
  type SupportedModel,
} from "@/src/core/agent/models";
import {
  DEFAULT_REASONING_EFFORT,
  SUPPORTED_REASONING_EFFORTS,
  isSupportedReasoningEffort,
  type SupportedReasoningEffort,
} from "@/src/core/agent/reasoning";
import type {
  AgentJobEvent,
  AgentJobSnapshot,
  AgentJobStreamEvent,
  AgentPromptMode,
  Message,
  Session,
} from "@/src/core/agent/types";

import type {
  AgentChatViewModel,
  ChatMessage,
  ContextCapacityStats,
  FileSuggestion,
  ResponsePhase,
  UsageStats,
} from "./agent-chat.types";
import { MAX_INPUT_LENGTH } from "./agent-chat.types";

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;
const LAST_SESSION_ID_STORAGE_KEY = "codexia:last-session-id";
const LAST_REASONING_EFFORT_STORAGE_KEY = "codexia:last-reasoning-effort";
const TRACE_MODE_STORAGE_KEY = "codexia:trace-mode";
const SSE_EVENT_DELIMITER = "\n\n";

interface StreamState {
  jobId: string | null;
  assistantMessageId: string;
  requestStartedAt: number;
  trace: boolean;
}

function getAtTokenContext(
  value: string,
  cursorPosition: number,
): { start: number; query: string } | null {
  const beforeCursor = value.slice(0, cursorPosition);
  const match = beforeCursor.match(/(?:^|\s)(@[^\s]*)$/);

  if (!match) {
    return null;
  }

  const token = match[1];
  const atIndex = beforeCursor.lastIndexOf(token);
  if (atIndex < 0) {
    return null;
  }

  return {
    start: atIndex,
    query: token.slice(1),
  };
}

function toFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "알 수 없는 오류가 발생했습니다.";
}

function toChatMessages(messages: Message[]): ChatMessage[] {
  return messages.map((message, index) => ({
    id: `history-${index}-${message.createdAt}`,
    role: message.role,
    content: message.content,
    status: "done",
  }));
}

function toPromptHistoryMessages(messages: ChatMessage[]): Message[] {
  return messages
    .filter((message) => message.status !== "streaming")
    .filter((message) => message.content.trim().length > 0)
    .map((message, index) => ({
      role: message.role,
      content: message.content,
      createdAt: `preview-${index}`,
    }));
}

function generateClientSessionId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    const compact = window.crypto.randomUUID().replaceAll("-", "");
    return `session-${compact.slice(0, 24)}`;
  }

  const fallback = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `session-${fallback}`;
}

function parseSseChunk(buffer: string): {
  events: AgentJobStreamEvent[];
  remainder: string;
} {
  const parts = buffer.split(SSE_EVENT_DELIMITER);
  const completeEvents = parts.slice(0, -1);
  const remainder = parts.at(-1) ?? "";
  const events: AgentJobStreamEvent[] = [];

  for (const rawEvent of completeEvents) {
    const dataLines = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6));

    if (dataLines.length === 0) {
      continue;
    }

    try {
      events.push(JSON.parse(dataLines.join("\n")) as AgentJobStreamEvent);
    } catch {
      // malformed event ignored
    }
  }

  return { events, remainder };
}

export function useAgentChatViewModel(): AgentChatViewModel {
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("sessionId");
  const forceNewSession = searchParams.get("new") === "1";

  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [generatedSessionId, setGeneratedSessionId] = useState<string | null>(null);
  const sessionId = useMemo(() => {
    if (requestedSessionId && SESSION_ID_PATTERN.test(requestedSessionId)) {
      return requestedSessionId;
    }

    if (forceNewSession) {
      return generatedSessionId ?? "";
    }

    if (localSessionId && SESSION_ID_PATTERN.test(localSessionId)) {
      return localSessionId;
    }

    return generatedSessionId ?? "";
  }, [forceNewSession, generatedSessionId, localSessionId, requestedSessionId]);
  const hasValidSessionId = SESSION_ID_PATTERN.test(sessionId);

  const [selectedModel, setSelectedModel] = useState<SupportedModel>(DEFAULT_MODEL);
  const [selectedReasoningEffort, setSelectedReasoningEffort] =
    useState<SupportedReasoningEffort>(DEFAULT_REASONING_EFFORT);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string | null>(null);
  const [responsePhase, setResponsePhase] = useState<ResponsePhase>("idle");
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [reasoningLogs, setReasoningLogs] = useState<string[]>([]);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activePromptMode, setActivePromptMode] = useState<AgentPromptMode | null>(null);
  const [contextCapacityMeta, setContextCapacityMeta] = useState<ReturnType<typeof computePromptBuildMeta> | null>(null);
  const [traceMode, setTraceMode] = useState(true);
  const [fileSuggestions, setFileSuggestions] = useState<FileSuggestion[]>([]);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [atTokenStart, setAtTokenStart] = useState<number | null>(null);
  const [atTokenQuery, setAtTokenQuery] = useState("");

  const streamRef = useRef<StreamState | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const usageStatsRef = useRef<UsageStats | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileSuggestionRef = useRef<AbortController | null>(null);
  const fileSuggestionRequestRef = useRef(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (requestedSessionId || forceNewSession) {
      return;
    }

    try {
      const savedSessionId = window.localStorage.getItem(LAST_SESSION_ID_STORAGE_KEY);
      if (savedSessionId && SESSION_ID_PATTERN.test(savedSessionId)) {
        setLocalSessionId(savedSessionId);
      }

      const savedReasoningEffort = window.localStorage.getItem(LAST_REASONING_EFFORT_STORAGE_KEY);
      if (savedReasoningEffort && isSupportedReasoningEffort(savedReasoningEffort)) {
        setSelectedReasoningEffort(savedReasoningEffort);
      }

      const savedTraceMode = window.localStorage.getItem(TRACE_MODE_STORAGE_KEY);
      setTraceMode(savedTraceMode === null ? true : savedTraceMode === "true");
    } catch {
      // storage access ignored
    }
  }, [forceNewSession, requestedSessionId]);

  useEffect(() => {
    setContextCapacityMeta(null);
    usageStatsRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    if (requestedSessionId || generatedSessionId || (!forceNewSession && localSessionId)) {
      return;
    }

    setGeneratedSessionId(generateClientSessionId());
  }, [forceNewSession, generatedSessionId, localSessionId, requestedSessionId]);

  useEffect(() => {
    if (!hasValidSessionId) {
      return;
    }

    try {
      window.localStorage.setItem(LAST_SESSION_ID_STORAGE_KEY, sessionId);
    } catch {
      // storage access ignored
    }
  }, [hasValidSessionId, sessionId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_REASONING_EFFORT_STORAGE_KEY, selectedReasoningEffort);
    } catch {
      // storage access ignored
    }
  }, [selectedReasoningEffort]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRACE_MODE_STORAGE_KEY, traceMode ? "true" : "false");
    } catch {
      // storage access ignored
    }
  }, [traceMode]);

  useEffect(() => {
    if (!traceMode) {
      setReasoningLogs([]);
      setActiveCommand(null);
      usageStatsRef.current = null;
    }
  }, [traceMode]);

  const clearStreamState = useCallback(() => {
    streamRef.current = null;
    streamAbortRef.current = null;
  }, []);

  const stopJobStream = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }

    clearStreamState();
  }, [clearStreamState]);

  const getOrCreateStreamingAssistantMessageId = useCallback((): string => {
    const currentMessages = messagesRef.current;
    const lastMessage = currentMessages.at(-1);

    if (lastMessage && lastMessage.role === "assistant" && lastMessage.status === "streaming") {
      return lastMessage.id;
    }

    const messageId = createId("assistant");
    setMessages((prev) => [
      ...prev,
      { id: messageId, role: "assistant", content: "", status: "streaming" },
    ]);
    return messageId;
  }, []);

  const upsertAssistantMessage = useCallback(
    (assistantMessageId: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) => {
        const index = prev.findIndex((item) => item.id === assistantMessageId);
        if (index >= 0) {
          const next = [...prev];
          next[index] = {
            ...next[index],
            ...patch,
          };
          return next;
        }

        return [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            status: "streaming",
            ...patch,
          },
        ];
      });
    },
    [],
  );

  const applyUsage = useCallback((usage?: AgentJobSnapshot["usage"]) => {
    if (!usage) {
      return;
    }

    usageStatsRef.current = {
      inputTokens: usage.input_tokens || 0,
      cachedInputTokens: usage.cached_input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
    };
  }, []);

  const applyJobEvent = useCallback(
    (event: AgentJobEvent, traceEnabled: boolean, assistantMessageId: string) => {
      if (event.type === "chunk") {
        setResponsePhase("streaming");
        setMessages((prev) =>
          prev.some((item) => item.id === assistantMessageId)
            ? prev.map((item) =>
                item.id === assistantMessageId
                  ? {
                      ...item,
                      content: `${item.content}${event.text}`,
                      status: "streaming",
                      responseSeconds: undefined,
                    }
                  : item,
              )
            : [
                ...prev,
                {
                  id: assistantMessageId,
                  role: "assistant",
                  content: event.text,
                  status: "streaming",
                },
              ],
        );
        return;
      }

      if (event.type === "reasoning" && traceEnabled) {
        setReasoningLogs((prev) => [...prev, event.text].slice(-8));
        return;
      }

      if (event.type === "command" && traceEnabled) {
        setActiveCommand(event.status === "in_progress" ? event.command || "명령 실행 중" : null);
        return;
      }

      if (event.type === "usage" && traceEnabled) {
        applyUsage(event.usage);
        return;
      }

      if (event.type === "error") {
        setErrorMessage(event.message || "작업 중 오류가 발생했습니다.");
      }
    },
    [applyUsage],
  );

  const syncJobSnapshot = useCallback(
    (job: AgentJobSnapshot, assistantMessageId: string) => {
      if (streamRef.current) {
        streamRef.current.jobId = job.jobId;
        streamRef.current.trace = job.trace;
      }

      setActiveJobId(job.jobId);
      setActivePromptMode(job.promptMode ?? null);

      if (job.startedAt) {
        const startedAt = Date.parse(job.startedAt);
        if (!Number.isNaN(startedAt) && streamRef.current) {
          streamRef.current.requestStartedAt = startedAt;
        }
      }

      if (job.trace) {
        applyUsage(job.usage);
      }

      setContextCapacityMeta((prevMeta) => (job.contextMeta ? { ...job.contextMeta } : prevMeta));

      const content = job.assistantText || "";
      if (content.trim().length > 0) {
        setResponsePhase("streaming");
      } else if (job.status === "queued" || job.status === "running") {
        setResponsePhase("waiting");
      }

      upsertAssistantMessage(assistantMessageId, {
        content,
        status:
          job.status === "failed"
            ? "error"
            : job.status === "completed"
              ? "done"
              : "streaming",
      });
    },
    [applyUsage, upsertAssistantMessage],
  );

  const finalizeJob = useCallback(
    (job: AgentJobSnapshot, assistantMessageId: string) => {
      setContextCapacityMeta((prevMeta) => (job.contextMeta ? { ...job.contextMeta } : prevMeta));

      if (job.trace) {
        applyUsage(job.usage);
      }

      const requestStartedAt = streamRef.current?.requestStartedAt ?? Date.now();
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - requestStartedAt) / 1000));
      const finalContent =
        job.assistantText.trim() || (job.status === "failed" ? "응답 생성에 실패했습니다." : "응답이 비어 있습니다.");

      upsertAssistantMessage(assistantMessageId, {
        content: finalContent,
        status: job.status === "failed" ? "error" : "done",
        responseSeconds: elapsedSeconds,
        usage: usageStatsRef.current ?? undefined,
      });

      if (job.status === "failed") {
        setErrorMessage(job.error || "에이전트 실행이 실패했습니다.");
      }

      setActiveCommand(null);
      setActiveJobId(null);
      setActivePromptMode(null);
      usageStatsRef.current = null;
      setResponsePhase("idle");
      setIsLoading(false);
      clearStreamState();
    },
    [applyUsage, clearStreamState, upsertAssistantMessage],
  );

  const failActiveStream = useCallback(
    (message: string) => {
      const active = streamRef.current;
      setErrorMessage(message);

      if (active) {
        upsertAssistantMessage(active.assistantMessageId, {
          content:
            messagesRef.current.find((item) => item.id === active.assistantMessageId)?.content ||
            "스트림 연결에 실패했습니다.",
          status: "error",
          responseSeconds: Math.max(1, Math.round((Date.now() - active.requestStartedAt) / 1000)),
        });
      }

      setActiveCommand(null);
      setActiveJobId(null);
      setActivePromptMode(null);
      usageStatsRef.current = null;
      setResponsePhase("idle");
      setIsLoading(false);
      clearStreamState();
    },
    [clearStreamState, upsertAssistantMessage],
  );

  const consumeAgentStream = useCallback(
    async (stream: ReadableStream<Uint8Array>, assistantMessageId: string) => {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawTerminalEvent = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseChunk(buffer);
          buffer = parsed.remainder;

          for (const event of parsed.events) {
            if (event.type === "created") {
              syncJobSnapshot(event.job, assistantMessageId);
              continue;
            }

            if (event.type === "snapshot") {
              for (const jobEvent of event.events) {
                applyJobEvent(jobEvent, event.job.trace, assistantMessageId);
              }
              syncJobSnapshot(event.job, assistantMessageId);
              continue;
            }

            if (event.type === "event") {
              if (streamRef.current) {
                streamRef.current.jobId = event.jobId;
              }
              applyJobEvent(event.event, streamRef.current?.trace === true, assistantMessageId);
              continue;
            }

            if (event.type === "done") {
              sawTerminalEvent = true;
              finalizeJob(event.job, assistantMessageId);
              continue;
            }

            if (event.type === "error") {
              failActiveStream(event.message);
              sawTerminalEvent = true;
              return;
            }
          }
        }

        if (!sawTerminalEvent && streamRef.current) {
          failActiveStream("스트림 연결이 예상보다 일찍 종료되었습니다.");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        failActiveStream(toErrorMessage(error));
      } finally {
        reader.releaseLock();
      }
    },
    [applyJobEvent, failActiveStream, finalizeJob, syncJobSnapshot],
  );

  const startExistingJobStream = useCallback(
    async (jobId: string, assistantMessageId: string, requestStartedAt: number) => {
      stopJobStream();

      const controller = new AbortController();
      streamAbortRef.current = controller;
      streamRef.current = {
        jobId,
        assistantMessageId,
        requestStartedAt,
        trace: false,
      };
      setContextCapacityMeta(null);
      setActiveJobId(jobId);
      setActivePromptMode(null);
      setIsLoading(true);
      setResponsePhase("waiting");

      try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/stream`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          let message = `작업 스트림 연결 실패 (${response.status})`;

          try {
            const parsed = (await response.json()) as { error?: string };
            if (parsed.error) {
              message = parsed.error;
            }
          } catch {
            // ignore parse error
          }

          throw new Error(message);
        }

        await consumeAgentStream(response.body, assistantMessageId);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        failActiveStream(toErrorMessage(error));
      }
    },
    [consumeAgentStream, failActiveStream, stopJobStream],
  );

  const estimatedContextCapacityMeta = useMemo(() => {
    try {
      return computePromptBuildMeta({
        messages: toPromptHistoryMessages(messages),
        userMessage: input,
        maxContextLength: getModelContextLength(selectedModel),
        allowEmptyUserMessage: true,
      });
    } catch {
      return null;
    }
  }, [input, messages, selectedModel]);

  const contextCapacityStats = useMemo<ContextCapacityStats | null>(() => {
    const effectiveMeta = isLoading ? contextCapacityMeta ?? estimatedContextCapacityMeta : estimatedContextCapacityMeta;
    if (!effectiveMeta) {
      return null;
    }

    const total = Math.max(0, toFiniteNumber(effectiveMeta.appliedContextLength));
    const fixedLength = Math.max(0, toFiniteNumber(effectiveMeta.fixedLength));
    const conversationConsumedLength = Math.max(0, toFiniteNumber(effectiveMeta.conversationConsumedLength));
    const used = Math.max(0, Math.min(total, fixedLength + conversationConsumedLength));
    const remaining = Math.max(0, total - used);
    const historyBudget = Math.max(0, toFiniteNumber(effectiveMeta.conversationBudget));
    const historyUsed = Math.max(0, Math.min(historyBudget, conversationConsumedLength));

    return {
      used,
      total,
      remaining,
      historyUsed,
      historyBudget,
      requested: Math.max(0, toFiniteNumber(effectiveMeta.requestedContextLength)),
    };
  }, [contextCapacityMeta, estimatedContextCapacityMeta, isLoading]);

  useEffect(() => {
    if (!hasValidSessionId) {
      return;
    }

    if (forceNewSession && !requestedSessionId) {
      setMessages([]);
      setActiveJobId(null);
      setActivePromptMode(null);
      setResponsePhase("idle");
      setIsLoading(false);
      setIsLoadingSession(false);
      stopJobStream();
      return;
    }

    stopJobStream();

    const loadSession = async () => {
      setIsLoadingSession(true);

      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          setMessages([]);
          return;
        }

        const payload = (await response.json()) as { session?: Session };
        if (!payload.session) {
          setMessages([]);
          return;
        }

        let nextMessages = toChatMessages(payload.session.messages);
        let resumeAssistantMessageId: string | null = null;

        if (payload.session.activeJobId) {
          const lastMessage = nextMessages.at(-1);
          if (!lastMessage || lastMessage.role !== "assistant") {
            resumeAssistantMessageId = createId("assistant");
            nextMessages = [
              ...nextMessages,
              {
                id: resumeAssistantMessageId,
                role: "assistant",
                content: "",
                status: "streaming",
              },
            ];
          } else {
            resumeAssistantMessageId = lastMessage.id;
          }
        }

        setMessages(nextMessages);

        if (payload.session.model && isSupportedModel(payload.session.model)) {
          setSelectedModel(payload.session.model);
        }

        if (
          payload.session.reasoningEffort &&
          isSupportedReasoningEffort(payload.session.reasoningEffort)
        ) {
          setSelectedReasoningEffort(payload.session.reasoningEffort);
        }

        if (payload.session.activeJobId && resumeAssistantMessageId) {
          void startExistingJobStream(payload.session.activeJobId, resumeAssistantMessageId, Date.now());
        } else {
          setActiveJobId(null);
          setActivePromptMode(null);
          setResponsePhase("idle");
          setIsLoading(false);
          stopJobStream();
        }
      } catch {
        setMessages([]);
        setActiveJobId(null);
        setActivePromptMode(null);
        setResponsePhase("idle");
        setIsLoading(false);
      } finally {
        setIsLoadingSession(false);
      }
    };

    void loadSession();
  }, [
    forceNewSession,
    hasValidSessionId,
    requestedSessionId,
    sessionId,
    startExistingJobStream,
    stopJobStream,
  ]);

  useEffect(() => {
    return () => {
      stopJobStream();
    };
  }, [stopJobStream]);

  useEffect(() => {
    if (!isLoading) {
      setWaitingSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const baseStartedAt = streamRef.current?.requestStartedAt ?? startedAt;
      setWaitingSeconds(Math.floor((Date.now() - baseStartedAt) / 1000));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isLoading]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    window.requestAnimationFrame(() => {
      const latest = messagesContainerRef.current;
      if (latest) {
        latest.scrollTop = latest.scrollHeight;
      }
    });
  }, [messages, sessionId]);

  const closeFileSuggestions = useCallback(() => {
    setFileSuggestions([]);
    setSelectedSuggestionIndex(0);
    setAtTokenStart(null);
    setAtTokenQuery("");
    setIsSuggestionLoading(false);
  }, []);

  const hideSuggestionsForEmptyContext = useCallback(() => {
    setFileSuggestions([]);
    setSelectedSuggestionIndex(0);
  }, []);

  const handleSuggestionSelect = useCallback(
    (path: string) => {
      const textarea = inputRef.current;
      if (textarea === null || atTokenStart === null) {
        return;
      }

      const currentInput = input;
      const cursor = textarea.selectionStart ?? currentInput.length;
      const replacement = `@${path} `;
      const nextInput = `${currentInput.slice(0, atTokenStart)}${replacement}${currentInput.slice(cursor)}`;

      setInput(nextInput);
      closeFileSuggestions();

      const nextCursor = atTokenStart + replacement.length;
      window.requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [atTokenStart, closeFileSuggestions, input],
  );

  const handleInputChange: AgentChatViewModel["handleInputChange"] = useCallback(
    (event) => {
      const value = event.target.value;
      const cursor = event.target.selectionStart ?? value.length;
      const tokenContext = getAtTokenContext(value, cursor);

      setInput(value);

      if (!tokenContext) {
        closeFileSuggestions();
        return;
      }

      setAtTokenStart(tokenContext.start);
      setAtTokenQuery(tokenContext.query);
    },
    [closeFileSuggestions],
  );

  useEffect(() => {
    if (atTokenStart === null) {
      return;
    }

    const requestId = ++fileSuggestionRequestRef.current;
    if (fileSuggestionRef.current) {
      fileSuggestionRef.current.abort();
    }

    const controller = new AbortController();
    fileSuggestionRef.current = controller;
    setIsSuggestionLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/files?q=${encodeURIComponent(atTokenQuery)}&limit=24`, {
          method: "GET",
          headers: {
            accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          if (requestId === fileSuggestionRequestRef.current) {
            hideSuggestionsForEmptyContext();
          }
          return;
        }

        const payload = (await response.json()) as { files?: string[] };
        if (requestId !== fileSuggestionRequestRef.current) {
          return;
        }

        setFileSuggestions((payload.files ?? []).map((path) => ({ path })));
        setSelectedSuggestionIndex(0);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (requestId === fileSuggestionRequestRef.current) {
          hideSuggestionsForEmptyContext();
        }
      } finally {
        if (requestId === fileSuggestionRequestRef.current) {
          setIsSuggestionLoading(false);
        }
      }
    }, 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [atTokenQuery, atTokenStart, hideSuggestionsForEmptyContext]);

  const submitMessage = useCallback(
    async (rawMessage: string, options?: { keepInput?: boolean }) => {
      if (isLoading) {
        return;
      }

      const message = rawMessage.trim();
      if (!message) {
        setErrorMessage("메시지를 입력해주세요.");
        return;
      }

      if (message.length > MAX_INPUT_LENGTH) {
        setErrorMessage(`입력 길이는 최대 ${MAX_INPUT_LENGTH.toLocaleString()}자입니다.`);
        return;
      }

      setErrorMessage(null);
      setLastSubmittedMessage(message);
      const requestStartedAt = Date.now();

      setReasoningLogs([]);
      setActiveCommand(null);
      usageStatsRef.current = null;
      setContextCapacityMeta(null);
      setResponsePhase("waiting");
      setIsLoading(true);

      try {
        stopJobStream();

        const controller = new AbortController();
        streamAbortRef.current = controller;

        const response = await fetch("/api/agent/stream", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            sessionId,
            message,
            model: selectedModel,
            reasoningEffort: selectedReasoningEffort,
            trace: traceMode,
          }),
        });

        if (response.status === 409) {
          const parsed = (await response.json()) as { error?: string; activeJobId?: string };
          if (parsed.activeJobId) {
            clearStreamState();
            const assistantMessageId = getOrCreateStreamingAssistantMessageId();
            void startExistingJobStream(parsed.activeJobId, assistantMessageId, requestStartedAt);
            setErrorMessage(parsed.error || "이미 실행 중인 작업이 있습니다.");
            return;
          }

          throw new Error(parsed.error || "이미 실행 중인 작업이 있습니다.");
        }

        if (!response.ok || !response.body) {
          let errorText = `요청 실패 (${response.status})`;

          try {
            const parsed = (await response.json()) as { error?: string };
            if (parsed.error) {
              errorText = parsed.error;
            }
          } catch {
            const raw = await response.text();
            if (raw.trim()) {
              errorText = raw.trim();
            }
          }

          throw new Error(errorText);
        }

        if (!options?.keepInput) {
          setInput("");
        }

        const userMessageId = createId("user");
        const assistantMessageId = createId("assistant");
        streamRef.current = {
          jobId: null,
          assistantMessageId,
          requestStartedAt,
          trace: traceMode,
        };
        setMessages((prev) => [
          ...prev,
          { id: userMessageId, role: "user", content: message, status: "done" },
          { id: assistantMessageId, role: "assistant", content: "", status: "streaming" },
        ]);

        await consumeAgentStream(response.body, assistantMessageId);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        failActiveStream(toErrorMessage(error));
      }
    },
    [
      clearStreamState,
      consumeAgentStream,
      failActiveStream,
      getOrCreateStreamingAssistantMessageId,
      isLoading,
      selectedModel,
      selectedReasoningEffort,
      sessionId,
      startExistingJobStream,
      stopJobStream,
      traceMode,
    ],
  );

  const handleSubmit: AgentChatViewModel["handleSubmit"] = useCallback(
    (event) => {
      event.preventDefault();
      void submitMessage(input);
    },
    [input, submitMessage],
  );

  const handleMessageKeyDown: AgentChatViewModel["handleMessageKeyDown"] = useCallback(
    (event) => {
      if (fileSuggestions.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedSuggestionIndex((prev) => (prev + 1) % fileSuggestions.length);
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedSuggestionIndex((prev) => (prev - 1 + fileSuggestions.length) % fileSuggestions.length);
          return;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const suggestion = fileSuggestions[selectedSuggestionIndex];
          if (suggestion) {
            handleSuggestionSelect(suggestion.path);
          }
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          closeFileSuggestions();
          return;
        }
      }

      if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
        return;
      }

      event.preventDefault();

      const trimmedLength = input.trim().length;
      const isSendDisabled = !hasValidSessionId || isLoading || trimmedLength === 0;
      if (!isSendDisabled) {
        void submitMessage(input);
      }
    },
    [
      closeFileSuggestions,
      fileSuggestions,
      handleSuggestionSelect,
      hasValidSessionId,
      input,
      isLoading,
      selectedSuggestionIndex,
      submitMessage,
    ],
  );

  const canRetry = useMemo(() => !isLoading && !!errorMessage && !!lastSubmittedMessage, [
    errorMessage,
    isLoading,
    lastSubmittedMessage,
  ]);

  const handleRetry = useCallback(() => {
    if (lastSubmittedMessage) {
      void submitMessage(lastSubmittedMessage, { keepInput: true });
    }
  }, [lastSubmittedMessage, submitMessage]);

  const normalizedSelectedModel = useMemo(
    () => (SUPPORTED_MODELS.includes(selectedModel) ? selectedModel : DEFAULT_MODEL),
    [selectedModel],
  );
  const normalizedReasoningEffort = useMemo(
    () =>
      SUPPORTED_REASONING_EFFORTS.includes(selectedReasoningEffort)
        ? selectedReasoningEffort
        : DEFAULT_REASONING_EFFORT,
    [selectedReasoningEffort],
  );

  return {
    sessionId,
    hasValidSessionId,
    input,
    inputLength: input.trim().length,
    isLoading,
    isLoadingSession,
    errorMessage,
    responsePhase,
    waitingSeconds,
    reasoningLogs,
    activeCommand,
    activeJobId,
    activePromptMode,
    messages,
    selectedModel: normalizedSelectedModel,
    selectedReasoningEffort: normalizedReasoningEffort,
    traceMode,
    contextCapacityMeta,
    contextCapacityStats,
    fileSuggestions,
    isSuggestionLoading,
    selectedSuggestionIndex,
    atTokenStart,
    canRetry,
    messagesContainerRef,
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
  };
}
