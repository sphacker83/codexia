import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  isAgentCliRunnerError,
  runAgentCli,
  type RunAgentCliResult,
} from "@/src/infrastructure/agent/codex-cli-executor";
import {
  DEFAULT_SYSTEM_PROMPT,
  buildPromptWithMeta,
} from "@/src/core/agent/prompt-builder";
import { getModelContextLength, getModelProvider } from "@/src/core/agent/models";
import {
  appendMessage,
  createMessage,
  listSessions,
  loadExistingSession,
  loadSession,
  recordUserTurn,
  setSessionProviderSession,
  setSessionTitleIfMissing,
  setSessionActiveJob,
} from "@/src/infrastructure/agent/session-file-store";
import { writeTextFileAtomically } from "@/src/infrastructure/atomic-file";
import { getAgentSystemPrompt } from "@/src/core/workspace/policy";
import type {
  AgentJob,
  AgentJobEvent,
  AgentJobSource,
  AgentJobUsage,
  AgentJobStatus,
  Session,
  SessionSummary,
} from "@/src/core/agent/types";

const JOBS_DIRECTORY = path.join(process.cwd(), "data", "jobs");
const JOB_FILE_EXTENSION = ".json";
const JOB_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;
const ACTIVE_JOB_STATUS: AgentJobStatus[] = ["queued", "running"];
const CANCEL_MESSAGE = "작업이 사용자에 의해 취소되었습니다.";
const STALE_JOB_MESSAGE = "작업 실행이 중단되어 자동으로 실패 처리되었습니다.";
const JOB_HEARTBEAT_INTERVAL_MS = 5_000;
const JOB_STALE_TIMEOUT_MS = 45_000;
const JOB_OWNER_GRACE_TIMEOUT_MS = 15 * 60 * 1000;
const PROCESS_OWNER_ID = `pid:${process.pid}:${randomUUID().slice(0, 8)}`;

interface CreateAgentJobInput {
  sessionId: string;
  message: string;
  model: string;
  reasoningEffort: string;
  trace: boolean;
  source?: AgentJobSource;
}

interface CodexJsonEvent {
  type?: "thread.started" | "turn.started" | "turn.completed" | "turn.failed" | "error" | "item.started" | "item.completed";
  thread_id?: string;
  message?: string;
  item?: {
    type?: "agent_message" | "command_execution" | "reasoning";
    text?: string;
    command?: string;
    exit_code?: number | null;
  };
  usage?: AgentJobUsage;
}

interface GeminiTraceStats {
  input_tokens?: number;
  output_tokens?: number;
  cached?: number;
}

interface GeminiTraceEvent {
  type?: "init" | "message" | "tool_use" | "tool_result" | "error" | "result";
  role?: "user" | "assistant";
  content?: string;
  message?: string;
  delta?: boolean;
  tool_name?: string;
  tool_id?: string;
  parameters?: Record<string, unknown>;
  status?: "success" | "error";
  output?: string;
  severity?: "warning" | "error";
  error?: {
    type?: string;
    message?: string;
  };
  stats?: GeminiTraceStats;
}

class ActiveJobError extends Error {
  activeJobId: string;

  constructor(activeJobId: string) {
    super("An active job already exists for this session.");
    this.activeJobId = activeJobId;
  }
}

const runningJobIds = new Set<string>();
const runningJobCancels = new Map<string, () => void>();
const cancelledJobIds = new Set<string>();
const jobWriteQueues = new Map<string, Promise<void>>();

type AgentJobEventInput = AgentJobEvent extends infer T
  ? T extends AgentJobEvent
    ? Omit<T, "id" | "createdAt">
    : never
  : never;

