import {
  cancelSessionActiveJob,
  createAgentJob,
  getAgentJob,
  isActiveJobError,
  listJobsForSessions,
  listSessionJobs,
} from "@/src/application/agent/job-service";
import {
  getSessionWorkingDirectoryLabel,
  listResumeSessions,
  loadSession,
  setSessionModel,
  setSessionWorkingDirectory,
  setSessionTitle,
  writeSessionFile,
} from "@/src/infrastructure/agent/session-file-store";
import { validateAgentRequest } from "@/src/presentation/server/agent-request-validator";
import { spawn } from "node:child_process";
import {
  DEFAULT_MODEL,
  SUPPORTED_MODELS,
  getModelLabel,
  isSupportedModel,
  type SupportedModel,
} from "@/src/core/agent/models";
import {
  DEFAULT_REASONING_EFFORT,
  SUPPORTED_REASONING_EFFORTS,
  isSupportedReasoningEffort,
  type SupportedReasoningEffort,
} from "@/src/core/agent/reasoning";
import { getAgentWorkspaceRoot } from "@/src/core/workspace/policy";
import type { AgentJob, Message } from "@/src/core/agent/types";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TELEGRAM_API_BASE_URL = "https://api.telegram.org/bot";
const TELEGRAM_CHAT_TEXT_LIMIT = 4096;
const TELEGRAM_POLL_INTERVAL_MS = 1000;
const TELEGRAM_PROGRESS_UPDATE_INTERVAL_MS = getEnvInt(
  "TELEGRAM_PROGRESS_UPDATE_INTERVAL_MS",
  5000,
);
const TELEGRAM_EDIT_MESSAGE_MIN_INTERVAL_MS = getEnvInt(
  "TELEGRAM_EDIT_MESSAGE_MIN_INTERVAL_MS",
  1500,
);
const TELEGRAM_PROGRESS_PREVIEW_LIMIT = getEnvInt("TELEGRAM_PROGRESS_PREVIEW_LIMIT", 320);
const TELEGRAM_UPDATE_DEDUP_TTL_MS = getEnvInt("TELEGRAM_UPDATE_DEDUP_TTL_MS", 5 * 60 * 1000);
const TELEGRAM_API_RATE_LIMIT_MAX_RETRIES = getEnvInt("TELEGRAM_API_RATE_LIMIT_MAX_RETRIES", 3);
const TELEGRAM_DEFAULT_TRACE_MODE = process.env.TELEGRAM_DEFAULT_TRACE_MODE !== "0";
const TELEGRAM_SCREENSHOT_TEMP_DIR = path.join(process.cwd(), "data", "telegram-screenshots");
const TELEGRAM_FILE_DOWNLOAD_DIR = path.join(process.cwd(), "data", "telegram-files");
const TELEGRAM_LOCAL_SCREENSHOT_TIMEOUT_MS = 20_000;
const TELEGRAM_FILE_BASE_URL = "https://api.telegram.org/file/bot";
const TELEGRAM_ALLOWED_CHAT_IDS = parseChatIdList(process.env.TELEGRAM_ALLOWED_CHAT_IDS);
const TELEGRAM_REGISTRATION_CODE = process.env.TELEGRAM_REGISTRATION_CODE?.trim() || null;
const TELEGRAM_AUTHORIZED_CHATS_FILE = path.resolve(
  process.cwd(),
  process.env.TELEGRAM_AUTHORIZED_CHATS_FILE?.trim() || "data/telegram-authorized-chats.json",
);
const TELEGRAM_SESSION_OVERRIDES_FILE = path.resolve(
  process.cwd(),
  process.env.TELEGRAM_SESSION_OVERRIDES_FILE?.trim() || "data/telegram-session-overrides.json",
);
const TELEGRAM_WORKSPACE_SELECTION_FILE = path.resolve(
  process.cwd(),
  process.env.TELEGRAM_WORKSPACE_SELECTION_FILE?.trim() || "data/telegram-workspace-selection.json",
);
const TELEGRAM_COMPLETION_CURSOR_FILE = path.resolve(
  process.cwd(),
  process.env.TELEGRAM_COMPLETION_CURSOR_FILE?.trim() || "data/telegram-completion-cursors.json",
);
const TELEGRAM_SIGNAL_STYLE_FILE = path.resolve(
  process.cwd(),
  process.env.TELEGRAM_SIGNAL_STYLE_FILE?.trim() || "data/signals/telegram-style-preferences.json",
);
const TELEGRAM_EVENT_LOG_FILE = path.resolve(
  process.cwd(),
  process.env.TELEGRAM_EVENT_LOG_FILE?.trim() || "data/telegram-events.log",
);
const TELEGRAM_EVENT_LOG_DEFAULT_LINES = 40;
const TELEGRAM_EVENT_LOG_MAX_LINES = 500;
const TELEGRAM_AUTH_REQUIRED = TELEGRAM_ALLOWED_CHAT_IDS.size > 0 || Boolean(TELEGRAM_REGISTRATION_CODE);

const authorizedChatIdsCache = { value: null as Set<number> | null };
const TELEGRAM_SESSION_PREVIEW_LIMIT = 6;
const TELEGRAM_SESSION_PREVIEW_TEXT_LIMIT = 180;
const TELEGRAM_SESSION_LIST_LIMIT = 10;
const TELEGRAM_SESSION_LIST_PREVIEW_TEXT_LIMIT = 48;
const TELEGRAM_SESSION_RESUME_CALLBACK_PREFIX = "resume_session:";
const TELEGRAM_WORKSPACE_SELECTION_CALLBACK_PREFIX = "workspace_select:";
const TELEGRAM_MODEL_SELECTION_CALLBACK_PREFIX = "model_select:";
const TELEGRAM_REASONING_SELECTION_CALLBACK_PREFIX = "reasoning_select:";
const TELEGRAM_INLINE_MENU_CLOSE_CALLBACK_PREFIX = "menu_close:";
const TELEGRAM_SESSION_ID_PREFIX = "tg_";
const TELEGRAM_REASONING_LABELS: Record<string, string> = {
  minimal: "최소",
  low: "낮음",
  medium: "보통",
  high: "높음",
  xhigh: "최고",
};
const SIGNAL_STYLE_LABELS = {
  conservative: "보수적",
  balanced: "균형형",
  aggressive: "공격형",
} as const;
const TELEGRAM_LOOP_EMOJI = "⏱";
const SIGNAL_DEFAULT_STYLE = "conservative";
const SIGNAL_RECOMMENDATION_DEFAULT_LIMIT = 5;
const SIGNAL_RECOMMENDATION_MAX_LIMIT = 10;
const SIGNAL_DISCLOSURE_TEXT = "판단 보조용이며 자동매매/투자자문이 아닙니다.";
const TELEGRAM_MENU_COMMANDS = [
  { command: "workspace", description: "작업 폴더 선택" },
  { command: "resume", description: "세션 목록 열기" },
  { command: "new", description: "새 세션 시작" },
  { command: "stop", description: "실행 중 작업 중지" },
  { command: "model", description: "모델 버튼 선택" },
  { command: "effort", description: "사고수준 버튼 선택" },
  { command: "help", description: "도움말 보기" },
] as const satisfies TelegramBotCommand[];

function getEnvInt(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
}

type TelegramCommandStart =
  | { kind: "start"; code?: string }
  | { kind: "unknown"; message: string };

type SignalRecommendationStyle = keyof typeof SIGNAL_STYLE_LABELS;

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

interface TelegramChat {
  id: number;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  caption?: string;
  chat: TelegramChat;
  from?: TelegramUser;
  document?: TelegramDocument;
  photo?: TelegramPhotoSize[];
}

interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_path: string;
  file_size?: number;
}

interface TelegramIncomingAttachment {
  fileId: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

interface TelegramReplyKeyboardRemove {
  remove_keyboard: true;
  selective?: boolean;
}

interface TelegramInlineKeyboardButton {
  text: string;
  callback_data: string;
}

interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
}

interface TelegramBotCommand {
  command: string;
  description: string;
}

type TelegramBotCommandScope =
  | { type: "default" }
  | { type: "all_private_chats" }
  | { type: "chat"; chat_id: number };

type ParsedTelegramCommand =
  | { kind: "run"; message: string }
  | { kind: "help" }
  | TelegramCommandStart
  | { kind: "signal" }
  | { kind: "briefing" }
  | { kind: "recommend"; count: number }
  | { kind: "asset"; ticker: string }
  | { kind: "signalStyle"; value?: string }
  | { kind: "newSession" }
  | { kind: "fork" }
  | { kind: "workspace"; workingDirectory?: string }
  | { kind: "resumeSession"; selector: string }
  | { kind: "status" }
  | { kind: "jobs"; limit: number }
  | { kind: "stop" }
  | { kind: "model"; value?: string }
  | { kind: "reasoning"; value?: string }
  | { kind: "sessionInfo"; query?: string }
  | { kind: "sessionTitle"; value?: string }
  | { kind: "clear" }
  | { kind: "recent"; count: number }
  | { kind: "ping" }
  | { kind: "id" }
  | { kind: "screenshotLocal"; target?: string }
  | { kind: "eventLog"; count?: number }
  | { kind: "unknown"; message: string };

interface TelegramSentMessage {
  message_id: number;
}

interface TelegramSessionBrowseState {
  query?: string;
  targetSessionIds: string[];
  createdAt: number;
}

interface TelegramWorkspaceBrowseState {
  directories: string[];
  createdAt: number;
}

const chatTraceMode = new Map<string, boolean>();
const chatSessionOverrides = new Map<number, string>();
let chatSessionOverridesLoaded = false;
let chatSessionOverridesLoadPromise: Promise<void> | null = null;
const chatWorkspaceSelections = new Map<number, string>();
let chatWorkspaceSelectionsLoaded = false;
let chatWorkspaceSelectionsLoadPromise: Promise<void> | null = null;
const chatCompletionCursors = new Map<number, string>();
let chatCompletionCursorsLoaded = false;
let chatCompletionCursorsLoadPromise: Promise<void> | null = null;
const chatSignalStyles = new Map<number, SignalRecommendationStyle>();
let chatSignalStylesLoaded = false;
let chatSignalStylesLoadPromise: Promise<void> | null = null;
const processedTelegramUpdates = new Map<number, number>();
const telegramMessageEditQueues = new Map<string, Promise<void>>();
const telegramMessageLastEditedAt = new Map<string, number>();
const telegramMenuSyncState = new Map<string, string>();
const chatSessionBrowseState = new Map<number, TelegramSessionBrowseState>();
const chatWorkspaceBrowseState = new Map<number, TelegramWorkspaceBrowseState>();

function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }
  return token;
}

function pruneProcessedTelegramUpdates(now = Date.now()): void {
  for (const [updateId, processedAt] of processedTelegramUpdates.entries()) {
    if (now - processedAt > TELEGRAM_UPDATE_DEDUP_TTL_MS) {
      processedTelegramUpdates.delete(updateId);
    }
  }
}

function markTelegramUpdateProcessed(updateId?: number): boolean {
  const normalizedUpdateId =
    typeof updateId === "number" && Number.isInteger(updateId) ? updateId : null;
  if (normalizedUpdateId === null) {
    return false;
  }

  const now = Date.now();
  pruneProcessedTelegramUpdates(now);

  if (processedTelegramUpdates.has(normalizedUpdateId)) {
    return true;
  }

  processedTelegramUpdates.set(normalizedUpdateId, now);
  return false;
}

function getWebhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? null;
}

function toSessionId(chatId: number): string {
  const raw = String(chatId).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `tg_${raw}`;
}

function sanitizeTelegramFileName(fileName?: string): string {
  const raw = fileName?.trim();
  if (!raw) {
    return "attachment";
  }
  const base = path.basename(raw);
  const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").trim();
  if (!safeBase) {
    return "attachment";
  }
  return safeBase.slice(0, 120);
}

function getIncomingAttachment(message: TelegramMessage): TelegramIncomingAttachment | null {
  if (message.document?.file_id) {
    return {
      fileId: message.document.file_id,
      fileName: message.document.file_name,
      mimeType: message.document.mime_type,
      fileSize: message.document.file_size,
    };
  }

  if (message.photo && message.photo.length > 0) {
    const selected = [...message.photo].sort((left, right) =>
      (right.file_size ?? 0) - (left.file_size ?? 0),
    )[0];
    return {
      fileId: selected.file_id,
      fileName: `photo-${selected.file_unique_id}.jpg`,
      mimeType: "image/jpeg",
      fileSize: selected.file_size,
    };
  }

  return null;
}

function isSessionOwnedByChat(chatId: number, sessionId: string): boolean {
  const rootSessionId = toSessionId(chatId);
  return sessionId === rootSessionId || sessionId.startsWith(`${rootSessionId}_`);
}

async function ensureChatSessionOverridesLoaded(): Promise<void> {
  if (chatSessionOverridesLoaded) {
    return;
  }

  if (chatSessionOverridesLoadPromise) {
    await chatSessionOverridesLoadPromise;
    return;
  }

  chatSessionOverridesLoadPromise = (async () => {
    try {
      const raw = await fs.readFile(TELEGRAM_SESSION_OVERRIDES_FILE, "utf8");
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (typeof parsed === "object" && parsed) {
        for (const [rawChatId, sessionId] of Object.entries(parsed)) {
          const parsedChatId = Number(rawChatId);
          if (!Number.isInteger(parsedChatId)) {
            continue;
          }
          if (typeof sessionId === "string" && sessionId.trim()) {
            chatSessionOverrides.set(parsedChatId, sessionId.trim());
          }
        }
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load telegram session overrides.", error);
      }
    } finally {
      chatSessionOverridesLoaded = true;
    }
  })();

  await chatSessionOverridesLoadPromise;
}

async function ensureChatWorkspaceSelectionsLoaded(): Promise<void> {
  if (chatWorkspaceSelectionsLoaded) {
    return;
  }

  if (chatWorkspaceSelectionsLoadPromise) {
    await chatWorkspaceSelectionsLoadPromise;
    return;
  }

  chatWorkspaceSelectionsLoadPromise = (async () => {
    try {
      const raw = await fs.readFile(TELEGRAM_WORKSPACE_SELECTION_FILE, "utf8");
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (typeof parsed === "object" && parsed) {
        for (const [rawChatId, workingDirectory] of Object.entries(parsed)) {
          const parsedChatId = Number(rawChatId);
          if (!Number.isInteger(parsedChatId)) {
            continue;
          }
          if (typeof workingDirectory === "string" && workingDirectory.trim()) {
            chatWorkspaceSelections.set(parsedChatId, workingDirectory.trim());
          }
        }
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load telegram workspace selections.", error);
      }
    } finally {
      chatWorkspaceSelectionsLoaded = true;
    }
  })();

  await chatWorkspaceSelectionsLoadPromise;
}

async function ensureChatCompletionCursorsLoaded(): Promise<void> {
  if (chatCompletionCursorsLoaded) {
    return;
  }

  if (chatCompletionCursorsLoadPromise) {
    await chatCompletionCursorsLoadPromise;
    return;
  }

  chatCompletionCursorsLoadPromise = (async () => {
    try {
      const raw = await fs.readFile(TELEGRAM_COMPLETION_CURSOR_FILE, "utf8");
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (typeof parsed === "object" && parsed) {
        for (const [rawChatId, completedAt] of Object.entries(parsed)) {
          const parsedChatId = Number(rawChatId);
          if (!Number.isInteger(parsedChatId)) {
            continue;
          }
          if (typeof completedAt === "string" && completedAt.trim()) {
            chatCompletionCursors.set(parsedChatId, completedAt.trim());
          }
        }
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load telegram completion cursors.", error);
      }
    } finally {
      chatCompletionCursorsLoaded = true;
    }
  })();

  await chatCompletionCursorsLoadPromise;
}

