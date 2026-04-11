"use client";

import type { ChangeEventHandler, FormEventHandler, KeyboardEventHandler, RefObject } from "react";

import type { SupportedModel } from "@/src/core/agent/models";
import type { SupportedReasoningEffort } from "@/src/core/agent/reasoning";
import type { AgentPromptMode, PromptBuildMeta } from "@/src/core/agent/types";

export type ChatRole = "user" | "assistant";
export type ChatStatus = "streaming" | "done" | "error";
export type ResponsePhase = "idle" | "waiting" | "streaming";

export interface UsageStats {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  status: ChatStatus;
  responseSeconds?: number;
  usage?: UsageStats;
}

export interface FileSuggestion {
  path: string;
}

export interface ContextCapacityStats {
  used: number;
  total: number;
  remaining: number;
  historyUsed: number;
  historyBudget: number;
  requested: number;
}

export interface AgentChatViewModel {
  sessionId: string;
  hasValidSessionId: boolean;
  input: string;
  inputLength: number;
  isLoading: boolean;
  isLoadingSession: boolean;
  errorMessage: string | null;
  responsePhase: ResponsePhase;
  waitingSeconds: number;
  reasoningLogs: string[];
  activeCommand: string | null;
  activeJobId: string | null;
  activePromptMode: AgentPromptMode | null;
  messages: ChatMessage[];
  selectedModel: SupportedModel;
  selectedReasoningEffort: SupportedReasoningEffort;
  traceMode: boolean;
  contextCapacityMeta: PromptBuildMeta | null;
  contextCapacityStats: ContextCapacityStats | null;
  fileSuggestions: FileSuggestion[];
  isSuggestionLoading: boolean;
  selectedSuggestionIndex: number;
  atTokenStart: number | null;
  canRetry: boolean;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  setSelectedModel: (model: SupportedModel) => void;
  setSelectedReasoningEffort: (reasoningEffort: SupportedReasoningEffort) => void;
  setTraceMode: (traceMode: boolean) => void;
  handleInputChange: ChangeEventHandler<HTMLTextAreaElement>;
  handleMessageKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  handleSubmit: FormEventHandler<HTMLFormElement>;
  handleRetry: () => void;
  handleSuggestionSelect: (path: string) => void;
  closeFileSuggestions: () => void;
}

export const MAX_INPUT_LENGTH = 20_000;
export const INPUT_PANEL_WIDTH_CLASS = "w-full max-w-[52rem]";