function nowIso(): string {
  return new Date().toISOString();
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function formatUsageFooter(usage?: AgentJobUsage): string {
  if (!usage) {
    return "";
  }

  return [
    "",
    `토큰 사용량: 입력 ${(usage.input_tokens || 0).toLocaleString()} / 캐시 ${(usage.cached_input_tokens || 0).toLocaleString()} / 출력 ${(usage.output_tokens || 0).toLocaleString()}`,
  ].join("\n");
}

function assertValidJobId(jobId: string): void {
  if (!JOB_ID_PATTERN.test(jobId)) {
    throw new Error("Invalid jobId format.");
  }
}

function getJobFilePath(jobId: string): string {
  assertValidJobId(jobId);
  return path.join(JOBS_DIRECTORY, `${jobId}${JOB_FILE_EXTENSION}`);
}

async function ensureJobsDirectory(): Promise<void> {
  await fs.mkdir(JOBS_DIRECTORY, { recursive: true });
}

function createJobId(): string {
  return `job-${randomUUID().replaceAll("-", "")}`;
}

function createInitialJob(input: CreateAgentJobInput): AgentJob {
  const now = nowIso();
  return {
    jobId: createJobId(),
    sessionId: input.sessionId,
    message: input.message,
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    trace: input.trace,
    source: input.source,
    ownerId: PROCESS_OWNER_ID,
    heartbeatAt: now,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    assistantText: "",
    lastEventId: 0,
    events: [],
  };
}

async function readJobFile(jobId: string): Promise<AgentJob | null> {
  const filePath = getJobFilePath(jobId);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as AgentJob;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeJobFile(job: AgentJob): Promise<void> {
  const filePath = getJobFilePath(job.jobId);
  const payload = `${JSON.stringify(job, null, 2)}\n`;
  await ensureJobsDirectory();
  await writeTextFileAtomically(filePath, payload);
}

function appendEvent(job: AgentJob, event: AgentJobEventInput): AgentJobEvent {
  const nextEvent: AgentJobEvent = {
    ...event,
    id: job.lastEventId + 1,
    createdAt: nowIso(),
  } as AgentJobEvent;
  job.events.push(nextEvent);
  job.lastEventId = nextEvent.id;
  job.updatedAt = nowIso();
  return nextEvent;
}

async function persistJob(job: AgentJob): Promise<void> {
  job.updatedAt = nowIso();
  const pendingWrite = jobWriteQueues.get(job.jobId) ?? Promise.resolve();
  const nextWrite = pendingWrite
    .catch(() => undefined)
    .then(async () => {
      await writeJobFile(job);
    });

  jobWriteQueues.set(job.jobId, nextWrite);

  try {
    await nextWrite;
  } finally {
    if (jobWriteQueues.get(job.jobId) === nextWrite) {
      jobWriteQueues.delete(job.jobId);
    }
  }
}

function isActiveJobStatus(status: AgentJobStatus): boolean {
  return ACTIVE_JOB_STATUS.includes(status);
}

function getLeaseTimestamp(job: AgentJob): number {
  const timestamp = Date.parse(job.heartbeatAt || job.startedAt || job.updatedAt || job.createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function parseOwnerPid(ownerId?: string): number | null {
  if (!ownerId?.startsWith("pid:")) {
    return null;
  }

  const [, rawPid] = ownerId.split(":", 3);
  const pid = Number.parseInt(rawPid || "", 10);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      ((error as NodeJS.ErrnoException).code === "ESRCH" ||
        (error as NodeJS.ErrnoException).code === "ENOENT")
    ) {
      return false;
    }
    return true;
  }
}

function hasLiveOwnerProcess(job: AgentJob): boolean {
  const pid = parseOwnerPid(job.ownerId);
  if (!pid) {
    return false;
  }
  return isProcessAlive(pid);
}

function isStaleJob(job: AgentJob): boolean {
  if (!isActiveJobStatus(job.status)) {
    return false;
  }
  if (runningJobIds.has(job.jobId)) {
    return false;
  }
  const leaseAgeMs = Date.now() - getLeaseTimestamp(job);
  if (hasLiveOwnerProcess(job)) {
    return leaseAgeMs > JOB_OWNER_GRACE_TIMEOUT_MS;
  }
  return leaseAgeMs > JOB_STALE_TIMEOUT_MS;
}

async function clearSessionActiveJobIfMatches(sessionId: string, jobId: string): Promise<void> {
  const session = await loadExistingSession(sessionId);
  if (!session || session.activeJobId !== jobId) {
    return;
  }
  await setSessionActiveJob(sessionId, undefined);
}

async function recoverStaleJob(job: AgentJob, errorMessage: string = STALE_JOB_MESSAGE): Promise<AgentJob> {
  const latestJob = await readJobFile(job.jobId);
  if (!latestJob) {
    return job;
  }
  if (!isStaleJob(latestJob)) {
    return latestJob;
  }

  const confirmedJob = await readJobFile(job.jobId);
  if (!confirmedJob) {
    return latestJob;
  }
  if (!isStaleJob(confirmedJob)) {
    return confirmedJob;
  }

  confirmedJob.status = "failed";
  confirmedJob.error = errorMessage;
  confirmedJob.completedAt = nowIso();
  confirmedJob.heartbeatAt = nowIso();
  appendEvent(confirmedJob, { type: "error", message: errorMessage });
  await persistJob(confirmedJob);
  await appendMessage(confirmedJob.sessionId, createMessage("assistant", `[ERROR] ${errorMessage}`));
  await clearSessionActiveJobIfMatches(confirmedJob.sessionId, confirmedJob.jobId);
  return confirmedJob;
}

async function getNormalizedJob(jobId: string): Promise<AgentJob | null> {
  const job = await readJobFile(jobId);
  if (!job) {
    return null;
  }
  if (isStaleJob(job)) {
    return recoverStaleJob(job);
  }
  return job;
}

async function loadActiveJobIfExists(sessionId: string, activeJobId?: string): Promise<AgentJob | null> {
  if (!activeJobId) {
    return null;
  }
  const job = await getNormalizedJob(activeJobId);
  if (!job || job.sessionId !== sessionId) {
    await clearSessionActiveJobIfMatches(sessionId, activeJobId);
    return null;
  }
  if (!isActiveJobStatus(job.status)) {
    await clearSessionActiveJobIfMatches(sessionId, activeJobId);
    return null;
  }
  return job;
}

async function markJobFailed(job: AgentJob, errorMessage: string): Promise<void> {
  job.status = "failed";
  job.error = errorMessage;
  job.completedAt = nowIso();
  job.heartbeatAt = nowIso();
  appendEvent(job, { type: "error", message: errorMessage });
  await persistJob(job);
  await appendMessage(job.sessionId, createMessage("assistant", `[ERROR] ${errorMessage}`));
}

async function refreshJobHeartbeat(job: AgentJob): Promise<void> {
  if (!isActiveJobStatus(job.status) || isJobCancelled(job.jobId)) {
    return;
  }

  const latestJob = await readJobFile(job.jobId);
  if (!latestJob || !isActiveJobStatus(latestJob.status)) {
    if (latestJob) {
      job.status = latestJob.status;
      job.error = latestJob.error;
      job.completedAt = latestJob.completedAt;
    }
    return;
  }

  job.ownerId = PROCESS_OWNER_ID;
  job.heartbeatAt = nowIso();
  await persistJob(job);
}

function isJobCancelled(jobId: string): boolean {
  return cancelledJobIds.has(jobId);
}

function recordFirstByteLatency(job: AgentJob, startedAtMs: number, mode: "fast" | "trace"): void {
  const ttfbMs = Math.max(0, Date.now() - startedAtMs);
  appendEvent(job, { type: "metric", name: "ttfb_ms", value: ttfbMs });
  console.info(
    `[AgentJob:${job.jobId}] first-byte latency=${ttfbMs}ms mode=${mode} trace=${job.trace}`,
  );
}

async function executeTraceJob(
  job: AgentJob,
  startedAtMs: number,
  runner: RunAgentCliResult,
): Promise<void> {
  if (runner.runner === "gemini") {
    await executeGeminiTraceJob(job, startedAtMs, runner);
    return;
  }

  await executeCodexTraceJob(job, startedAtMs, runner);
}

async function executeCodexTraceJob(
  job: AgentJob,
  startedAtMs: number,
  runner: RunAgentCliResult,
): Promise<void> {
  const reader = runner.stream.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = "";
  let ttfbLogged = false;

  const handleJsonLine = async (line: string): Promise<void> => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let event: CodexJsonEvent;
    try {
      event = JSON.parse(trimmed) as CodexJsonEvent;
    } catch {
      return;
    }

    if (event.type === "thread.started" && typeof event.thread_id === "string" && event.thread_id) {
      await persistCodexSessionThread(job.sessionId, event.thread_id);
      return;
    }

    if (event.type === "error" && event.message) {
      throw new Error(event.message);
    }

    if (event.type === "item.started" && event.item?.type === "command_execution") {
      appendEvent(job, {
        type: "command",
        command: event.item.command || "",
        status: "in_progress",
      });
      await persistJob(job);
      return;
    }

    if (event.type === "item.completed" && event.item?.type === "command_execution") {
      appendEvent(job, {
        type: "command",
        command: event.item.command || "",
        status: "completed",
        exitCode: event.item.exit_code,
      });
      await persistJob(job);
      return;
    }

    if (event.type === "item.completed" && event.item?.type === "reasoning" && event.item.text) {
      appendEvent(job, { type: "reasoning", text: event.item.text });
      await persistJob(job);
      return;
    }

    if (event.type === "item.completed" && event.item?.type === "agent_message") {
      job.assistantText = event.item.text || "";
      await persistJob(job);
      return;
    }

    if (event.type === "turn.completed" && event.usage) {
      job.usage = event.usage;
      appendEvent(job, { type: "usage", usage: event.usage });
      await persistJob(job);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!ttfbLogged && value.byteLength > 0) {
        ttfbLogged = true;
        recordFirstByteLatency(job, startedAtMs, "trace");
        await persistJob(job);
      }
      lineBuffer += decoder.decode(value, { stream: true });
      while (true) {
        const newlineIndex = lineBuffer.indexOf("\n");
        if (newlineIndex < 0) {
          break;
        }
        const line = lineBuffer.slice(0, newlineIndex);
        lineBuffer = lineBuffer.slice(newlineIndex + 1);
        await handleJsonLine(line);
      }
    }
    lineBuffer += decoder.decode();
    if (lineBuffer.trim()) {
      await handleJsonLine(lineBuffer);
    }
    await runner.completed;
  } finally {
    reader.releaseLock();
  }
}