async function ensureChatSignalStylesLoaded(): Promise<void> {
  if (chatSignalStylesLoaded) {
    return;
  }

  if (chatSignalStylesLoadPromise) {
    await chatSignalStylesLoadPromise;
    return;
  }

  chatSignalStylesLoadPromise = (async () => {
    try {
      const raw = await fs.readFile(TELEGRAM_SIGNAL_STYLE_FILE, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        for (const [rawChatId, rawStyle] of Object.entries(parsed)) {
          const chatId = Number(rawChatId);
          const style = resolveSignalStyleByInput(typeof rawStyle === "string" ? rawStyle : "");
          if (!Number.isInteger(chatId) || !style) {
            continue;
          }
          chatSignalStyles.set(chatId, style);
        }
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load telegram signal styles.", error);
      }
    } finally {
      chatSignalStylesLoaded = true;
    }
  })();

  await chatSignalStylesLoadPromise;
}

function safeJsonSerialize(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ fallback: String(value) });
  }
}

async function appendTelegramEventLog(event: string, details?: Record<string, unknown>): Promise<void> {
  try {
    await fs.mkdir(path.dirname(TELEGRAM_EVENT_LOG_FILE), { recursive: true });
    const record = {
      time: new Date().toISOString(),
      event,
      ...(details ? details : {}),
    };
    const line = safeJsonSerialize(record);
    await fs.appendFile(TELEGRAM_EVENT_LOG_FILE, `${line}\n`, "utf8");
  } catch {
    // Logging is non-critical.
  }
}

async function readRecentTelegramEventLogLines(limit: number): Promise<string[]> {
  try {
    const raw = await fs.readFile(TELEGRAM_EVENT_LOG_FILE, "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-Math.min(Math.max(limit, 1), TELEGRAM_EVENT_LOG_MAX_LINES));
    return lines;
  } catch {
    return [];
  }
}

async function persistChatSessionOverrides(): Promise<void> {
  await fs.mkdir(path.dirname(TELEGRAM_SESSION_OVERRIDES_FILE), { recursive: true });
  const payload: Record<string, string> = {};
  for (const [chatId, sessionId] of chatSessionOverrides.entries()) {
    payload[String(chatId)] = sessionId;
  }
  await fs.writeFile(TELEGRAM_SESSION_OVERRIDES_FILE, JSON.stringify(payload, null, 2), "utf8");
}

async function persistChatWorkspaceSelections(): Promise<void> {
  await fs.mkdir(path.dirname(TELEGRAM_WORKSPACE_SELECTION_FILE), { recursive: true });
  const payload: Record<string, string> = {};
  for (const [chatId, workingDirectory] of chatWorkspaceSelections.entries()) {
    payload[String(chatId)] = workingDirectory;
  }
  await fs.writeFile(TELEGRAM_WORKSPACE_SELECTION_FILE, JSON.stringify(payload, null, 2), "utf8");
}

async function persistChatCompletionCursors(): Promise<void> {
  await fs.mkdir(path.dirname(TELEGRAM_COMPLETION_CURSOR_FILE), { recursive: true });
  const payload: Record<string, string> = {};
  for (const [chatId, completedAt] of chatCompletionCursors.entries()) {
    payload[String(chatId)] = completedAt;
  }
  await fs.writeFile(TELEGRAM_COMPLETION_CURSOR_FILE, JSON.stringify(payload, null, 2), "utf8");
}

async function persistChatSignalStyles(): Promise<void> {
  await fs.mkdir(path.dirname(TELEGRAM_SIGNAL_STYLE_FILE), { recursive: true });
  const payload: Record<string, SignalRecommendationStyle> = {};
  for (const [chatId, style] of chatSignalStyles.entries()) {
    payload[String(chatId)] = style;
  }
  await fs.writeFile(TELEGRAM_SIGNAL_STYLE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

async function setChatCompletionCursor(chatId: number, completedAt: string): Promise<void> {
  await ensureChatCompletionCursorsLoaded();
  chatCompletionCursors.set(chatId, completedAt);
  await persistChatCompletionCursors();
}

async function setSessionOverride(chatId: number, sessionId: string): Promise<void> {
  await ensureChatSessionOverridesLoaded();
  chatSessionOverrides.set(chatId, sessionId);
  await persistChatSessionOverrides();
}

async function setChatWorkspaceSelection(chatId: number, workingDirectory: string): Promise<void> {
  await ensureChatWorkspaceSelectionsLoaded();
  chatWorkspaceSelections.set(chatId, workingDirectory);
  await persistChatWorkspaceSelections();
}

async function getChatWorkspaceSelection(chatId: number): Promise<string | undefined> {
  await ensureChatWorkspaceSelectionsLoaded();
  return chatWorkspaceSelections.get(chatId);
}

async function listChatScopedResumeSessions(chatId: number): Promise<Awaited<ReturnType<typeof listResumeSessions>>> {
  const workingDirectory = await getChatWorkspaceSelection(chatId);
  return listResumeSessions(workingDirectory);
}

async function setChatSignalStyle(chatId: number, style: SignalRecommendationStyle): Promise<void> {
  await ensureChatSignalStylesLoaded();
  chatSignalStyles.set(chatId, style);
  await persistChatSignalStyles();
}

async function getChatSignalStyle(chatId: number): Promise<SignalRecommendationStyle> {
  await ensureChatSignalStylesLoaded();
  return chatSignalStyles.get(chatId) ?? SIGNAL_DEFAULT_STYLE;
}

async function getSessionIdForChat(chatId: number): Promise<string> {
  await ensureChatSessionOverridesLoaded();
  return chatSessionOverrides.get(chatId) ?? toSessionId(chatId);
}

function createNewSessionId(chatId: number): string {
  const shortToken = randomUUID().replace(/-/g, "").slice(0, 10);
  return `tg_${chatId}_${Date.now().toString(36)}_${shortToken}`;
}

function parseChatIdList(raw?: string): Set<number> {
  const result = new Set<number>();
  if (!raw) {
    return result;
  }

  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token) {
      continue;
    }
    const parsed = Number(token);
    if (Number.isInteger(parsed)) {
      result.add(parsed);
    }
  }

  return result;
}

async function getAuthorizedChatIds(): Promise<Set<number>> {
  if (authorizedChatIdsCache.value) {
    return authorizedChatIdsCache.value;
  }

  try {
    const content = await fs.readFile(TELEGRAM_AUTHORIZED_CHATS_FILE, "utf8");
    const parsed = JSON.parse(content);
    const values = Array.isArray(parsed) ? parsed : parsed?.chatIds;
    const nextSet = new Set<number>();
    if (Array.isArray(values)) {
      for (const rawId of values) {
        const parsedId = Number(rawId);
        if (Number.isInteger(parsedId)) {
          nextSet.add(parsedId);
        }
      }
    }
    authorizedChatIdsCache.value = nextSet;
    return nextSet;
  } catch (error: unknown) {
    if (!(error instanceof Error) || (error as { code?: string }).code !== "ENOENT") {
      console.error("Failed to load telegram authorized chats.", error);
    }
    const empty = new Set<number>();
    authorizedChatIdsCache.value = empty;
    return empty;
  }
}

async function persistAuthorizedChatIds(chatIds: Set<number>): Promise<void> {
  await fs.mkdir(path.dirname(TELEGRAM_AUTHORIZED_CHATS_FILE), { recursive: true });
  const sortedIds = [...chatIds].sort((a, b) => a - b);
  await fs.writeFile(
    TELEGRAM_AUTHORIZED_CHATS_FILE,
    JSON.stringify(sortedIds, null, 2),
    "utf8",
  );
}

async function authorizeChatId(chatId: number): Promise<void> {
  const chatIds = await getAuthorizedChatIds();
  if (chatIds.has(chatId)) {
    return;
  }
  chatIds.add(chatId);
  await persistAuthorizedChatIds(chatIds);
  authorizedChatIdsCache.value = chatIds;
}

async function isAuthorizedChat(chatId: number): Promise<boolean> {
  if (TELEGRAM_ALLOWED_CHAT_IDS.has(chatId)) {
    return true;
  }
  const chatIds = await getAuthorizedChatIds();
  return chatIds.has(chatId);
}

function isAuthBypassCommand(command: ParsedTelegramCommand): boolean {
  return command.kind === "help" || command.kind === "start";
}

function getSessionModel(sessionModel?: string): SupportedModel {
  if (sessionModel && isSupportedModel(sessionModel)) {
    return sessionModel;
  }
  return DEFAULT_MODEL;
}

function getSessionReasoning(sessionReasoning?: string): SupportedReasoningEffort {
  if (sessionReasoning && isSupportedReasoningEffort(sessionReasoning)) {
    return sessionReasoning;
  }
  return DEFAULT_REASONING_EFFORT;
}

function formatReasoningLabel(value: string): string {
  return TELEGRAM_REASONING_LABELS[value] || value;
}

function formatModelListText(currentModel: string): string {
  const rows = SUPPORTED_MODELS.map((model, index) => {
    const prefix = index + 1;
    const mark = model === currentModel ? " [현재]" : "";
    return `${prefix}. ${getModelLabel(model)} · ${model}${mark}`;
  });

  return [
    "모델 목록:",
    ...rows,
    `현재 모델: ${getModelLabel(currentModel)} · ${currentModel}`,
    "선택: 버튼을 누르거나 `/model 2`, `/model gpt-5.3-codex`처럼 입력",
  ].join("\n");
}

function formatReasoningListText(currentReasoning: string): string {
  const rows = SUPPORTED_REASONING_EFFORTS.map((reasoning, index) => {
    const prefix = index + 1;
    const mark = reasoning === currentReasoning ? " [현재]" : "";
    return `${prefix}. ${formatReasoningLabel(reasoning)} · ${reasoning}${mark}`;
  });

  return [
    "사고수준 목록:",
    ...rows,
    `현재 사고수준: ${formatReasoningLabel(currentReasoning)} · ${currentReasoning}`,
    "선택: 버튼을 누르거나 `/effort 2`, `/effort high`처럼 입력",
  ].join("\n");
}

function resolveModelByInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = Number.parseInt(trimmed, 10);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= SUPPORTED_MODELS.length) {
    return SUPPORTED_MODELS[numeric - 1];
  }

  const exact = SUPPORTED_MODELS.find((model) => model.toLowerCase() === trimmed.toLowerCase());
  if (exact) {
    return exact;
  }

  const normalizedInput = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
  const exactByNormalized = SUPPORTED_MODELS.find(
    (model) => model.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedInput,
  );
  if (exactByNormalized) {
    return exactByNormalized;
  }

  const startsWith = SUPPORTED_MODELS.filter((model) =>
    model.toLowerCase().startsWith(trimmed.toLowerCase()),
  );
  if (startsWith.length === 1) {
    return startsWith[0];
  }

  const contains = SUPPORTED_MODELS.filter((model) =>
    model.toLowerCase().includes(trimmed.toLowerCase()),
  );
  if (contains.length === 1) {
    return contains[0];
  }

  return null;
}

function resolveReasoningByInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = Number.parseInt(trimmed, 10);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= SUPPORTED_REASONING_EFFORTS.length) {
    return SUPPORTED_REASONING_EFFORTS[numeric - 1];
  }

  const rawLower = trimmed.toLowerCase();
  if (rawLower === "최소") {
    return "minimal";
  }
  if (rawLower === "낮음") {
    return "low";
  }
  if (rawLower === "보통") {
    return "medium";
  }
  if (rawLower === "높음") {
    return "high";
  }
  if (rawLower === "최고" || rawLower === "xhigh") {
    return "xhigh";
  }

  const normalized = rawLower.replace(/[^a-z]/g, "");

  const exact = SUPPORTED_REASONING_EFFORTS.find(
    (reasoning) => reasoning.toLowerCase() === normalized,
  );
  if (exact) {
    return exact;
  }

  const startsWith = SUPPORTED_REASONING_EFFORTS.filter((reasoning) =>
    reasoning.toLowerCase().startsWith(normalized),
  );
  if (startsWith.length === 1) {
    return startsWith[0];
  }

  const contains = SUPPORTED_REASONING_EFFORTS.filter((reasoning) =>
    reasoning.toLowerCase().includes(normalized),
  );
  if (contains.length === 1) {
    return contains[0];
  }

  return null;
}

function resolveSignalStyleByInput(raw: string): SignalRecommendationStyle | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (trimmed === "conservative" || trimmed === "보수적") {
    return "conservative";
  }
  if (trimmed === "balanced" || trimmed === "균형" || trimmed === "균형형") {
    return "balanced";
  }
  if (trimmed === "aggressive" || trimmed === "공격적" || trimmed === "공격형") {
    return "aggressive";
  }
  return null;
}

function getSignalStyleLabel(style: SignalRecommendationStyle): string {
  return SIGNAL_STYLE_LABELS[style];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function formatTelegramDateTime(iso?: string | null): string | null {
  if (!iso) {
    return null;
  }
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  const hours = String(target.getHours()).padStart(2, "0");
  const minutes = String(target.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

function formatSignalBadgeLines(payload: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const mode = asString(payload.snapshotMode) || asString(payload.dataMode) || asString(payload.mode);
  const demo = asBoolean(payload.demo);
  const stale = asBoolean(payload.stale);
  const generatedAt = asString(payload.generatedAt);
  const generatedLabel = formatTelegramDateTime(generatedAt);
  const disclaimer = asString(payload.disclaimer);
  const health = asRecord(payload.health);
  const healthStatus = asString(health?.status);
  const badges: string[] = [];

  if (demo === true || mode === "demo") {
    badges.push("[demo]");
  } else if (mode === "live") {
    badges.push("[live]");
  }
  if (healthStatus === "failed") {
    badges.push("[failed]");
  }
  if (stale === true) {
    badges.push("[stale]");
  }
  if (badges.length > 0) {
    lines.push(badges.join(" "));
  }
  if (demo === true || mode === "demo") {
    lines.push("demo는 로컬 demo fallback snapshot입니다.");
  } else if (mode === "live") {
    lines.push("live는 저장된 실데이터 snapshot입니다.");
  }
  if (healthStatus === "failed") {
    lines.push("failed는 필요한 live snapshot을 찾지 못해 응답이 제한된 상태입니다.");
  }
  if (stale === true) {
    lines.push("stale은 snapshot 시각이 오래되어 강한 액션을 낮춘 상태입니다.");
  }
  if (generatedLabel) {
    lines.push(`기준: ${generatedLabel}`);
  }
  if (disclaimer) {
    lines.push(disclaimer);
  }

  return lines;
}

function formatSignalFooter(): string {
  return SIGNAL_DISCLOSURE_TEXT;
}

function formatStyleSummary(style: SignalRecommendationStyle): string {
  return `스타일: ${getSignalStyleLabel(style)} (${style})`;
}

function resolveRequestOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (!host) {
      throw new Error("request origin을 확인할 수 없습니다.");
    }
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    return `${protocol}://${host}`;
  }
}

async function callInternalSignalApi(
  origin: string,
  pathname: string,
  searchParams?: Record<string, string | number | undefined>,
): Promise<Record<string, unknown>> {
  const url = new URL(pathname, origin);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-internal-telegram": "1",
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const record = asRecord(payload);
    const message = asString(record?.error) || `HTTP ${response.status}`;
    throw new Error(message);
  }
  const record = asRecord(payload);
  if (!record) {
    throw new Error("시그널 응답이 JSON 객체가 아닙니다.");
  }
  return record;
}

function formatOverviewTelegramMessage(
  payload: Record<string, unknown>,
  style: SignalRecommendationStyle,
): string {
  const assets = Array.isArray(payload.benchmarks) ? payload.benchmarks : [];
  const health = asRecord(payload.health);
  const summary = asString(payload.summary);
  const marketLabel = asString(payload.marketLabel);
  const marketRegime = asString(payload.marketRegime);
  const lines = [
    "시그널 요약",
    formatStyleSummary(style),
    ...formatSignalBadgeLines(payload),
  ];

  if (marketLabel || marketRegime) {
    lines.push(
      [marketLabel, marketRegime].filter(Boolean).join(" · "),
    );
  }
  if (summary) {
    lines.push(summary);
  }

  if (assets.length === 0) {
    lines.push("벤치마크 시그널 데이터가 아직 없습니다.");
  } else {
    for (const item of assets.slice(0, 4)) {
      const asset = asRecord(item);
      if (!asset) {
        continue;
      }
      const ticker = asString(asset.ticker) || "UNKNOWN";
      const assetScore = asNumber(asset.compositeScore) ?? asNumber(asset.score);
      const verdict = asString(asset.action) || "판정 없음";
      const assetRegime = asString(asset.regime);
      const subtitle = [assetScore !== null ? `${Math.round(assetScore)}점` : null, verdict, assetRegime]
        .filter(Boolean)
        .join(" · ");
      lines.push(`${ticker}: ${subtitle}`);
    }
  }

  if (health) {
    const healthSummary = asString(health.summary);
    if (healthSummary) {
      lines.push(`상태: ${healthSummary}`);
    }
  }

  lines.push(formatSignalFooter());
  return lines.join("\n");
}

