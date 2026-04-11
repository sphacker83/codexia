import type { ModelProvider } from "./models";

export type Role = "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
  createdAt: string;
}

export interface Session {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  model?: string;
  reasoningEffort?: string;
  providerSessionId?: string;
  providerSessionProvider?: ModelProvider;
  activeJobId?: string;
  messages: Message[];
}

export interface AgentRequest {
  sessionId: string;
  message: string;
  model?: string;
  reasoningEffort?: string;
  trace?: boolean;
}

export type AgentJobSource = "web" | "telegram";

export interface SessionSummary {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  lastMessagePreview?: string;
  messageCount: number;
  model?: string;
  reasoningEffort?: string;
  activeJobId?: string;
}

export type AgentJobStatus = "queued" | "running" | "completed" | "failed";

export interface AgentJobUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
}

export interface PromptBuildMeta {
  requestedContextLength: number;
  appliedContextLength: number;
  fixedLength: number;
  conversationBudget: number;
  conversationConsumedLength: number;
  selectedMessageCount: number;
  droppedMessageCount: number;
  promptLength: number;
}

export type AgentJobEvent =
  | { id: number; createdAt: string; type: "chunk"; text: string }
  | { id: number; createdAt: string; type: "reasoning"; text: string }
  | {
      id: number;
      createdAt: string;
      type: "command";
      command: string;
      status: "in_progress" | "completed";
      exitCode?: number | null;
    }
  | { id: number; createdAt: string; type: "status"; phase: "started" | "completed" }
  | { id: number; createdAt: string; type: "usage"; usage: AgentJobUsage }
  | { id: number; createdAt: string; type: "metric"; name: "ttfb_ms"; value: number }
  | { id: number; createdAt: string; type: "error"; message: string };

export interface AgentJob {
  jobId: string;
  sessionId: string;
  message: string;
  model: string;
  reasoningEffort: string;
  trace: boolean;
  source?: AgentJobSource;
  ownerId?: string;
  heartbeatAt?: string;
  status: AgentJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  assistantText: string;
  error?: string;
  usage?: AgentJobUsage;
  contextMeta?: PromptBuildMeta;
  lastEventId: number;
  events: AgentJobEvent[];
}

export interface AgentJobSnapshot {
  jobId: string;
  sessionId: string;
  status: AgentJobStatus;
  trace: boolean;
  ownerId?: string;
  heartbeatAt?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  assistantText: string;
  error?: string;
  usage?: AgentJobUsage;
  contextMeta?: PromptBuildMeta;
  lastEventId: number;
}

export type AgentJobStreamEvent =
  | { type: "created"; job: AgentJobSnapshot }
  | { type: "snapshot"; job: AgentJobSnapshot; events: AgentJobEvent[] }
  | { type: "event"; jobId: string; event: AgentJobEvent }
  | { type: "done"; job: AgentJobSnapshot }
  | { type: "error"; message: string; jobId?: string };