function formatGeminiToolLabel(event: GeminiTraceEvent): string {
  const toolName = event.tool_name?.trim() || "tool";
  if (!event.parameters || Object.keys(event.parameters).length === 0) {
    return toolName;
  }

  const rawParameters = JSON.stringify(event.parameters);
  const suffix = rawParameters.length > 120 ? `${rawParameters.slice(0, 117)}...` : rawParameters;
  return `${toolName} ${suffix}`;
}

function toGeminiUsage(stats?: GeminiTraceStats): AgentJobUsage | undefined {
  if (!stats) {
    return undefined;
  }

  return {
    input_tokens: stats.input_tokens || 0,
    cached_input_tokens: stats.cached || 0,
    output_tokens: stats.output_tokens || 0,
  };
}

async function executeGeminiTraceJob(
  job: AgentJob,
  startedAtMs: number,
  runner: RunAgentCliResult,
): Promise<void> {
  const reader = runner.stream.getReader();
  const decoder = new TextDecoder();
  const activeToolLabels = new Map<string, string>();
  let lineBuffer = "";
  let ttfbLogged = false;

  const handleJsonLine = async (line: string): Promise<void> => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let event: GeminiTraceEvent;
    try {
      event = JSON.parse(trimmed) as GeminiTraceEvent;
    } catch {
      return;
    }

    if (event.type === "message" && event.role === "assistant" && event.content) {
      job.assistantText += event.content;
      await persistJob(job);
      return;
    }

    if (event.type === "tool_use") {
      const command = formatGeminiToolLabel(event);
      if (event.tool_id) {
        activeToolLabels.set(event.tool_id, command);
      }
      appendEvent(job, {
        type: "command",
        command,
        status: "in_progress",
      });
      await persistJob(job);
      return;
    }

    if (event.type === "tool_result") {
      const command =
        (event.tool_id ? activeToolLabels.get(event.tool_id) : undefined) || "tool";
      appendEvent(job, {
        type: "command",
        command,
        status: "completed",
      });
      if (event.tool_id) {
        activeToolLabels.delete(event.tool_id);
      }
      if (event.status === "error" && event.error?.message) {
        appendEvent(job, { type: "reasoning", text: event.error.message });
      }
      await persistJob(job);
      return;
    }

    if (event.type === "error" && event.message) {
      if (event.severity === "warning") {
        appendEvent(job, { type: "reasoning", text: event.message });
      } else {
        appendEvent(job, { type: "error", message: event.message });
      }
      await persistJob(job);
      return;
    }

    if (event.type === "result") {
      const usage = toGeminiUsage(event.stats);
      if (usage) {
        job.usage = usage;
        appendEvent(job, { type: "usage", usage });
      }
      if (event.status === "error" && event.error?.message) {
        appendEvent(job, { type: "error", message: event.error.message });
      }
      await persistJob(job);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) {
        continue;
      }
      if (!ttfbLogged) {
        ttfbLogged = true;
        recordFirstByteLatency(job, startedAtMs, "trace");
        await persistJob(job);
      }
      lineBuffer += chunk;
      while (true) {
        const newlineIndex = lineBuffer.indexOf("\n");
        if (newlineIndex < 0) {
          break;
        }
        const line = lineBuffer.slice(0, newlineIndex);
        lineBuffer = lineBuffer.slice(newlineIndex + 1);
        await handleJsonLine(line);
      }
    }
    lineBuffer += decoder.decode();
    if (lineBuffer.trim()) {
      await handleJsonLine(lineBuffer);
    }
    await runner.completed;
  } finally {
    reader.releaseLock();
  }
}