function formatBriefingTelegramMessage(
  payload: Record<string, unknown>,
  fallbackStyle: SignalRecommendationStyle,
): string {
  const style = resolveSignalStyleByInput(asString(payload.style) || "") || fallbackStyle;
  const text = asString(payload.text);
  const bullets = asStringArray(payload.bullets);
  const lines = [
    "브리핑",
    formatStyleSummary(style),
    ...formatSignalBadgeLines(payload),
  ];

  if (text) {
    lines.push(text);
  }
  for (const bullet of bullets.slice(0, 6)) {
    lines.push(`- ${bullet}`);
  }
  if (!text && bullets.length === 0) {
    lines.push("브리핑 텍스트가 아직 없습니다.");
  }

  lines.push(formatSignalFooter());
  return lines.join("\n");
}

function formatRecommendationsTelegramMessage(
  payload: Record<string, unknown>,
  fallbackStyle: SignalRecommendationStyle,
): string {
  const style = resolveSignalStyleByInput(asString(payload.style) || "") || fallbackStyle;
  const items = Array.isArray(payload.items) ? payload.items : [];
  const marketRegime = asString(payload.marketRegime);
  const state = asString(payload.state);
  const lines = [
    "추천 종목",
    formatStyleSummary(style),
    ...formatSignalBadgeLines(payload),
  ];

  if (marketRegime) {
    lines.push(`시장 레짐: ${marketRegime}`);
  }
  if (state) {
    lines.push(`추천 상태: ${state}`);
  }

  if (items.length === 0) {
    lines.push("현재 조건에 맞는 후보가 없습니다.");
  } else {
    for (const item of items) {
      const candidate = asRecord(item);
      if (!candidate) {
        continue;
      }
      const ticker = asString(candidate.ticker) || "UNKNOWN";
      const name = asString(candidate.name);
      const score = asNumber(candidate.styleScore);
      const verdict = asString(candidate.verdictLabel) || "판정 없음";
      const thesis = asString(candidate.thesis);
      const riskFlags = asStringArray(candidate.riskFlags);
      lines.push(
        `${ticker}${name ? ` (${name})` : ""}: ${score !== null ? `${Math.round(score)}점` : "점수 없음"} · ${verdict}`,
      );
      if (thesis) {
        lines.push(`  근거: ${thesis}`);
      }
      if (riskFlags.length > 0) {
        lines.push(`  리스크: ${riskFlags.slice(0, 3).join(", ")}`);
      }
    }
  }

  lines.push(formatSignalFooter());
  return lines.join("\n");
}

function formatAssetTelegramMessage(
  payload: Record<string, unknown>,
  fallbackStyle: SignalRecommendationStyle,
): string {
  const style = resolveSignalStyleByInput(asString(payload.style) || "") || fallbackStyle;
  const asset = asRecord(payload.asset);

  if (!asset) {
    return ["종목 상세", "종목 데이터를 찾지 못했습니다.", formatSignalFooter()].join("\n");
  }

  const ticker = asString(asset.ticker) || "UNKNOWN";
  const name = asString(asset.name);
  const summary = asString(asset.summary);
  const verdict = asString(asset.verdictLabel);
  const drivers = Array.isArray(asset.drivers)
    ? asset.drivers
        .map((item) => {
          if (typeof item === "string" && item.trim()) {
            return item.trim();
          }
          const driver = asRecord(item);
          if (!driver) {
            return null;
          }
          return asString(driver.label) || asString(driver.summary);
        })
        .filter((item): item is string => Boolean(item))
    : [];
  const riskFlags = asStringArray(asset.riskFlags);
  const factorScores = asRecord(asset.factorScores);
  const lines = [
    `${ticker}${name ? ` · ${name}` : ""}`,
    formatStyleSummary(style),
    ...formatSignalBadgeLines(payload),
  ];

  if (verdict) {
    lines.push(`판정: ${verdict}`);
  }
  if (summary) {
    lines.push(summary);
  }
  if (drivers.length > 0) {
    lines.push(`상승 요인: ${drivers.slice(0, 4).join(", ")}`);
  }
  if (riskFlags.length > 0) {
    lines.push(`리스크: ${riskFlags.slice(0, 4).join(", ")}`);
  }
  if (factorScores) {
    const factorParts = Object.entries(factorScores)
      .map(([key, value]) => {
        const score = asNumber(value);
        return score === null ? null : `${key}:${Math.round(score)}`;
      })
      .filter((item): item is string => Boolean(item));
    if (factorParts.length > 0) {
      lines.push(`팩터: ${factorParts.join(" / ")}`);
    }
  }

  lines.push(formatSignalFooter());
  return lines.join("\n");
}

function toRecentMessagesText(messages: Message[]): string {
  const preview = messages.map((message, index) => {
    const previewText = (message.content || "").replace(/\s+/g, " ").trim();
    const clipped =
      previewText.length > TELEGRAM_SESSION_PREVIEW_TEXT_LIMIT
        ? `${previewText.slice(0, TELEGRAM_SESSION_PREVIEW_TEXT_LIMIT)}...`
        : previewText;
    return `${index + 1}. [${message.role}] ${clipped || "(빈 메시지)"}`;
  });

  return preview.join("\n");
}

interface ScreenshotCommandResult {
  exitCode: number | null;
  stderr: string;
}

function runSystemScreenshotCommand(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<ScreenshotCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    const stderrChunks: Buffer[] = [];
    let done = false;

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill("SIGKILL");
      resolve({
        exitCode: -1,
        stderr: `screenshot timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs + 2000);

    child.on("error", (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        resolve({
          exitCode: 127,
          stderr: `${command} command not found`,
        });
        return;
      }
      reject(error);
    });

    child.on("close", (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({
        exitCode: code,
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });
  });
}

function getLocalScreenshotCandidates(outputPath: string): Array<{ command: string; args: string[] }> {
  const escapedPath = outputPath.replace(/'/g, "'\"'\"'");
  const windowsScript = [
    "Add-Type -AssemblyName System.Windows.Forms;",
    "Add-Type -AssemblyName System.Drawing;",
    "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms');",
    "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Drawing');",
    "$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;",
    "$bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height;",
    "$graphics = [System.Drawing.Graphics]::FromImage($bitmap);",
    "$graphics.CopyFromScreen($screen.Left, $screen.Top, 0, 0, $screen.Size);",
    `$bitmap.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png);`,
    "$graphics.Dispose();",
    "$bitmap.Dispose();",
  ].join(" ");

  switch (process.platform) {
    case "darwin":
      return [{ command: "screencapture", args: ["-x", outputPath] }];
    case "win32":
      return [{ command: "powershell", args: ["-NoProfile", "-NonInteractive", "-Command", windowsScript] }];
    case "linux":
      return [
        { command: "gnome-screenshot", args: ["-f", outputPath] },
        { command: "scrot", args: ["-z", outputPath] },
      ];
    default:
      return [];
  }
}

async function captureLocalScreenshot(label?: string): Promise<string> {
  const safeLabel = label?.trim()?.replace(/[^a-zA-Z0-9가-힣._-]+/g, "_");
  const fileName = `tg-local-screenshot-${Date.now()}${safeLabel ? `-${safeLabel}` : ""}.png`;
  const outputPath = path.join(TELEGRAM_SCREENSHOT_TEMP_DIR, fileName);
  const commands = getLocalScreenshotCandidates(outputPath);

  if (commands.length === 0) {
    throw new Error("이 운영체제는 로컬 화면 캡처를 지원하지 않습니다.");
  }

  await fs.mkdir(TELEGRAM_SCREENSHOT_TEMP_DIR, { recursive: true });
  const notFoundCommands: string[] = [];

  for (const candidate of commands) {
    const result = await runSystemScreenshotCommand(
      candidate.command,
      candidate.args,
      TELEGRAM_LOCAL_SCREENSHOT_TIMEOUT_MS,
    );

    if (result.exitCode === 0) {
      await fs.access(outputPath);
      return outputPath;
    }

    if (result.exitCode === 127) {
      notFoundCommands.push(candidate.command);
      continue;
    }

    throw new Error(result.stderr || `${candidate.command} exited with code ${result.exitCode}`);
  }

  if (notFoundCommands.length === commands.length) {
    throw new Error(`필요한 캡처 도구가 설치되어 있지 않습니다. (시도: ${notFoundCommands.join(", ")})`);
  }

  throw new Error("로컬 화면 캡처 실패");
}

function formatUnauthorizedText(): string {
  if (TELEGRAM_REGISTRATION_CODE) {
    return [
      "이 봇은 인증된 사용자만 사용할 수 있습니다.",
      "/start <인증코드> 를 전송해 인증을 완료한 뒤 이용하세요.",
    ].join("\n");
  }
  return [
    "이 봇은 허용된 사용자만 사용할 수 있습니다.",
    "관리자에게 사용자 승인 요청 후 이용해 주세요.",
  ].join("\n");
}

function parseCommand(input: string): ParsedTelegramCommand {
  const trimmed = input.trim();
  const match = trimmed.match(/^\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s+([\s\S]*))?$/);

  if (!match) {
    return { kind: "run", message: trimmed };
  }

  const command = match[1].toLowerCase();
  const arg = (match[2] || "").trim();

  switch (command) {
    case "run":
      return { kind: "run", message: arg };
    case "signal":
      return { kind: "signal" };
    case "briefing":
    case "brief":
      return { kind: "briefing" };
    case "recommend":
    case "reco":
      if (!arg) {
        return { kind: "recommend", count: SIGNAL_RECOMMENDATION_DEFAULT_LIMIT };
      }
      const parsedRecommendCount = Number.parseInt(arg, 10);
      if (Number.isInteger(parsedRecommendCount) && parsedRecommendCount > 0) {
        return {
          kind: "recommend",
          count: Math.min(SIGNAL_RECOMMENDATION_MAX_LIMIT, parsedRecommendCount),
        };
      }
      return {
        kind: "unknown",
        message: `\`/recommend <1~${SIGNAL_RECOMMENDATION_MAX_LIMIT}>\` 형식으로 입력해 주세요. (예: /recommend 5)`,
      };
    case "asset":
      if (!arg) {
        return {
          kind: "unknown",
          message: "`/asset <티커>` 형식으로 입력해 주세요. (예: /asset MSFT)",
        };
      }
      return { kind: "asset", ticker: arg.toUpperCase() };
    case "style":
      return { kind: "signalStyle", value: arg || undefined };
    case "models":
    case "m":
    case "model":
      return { kind: "model", value: arg || undefined };
    case "e":
    case "effort":
      return { kind: "reasoning", value: arg || undefined };
    case "jobs":
      if (!arg) {
        return { kind: "jobs", limit: 10 };
      }

      const parsedJobs = Number.parseInt(arg, 10);
      if (Number.isInteger(parsedJobs) && parsedJobs > 0) {
        return { kind: "jobs", limit: Math.min(20, parsedJobs) };
      }

      return {
        kind: "unknown",
        message: "`/jobs <1~20>` 형식으로 입력해 주세요. (예: /jobs 8)",
      };
    case "stop":
    case "x":
      return { kind: "stop" };
    case "c":
    case "cancel":
      return { kind: "stop" };
    case "h":
    case "help":
      return { kind: "help" };
    case "start":
      return { kind: "start", code: arg || undefined };
    case "status":
      return { kind: "status" };
    case "clear":
    case "reset":
      return { kind: "clear" };
    case "recent":
    case "history":
      if (arg.length === 0) {
        return { kind: "recent", count: TELEGRAM_SESSION_PREVIEW_LIMIT };
      }
      const parsedRecent = Number.parseInt(arg, 10);
      if (Number.isInteger(parsedRecent) && parsedRecent > 0) {
        return { kind: "recent", count: Math.min(20, parsedRecent) };
      }
      return {
        kind: "unknown",
        message: "`/recent <1~20>` 형식으로 입력해 주세요. (예: /recent 8)",
      };
    case "ping":
      return { kind: "ping" };
    case "id":
      return { kind: "id" };
    case "screencap":
    case "sc":
    case "shotme":
      return { kind: "screenshotLocal", target: arg || undefined };
    case "workspace":
    case "ws":
      return { kind: "workspace", workingDirectory: arg || undefined };
    case "fork":
      return { kind: "fork" };
    case "n":
    case "new":
      return { kind: "newSession" };
    case "title":
    case "t":
      return { kind: "sessionTitle", value: arg || undefined };
    case "r":
    case "resume":
      return arg
        ? { kind: "resumeSession", selector: arg }
        : { kind: "sessionInfo", query: undefined };
    case "log":
    case "logs":
      if (!arg) {
        return { kind: "eventLog", count: TELEGRAM_EVENT_LOG_DEFAULT_LINES };
      }
      const parsedLogCount = Number.parseInt(arg, 10);
      if (Number.isInteger(parsedLogCount) && parsedLogCount > 0) {
        return { kind: "eventLog", count: Math.min(TELEGRAM_EVENT_LOG_MAX_LINES, parsedLogCount) };
      }
      return {
        kind: "unknown",
        message: "`/log <1~500>` 형식으로 입력해 주세요. (예: /log 80)",
      };
    default:
      return {
        kind: "unknown",
        message: `지원하지 않는 명령어입니다: /${command}`,
      };
  }
}

function getTraceMode(sessionId: string): boolean {
  return chatTraceMode.get(sessionId) ?? TELEGRAM_DEFAULT_TRACE_MODE;
}

function parseResumeSessionCallbackData(data: string): string | null {
  const raw = data.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith(TELEGRAM_SESSION_RESUME_CALLBACK_PREFIX)) {
    const encoded = raw.slice(TELEGRAM_SESSION_RESUME_CALLBACK_PREFIX.length).trim();
    if (!encoded) {
      return null;
    }

    try {
      return decodeURIComponent(encoded);
    } catch {
      const fallback = encoded.trim();
      return fallback.startsWith(TELEGRAM_SESSION_ID_PREFIX) ? fallback : null;
    }
  }

  if (raw.startsWith(TELEGRAM_SESSION_ID_PREFIX)) {
    return raw;
  }

  return null;
}

function parseWorkspaceSelectionCallbackData(data: string): number | null {
  const raw = data.trim();
  if (!raw.startsWith(TELEGRAM_WORKSPACE_SELECTION_CALLBACK_PREFIX)) {
    return null;
  }

  const indexText = raw.slice(TELEGRAM_WORKSPACE_SELECTION_CALLBACK_PREFIX.length).trim();
  if (!indexText) {
    return null;
  }

  const parsed = Number.parseInt(indexText, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseModelSelectionCallbackData(data: string): string | null {
  const raw = data.trim();
  if (!raw.startsWith(TELEGRAM_MODEL_SELECTION_CALLBACK_PREFIX)) {
    return null;
  }

  const value = raw.slice(TELEGRAM_MODEL_SELECTION_CALLBACK_PREFIX.length).trim();
  return value || null;
}

function parseReasoningSelectionCallbackData(data: string): string | null {
  const raw = data.trim();
  if (!raw.startsWith(TELEGRAM_REASONING_SELECTION_CALLBACK_PREFIX)) {
    return null;
  }

  const value = raw.slice(TELEGRAM_REASONING_SELECTION_CALLBACK_PREFIX.length).trim();
  return value || null;
}

function parseInlineMenuCloseCallbackData(data: string): string | null {
  const raw = data.trim();
  if (!raw.startsWith(TELEGRAM_INLINE_MENU_CLOSE_CALLBACK_PREFIX)) {
    return null;
  }

  const value = raw.slice(TELEGRAM_INLINE_MENU_CLOSE_CALLBACK_PREFIX.length).trim();
  return value || null;
}

function withInlineMenuCloseButton(
  markup: TelegramInlineKeyboardMarkup,
  menuKey: string,
): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      ...markup.inline_keyboard,
      [{
        text: "닫기",
        callback_data: `${TELEGRAM_INLINE_MENU_CLOSE_CALLBACK_PREFIX}${menuKey}`,
      }],
    ],
  };
}