async function executeFastJob(
  job: AgentJob,
  startedAtMs: number,
  runner: RunAgentCliResult,
): Promise<void> {
  if (runner.runner === "codex") {
    await executeCodexFastJob(job, startedAtMs, runner);
    return;
  }

  const reader = runner.stream.getReader();
  const decoder = new TextDecoder();
  let ttfbLogged = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) {
        continue;
      }
      if (!ttfbLogged) {
        ttfbLogged = true;
        recordFirstByteLatency(job, startedAtMs, "fast");
      }
      job.assistantText += chunk;
      appendEvent(job, { type: "chunk", text: chunk });
      await persistJob(job);
    }
    job.assistantText += decoder.decode();
    await runner.completed;
  } finally {
    reader.releaseLock();
  }
}

async function persistCodexSessionThread(sessionId: string, threadId: string): Promise<void> {
  await setSessionProviderSession(sessionId, "codex", threadId);
}

async function executeCodexFastJob(
  job: AgentJob,
  startedAtMs: number,
  runner: RunAgentCliResult,
): Promise<void> {
  const reader = runner.stream.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = "";
  let ttfbLogged = false;

  const handleJsonLine = async (line: string): Promise<void> => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let event: CodexJsonEvent;
    try {
      event = JSON.parse(trimmed) as CodexJsonEvent;
    } catch {
      return;
    }

    if (event.type === "thread.started" && typeof event.thread_id === "string" && event.thread_id) {
      await persistCodexSessionThread(job.sessionId, event.thread_id);
      return;
    }

    if (event.type === "error" && event.message) {
      throw new Error(event.message);
    }

    if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item.text) {
      job.assistantText = event.item.text;
      appendEvent(job, { type: "chunk", text: event.item.text });
      await persistJob(job);
      return;
    }

    if (event.type === "turn.completed" && event.usage) {
      job.usage = event.usage;
      appendEvent(job, { type: "usage", usage: event.usage });
      await persistJob(job);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) {
        continue;
      }
      if (!ttfbLogged) {
        ttfbLogged = true;
        recordFirstByteLatency(job, startedAtMs, "fast");
      }
      lineBuffer += chunk;
      while (true) {
        const newlineIndex = lineBuffer.indexOf("\n");
        if (newlineIndex < 0) {
          break;
        }
        const line = lineBuffer.slice(0, newlineIndex);
        lineBuffer = lineBuffer.slice(newlineIndex + 1);
        await handleJsonLine(line);
      }
    }
    lineBuffer += decoder.decode();
    if (lineBuffer.trim()) {
      await handleJsonLine(lineBuffer);
    }
    await runner.completed;
  } finally {
    reader.releaseLock();
  }
}

type ResolvedJobPrompt = {
  prompt: string;
  contextMeta?: AgentJob["contextMeta"];
  providerSessionId?: string;
  mode: AgentJob["promptMode"];
};

function shouldUseCodexProviderResume(job: AgentJob, session: Session): boolean {
  return (
    getModelProvider(job.model) === "codex" &&
    session.providerSessionProvider === "codex" &&
    Boolean(session.providerSessionId)
  );
}

function resolveJobPrompt(
  job: AgentJob,
  session: Session,
): ResolvedJobPrompt {
  // Codex resume는 provider thread continuity만 신뢰한다.
  // 같은 스레드를 이어가는 동안 로컬 conversation/system prompt를 다시 붙이면
  // 중복 컨텍스트가 생기고 토큰만 불어난다.
  if (shouldUseCodexProviderResume(job, session)) {
    return {
      prompt: job.message,
      providerSessionId: session.providerSessionId!,
      mode: "provider-resume",
    };
  }

  const disableDynamicContext = process.env.AGENT_DISABLE_DYNAMIC_CONTEXT === "1";
  const { prompt, meta } = buildPromptWithMeta({
    session,
    userMessage: job.message,
    systemPrompt: getAgentSystemPrompt(DEFAULT_SYSTEM_PROMPT, {
      channel: job.source === "telegram" ? "telegram" : "web",
    }),
    maxContextLength: getModelContextLength(job.model),
    disableDynamicContext,
  });

  return {
    prompt,
    contextMeta: meta,
    mode: "fresh-start",
  };
}