function buildSessionResumeInlineKeyboard(
  sessions: Array<{
    sessionId: string;
    title?: string | null;
    lastMessagePreview?: string | null;
    updatedAt: string;
  }>,
  currentSessionId: string,
): TelegramInlineKeyboardMarkup {
  return withInlineMenuCloseButton({
    inline_keyboard: sessions.map((item, index) => {
      const isCurrent = item.sessionId === currentSessionId;
      const fallbackLabel = `${formatTelegramJobTime(item.updatedAt)} · ${item.sessionId.slice(0, 8)}`;
      const rawLabel = item.title?.trim() || item.lastMessagePreview?.trim() || fallbackLabel;
      const displayLabel = rawLabel.length > TELEGRAM_SESSION_LIST_PREVIEW_TEXT_LIMIT
        ? `${rawLabel.slice(0, TELEGRAM_SESSION_LIST_PREVIEW_TEXT_LIMIT)}...`
        : rawLabel;

      return [{
        text: `${index + 1}. ${displayLabel}${isCurrent ? " [현재]" : ""}`,
        callback_data: `${TELEGRAM_SESSION_RESUME_CALLBACK_PREFIX}${encodeURIComponent(item.sessionId)}`,
      }];
    }),
  }, "resume");
}

async function listTelegramWorkspaceDirectories(): Promise<string[]> {
  const workspaceRoot = getAgentWorkspaceRoot();
  const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "ko"));
}

function buildWorkspaceSelectionInlineKeyboard(
  directories: string[],
): TelegramInlineKeyboardMarkup {
  const buttonEntries = directories.map((directory, index) => ({
    text: directory.length > 40 ? `${directory.slice(0, 37)}...` : directory,
    callback_data: `${TELEGRAM_WORKSPACE_SELECTION_CALLBACK_PREFIX}${index + 1}`,
    directory,
  }));
  const workspaceEntry = buttonEntries.find((entry) => entry.directory === "workspace");
  const remainingEntries = buttonEntries.filter((entry) => entry.directory !== "workspace");
  const inlineKeyboard = remainingEntries.reduce<Array<typeof buttonEntries>>((rows, entry, index) => {
    if (index % 3 === 0) {
      rows.push([]);
    }
    rows[rows.length - 1].push(entry);
    return rows;
  }, []);

  if (workspaceEntry) {
    inlineKeyboard.unshift([workspaceEntry]);
  }

  return withInlineMenuCloseButton({
    inline_keyboard: inlineKeyboard,
  }, "workspace");
}

function setTelegramWorkspaceBrowseState(chatId: number, directories: string[]): void {
  chatWorkspaceBrowseState.set(chatId, {
    directories,
    createdAt: Date.now(),
  });
}

function getTelegramWorkspaceBrowseSelection(chatId: number, index: number): string | null {
  const state = chatWorkspaceBrowseState.get(chatId);
  if (!state) {
    return null;
  }

  const maxAgeMs = 30 * 60 * 1000;
  if (Date.now() - state.createdAt > maxAgeMs) {
    chatWorkspaceBrowseState.delete(chatId);
    return null;
  }

  return state.directories[index - 1] ?? null;
}

function buildModelInlineKeyboard(currentModel: string): TelegramInlineKeyboardMarkup {
  return withInlineMenuCloseButton({
    inline_keyboard: SUPPORTED_MODELS.map((model, index) => {
      const mark = model === currentModel ? " [현재]" : "";
      return [{
        text: `${index + 1}. ${getModelLabel(model)}${mark}`,
        callback_data: `${TELEGRAM_MODEL_SELECTION_CALLBACK_PREFIX}${model}`,
      }];
    }),
  }, "model");
}

function buildReasoningInlineKeyboard(currentReasoning: string): TelegramInlineKeyboardMarkup {
  return withInlineMenuCloseButton({
    inline_keyboard: SUPPORTED_REASONING_EFFORTS.map((reasoning, index) => {
      const mark = reasoning === currentReasoning ? " [현재]" : "";
      return [{
        text: `${index + 1}. ${formatReasoningLabel(reasoning)}${mark}`,
        callback_data: `${TELEGRAM_REASONING_SELECTION_CALLBACK_PREFIX}${reasoning}`,
      }];
    }),
  }, "effort");
}

function formatHelpText(): string {
  const base = [
    "도움말",
    "",
    "메뉴",
    "/workspace 작업 폴더 선택",
    "/resume 세션 목록 열기 또는 기존 세션 전환",
    "/new 새 세션 시작",
    "/stop 실행 중 작업 중지",
    "/model 모델 버튼 선택",
    "/effort 사고수준 버튼 선택",
    "/help 이 안내 다시 보기",
    "",
    "추가",
    "/status 현재 세션 상태 확인",
    "/jobs [개수] 최근 작업 목록 확인",
    "/fork 현재 세션을 새 분기 세션으로 복제",
    "/model <번호|모델명> 모델 변경",
    "/effort <번호|사고수준> 사고수준 변경",
    "/sc 또는 /screencap [라벨] 화면 캡처 전송",
    "/title <제목> 현재 세션 제목 설정",
    "/clear 대화 기록 초기화",
    "/ping 연결 테스트",
    "/id 내 chat_id 확인",
    "",
    "텍스트만 보내도 바로 실행됩니다.",
  ];

  if (TELEGRAM_REGISTRATION_CODE) {
    base.push("", "/start <인증코드> 인증 코드로 사용 승인");
  }

  return base.join("\n");
}

type TelegramFormattedBlock =
  | { kind: "text"; value: string }
  | { kind: "diff"; value: string }
  | { kind: "code"; value: string; language?: string };

type TelegramFormattedChunk = {
  text: string;
  parseMode?: "HTML";
};

function escapeTelegramHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function tryParseJsonTelegramBlock(text: string): TelegramFormattedBlock | null {
  const trimmed = text.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return {
      kind: "code",
      language: "json",
      value: JSON.stringify(parsed, null, 2),
    };
  } catch {
    return null;
  }
}

function isTelegramUnifiedDiff(text: string): boolean {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return false;
  }

  const lines = normalized.split("\n");
  const hasFileHeader = lines.some((line) => line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("diff --git "));
  const hasHunk = lines.some((line) => line.startsWith("@@ "));
  const hasChangeLine = lines.some((line) => line.startsWith("+") || line.startsWith("-"));

  return hasFileHeader && (hasHunk || hasChangeLine);
}

function parseTelegramFormattedBlocks(text: string): TelegramFormattedBlock[] {
  const jsonBlock = tryParseJsonTelegramBlock(text);
  if (jsonBlock) {
    return [jsonBlock];
  }

  if (isTelegramUnifiedDiff(text)) {
    return [{ kind: "diff", value: text.replace(/\r\n/g, "\n") }];
  }

  const normalized = text.replace(/\r\n/g, "\n");
  const blocks: TelegramFormattedBlock[] = [];
  const fencePattern = /```([a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;

  for (const match of normalized.matchAll(fencePattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      const preceding = normalized.slice(lastIndex, start);
      if (preceding.trim()) {
        blocks.push({ kind: "text", value: preceding });
      }
    }

    const language = match[1]?.trim() || undefined;
    blocks.push(
      language === "diff"
        ? {
            kind: "diff",
            value: (match[2] || "").replace(/\n$/, ""),
          }
        : {
            kind: "code",
            language,
            value: (match[2] || "").replace(/\n$/, ""),
          },
    );

    lastIndex = start + match[0].length;
  }

  if (lastIndex < normalized.length) {
    const trailing = normalized.slice(lastIndex);
    if (trailing.trim()) {
      blocks.push({ kind: "text", value: trailing });
    }
  }

  return blocks.length > 0 ? blocks : [{ kind: "text", value: normalized }];
}

function renderTelegramInlineHtml(text: string): string {
  let rendered = escapeTelegramHtml(text);

  rendered = rendered.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, label: string, href: string) => `<a href="${href}">${label}</a>`,
  );
  rendered = rendered.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  rendered = rendered.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");
  rendered = rendered.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");
  rendered = rendered.replace(/(^|[^\w_])_([^_\n]+)_(?!_)/g, "$1<i>$2</i>");
  rendered = rendered.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  return rendered;
}

function isTelegramTableLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) {
    return false;
  }

  const separators = trimmed.match(/\|/g)?.length ?? 0;
  return separators >= 2;
}

function isTelegramTableDivider(line: string): boolean {
  const normalized = line.replace(/\s+/g, "");
  return /^[:|\-]+$/.test(normalized) && normalized.includes("-");
}

function renderTelegramTableLine(line: string): string {
  const cells = line
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);

  if (cells.length === 0) {
    return "";
  }

  return `<code>${escapeTelegramHtml(cells.join(" | "))}</code>`;
}

function renderTelegramTextHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  const lines = normalized.split("\n").map((line) => {
    if (isTelegramTableDivider(line)) {
      return "";
    }
    if (isTelegramTableLine(line)) {
      return renderTelegramTableLine(line);
    }
    if (/^#{1,6}\s+/.test(line)) {
      return `<b>${renderTelegramInlineHtml(line.replace(/^#{1,6}\s+/, "").trim())}</b>`;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      return `• ${renderTelegramInlineHtml(line.replace(/^\s*[-*]\s+/, "").trim())}`;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      return renderTelegramInlineHtml(line.trim());
    }
    if (/^\s*>\s?/.test(line)) {
      return `┃ ${renderTelegramInlineHtml(line.replace(/^\s*>\s?/, "").trim())}`;
    }
    return renderTelegramInlineHtml(line);
  });

  return lines.filter(Boolean).join("\n");
}

function renderTelegramCodeHtml(code: string, language?: string): string {
  const escaped = escapeTelegramHtml(code.trimEnd());
  if (language?.trim()) {
    return `<pre><code class="language-${escapeTelegramHtml(language.trim())}">${escaped}</code></pre>`;
  }
  return `<pre><code>${escaped}</code></pre>`;
}

function formatTelegramDiffLine(line: string): string {
  if (line.startsWith("diff --git ")) {
    return `🧩 ${line}`;
  }
  if (line.startsWith("index ")) {
    return `ℹ️ ${line}`;
  }
  if (line.startsWith("--- ") || line.startsWith("+++ ")) {
    return `📄 ${line}`;
  }
  if (line.startsWith("@@ ")) {
    return `🔵 ${line}`;
  }
  if (line.startsWith("+") && !line.startsWith("+++ ")) {
    return `🟢 ${line}`;
  }
  if (line.startsWith("-") && !line.startsWith("--- ")) {
    return `🔴 ${line}`;
  }
  if (line.startsWith("\\")) {
    return `⚠️ ${line}`;
  }
  return `⚪ ${line}`;
}

function renderTelegramDiffHtml(diff: string): string {
  const rendered = diff
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => formatTelegramDiffLine(line))
    .join("\n");

  return `<pre>${escapeTelegramHtml(rendered.trimEnd())}</pre>`;
}

function splitTelegramTextBlock(text: string, limit: number): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const parts: string[] = [];
  let current = "";

  const flushCurrent = () => {
    if (!current.trim()) {
      current = "";
      return;
    }
    parts.push(current.trimEnd());
    current = "";
  };

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (renderTelegramTextHtml(candidate).length <= limit) {
      current = candidate;
      continue;
    }

    flushCurrent();
    if (renderTelegramTextHtml(line).length <= limit) {
      current = line;
      continue;
    }

    let start = 0;
    const sliceSize = Math.max(256, Math.floor(limit / 2));
    while (start < line.length) {
      const piece = line.slice(start, start + sliceSize);
      parts.push(piece);
      start += sliceSize;
    }
  }

  flushCurrent();
  return parts;
}

function splitTelegramCodeBlock(code: string, language: string | undefined, limit: number): string[] {
  if (renderTelegramCodeHtml(code, language).length <= limit) {
    return [renderTelegramCodeHtml(code, language)];
  }

  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let current = "";

  const flushCurrent = () => {
    if (!current) {
      return;
    }
    parts.push(renderTelegramCodeHtml(current, language));
    current = "";
  };

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (renderTelegramCodeHtml(candidate, language).length <= limit) {
      current = candidate;
      continue;
    }

    flushCurrent();
    if (renderTelegramCodeHtml(line, language).length <= limit) {
      current = line;
      continue;
    }

    let start = 0;
    const sliceSize = Math.max(256, Math.floor(limit / 2));
    while (start < line.length) {
      parts.push(renderTelegramCodeHtml(line.slice(start, start + sliceSize), language));
      start += sliceSize;
    }
  }

  flushCurrent();
  return parts;
}

function splitTelegramDiffBlock(diff: string, limit: number): string[] {
  if (renderTelegramDiffHtml(diff).length <= limit) {
    return [renderTelegramDiffHtml(diff)];
  }

  const lines = diff.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let current = "";

  const flushCurrent = () => {
    if (!current) {
      return;
    }
    parts.push(renderTelegramDiffHtml(current));
    current = "";
  };

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (renderTelegramDiffHtml(candidate).length <= limit) {
      current = candidate;
      continue;
    }

    flushCurrent();
    if (renderTelegramDiffHtml(line).length <= limit) {
      current = line;
      continue;
    }

    let start = 0;
    const sliceSize = Math.max(256, Math.floor(limit / 2));
    while (start < line.length) {
      parts.push(renderTelegramDiffHtml(line.slice(start, start + sliceSize)));
      start += sliceSize;
    }
  }

  flushCurrent();
  return parts;
}

function buildTelegramFormattedChunks(text: string): TelegramFormattedChunk[] {
  const blocks = parseTelegramFormattedBlocks(text);
  const maxLength = TELEGRAM_CHAT_TEXT_LIMIT - 64;
  const renderedSegments = blocks.flatMap((block) => {
    if (block.kind === "diff") {
      return splitTelegramDiffBlock(block.value, maxLength);
    }
    if (block.kind === "code") {
      return splitTelegramCodeBlock(block.value, block.language, maxLength);
    }

    return splitTelegramTextBlock(block.value, maxLength).map((part) => renderTelegramTextHtml(part));
  }).filter(Boolean);

  if (renderedSegments.length === 0) {
    return [{ text: escapeTelegramHtml(text.slice(0, maxLength)), parseMode: "HTML" }];
  }

  const chunks: TelegramFormattedChunk[] = [];
  let current = "";

  for (const segment of renderedSegments) {
    const candidate = current ? `${current}\n\n${segment}` : segment;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push({ text: current, parseMode: "HTML" });
    }
    current = segment;
  }

  if (current) {
    chunks.push({ text: current, parseMode: "HTML" });
  }

  return chunks;
}

function formatProgressPreview(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  const shouldTruncate = normalized.length > TELEGRAM_PROGRESS_PREVIEW_LIMIT;
  const previewLength = shouldTruncate
    ? Math.max(1, TELEGRAM_PROGRESS_PREVIEW_LIMIT - 1)
    : TELEGRAM_PROGRESS_PREVIEW_LIMIT;
  const preview = normalized.slice(0, previewLength);
  if (!preview) {
    return null;
  }

  return `미리보기:\n${preview}${shouldTruncate ? "." : ""}`;
}

function formatTelegramLoopStatus(status: string): string {
  switch (status) {
    case "queued":
      return "대기중";
    case "running":
      return "진행중";
    case "completed":
      return "완료";
    case "failed":
      return "실패";
    default:
      return status;
  }
}

function buildWaitingText(elapsedSeconds: number): string {
  return `${TELEGRAM_LOOP_EMOJI} 응답 대기중 입니다. (${elapsedSeconds}초)`;
}

function buildStatusText(
  elapsedSeconds: number,
  status: string,
  summary: string,
  preview: string | null,
  options?: { completed?: boolean },
): string {
  void options;
  const lines = [
    `${TELEGRAM_LOOP_EMOJI} 작업상태 : ${formatTelegramLoopStatus(status)} (${elapsedSeconds}초)`,
  ];
  if (summary.trim()) {
    lines.push(summary);
  }
  if (preview) {
    lines.push("", preview);
  }
  return lines.join("\n");
}