async function runJob(jobId: string): Promise<void> {
  if (runningJobIds.has(jobId)) {
    return;
  }

  runningJobIds.add(jobId);
  try {
    const job = await readJobFile(jobId);
    if (!job) {
      return;
    }
    if (job.status === "completed" || job.status === "failed") {
      return;
    }

    job.status = "running";
    job.ownerId = PROCESS_OWNER_ID;
    job.startedAt = nowIso();
    job.heartbeatAt = job.startedAt;
    appendEvent(job, { type: "status", phase: "started" });
    await persistJob(job);
    const heartbeat = setInterval(() => {
      void refreshJobHeartbeat(job);
    }, JOB_HEARTBEAT_INTERVAL_MS);

    const session = await loadSession(job.sessionId);
    const shouldSetAutoTitle = session.messages.length === 0 && !session.title?.trim();
    const promptState = resolveJobPrompt(job, session);
    const prompt = promptState.prompt;
    job.contextMeta = promptState.contextMeta;
    job.promptMode = promptState.mode;
    if (promptState.contextMeta) {
      const meta = promptState.contextMeta;
      console.info(
        `[AgentJob:${job.jobId}] mode=${promptState.mode}, prompt=${meta.promptLength} chars, context=${meta.appliedContextLength}/${meta.requestedContextLength}, budget=${meta.conversationBudget}, selected=${meta.selectedMessageCount}, dropped=${meta.droppedMessageCount}`,
      );
    } else {
      console.info(
        `[AgentJob:${job.jobId}] mode=${promptState.mode}, prompt=${prompt.length} chars, provider-resume=${promptState.providerSessionId ? "on" : "off"}`,
      );
    }

    const disableParallelSessionWrite = process.env.AGENT_DISABLE_PARALLEL_SESSION_WRITE === "1";
    const persistUserTurnPromise = recordUserTurn(job.sessionId, {
      model: job.model,
      reasoningEffort: job.reasoningEffort,
      userMessage: job.message,
    });
    if (disableParallelSessionWrite) {
      await persistUserTurnPromise;
    }
    const startedAtMs = Date.parse(job.startedAt || nowIso());

    try {
      const usesJsonOutput = job.trace || getModelProvider(job.model) === "codex";
      const runner = runAgentCli({
        prompt,
        model: job.model,
        reasoningEffort: job.reasoningEffort,
        jsonOutput: usesJsonOutput,
        sessionId: promptState.providerSessionId,
      });
      runningJobCancels.set(job.jobId, runner.cancel);

      if (job.trace) {
        await executeTraceJob(job, startedAtMs, runner);
      } else {
        await executeFastJob(job, startedAtMs, runner);
      }

      if (isJobCancelled(job.jobId)) {
        await markJobFailed(job, CANCEL_MESSAGE);
        return;
      }

      if (!disableParallelSessionWrite) {
        await persistUserTurnPromise;
      }

      const baseFinalText = job.assistantText.trim() || "응답이 비어 있습니다.";
      const finalText = `${baseFinalText}${formatUsageFooter(job.usage)}`;
      await appendMessage(job.sessionId, createMessage("assistant", finalText));
      if (shouldSetAutoTitle) {
        await setSessionTitleIfMissing(job.sessionId, baseFinalText);
      }

      job.assistantText = finalText;
      job.status = "completed";
      job.completedAt = nowIso();
      appendEvent(job, { type: "status", phase: "completed" });
      await persistJob(job);
    } catch (error) {
      if (isJobCancelled(job.jobId)) {
        await markJobFailed(job, CANCEL_MESSAGE);
        return;
      }

      let message = toErrorMessage(error, "Agent CLI execution failed.");
      if (isAgentCliRunnerError(error) && error.detail) {
        message = `${message} | ${error.detail}`;
      }
      try {
        if (!disableParallelSessionWrite) {
          await persistUserTurnPromise;
        }
      } catch (persistError) {
        const persistMessage = toErrorMessage(persistError, "세션 저장 실패");
        if (!message.includes(persistMessage)) {
          message = `${message} | ${persistMessage}`;
        }
      }
      await markJobFailed(job, message);
    } finally {
      clearInterval(heartbeat);
      await setSessionActiveJob(job.sessionId, undefined);
      runningJobCancels.delete(job.jobId);
      cancelledJobIds.delete(job.jobId);
    }
  } finally {
    runningJobIds.delete(jobId);
  }
}

export async function createAgentJob(input: CreateAgentJobInput): Promise<AgentJob> {
  const session = await loadSession(input.sessionId);
  const activeJob = await loadActiveJobIfExists(input.sessionId, session.activeJobId);
  if (activeJob) {
    throw new ActiveJobError(activeJob.jobId);
  }

  const job = createInitialJob(input);
  await writeJobFile(job);
  await setSessionActiveJob(input.sessionId, job.jobId);

  void runJob(job.jobId);

  return job;
}

export async function getAgentJob(jobId: string): Promise<AgentJob | null> {
  return getNormalizedJob(jobId);
}

export async function listSessionJobs(sessionId: string): Promise<AgentJob[]> {
  return listJobsForSessions([sessionId]);
}

export async function listJobsForSessions(sessionIds: string[]): Promise<AgentJob[]> {
  await ensureJobsDirectory();
  const targetSessionIds = new Set(sessionIds.filter(Boolean));
  if (targetSessionIds.size === 0) {
    return [];
  }

  const files = await fs.readdir(JOBS_DIRECTORY);
  const jobs: AgentJob[] = [];

  for (const fileName of files) {
    if (!fileName.endsWith(JOB_FILE_EXTENSION)) {
      continue;
    }
    const jobId = fileName.slice(0, -JOB_FILE_EXTENSION.length);
    if (!JOB_ID_PATTERN.test(jobId)) {
      continue;
    }
    const job = await readJobFile(jobId);
    if (!job || !targetSessionIds.has(job.sessionId)) {
      continue;
    }
    jobs.push((await recoverStaleJob(job)) || job);
  }

  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return jobs;
}