function formatStatusText(
  elapsedSeconds: number,
  status: string,
  traceEnabled: boolean,
  assistantText: string,
): string {
  return buildStatusText(
    elapsedSeconds,
    status,
    traceEnabled ? "진행 상황을 확인 중입니다." : "응답 생성 중...",
    formatProgressPreview(assistantText),
  );
}

async function callTelegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt <= TELEGRAM_API_RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    const response = await fetch(`${TELEGRAM_API_BASE_URL}${getTelegramBotToken()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const parsed = (await response.json().catch(() => null)) as TelegramApiResponse<T> | null;
    if (response.ok && parsed?.ok && parsed.result) {
      return parsed.result;
    }

    const retryAfterSeconds = parsed?.parameters?.retry_after;
    if (
      typeof retryAfterSeconds === "number" &&
      Number.isFinite(retryAfterSeconds) &&
      retryAfterSeconds > 0 &&
      attempt < TELEGRAM_API_RATE_LIMIT_MAX_RETRIES
    ) {
      await appendTelegramEventLog("telegram_api.rate_limited", {
        method,
        retryAfterSeconds,
        attempt: attempt + 1,
        chatId: payload.chat_id ?? null,
        messageId: payload.message_id ?? null,
      });
      await sleep(retryAfterSeconds * 1000);
      continue;
    }

    const message = parsed?.description || `HTTP ${response.status}`;
    throw new Error(`Telegram API error: ${message}`);
  }
  throw new Error("Telegram API error: exceeded retry limit");
}

function serializeTelegramCommands(commands: readonly TelegramBotCommand[]): string {
  return JSON.stringify(
    commands.map((command) => ({
      command: command.command.trim(),
      description: command.description.trim(),
    })),
  );
}

function serializeTelegramCommandScope(scope?: TelegramBotCommandScope): string {
  if (!scope || scope.type === "default") {
    return "default";
  }
  if (scope.type === "chat") {
    return `chat:${scope.chat_id}`;
  }
  return scope.type;
}

function areTelegramCommandsEqual(
  left: readonly TelegramBotCommand[],
  right: readonly TelegramBotCommand[],
): boolean {
  return serializeTelegramCommands(left) === serializeTelegramCommands(right);
}

async function getTelegramBotCommands(scope?: TelegramBotCommandScope): Promise<TelegramBotCommand[]> {
  return callTelegramApi<TelegramBotCommand[]>(
    "getMyCommands",
    scope && scope.type !== "default" ? { scope } : {},
  );
}

async function setTelegramBotCommands(
  commands: readonly TelegramBotCommand[],
  scope?: TelegramBotCommandScope,
): Promise<void> {
  await callTelegramApi("setMyCommands", scope && scope.type !== "default" ? { commands, scope } : { commands });
}

async function ensureTelegramMenuCommandsRegistered(scope?: TelegramBotCommandScope): Promise<void> {
  const desiredSignature = serializeTelegramCommands(TELEGRAM_MENU_COMMANDS);
  const scopeKey = serializeTelegramCommandScope(scope);
  if (telegramMenuSyncState.get(scopeKey) === desiredSignature) {
    return;
  }

  const currentCommands = await getTelegramBotCommands(scope);
  if (!areTelegramCommandsEqual(currentCommands, TELEGRAM_MENU_COMMANDS)) {
    await setTelegramBotCommands(TELEGRAM_MENU_COMMANDS, scope);
    await appendTelegramEventLog("telegram_menu.synced", {
      commandCount: TELEGRAM_MENU_COMMANDS.length,
      scope: scopeKey,
    });
  }

  telegramMenuSyncState.set(scopeKey, desiredSignature);
}

async function downloadTelegramFile(
  attachment: TelegramIncomingAttachment,
): Promise<{ savedPath: string; fileName: string }> {
  const token = getTelegramBotToken();
  const file = await callTelegramApi<TelegramFile>("getFile", { file_id: attachment.fileId });
  if (!file?.file_path) {
    throw new Error("Telegram file_path를 조회하지 못했습니다.");
  }

  const response = await fetch(`${TELEGRAM_FILE_BASE_URL}${token}/${file.file_path}`);
  if (!response.ok) {
    throw new Error(`파일 다운로드 실패: HTTP ${response.status}`);
  }

  const downloaded = Buffer.from(await response.arrayBuffer());
  const safeName = sanitizeTelegramFileName(attachment.fileName || path.basename(file.file_path));
  const uniqueName = `${Date.now()}-${randomUUID().replaceAll("-", "").slice(0, 12)}-${safeName}`;
  const savedPath = path.join(TELEGRAM_FILE_DOWNLOAD_DIR, uniqueName);

  await fs.mkdir(TELEGRAM_FILE_DOWNLOAD_DIR, { recursive: true });
  await fs.writeFile(savedPath, downloaded);

  return { savedPath, fileName: safeName };
}

function appendAttachmentContextToRunMessage(message: string, attachmentPath: string | null): string {
  const trimmed = message.trim();
  if (!attachmentPath) {
    return trimmed;
  }
  if (!trimmed) {
    return `첨부 파일을 분석해줘.\n첨부 파일 경로: ${attachmentPath}`;
  }
  return `${trimmed}\n\n첨부 파일 경로: ${attachmentPath}`;
}

async function sendTelegramMessage(chatId: number, text: string): Promise<TelegramSentMessage> {
  const chunks = buildTelegramFormattedChunks(text);
  let sentMessageId: number | null = null;

  for (const [index, chunk] of chunks.entries()) {
    const prefix = chunks.length > 1 ? `[${index + 1}/${chunks.length}]\n` : "";
    const body = `${prefix}${chunk.text}`;
    const sent = await callTelegramApi<TelegramSentMessage>("sendMessage", {
      chat_id: chatId,
      text: body.slice(0, TELEGRAM_CHAT_TEXT_LIMIT),
      disable_web_page_preview: true,
      parse_mode: chunk.parseMode,
    });
    sentMessageId = sent.message_id;
  }

  if (sentMessageId === null) {
    const sent = await callTelegramApi<TelegramSentMessage>("sendMessage", {
      chat_id: chatId,
      text: "메시지를 보냈으나 응답이 비어 있었습니다.",
      disable_web_page_preview: true,
    });
    return sent;
  }

  return { message_id: sentMessageId };
}

async function sendTelegramMessageWithRemovedKeyboard(
  chatId: number,
  text: string,
): Promise<TelegramSentMessage> {
  const chunks = buildTelegramFormattedChunks(text);
  const chunksToSend = chunks.length > 0 ? chunks : [{
    text: escapeTelegramHtml(text.slice(0, TELEGRAM_CHAT_TEXT_LIMIT)),
    parseMode: "HTML" as const,
  }];
  let sentMessageId: number | null = null;

  for (const [index, chunk] of chunksToSend.entries()) {
    const prefix = chunksToSend.length > 1 ? `[${index + 1}/${chunksToSend.length}]\n` : "";
    const body = `${prefix}${chunk.text}`;
    const sent = await callTelegramApi<TelegramSentMessage>("sendMessage", {
      chat_id: chatId,
      text: body.slice(0, TELEGRAM_CHAT_TEXT_LIMIT),
      disable_web_page_preview: true,
      parse_mode: chunk.parseMode,
      reply_markup: index === chunksToSend.length - 1
        ? ({
            remove_keyboard: true,
          } satisfies TelegramReplyKeyboardRemove)
        : undefined,
    });
    sentMessageId = sent.message_id;
  }

  return { message_id: sentMessageId ?? 0 };
}

async function sendTelegramMessageWithInlineKeyboard(
  chatId: number,
  text: string,
  replyMarkup: TelegramInlineKeyboardMarkup,
): Promise<TelegramSentMessage> {
  const chunks = buildTelegramFormattedChunks(text);
  const chunksToSend = chunks.length > 0 ? chunks : [{
    text: escapeTelegramHtml(text.slice(0, TELEGRAM_CHAT_TEXT_LIMIT)),
    parseMode: "HTML" as const,
  }];
  let sentMessageId: number | null = null;

  for (const [index, chunk] of chunksToSend.entries()) {
    const prefix = chunksToSend.length > 1 ? `[${index + 1}/${chunksToSend.length}]\n` : "";
    const body = `${prefix}${chunk.text}`;
    const sent = await callTelegramApi<TelegramSentMessage>("sendMessage", {
      chat_id: chatId,
      text: body.slice(0, TELEGRAM_CHAT_TEXT_LIMIT),
      disable_web_page_preview: true,
      parse_mode: chunk.parseMode,
      reply_markup: index === chunksToSend.length - 1 ? replyMarkup : undefined,
    });
    sentMessageId = sent.message_id;
  }

  return { message_id: sentMessageId ?? 0 };
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text?.trim() || "",
    show_alert: false,
  });
}

async function sendTelegramPhoto(
  chatId: number,
  imagePath: string,
  caption: string,
): Promise<TelegramSentMessage> {
  const imageBuffer = await fs.readFile(imagePath);
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("photo", new Blob([imageBuffer], { type: "image/png" }), path.basename(imagePath));

  const response = await fetch(`${TELEGRAM_API_BASE_URL}${getTelegramBotToken()}/sendPhoto`, {
    method: "POST",
    body: form,
  });

  const parsed = (await response.json().catch(() => null)) as TelegramApiResponse<TelegramSentMessage> | null;
  if (!response.ok || !parsed?.ok || !parsed.result) {
    const message = parsed?.description || `HTTP ${response.status}`;
    throw new Error(`Telegram API error: ${message}`);
  }

  return parsed.result;
}

function getTelegramMessageKey(chatId: number, messageId: number): string {
  return `${chatId}:${messageId}`;
}

async function runTelegramMessageEditWithThrottle<T>(
  chatId: number,
  messageId: number,
  operation: () => Promise<T>,
): Promise<T> {
  const key = getTelegramMessageKey(chatId, messageId);
  const previous = telegramMessageEditQueues.get(key) ?? Promise.resolve();

  const current = previous.catch(() => undefined).then(async () => {
    const lastEditedAt = telegramMessageLastEditedAt.get(key) ?? 0;
    const waitMs = TELEGRAM_EDIT_MESSAGE_MIN_INTERVAL_MS - (Date.now() - lastEditedAt);
    if (waitMs > 0) {
      await appendTelegramEventLog("telegram_message.edit_throttled", {
        chatId,
        messageId,
        waitMs,
      });
      await sleep(waitMs);
    }

    try {
      return await operation();
    } finally {
      telegramMessageLastEditedAt.set(key, Date.now());
    }
  });

  const settled = current.then(() => undefined, () => undefined);
  telegramMessageEditQueues.set(key, settled);

  try {
    return await current;
  } finally {
    if (telegramMessageEditQueues.get(key) === settled) {
      telegramMessageEditQueues.delete(key);
    }
  }
}

async function editTelegramMessage(chatId: number, messageId: number, text: string): Promise<void> {
  const safeText = text.slice(0, TELEGRAM_CHAT_TEXT_LIMIT);
  try {
    await runTelegramMessageEditWithThrottle(chatId, messageId, async () => {
      await callTelegramApi("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: safeText,
        disable_web_page_preview: true,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("message is not modified")) {
      return;
    }
    throw error;
  }
}

async function clearTelegramInlineKeyboard(chatId: number, messageId: number): Promise<void> {
  try {
    await runTelegramMessageEditWithThrottle(chatId, messageId, async () => {
      await callTelegramApi("editMessageReplyMarkup", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [],
        } satisfies TelegramInlineKeyboardMarkup,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("message is not modified")) {
      return;
    }
    throw error;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForJobAndSendResult(chatId: number, jobId: string, progressMessageId: number, traceEnabled: boolean): Promise<void> {
  const startTime = Date.now();
  let lastProgress = "";
  let lastStatusTime = 0;
  let lastPreview: string | null = null;

  while (true) {
    const job = await getAgentJob(jobId);
    if (!job) {
      await editTelegramMessage(chatId, progressMessageId, "작업 정보를 찾을 수 없습니다.");
      return;
    }

    const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));

    if (job.status === "completed" || job.status === "failed") {
      const finalStatusText = buildStatusText(
        elapsed,
        job.status,
        job.status === "failed"
          ? "오류 내용은 새 메시지로 전송했습니다."
          : "최종 결과는 새 메시지로 전송했습니다.",
        lastPreview,
        { completed: job.status === "completed" },
      );

      if (job.status === "failed") {
        const reason = job.error?.trim() || "실행 중 오류가 발생했습니다.";
        await sendTelegramMessage(chatId, `실행 실패: ${reason}`);
        await editTelegramMessage(
          chatId,
          progressMessageId,
          finalStatusText,
        );
        return;
      }

      const finalText = job.assistantText.trim() || "응답이 비어 있습니다.";
      await sendTelegramMessage(chatId, finalText);
      await editTelegramMessage(
        chatId,
        progressMessageId,
        finalStatusText,
      );
      return;
    }

    const shouldUpdateStatus = Date.now() - lastStatusTime >= TELEGRAM_PROGRESS_UPDATE_INTERVAL_MS;
    const hasAssistantResponse = job.assistantText.trim().length > 0;
    if (shouldUpdateStatus) {
      const nextProgress = hasAssistantResponse
        ? formatStatusText(elapsed, job.status, traceEnabled, job.assistantText)
        : buildWaitingText(elapsed);
      if (nextProgress !== lastProgress) {
        await editTelegramMessage(chatId, progressMessageId, nextProgress);
        lastProgress = nextProgress;
      }
      if (hasAssistantResponse) {
        lastPreview = formatProgressPreview(job.assistantText);
      }
      lastStatusTime = Date.now();
    }

    await sleep(TELEGRAM_POLL_INTERVAL_MS);
  }
}

async function handleSignalCommand(chatId: number, origin: string): Promise<void> {
  const style = await getChatSignalStyle(chatId);
  const payload = await callInternalSignalApi(origin, "/api/signals/overview", { style });
  await sendTelegramMessage(chatId, formatOverviewTelegramMessage(payload, style));
}

async function handleBriefingCommand(chatId: number, origin: string): Promise<void> {
  const style = await getChatSignalStyle(chatId);
  const payload = await callInternalSignalApi(origin, "/api/signals/briefing", { style });
  await sendTelegramMessage(chatId, formatBriefingTelegramMessage(payload, style));
}

async function handleRecommendCommand(
  chatId: number,
  origin: string,
  count: number,
): Promise<void> {
  const style = await getChatSignalStyle(chatId);
  const payload = await callInternalSignalApi(origin, "/api/signals/recommendations", {
    style,
    limit: count,
  });
  await sendTelegramMessage(chatId, formatRecommendationsTelegramMessage(payload, style));
}

async function handleAssetCommand(
  chatId: number,
  origin: string,
  ticker: string,
): Promise<void> {
  const style = await getChatSignalStyle(chatId);
  const payload = await callInternalSignalApi(
    origin,
    `/api/signals/assets/${encodeURIComponent(ticker)}`,
    { style },
  );
  await sendTelegramMessage(chatId, formatAssetTelegramMessage(payload, style));
}

async function handleSignalStyleCommand(
  chatId: number,
  value: string | undefined,
): Promise<void> {
  const currentStyle = await getChatSignalStyle(chatId);
  if (!value) {
    await sendTelegramMessage(
      chatId,
      [
        "추천 스타일 설정",
        `현재: ${getSignalStyleLabel(currentStyle)} (${currentStyle})`,
        "변경: /style conservative | /style balanced | /style aggressive",
      ].join("\n"),
    );
    return;
  }

  const nextStyle = resolveSignalStyleByInput(value);
  if (!nextStyle) {
    await sendTelegramMessage(
      chatId,
      [
        `스타일을 해석하지 못했습니다: ${value}`,
        "지원값: conservative | balanced | aggressive",
      ].join("\n"),
    );
    return;
  }

  if (nextStyle === currentStyle) {
    await sendTelegramMessage(
      chatId,
      `현재 추천 스타일이 이미 ${getSignalStyleLabel(nextStyle)} (${nextStyle})입니다.`,
    );
    return;
  }

  await setChatSignalStyle(chatId, nextStyle);
  await sendTelegramMessage(
    chatId,
    `추천 스타일을 ${getSignalStyleLabel(nextStyle)} (${nextStyle})로 변경했습니다.`,
  );
}

async function handleRunCommand(
  chatId: number,
  sessionId: string,
  text: string,
): Promise<void> {
  const session = await loadSession(sessionId);
  const validation = validateAgentRequest({
    sessionId,
    message: text,
    model: getSessionModel(session.model),
    reasoningEffort: getSessionReasoning(session.reasoningEffort),
    trace: getTraceMode(sessionId),
  });

  if (!validation.ok) {
    await sendTelegramMessage(chatId, validation.reason);
    return;
  }

  try {
    const job = await createAgentJob({
      sessionId: validation.data.sessionId,
      message: validation.data.message,
      model: validation.data.model,
      reasoningEffort: validation.data.reasoningEffort,
      trace: validation.data.trace,
      source: "telegram",
    });
    const initial = await sendTelegramMessage(chatId, buildWaitingText(0));
    await waitForJobAndSendResult(chatId, job.jobId, initial.message_id, getTraceMode(sessionId));
  } catch (error) {
    if (isActiveJobError(error)) {
      await sendTelegramMessage(chatId, `현재 이 세션은 이미 처리 중인 작업이 있습니다. (${error.activeJobId})`);
      return;
    }

    const message = error instanceof Error ? error.message : "작업 생성에 실패했습니다.";
    await sendTelegramMessage(chatId, `요청 처리 실패: ${message}`);
  }
}

async function applyModelSelection(sessionId: string, value: string): Promise<string> {
  const session = await loadSession(sessionId);
  const currentModel = getSessionModel(session.model);
  const nextModel = resolveModelByInput(value);

  if (!nextModel) {
    return `모델 선택에 실패했습니다: ${value}`;
  }

  if (nextModel === currentModel) {
    return `현재 모델이 이미 ${getModelLabel(nextModel)}입니다.`;
  }

  await setSessionModel(sessionId, nextModel, session.reasoningEffort);
  return `기본 모델을 ${getModelLabel(nextModel)} (${nextModel})로 변경했습니다.`;
}

async function handleModelCommand(
  chatId: number,
  sessionId: string,
  value: string | undefined,
): Promise<void> {
  const session = await loadSession(sessionId);
  const currentModel = getSessionModel(session.model);

  if (!value) {
    await sendTelegramMessageWithInlineKeyboard(
      chatId,
      formatModelListText(currentModel),
      buildModelInlineKeyboard(currentModel),
    );
    return;
  }

  const message = await applyModelSelection(sessionId, value);
  if (message.startsWith("모델 선택에 실패했습니다:")) {
    await sendTelegramMessageWithInlineKeyboard(
      chatId,
      [
        message,
        formatModelListText(currentModel),
      ].join("\n"),
      buildModelInlineKeyboard(currentModel),
    );
    return;
  }

  await sendTelegramMessageWithRemovedKeyboard(chatId, message);
}

async function applyReasoningSelection(sessionId: string, value: string): Promise<string> {
  const session = await loadSession(sessionId);
  const currentReasoning = getSessionReasoning(session.reasoningEffort);
  const nextReasoning = resolveReasoningByInput(value);

  if (!nextReasoning) {
    return `사고수준 선택에 실패했습니다: ${value}`;
  }

  if (nextReasoning === currentReasoning) {
    return `현재 사고수준이 이미 ${formatReasoningLabel(nextReasoning)}입니다.`;
  }

  await setSessionModel(sessionId, getSessionModel(session.model), nextReasoning);
  return `사고수준을 ${formatReasoningLabel(nextReasoning)} (${nextReasoning})로 변경했습니다.`;
}

async function handleReasoningCommand(
  chatId: number,
  sessionId: string,
  value: string | undefined,
): Promise<void> {
  const session = await loadSession(sessionId);
  const currentReasoning = getSessionReasoning(session.reasoningEffort);

  if (!value) {
    await sendTelegramMessageWithInlineKeyboard(
      chatId,
      formatReasoningListText(currentReasoning),
      buildReasoningInlineKeyboard(currentReasoning),
    );
    return;
  }

  const message = await applyReasoningSelection(sessionId, value);
  if (message.startsWith("사고수준 선택에 실패했습니다:")) {
    await sendTelegramMessageWithInlineKeyboard(
      chatId,
      [
        message,
        formatReasoningListText(currentReasoning),
      ].join("\n"),
      buildReasoningInlineKeyboard(currentReasoning),
    );
    return;
  }

  await sendTelegramMessageWithRemovedKeyboard(chatId, message);
}

async function handleSessionInfoCommand(chatId: number, sessionId: string, query?: string): Promise<void> {
  const workingDirectory = await getSessionWorkingDirectoryLabel(sessionId);
  const sessions = filterTelegramResumeSessions(await listChatScopedResumeSessions(chatId), query);
  const targets = sessions.slice(0, TELEGRAM_SESSION_LIST_LIMIT);
  setTelegramSessionBrowseState(chatId, query, targets.map((item) => item.sessionId));

  let selectorIndex = 1;
  const selectorLines = targets.length > 0
    ? targets.map((item) => {
        const line = formatTelegramSessionSelectorLine(item, selectorIndex, sessionId);
        selectorIndex += 1;
        return line;
      })
    : [query?.trim() ? "(일치하는 세션 없음)" : "(표시할 세션 없음)"];

  const body = [
    `기본 작업 위치: ${workingDirectory || "(미설정)"}`,
    "",
    ...selectorLines,
  ].join("\n");

  if (targets.length === 0) {
    await sendTelegramMessage(chatId, body);
    return;
  }

  const inlineKeyboard = buildSessionResumeInlineKeyboard(
    targets.map((item) => ({
      sessionId: item.sessionId,
      title: item.title,
      lastMessagePreview: item.lastMessagePreview,
      updatedAt: item.updatedAt,
    })),
    sessionId,
  );

  await sendTelegramMessageWithInlineKeyboard(
    chatId,
    body,
    inlineKeyboard,
  );
}

type SessionSwitchResult = {
  targetSessionId: string;
  targetSessionTitle?: string | null;
  switched: boolean;
  found: boolean;
  message: string;
};

function formatSessionTitleLabel(title?: string | null): string {
  const normalized = title?.trim();
  return normalized && normalized.length > 0 ? normalized : "(미설정)";
}

function formatTelegramJobTime(iso?: string): string {
  if (!iso) {
    return "시간 정보 없음";
  }
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) {
    return "시간 정보 없음";
  }
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  const hours = String(target.getHours()).padStart(2, "0");
  const minutes = String(target.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

function formatTelegramJobStatus(status: "completed" | "failed"): string {
  return status === "completed" ? "완료" : "실패";
}

function formatTelegramSessionSelectorLine(
  session: Awaited<ReturnType<typeof listResumeSessions>>[number],
  index: number,
  currentSessionId: string,
): string {
  const rawLabel = session.title?.trim() || session.lastMessagePreview?.trim() || "제목 없음";
  const clippedLabel = rawLabel.length > TELEGRAM_SESSION_LIST_PREVIEW_TEXT_LIMIT
    ? `${rawLabel.slice(0, TELEGRAM_SESSION_LIST_PREVIEW_TEXT_LIMIT)}...`
    : rawLabel;
  const timestamp = formatTelegramJobTime(session.updatedAt);
  const shortSessionId = session.sessionId.slice(0, 8);
  const marker = session.sessionId === currentSessionId ? " [현재]" : "";
  return `${index}. ${timestamp} | ${clippedLabel} | ${shortSessionId}${marker}`;
}

function filterTelegramResumeSessions(
  sessions: Awaited<ReturnType<typeof listResumeSessions>>,
  query?: string,
): Awaited<ReturnType<typeof listResumeSessions>> {
  const normalizedQuery = query?.trim().toLowerCase();
  if (!normalizedQuery) {
    return sessions;
  }

  return sessions.filter((session) => {
    const title = session.title?.toLowerCase() || "";
    const preview = session.lastMessagePreview?.toLowerCase() || "";
    const sessionId = session.sessionId.toLowerCase();
    return (
      title.includes(normalizedQuery) ||
      preview.includes(normalizedQuery) ||
      sessionId.includes(normalizedQuery)
    );
  });
}

function setTelegramSessionBrowseState(chatId: number, query: string | undefined, targetSessionIds: string[]): void {
  chatSessionBrowseState.set(chatId, {
    query: query?.trim() || undefined,
    targetSessionIds,
    createdAt: Date.now(),
  });
}

function getTelegramSessionBrowseTargets(chatId: number): string[] | null {
  const state = chatSessionBrowseState.get(chatId);
  if (!state) {
    return null;
  }

  const maxAgeMs = 30 * 60 * 1000;
  if (Date.now() - state.createdAt > maxAgeMs) {
    chatSessionBrowseState.delete(chatId);
    return null;
  }

  return state.targetSessionIds;
}

function isFinishedJobStatus(status: string): status is "completed" | "failed" {
  return status === "completed" || status === "failed";
}

function isFinishedJob(job: AgentJob, cursor: string): job is AgentJob & {
  status: "completed" | "failed";
  completedAt: string;
} {
  return isFinishedJobStatus(job.status) && typeof job.completedAt === "string" && job.completedAt > cursor;
}

async function buildCrossSessionCompletionNotice(chatId: number, targetSessionId: string): Promise<string | null> {
  await ensureChatCompletionCursorsLoaded();

  const cursor = chatCompletionCursors.get(chatId);
  const now = new Date().toISOString();
  if (!cursor) {
    await setChatCompletionCursor(chatId, now);
    return null;
  }

  const sessions = (await listChatScopedResumeSessions(chatId)).filter(
    (session) => session.sessionId !== targetSessionId && isSessionOwnedByChat(chatId, session.sessionId),
  );
  if (sessions.length === 0) {
    await setChatCompletionCursor(chatId, now);
    return null;
  }

  const jobs = await listJobsForSessions(sessions.map((session) => session.sessionId));
  const finishedJobs = jobs
    .filter((job) => isFinishedJob(job, cursor))
    .sort((a, b) => {
      const aTime = Date.parse(a.completedAt || a.updatedAt);
      const bTime = Date.parse(b.completedAt || b.updatedAt);
      return bTime - aTime;
    });

  await setChatCompletionCursor(chatId, now);

  if (finishedJobs.length === 0) {
    return null;
  }

  const lines = finishedJobs.slice(0, 3).map((job, index) => {
    const preview = (job.message || "").replace(/\s+/g, " ").trim() || "(빈 요청)";
    const truncatedPreview = preview.length > 48 ? `${preview.slice(0, 45)}...` : preview;
    return [
      `${index + 1}. ${job.sessionId}`,
      `${formatTelegramJobStatus(job.status)} · ${formatTelegramJobTime(job.completedAt)}`,
      truncatedPreview,
    ].join("\n");
  });

  if (finishedJobs.length > lines.length) {
    lines.push(`외 ${finishedJobs.length - lines.length}건`);
  }

  return ["다른 세션에서 종료된 작업이 있습니다.", ...lines].join("\n");
}

function buildSessionSwitchedText(
  targetSessionId: string,
  targetSessionTitle: string | null,
  switched: boolean,
): string {
  const titleLine = `세션 제목: ${formatSessionTitleLabel(targetSessionTitle)}`;

  if (!switched) {
    return `이미 현재 세션입니다: ${targetSessionId}\n${titleLine}`;
  }

  return `세션을 전환했습니다.\n현재 세션: ${targetSessionId}\n${titleLine}\n이제부터 이 세션 컨텍스트에서 계속 진행됩니다.`;
}

async function switchSession(
  chatId: number,
  targetSessionId: string,
  currentSessionId: string,
): Promise<SessionSwitchResult> {
  await appendTelegramEventLog("session_switch.request", {
    chatId,
    targetSessionId,
    currentSessionId,
  });

  if (targetSessionId === currentSessionId) {
    const targetSession = await loadSession(targetSessionId);
    const targetSessionTitle = targetSession.title?.trim() || null;
    await appendTelegramEventLog("session_switch.result", {
      chatId,
      targetSessionId,
      currentSessionId,
      switched: false,
      found: true,
      targetSessionTitle,
      reason: "already_current",
    });
    return {
      targetSessionId,
      targetSessionTitle,
      switched: false,
      found: true,
      message: buildSessionSwitchedText(targetSessionId, targetSessionTitle, false),
    };
  }

  const targetSession = await loadSession(targetSessionId);
  const selectedWorkingDirectory = await getChatWorkspaceSelection(chatId);
  if (selectedWorkingDirectory) {
    await setSessionWorkingDirectory(targetSessionId, selectedWorkingDirectory);
  }
  const targetSessionTitle = targetSession.title?.trim() || null;
  await setSessionOverride(chatId, targetSessionId);
  const completionNotice = await buildCrossSessionCompletionNotice(chatId, targetSessionId);
  await appendTelegramEventLog("session_switch.result", {
    chatId,
    targetSessionId,
    currentSessionId,
    switched: true,
    found: true,
    targetSessionTitle,
    hasCompletionNotice: Boolean(completionNotice),
  });
  return {
    targetSessionId,
    targetSessionTitle,
    switched: true,
    found: true,
    message: completionNotice
      ? `${buildSessionSwitchedText(targetSessionId, targetSessionTitle, true)}\n\n${completionNotice}`
      : buildSessionSwitchedText(targetSessionId, targetSessionTitle, true),
  };
}

function summarizeResumeSessionResult(result: SessionSwitchResult): string {
  if (!result.found) {
    return "요청한 세션을 찾을 수 없습니다.";
  }
  return result.switched ? `세션 전환됨: ${result.targetSessionId}` : `현재 세션 유지: ${result.targetSessionId}`;
}

async function handleResumeSessionCallback(
  chatId: number,
  targetSessionId: string,
  currentSessionId: string,
): Promise<SessionSwitchResult> {
  try {
    await loadSession(targetSessionId);
  } catch {
    await appendTelegramEventLog("session_switch.not_found", {
      chatId,
      targetSessionId,
      currentSessionId,
    });
    return {
      targetSessionId,
      switched: false,
      found: false,
      message: "요청한 세션을 찾을 수 없습니다. /resume 을 다시 열어 최신 목록에서 선택해 주세요.",
    };
  }

  const switchResult = await switchSession(chatId, targetSessionId, currentSessionId);
  return switchResult;
}

async function handleResumeSessionCommand(
  chatId: number,
  selector: string,
  currentSessionId: string,
): Promise<void> {
  const sessions = await listChatScopedResumeSessions(chatId);
  const browseTargets = getTelegramSessionBrowseTargets(chatId);
  const targets = browseTargets
    ? browseTargets
        .map((sessionId) => sessions.find((session) => session.sessionId === sessionId))
        .filter(Boolean)
    : sessions.slice(0, TELEGRAM_SESSION_LIST_LIMIT);
  if (targets.length === 0) {
    await sendTelegramMessage(chatId, "이동 가능한 세션이 없습니다.");
    return;
  }

  const trimmed = selector.trim();
  let selectedSessionId: string | null = null;
  const numberCandidate = Number.parseInt(trimmed, 10);

  if (Number.isInteger(numberCandidate) && numberCandidate > 0 && numberCandidate <= targets.length) {
    selectedSessionId = targets[numberCandidate - 1]?.sessionId ?? null;
  } else {
    selectedSessionId = sessions.find((session) => session.sessionId === trimmed)?.sessionId ?? null;
  }

  if (!selectedSessionId) {
    await sendTelegramMessage(
      chatId,
      `세션 선택 실패: ${trimmed}\n/resume 목록에서 번호(1~${targets.length}) 또는 정확한 세션 ID로 선택해 주세요.`,
    );
    return;
  }

  const switchResult = await switchSession(chatId, selectedSessionId, currentSessionId);
  await sendTelegramMessageWithRemovedKeyboard(chatId, switchResult.message);
}

async function handleEventLogCommand(chatId: number, count?: number): Promise<void> {
  const lines = await readRecentTelegramEventLogLines(count ?? TELEGRAM_EVENT_LOG_DEFAULT_LINES);
  if (lines.length === 0) {
    await sendTelegramMessage(
      chatId,
      "로그 파일이 비어 있거나 아직 생성되지 않았습니다. `/resume` 버튼을 눌러도 반응이 없으면 재현 시점을 다시 보내 주세요.",
    );
    return;
  }

  const maxCount = lines.length;
  const body = `최근 이벤트 로그 ${maxCount}개:\n${lines.join("\n")}`;
  await sendTelegramMessage(chatId, body);
}

 

async function handleRecentMessagesCommand(
  chatId: number,
  sessionId: string,
  count: number,
): Promise<void> {
  const session = await loadSession(sessionId);
  const items = session.messages.slice(-count);
  if (items.length === 0) {
    await sendTelegramMessage(chatId, "최근 대화가 없습니다.");
    return;
  }

  await sendTelegramMessage(
    chatId,
    [
      `최근 대화 ${items.length}개 (최신순):`,
      toRecentMessagesText(items),
    ].join("\n"),
  );
}

async function handleSessionTitleCommand(
  chatId: number,
  sessionId: string,
  value?: string,
): Promise<void> {
  const session = await loadSession(sessionId);
  const nextTitle = (value || "").trim();

  if (!nextTitle) {
    const current = session.title?.trim() || "(미설정)";
    await sendTelegramMessage(
      chatId,
      `현재 세션 제목: ${current}\n사용법: /title <제목>\n(예: /title 버그 수정 세션)`,
    );
    return;
  }

  const normalized = nextTitle.slice(0, 60).trim();
  if (!normalized) {
    await sendTelegramMessage(chatId, "세션 제목으로 사용할 수 있는 텍스트가 없습니다.");
    return;
  }

  await setSessionTitle(sessionId, normalized, { maxLength: 60, overwrite: true });

  await sendTelegramMessage(chatId, `현재 세션 제목을 설정했습니다.\n${normalized}`);
}

function buildJobSummaryMessage(jobId: string, status: string, date: string, message: string): string {
  const truncatedMessage = message.length > 60 ? `${message.slice(0, 57)}...` : message;
  return `${jobId} | ${status} | ${date} | ${truncatedMessage}`;
}

async function handleJobsCommand(chatId: number, sessionId: string, limit: number): Promise<void> {
  const jobs = await listSessionJobs(sessionId);
  const target = jobs.slice(0, limit);
  if (target.length === 0) {
    await sendTelegramMessage(chatId, "최근 작업 이력이 없습니다.");
    return;
  }

  const lines = [
    `최근 작업 ${target.length}개 조회 (${jobs.length}개 중):`,
    ...target.map((job, idx) => {
      const created = job.createdAt.slice(0, 16).replace("T", " ");
      const text = (job.message || "").replace(/\s+/g, " ").trim();
      return `${idx + 1}. ${buildJobSummaryMessage(job.jobId, job.status, created, text || "(빈 요청)")}`;
    }),
  ];

  await sendTelegramMessage(chatId, lines.join("\n"));
}

async function handleCancelCommand(chatId: number, sessionId: string): Promise<void> {
  const canceled = await cancelSessionActiveJob(sessionId);

  if (!canceled.ok) {
    if (canceled.reason === "no-active-job") {
      await sendTelegramMessage(chatId, "현재 진행 중인 작업이 없습니다.");
      return;
    }

    if (canceled.reason === "job-already-finished") {
      await sendTelegramMessage(chatId, "현재 작업은 이미 종료되었습니다.");
      return;
    }

    await sendTelegramMessage(chatId, "작업 취소 대상이 없습니다.");
    return;
  }

  await sendTelegramMessage(chatId, `요청하신 작업을 취소 처리했습니다. (작업 ID: ${canceled.jobId})`);
}

async function handleClearCommand(chatId: number, sessionId: string): Promise<void> {
  const session = await loadSession(sessionId);
  const removedCount = session.messages.length;
  if (removedCount === 0) {
    await sendTelegramMessage(chatId, "이미 대화 기록이 비어 있습니다.");
    return;
  }

  await writeSessionFile(sessionId, {
    ...session,
    messages: [],
    updatedAt: new Date().toISOString(),
  });
  await sendTelegramMessage(chatId, `대화 기록을 초기화했습니다. (${removedCount}개 삭제)`);
}

async function handleWorkspaceCommand(chatId: number, workingDirectory?: string): Promise<void> {
  const normalizedWorkingDirectory = workingDirectory?.trim();
  if (!normalizedWorkingDirectory) {
    const workspaceDirectories = await listTelegramWorkspaceDirectories();
    if (workspaceDirectories.length === 0) {
      await sendTelegramMessage(chatId, "선택할 작업 폴더가 없습니다.");
      return;
    }

    await sendTelegramMessageWithInlineKeyboard(
      chatId,
      [
        "기본 작업 폴더를 선택하세요.",
        `기준 위치: ${path.basename(getAgentWorkspaceRoot())}`,
        "이후 /new 와 /resume 세션은 이 폴더를 기본 spawn 위치로 사용합니다.",
      ].join("\n"),
      buildWorkspaceSelectionInlineKeyboard(workspaceDirectories),
    );
    setTelegramWorkspaceBrowseState(chatId, workspaceDirectories);
    return;
  }

  const workspaceDirectories = await listTelegramWorkspaceDirectories();
  if (!workspaceDirectories.includes(normalizedWorkingDirectory)) {
    await sendTelegramMessage(
      chatId,
      [
        `작업 폴더를 찾지 못했습니다: ${normalizedWorkingDirectory}`,
        "메뉴에서 선택하거나 `/workspace <폴더명>` 형식으로 다시 입력해 주세요.",
      ].join("\n"),
    );
    return;
  }

  await setChatWorkspaceSelection(chatId, normalizedWorkingDirectory);
  await sendTelegramMessage(
    chatId,
    [
      "기본 작업 폴더를 설정했습니다.",
      `선택 폴더: ${normalizedWorkingDirectory}`,
      "이후 /new 와 /resume 에 적용됩니다.",
    ].join("\n"),
  );
}

async function handleNewSessionCommand(chatId: number): Promise<void> {
  const previousSessionId = await getSessionIdForChat(chatId);
  const nextSessionId = createNewSessionId(chatId);
  await setSessionOverride(chatId, nextSessionId);
  await loadSession(nextSessionId);
  const selectedWorkingDirectory = await getChatWorkspaceSelection(chatId);
  if (selectedWorkingDirectory) {
    await setSessionWorkingDirectory(nextSessionId, selectedWorkingDirectory);
  }
  await sendTelegramMessage(
    chatId,
    [
      "새 세션을 시작했습니다.",
      `이전 세션: ${previousSessionId}`,
      `세션 ID: ${nextSessionId}`,
      ...(selectedWorkingDirectory
        ? [`기본 작업 위치: ${await getSessionWorkingDirectoryLabel(nextSessionId)}`]
        : []),
      "기존 대화 컨텍스트와 분리되어 동작합니다.",
      "이후 /run, /model, /effort, /status 등은 새 세션에서 처리됩니다.",
    ].join("\n"),
  );
}

async function handleForkSessionCommand(chatId: number, sourceSessionId: string): Promise<void> {
  const sourceSession = await loadSession(sourceSessionId);
  const nextSessionId = createNewSessionId(chatId);
  const timestamp = new Date().toISOString();

  await writeSessionFile(nextSessionId, {
    ...sourceSession,
    sessionId: nextSessionId,
    createdAt: timestamp,
    updatedAt: timestamp,
    activeJobId: undefined,
    providerSessionId: undefined,
    providerSessionProvider: undefined,
    messages: [...sourceSession.messages],
  });

  const workingDirectory = await getSessionWorkingDirectoryLabel(sourceSessionId);
  if (workingDirectory) {
    await setSessionWorkingDirectory(nextSessionId, workingDirectory);
  }

  await setSessionOverride(chatId, nextSessionId);
  await sendTelegramMessage(
    chatId,
    [
      "세션을 분기했습니다.",
      `원본 세션: ${sourceSessionId}`,
      `새 세션: ${nextSessionId}`,
      ...(workingDirectory ? [`기본 작업 위치: ${workingDirectory}`] : []),
      "이후 메시지는 새 분기 세션에서 이어집니다.",
    ].join("\n"),
  );
}

async function handleLocalScreenshotCommand(chatId: number, target?: string): Promise<void> {
  const progress = await sendTelegramMessage(
    chatId,
    `화면 캡처 시작 (${target?.trim() || "현재 기본 화면"})\n잠시만 기다려 주세요...`,
  );

  let imagePath: string | null = null;
  try {
    imagePath = await captureLocalScreenshot(target);
    const caption = target?.trim() ? `내 화면 캡처: ${target.trim()}` : "내 화면 캡처";
    await sendTelegramPhoto(chatId, imagePath, caption);
    await editTelegramMessage(chatId, progress.message_id, "화면 캡처 완료");
  } catch (error) {
    const message = error instanceof Error ? error.message : "화면 캡처 처리에 실패했습니다.";
    await editTelegramMessage(chatId, progress.message_id, `화면 캡처 실패: ${message}`);
  } finally {
    if (imagePath) {
      try {
        await fs.unlink(imagePath);
      } catch {
        // noop
      }
    }
  }
}

function buildUserInfoText(chatId: number, user?: TelegramUser): string {
  const lines = [`chat_id: ${chatId}`];
  if (user?.username) {
    lines.push(`username: @${user.username}`);
  }
  if (user?.first_name) {
    lines.push(`name: ${user.first_name}`);
  }
  return lines.join("\n");
}

async function handleStartCommand(chatId: number, code?: string): Promise<void> {
  if (!TELEGRAM_REGISTRATION_CODE) {
    if (TELEGRAM_ALLOWED_CHAT_IDS.size > 0) {
      await sendTelegramMessage(
        chatId,
        "현재 봇은 허용 목록 기반으로 운영 중입니다.\n인증 코드 기능이 비활성화되어 있습니다.",
      );
      return;
    }

    await sendTelegramMessage(chatId, "현재 인증 코드가 설정되어 있지 않습니다. 관리자에게 문의하세요.");
    return;
  }

  if (!code) {
    await sendTelegramMessage(chatId, "인증 코드를 입력해 주세요. 예: /start <코드>");
    return;
  }

  if (code !== TELEGRAM_REGISTRATION_CODE) {
    await sendTelegramMessage(chatId, "인증 코드가 일치하지 않습니다.");
    return;
  }

  await authorizeChatId(chatId);
  await sendTelegramMessage(
    chatId,
    [
      "인증이 완료되었습니다.",
      "이제 텍스트나 /run 명령으로 Codex 명령을 실행할 수 있습니다.",
      "도움말: /h",
    ].join("\n"),
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    const requestOrigin = resolveRequestOrigin(request);
    const webhookSecret = getWebhookSecret();
    if (webhookSecret) {
      const header = request.headers.get("x-telegram-bot-api-secret-token");
      if (header !== webhookSecret) {
        return Response.json({ error: "Invalid webhook secret." }, { status: 401 });
      }
    }

    try {
      await ensureTelegramMenuCommandsRegistered();
      await ensureTelegramMenuCommandsRegistered({ type: "all_private_chats" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      await appendTelegramEventLog("telegram_menu.sync_failed", { error: message });
    }

    const body = (await request.json()) as TelegramUpdate;
    if (markTelegramUpdateProcessed(body.update_id)) {
      await appendTelegramEventLog("update.duplicate_skipped", {
        updateId: body.update_id ?? null,
        updateType: body.callback_query
          ? "callback_query"
          : body.edited_message
            ? "edited_message"
            : body.message
              ? "message"
              : "unknown",
      });
      return Response.json({ ok: true }, { status: 200 });
    }

    const callbackQuery = body.callback_query;
    if (callbackQuery) {
      const callbackMenuChatId = callbackQuery.message?.chat?.id;
      if (typeof callbackMenuChatId === "number") {
        try {
          await ensureTelegramMenuCommandsRegistered({ type: "chat", chat_id: callbackMenuChatId });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          await appendTelegramEventLog("telegram_menu.sync_failed", {
            error: message,
            scope: `chat:${callbackMenuChatId}`,
          });
        }
      }

      await appendTelegramEventLog("callback_query.received", {
        callbackQueryId: callbackQuery.id,
        from: callbackQuery.from?.id,
        chat: callbackQuery.message?.chat?.id,
        hasData: Boolean(callbackQuery.data),
        data: callbackQuery.data,
      });
      console.info("[telegram] callback_query received", {
        id: callbackQuery.id,
        from: callbackQuery.from?.id,
        chat: callbackQuery.message?.chat?.id,
      });

      if (!callbackQuery.data) {
        await appendTelegramEventLog("callback_query.missing_data", {
          callbackQueryId: callbackQuery.id,
        });
        await answerCallbackQuery(callbackQuery.id, "버튼 데이터가 없습니다. /resume 을 다시 열어 주세요.");
        return Response.json({ ok: true }, { status: 200 });
      }

      const selectedWorkspaceIndex = parseWorkspaceSelectionCallbackData(callbackQuery.data);
      if (selectedWorkspaceIndex) {
        if (TELEGRAM_AUTH_REQUIRED) {
          const authorized = await isAuthorizedChat(callbackQuery.from.id);
          if (!authorized) {
            await appendTelegramEventLog("callback_query.unauthorized", {
              callbackQueryId: callbackQuery.id,
              from: callbackQuery.from?.id,
            });
            await answerCallbackQuery(callbackQuery.id, "인증이 필요합니다.");
            return Response.json({ ok: true }, { status: 200 });
          }
        }

        const callbackChatId = callbackQuery.message?.chat?.id ?? callbackQuery.from.id;
        if (!callbackChatId) {
          await appendTelegramEventLog("callback_query.missing_chat", { callbackQueryId: callbackQuery.id });
          await answerCallbackQuery(callbackQuery.id, "작업 폴더 선택에 필요한 chat 정보를 찾을 수 없습니다.");
          return Response.json({ ok: true }, { status: 200 });
        }

        const selectedWorkspace = getTelegramWorkspaceBrowseSelection(callbackChatId, selectedWorkspaceIndex);
        if (!selectedWorkspace) {
          await appendTelegramEventLog("callback_query.workspace_state_missing", {
            callbackQueryId: callbackQuery.id,
            chatId: callbackChatId,
            selectionIndex: selectedWorkspaceIndex,
          });
          await answerCallbackQuery(callbackQuery.id, "폴더 목록이 만료되었습니다. /workspace 를 다시 열어 주세요.");
          return Response.json({ ok: true }, { status: 200 });
        }

        try {
          await handleWorkspaceCommand(callbackChatId, selectedWorkspace);
          await appendTelegramEventLog("callback_query.workspace_selected", {
            callbackQueryId: callbackQuery.id,
            chatId: callbackChatId,
            workingDirectory: selectedWorkspace,
          });
          await answerCallbackQuery(callbackQuery.id, `작업 폴더 선택됨: ${selectedWorkspace}`);

          if (callbackQuery.message && "message_id" in callbackQuery.message) {
            await clearTelegramInlineKeyboard(callbackChatId, callbackQuery.message.message_id);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "작업 폴더 선택에 실패했습니다.";
          await appendTelegramEventLog("callback_query.workspace_select_failed", {
            callbackQueryId: callbackQuery.id,
            chatId: callbackChatId,
            workingDirectory: selectedWorkspace,
            error: message,
          });
          await answerCallbackQuery(callbackQuery.id, `작업 폴더 선택 실패: ${message}`);
        }

        return Response.json({ ok: true }, { status: 200 });
      }

      const closedMenu = parseInlineMenuCloseCallbackData(callbackQuery.data);
      if (closedMenu) {
        if (TELEGRAM_AUTH_REQUIRED) {
          const authorized = await isAuthorizedChat(callbackQuery.from.id);
          if (!authorized) {
            await appendTelegramEventLog("callback_query.unauthorized", {
              callbackQueryId: callbackQuery.id,
              from: callbackQuery.from?.id,
            });
            await answerCallbackQuery(callbackQuery.id, "인증이 필요합니다.");
            return Response.json({ ok: true }, { status: 200 });
          }
        }

        const callbackChatId = callbackQuery.message?.chat?.id ?? callbackQuery.from.id;
        if (!callbackChatId) {
          await appendTelegramEventLog("callback_query.missing_chat", { callbackQueryId: callbackQuery.id });
          await answerCallbackQuery(callbackQuery.id, "메뉴 닫기에 필요한 chat 정보를 찾을 수 없습니다.");
          return Response.json({ ok: true }, { status: 200 });
        }

        const closeLabelMap: Record<string, string> = {
          workspace: "작업 폴더",
          resume: "세션 목록",
          model: "모델 선택",
          effort: "사고수준 선택",
        };
        const closeLabel = closeLabelMap[closedMenu] || "메뉴";
        await appendTelegramEventLog("callback_query.menu_closed", {
          callbackQueryId: callbackQuery.id,
          chatId: callbackChatId,
          menu: closedMenu,
        });
        await answerCallbackQuery(callbackQuery.id, `${closeLabel} 메뉴를 닫았습니다.`);

        if (callbackQuery.message && "message_id" in callbackQuery.message) {
          await clearTelegramInlineKeyboard(callbackChatId, callbackQuery.message.message_id);
          await editTelegramMessage(
            callbackChatId,
            callbackQuery.message.message_id,
            `${closeLabel} 메뉴를 닫았습니다.`,
          );
        }

        return Response.json({ ok: true }, { status: 200 });
      }

      const selectedModel = parseModelSelectionCallbackData(callbackQuery.data);
      if (selectedModel) {
        if (TELEGRAM_AUTH_REQUIRED) {
          const authorized = await isAuthorizedChat(callbackQuery.from.id);
          if (!authorized) {
            await appendTelegramEventLog("callback_query.unauthorized", {
              callbackQueryId: callbackQuery.id,
              from: callbackQuery.from?.id,
            });
            await answerCallbackQuery(callbackQuery.id, "인증이 필요합니다.");
            return Response.json({ ok: true }, { status: 200 });
          }
        }

        const callbackChatId = callbackQuery.message?.chat?.id ?? callbackQuery.from.id;
        if (!callbackChatId) {
          await appendTelegramEventLog("callback_query.missing_chat", { callbackQueryId: callbackQuery.id });
          await answerCallbackQuery(callbackQuery.id, "모델 선택에 필요한 chat 정보를 찾을 수 없습니다.");
          return Response.json({ ok: true }, { status: 200 });
        }

        try {
          const targetSessionId = await getSessionIdForChat(callbackChatId);
          const resultMessage = await applyModelSelection(targetSessionId, selectedModel);
          await answerCallbackQuery(callbackQuery.id, resultMessage);

          if (callbackQuery.message && "message_id" in callbackQuery.message) {
            await clearTelegramInlineKeyboard(callbackChatId, callbackQuery.message.message_id);
            await editTelegramMessage(callbackChatId, callbackQuery.message.message_id, resultMessage);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "모델 선택에 실패했습니다.";
          await appendTelegramEventLog("callback_query.model_select_failed", {
            callbackQueryId: callbackQuery.id,
            chatId: callbackChatId,
            model: selectedModel,
            error: message,
          });
          await answerCallbackQuery(callbackQuery.id, `모델 선택 실패: ${message}`);
        }

        return Response.json({ ok: true }, { status: 200 });
      }

      const selectedReasoning = parseReasoningSelectionCallbackData(callbackQuery.data);
      if (selectedReasoning) {
        if (TELEGRAM_AUTH_REQUIRED) {
          const authorized = await isAuthorizedChat(callbackQuery.from.id);
          if (!authorized) {
            await appendTelegramEventLog("callback_query.unauthorized", {
              callbackQueryId: callbackQuery.id,
              from: callbackQuery.from?.id,
            });
            await answerCallbackQuery(callbackQuery.id, "인증이 필요합니다.");
            return Response.json({ ok: true }, { status: 200 });
          }
        }

        const callbackChatId = callbackQuery.message?.chat?.id ?? callbackQuery.from.id;
        if (!callbackChatId) {
          await appendTelegramEventLog("callback_query.missing_chat", { callbackQueryId: callbackQuery.id });
          await answerCallbackQuery(callbackQuery.id, "사고수준 선택에 필요한 chat 정보를 찾을 수 없습니다.");
          return Response.json({ ok: true }, { status: 200 });
        }

        try {
          const targetSessionId = await getSessionIdForChat(callbackChatId);
          const resultMessage = await applyReasoningSelection(targetSessionId, selectedReasoning);
          await answerCallbackQuery(callbackQuery.id, resultMessage);

          if (callbackQuery.message && "message_id" in callbackQuery.message) {
            await clearTelegramInlineKeyboard(callbackChatId, callbackQuery.message.message_id);
            await editTelegramMessage(callbackChatId, callbackQuery.message.message_id, resultMessage);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "사고수준 선택에 실패했습니다.";
          await appendTelegramEventLog("callback_query.reasoning_select_failed", {
            callbackQueryId: callbackQuery.id,
            chatId: callbackChatId,
            reasoning: selectedReasoning,
            error: message,
          });
          await answerCallbackQuery(callbackQuery.id, `사고수준 선택 실패: ${message}`);
        }

        return Response.json({ ok: true }, { status: 200 });
      }

      const parsedSessionId = parseResumeSessionCallbackData(callbackQuery.data);
      if (!parsedSessionId) {
        await appendTelegramEventLog("callback_query.parse_failed", {
          callbackQueryId: callbackQuery.id,
          data: callbackQuery.data,
        });
        console.warn("[telegram] unknown callback_data", {
          id: callbackQuery.id,
          data: callbackQuery.data,
        });
        await answerCallbackQuery(callbackQuery.id, "알 수 없는 버튼입니다. /resume, /workspace, /model, /effort 를 다시 열어 주세요.");
        return Response.json({ ok: true }, { status: 200 });
      }

      if (TELEGRAM_AUTH_REQUIRED) {
        const authorized = await isAuthorizedChat(callbackQuery.from.id);
        if (!authorized) {
          await appendTelegramEventLog("callback_query.unauthorized", {
            callbackQueryId: callbackQuery.id,
            from: callbackQuery.from?.id,
          });
          await answerCallbackQuery(callbackQuery.id, "인증이 필요합니다.");
          return Response.json({ ok: true }, { status: 200 });
        }
      }

      const callbackChatId = callbackQuery.message?.chat?.id ?? callbackQuery.from.id;
      if (!callbackChatId) {
        await appendTelegramEventLog("callback_query.missing_chat", { callbackQueryId: callbackQuery.id });
        await answerCallbackQuery(callbackQuery.id, "세션 전환에 필요한 chat 정보를 찾을 수 없습니다.");
        return Response.json({ ok: true }, { status: 200 });
      }

      let switchResult: SessionSwitchResult;
      try {
        const currentSessionId = await getSessionIdForChat(callbackChatId);
        switchResult = await handleResumeSessionCallback(callbackChatId, parsedSessionId, currentSessionId);
        await appendTelegramEventLog("callback_query.session_result", {
          callbackQueryId: callbackQuery.id,
          chatId: callbackChatId,
          targetSessionId: parsedSessionId,
          switched: switchResult.switched,
          found: switchResult.found,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "세션 전환에 실패했습니다.";
        await appendTelegramEventLog("callback_query.error", {
          callbackQueryId: callbackQuery.id,
          chatId: callbackChatId,
          targetSessionId: parsedSessionId,
          error: message,
        });
        console.error("[telegram] session resume failed", {
          id: callbackQuery.id,
          chatId: callbackChatId,
          target: parsedSessionId,
          error: message,
        });
        await answerCallbackQuery(callbackQuery.id, `세션 전환 실패: ${message}`);
        return Response.json({ ok: true }, { status: 200 });
      }

      await answerCallbackQuery(callbackQuery.id, summarizeResumeSessionResult(switchResult));

      if (switchResult.message) {
        await sendTelegramMessageWithRemovedKeyboard(callbackChatId, switchResult.message);
      }

      try {
        if (callbackQuery.message && "message_id" in callbackQuery.message) {
          await clearTelegramInlineKeyboard(callbackChatId, callbackQuery.message.message_id);
        }
      } catch {
        // fallback noop
      }
      return Response.json({ ok: true }, { status: 200 });
    }

    const message = body.message ?? body.edited_message;
    if (!message) {
      return Response.json({ ok: true }, { status: 200 });
    }

    try {
      await ensureTelegramMenuCommandsRegistered({ type: "chat", chat_id: message.chat.id });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "unknown";
      await appendTelegramEventLog("telegram_menu.sync_failed", {
        error: messageText,
        scope: `chat:${message.chat.id}`,
      });
    }

    const attachment = getIncomingAttachment(message);
    let downloadedAttachmentPath: string | null = null;

    if (attachment) {
      try {
        const downloaded = await downloadTelegramFile(attachment);
        downloadedAttachmentPath = downloaded.savedPath;
        await appendTelegramEventLog("message.attachment_downloaded", {
          chatId: message.chat.id,
          fileName: downloaded.fileName,
          fileSize: attachment.fileSize,
          filePath: downloaded.savedPath,
          updateType: body.edited_message ? "edited_message" : "message",
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "첨부 파일을 받지 못했습니다.";
        await appendTelegramEventLog("message.attachment_download_failed", {
          chatId: message.chat.id,
          fileId: attachment.fileId,
          error: errorMessage,
          updateType: body.edited_message ? "edited_message" : "message",
        });
      }
    }

    const messageText = typeof message.text === "string"
      ? message.text
      : typeof message.caption === "string"
        ? message.caption
        : "";

    if (!messageText.trim()) {
      if (!attachment) {
        return Response.json({ ok: true }, { status: 200 });
      }

      if (!downloadedAttachmentPath) {
        await sendTelegramMessage(message.chat.id, "첨부 파일 처리에 실패했습니다. 다시 보내 주세요.");
        return Response.json({ ok: true }, { status: 200 });
      }

      await sendTelegramMessage(message.chat.id, `첨부 파일을 저장했습니다.\n경로: ${downloadedAttachmentPath}`);
      return Response.json({ ok: true }, { status: 200 });
    }

    const sessionId = await getSessionIdForChat(message.chat.id);
    const command = parseCommand(messageText);
    await appendTelegramEventLog("message.command", {
      chatId: message.chat.id,
      commandKind: command.kind,
      textLength: messageText.length,
      hasAttachment: Boolean(attachment),
      updateType: body.edited_message ? "edited_message" : "message",
    });

    if (TELEGRAM_AUTH_REQUIRED && !isAuthBypassCommand(command)) {
      const authorized = await isAuthorizedChat(message.chat.id);
      if (!authorized) {
        await sendTelegramMessage(message.chat.id, formatUnauthorizedText());
        return Response.json({ ok: true }, { status: 200 });
      }
    }

    void (async () => {
      try {
        switch (command.kind) {
          case "signal":
            await handleSignalCommand(message.chat.id, requestOrigin);
            return;
          case "briefing":
            await handleBriefingCommand(message.chat.id, requestOrigin);
            return;
          case "recommend":
            await handleRecommendCommand(message.chat.id, requestOrigin, command.count);
            return;
          case "asset":
            await handleAssetCommand(message.chat.id, requestOrigin, command.ticker);
            return;
          case "signalStyle":
            await handleSignalStyleCommand(message.chat.id, command.value);
            return;
          case "help":
          case "start":
            if (command.kind === "start") {
              await handleStartCommand(message.chat.id, command.code);
              return;
            }
            await sendTelegramMessage(message.chat.id, formatHelpText());
            return;
          case "newSession":
            await handleNewSessionCommand(message.chat.id);
            return;
          case "fork":
            await handleForkSessionCommand(message.chat.id, sessionId);
            return;
          case "workspace":
            await handleWorkspaceCommand(message.chat.id, command.workingDirectory);
            return;
          case "resumeSession":
            await handleResumeSessionCommand(message.chat.id, command.selector, sessionId);
            return;
          case "status": {
            const session = await loadSession(sessionId);
            const sessionTitle = session.title?.trim() || "(미설정)";
            const workingDirectory = await getSessionWorkingDirectoryLabel(sessionId);
            const model = getSessionModel(session.model);
            const reasoning = getSessionReasoning(session.reasoningEffort);
            const activeJobId = session.activeJobId;
            if (!activeJobId) {
              await sendTelegramMessage(
                message.chat.id,
                [
                  `세션: ${sessionId}`,
                  `세션 제목: ${sessionTitle}`,
                  `기본 작업 위치: ${workingDirectory || "(미설정)"}`,
                  "현재 진행 중인 작업이 없습니다.",
                  `모델: ${getModelLabel(model)} (${model})`,
                  `사고수준: ${formatReasoningLabel(reasoning)} (${reasoning})`,
                  `트레이스: ${getTraceMode(sessionId) ? "ON" : "OFF"}`,
                ].join("\n"),
              );
              return;
            }

            const activeJob = await getAgentJob(activeJobId);
            if (!activeJob) {
              await sendTelegramMessage(message.chat.id, "현재 작업 정보를 찾을 수 없습니다.");
              return;
            }

            await sendTelegramMessage(
              message.chat.id,
              [
                `세션: ${sessionId}`,
                `세션 제목: ${sessionTitle}`,
                `기본 작업 위치: ${workingDirectory || "(미설정)"}`,
                `작업 상태: ${activeJob.status}`,
                `작업 ID: ${activeJob.jobId}`,
                `모델: ${getModelLabel(model)} (${model})`,
                `사고수준: ${formatReasoningLabel(reasoning)} (${reasoning})`,
                `트레이스: ${getTraceMode(sessionId) ? "ON" : "OFF"}`,
                `업데이트: ${activeJob.updatedAt}`,
              ].join("\n"),
            );
            return;
          }
          case "jobs":
            await handleJobsCommand(message.chat.id, sessionId, command.limit);
            return;
          case "stop":
            await handleCancelCommand(message.chat.id, sessionId);
            return;
          case "model":
            await handleModelCommand(message.chat.id, sessionId, command.value);
            return;
          case "reasoning":
            await handleReasoningCommand(message.chat.id, sessionId, command.value);
            return;
          case "sessionInfo":
            await handleSessionInfoCommand(message.chat.id, sessionId, command.query);
            return;
          case "sessionTitle":
            await handleSessionTitleCommand(message.chat.id, sessionId, command.value);
            return;
          case "eventLog":
            await handleEventLogCommand(message.chat.id, command.count);
            return;
          case "recent":
            await handleRecentMessagesCommand(message.chat.id, sessionId, command.count);
            return;
          case "clear":
            await handleClearCommand(message.chat.id, sessionId);
            return;
          case "ping":
            await sendTelegramMessage(
              message.chat.id,
              `pong\nchat_id: ${message.chat.id}\nsession: ${sessionId}`,
            );
            return;
          case "id":
            await sendTelegramMessage(message.chat.id, buildUserInfoText(message.chat.id, message.from));
            return;
          case "screenshotLocal":
            await handleLocalScreenshotCommand(message.chat.id, command.target);
            return;
          case "unknown":
            await sendTelegramMessage(message.chat.id, `${command.message}\n도움이 필요하면 /h`);
            return;
          case "run":
            const runMessage = appendAttachmentContextToRunMessage(
              command.message,
              downloadedAttachmentPath,
            );
            if (!runMessage.trim()) {
              await sendTelegramMessage(message.chat.id, "실행할 내용이 비어 있습니다. /h 를 확인해 주세요.");
              return;
            }
            await handleRunCommand(message.chat.id, sessionId, runMessage);
            return;
          default:
            await sendTelegramMessage(message.chat.id, "지원되지 않는 명령어입니다. /h 를 확인해 주세요.");
            return;
        }
      } catch (error) {
        const messageText =
          error instanceof Error
            ? `처리 중 오류: ${error.message}`
            : "처리 중 알 수 없는 오류가 발생했습니다.";
        await appendTelegramEventLog("message.command_error", {
          chatId: message.chat.id,
          commandKind: command.kind,
          error: messageText,
        });
        await sendTelegramMessage(message.chat.id, messageText);
      }
    })();

    return Response.json({ ok: true }, { status: 200 });
  } catch {
    await appendTelegramEventLog("request.error", { message: "invalid request payload" });
    console.error("[telegram] invalid request payload", "failed to process update");
    return Response.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