export async function cancelSessionActiveJob(sessionId: string): Promise<{
  ok: boolean;
  jobId?: string;
  reason?: string;
}> {
  const session = await loadSessionWithRecoveredActiveJob(sessionId);
  const jobId = session.activeJobId;
  if (!jobId) {
    return { ok: false, reason: "no-active-job" };
  }

  const job = await getAgentJob(jobId);
  if (!job || job.sessionId !== sessionId) {
    await setSessionActiveJob(sessionId, undefined);
    return { ok: false, jobId, reason: "active-job-not-found" };
  }

  if (job.status === "completed" || job.status === "failed") {
    await setSessionActiveJob(sessionId, undefined);
    return { ok: false, jobId, reason: "job-already-finished" };
  }

  cancelledJobIds.add(jobId);
  const cancel = runningJobCancels.get(jobId);
  if (cancel) {
    cancel();
  }

  await markJobFailed(job, CANCEL_MESSAGE);
  await setSessionActiveJob(sessionId, undefined);

  return { ok: true, jobId };
}

export async function cancelAllActiveJobs(): Promise<{
  cancelled: Array<{ sessionId: string; jobId: string }>;
  skipped: Array<{ sessionId: string; reason: string; jobId?: string }>;
}> {
  const sessions = await listSessions();
  const cancelled: Array<{ sessionId: string; jobId: string }> = [];
  const skipped: Array<{ sessionId: string; reason: string; jobId?: string }> = [];

  for (const session of sessions) {
    if (!session.activeJobId) {
      continue;
    }

    const result = await cancelSessionActiveJob(session.sessionId);
    if (result.ok && result.jobId) {
      cancelled.push({ sessionId: session.sessionId, jobId: result.jobId });
      continue;
    }

    skipped.push({
      sessionId: session.sessionId,
      jobId: result.jobId,
      reason: result.reason || "unknown",
    });
  }

  return { cancelled, skipped };
}

export async function loadExistingSessionWithRecoveredActiveJob(sessionId: string): Promise<Session | null> {
  const session = await loadExistingSession(sessionId);
  if (!session?.activeJobId) {
    return session;
  }

  const activeJob = await loadActiveJobIfExists(sessionId, session.activeJobId);
  if (activeJob) {
    return session;
  }

  return loadExistingSession(sessionId);
}

export async function loadSessionWithRecoveredActiveJob(sessionId: string): Promise<Session> {
  const session = await loadSession(sessionId);
  if (!session.activeJobId) {
    return session;
  }

  const activeJob = await loadActiveJobIfExists(sessionId, session.activeJobId);
  if (activeJob) {
    return session;
  }

  return loadSession(sessionId);
}

export async function listSessionsWithRecoveredActiveJobs(): Promise<SessionSummary[]> {
  const summaries = await listSessions();
  let hasRecovered = false;

  for (const summary of summaries) {
    if (!summary.activeJobId) {
      continue;
    }

    const activeJob = await loadActiveJobIfExists(summary.sessionId, summary.activeJobId);
    if (!activeJob) {
      hasRecovered = true;
    }
  }

  if (!hasRecovered) {
    return summaries;
  }

  return listSessions();
}

export function isActiveJobError(error: unknown): error is ActiveJobError {
  return error instanceof ActiveJobError;
}
