import {
  cancelSessionActiveJob,
  createAgentJob,
  getAgentJob,
  isActiveJobError,
  listJobsForSessions,
  listSessionJobs,
} from "@/src/application/agent/job-service";
import {
  listSessions,
  loadSession,
  setSessionModel,
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
import type { AgentJob, Message } from "@/src/core/agent/types";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TELEGRAM_API_BASE_URL = "https://api.telegram.org/bot";
const TELEGRAM_CHAT_TEXT_LIMIT = 4096;
const TELEGRAM_STATUS_TEXT_LIMIT = 3600;
const TELEGRAM_POLL_INTERVAL_MS = 1000;
const TELEGRAM_MAX_WAIT_MS = 15 * 60 * 1000;
const TELEGRAM_DEFAULT_TRACE_MODE = process.env.TELEGRAM_DEFAULT_TRACE_MODE !== "0";
const TELEGRAM_SCREENSHOT_TEMP_DIR = path.join(process.cwd(), "data", "telegram-screenshots");
const TELEGRAM_SCREENSHOT_TIMEOUT_MS = 40_000;
const TELEGRAM_LOCAL_SCREENSHOT_TIMEOUT_MS = 20_000;
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
const TELEGRAM_COMPLETION_CURSOR_FILE = path.resolve(
  process.cwd(),
  process.env.TELEGRAM_COMPLETION_CURSOR_FILE?.trim() || "data/telegram-completion-cursors.json",
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
const TELEGRAM_SESSION_ID_PREFIX = "tg_";
const TELEGRAM_REASONING_LABELS: Record<string, string> = {
  minimal: "최소",
  low: "낮음",
  medium: "보통",
  high: "높음",
  xhigh: "최고",
};

type TelegramCommandStart =
  | { kind: "start"; code?: string }
  | { kind: "unknown"; message: string };

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
  chat: TelegramChat;
  from?: TelegramUser;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

interface TelegramReplyKeyboardButton {
  text: string;
}

interface TelegramReplyKeyboardMarkup {
  keyboard: Array<Array<TelegramReplyKeyboardButton>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
  input_field_placeholder?: string;
}

interface TelegramReplyKeyboardRemove {
  remove_keyboard: true;
  selective?: boolean;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

type ParsedTelegramCommand =
  | { kind: "run"; message: string }
  | { kind: "help" }
  | TelegramCommandStart
  | { kind: "newSession" }
  | { kind: "resumeSession"; selector: string }
  | { kind: "status" }
  | { kind: "jobs"; limit: number }
  | { kind: "cancel" }
  | { kind: "model"; value?: string }
  | { kind: "reasoning"; value?: string }
  | { kind: "sessionInfo" }
  | { kind: "sessionTitle"; value?: string }
  | { kind: "clear" }
  | { kind: "recent"; count: number }
  | { kind: "ping" }
  | { kind: "id" }
  | { kind: "screenshot"; target: string }
  | { kind: "screenshotLocal"; target?: string }
  | { kind: "eventLog"; count?: number }
  | { kind: "unknown"; message: string };

interface TelegramSentMessage {
  message_id: number;
}

const chatTraceMode = new Map<string, boolean>();
const chatSessionOverrides = new Map<number, string>();
let chatSessionOverridesLoaded = false;
let chatSessionOverridesLoadPromise: Promise<void> | null = null;
const chatCompletionCursors = new Map<number, string>();
let chatCompletionCursorsLoaded = false;
let chatCompletionCursorsLoadPromise: Promise<void> | null = null;

function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }
  return token;
}

function getWebhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? null;
}

function toSessionId(chatId: number): string {
  const raw = String(chatId).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `tg_${raw}`;
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

async function persistChatCompletionCursors(): Promise<void> {
  await fs.mkdir(path.dirname(TELEGRAM_COMPLETION_CURSOR_FILE), { recursive: true });
  const payload: Record<string, string> = {};
  for (const [chatId, completedAt] of chatCompletionCursors.entries()) {
    payload[String(chatId)] = completedAt;
  }
  await fs.writeFile(TELEGRAM_COMPLETION_CURSOR_FILE, JSON.stringify(payload, null, 2), "utf8");
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
    return `${prefix}. ${getModelLabel(model)} (${model})${mark}`;
  });

  return [
    "모델 목록:",
    ...rows,
    `현재 모델: ${getModelLabel(currentModel)} (${currentModel})`,
    "선택: `/model 2` 또는 `/model gpt-5.3-codex`",
  ].join("\n");
}

function formatReasoningListText(currentReasoning: string): string {
  const rows = SUPPORTED_REASONING_EFFORTS.map((reasoning, index) => {
    const prefix = index + 1;
    const mark = reasoning === currentReasoning ? " [현재]" : "";
    return `${prefix}. ${formatReasoningLabel(reasoning)} (${reasoning})${mark}`;
  });

  return [
    "사고수준 목록:",
    ...rows,
    `현재 사고수준: ${formatReasoningLabel(currentReasoning)} (${currentReasoning})`,
    "선택: `/reasoning 2` 또는 `/reasoning high`",
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
  const numeric = Number.parseInt(normalized, 10);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= SUPPORTED_REASONING_EFFORTS.length) {
    return SUPPORTED_REASONING_EFFORTS[numeric - 1];
  }

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

function isValidUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // ignore and try adding https scheme
  }

  try {
    const parsed = new URL(`https://${trimmed}`);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

interface ScreenshotCommandResult {
  exitCode: number | null;
  stderr: string;
}

function runNodePlaywrightScreenshot(url: string, outputPath: string): Promise<ScreenshotCommandResult> {
  const script = `
const timeoutMs = Number(process.env.TELEGRAM_SCREENSHOT_TIMEOUT_MS || "40000");

(async () => {
  const targetUrl = process.argv[2];
  const outputPath = process.argv[3];
  if (!targetUrl || !outputPath) {
    process.stderr.write("Missing screenshot arguments.");
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    process.stderr.write("playwright module is not available.");
    process.exit(2);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: timeoutMs - 2000 });
    await page.screenshot({ path: outputPath, fullPage: true, timeout: timeoutMs - 1000 });
    await browser.close();
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(message);
    process.exit(3);
  }
})();`
;

  return new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      ["-e", script, url, outputPath],
      {
        env: {
          ...process.env,
          TELEGRAM_SCREENSHOT_TIMEOUT_MS: String(TELEGRAM_SCREENSHOT_TIMEOUT_MS),
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );

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
        stderr: `screenshot timed out after ${TELEGRAM_SCREENSHOT_TIMEOUT_MS}ms`,
      });
    }, TELEGRAM_SCREENSHOT_TIMEOUT_MS + 2000);

    child.on("error", (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
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

async function captureWebScreenshot(targetUrl: string): Promise<string> {
  const safeName = targetUrl.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 60);
  const fileName = `tg-screenshot-${Date.now()}-${safeName || "capture"}.png`;
  const outputPath = path.join(TELEGRAM_SCREENSHOT_TEMP_DIR, fileName);

  await fs.mkdir(TELEGRAM_SCREENSHOT_TEMP_DIR, { recursive: true });
  const result = await runNodePlaywrightScreenshot(targetUrl, outputPath);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "screenshot command failed");
  }

  await fs.access(outputPath);
  return outputPath;
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
    case "models":
    case "m":
    case "model":
      return { kind: "model", value: arg || undefined };
    case "reason":
    case "reasoning":
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
    case "c":
    case "cancel":
      return { kind: "cancel" };
    case "h":
    case "help":
      return { kind: "help" };
    case "start":
      return { kind: "start", code: arg || undefined };
    case "status":
      return { kind: "status" };
    case "session":
    case "settings":
      return { kind: "sessionInfo" };
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
    case "s":
    case "screenshot":
    case "shot":
      if (!arg) {
        return {
          kind: "unknown",
          message: "`/screenshot <url>` 형식으로 입력해 주세요. (예: /screenshot https://example.com)",
        };
      }
      return { kind: "screenshot", target: arg };
    case "screencap":
    case "sc":
    case "shotme":
      return { kind: "screenshotLocal", target: arg || undefined };
    case "n":
    case "new":
      return { kind: "newSession" };
    case "title":
    case "t":
      return { kind: "sessionTitle", value: arg || undefined };
    case "r":
    case "resume":
      if (!arg) {
        return {
          kind: "unknown",
          message: "`/r <번호|세션ID>` 형식으로 입력해 주세요. (예: /r 2, /r tg_12345_abc...)",
        };
      }
      return { kind: "resumeSession", selector: arg };
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

function buildSessionResumeReplyKeyboard(
  sessions: Array<{
    sessionId: string;
    title?: string | null;
    lastMessagePreview?: string | null;
  }>,
  currentSessionId: string,
): TelegramReplyKeyboardMarkup {
  const keyboard = sessions.map((item, index) => {
    const isCurrent = item.sessionId === currentSessionId;
    const rawLabel = item.title?.trim() || item.lastMessagePreview?.trim() || "대화 없음";
    const displayLabel = rawLabel.length > TELEGRAM_SESSION_LIST_PREVIEW_TEXT_LIMIT
      ? `${rawLabel.slice(0, TELEGRAM_SESSION_LIST_PREVIEW_TEXT_LIMIT)}...`
      : rawLabel;
    const commandPrefix = isCurrent ? `/r ${index + 1} [현재]` : `/r ${index + 1}`;
    const safePrefix = `${commandPrefix} `;
    const maxLabelLength = Math.max(1, 64 - safePrefix.length - 3);
    const safeLabel = displayLabel.length > maxLabelLength
      ? `${displayLabel.slice(0, maxLabelLength)}...`
      : displayLabel;
    const text = `${safePrefix}${safeLabel}`;

    return [{ text }];
  });

  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: true,
    input_field_placeholder: "버튼으로 세션 번호를 선택하세요",
  };
}

function formatHelpText(): string {
  const base = [
    "명령어 안내:",
    "- /run <요청>: Codex에 바로 전달합니다.",
    "- `/run` 없이 텍스트만 보내도 실행됩니다.",
    "- /status: 현재 세션 상태 확인",
    "- /c 또는 /cancel: 진행 중인 작업 취소",
    "- `/jobs [개수]`: 최근 작업 목록 조회 (기본 10개)",
    "- /sc 또는 /screencap [라벨]: 내 화면 캡처 후 이미지 전송",
    "- /n 또는 /new: 새 세션으로 강제 전환",
    "- /t 또는 /title <제목>: 현재 세션 제목 설정 (예: /title 버그 수정)",
    "- `/m`, `/model`, `/models`: 모델 목록 조회",
    "- `/m <번호|모델명>`, `/model <번호|모델명>`: 기본 모델 변경",
    "- `/reason` / `/reasoning`: 사고수준 목록 조회",
    "- `/reasoning <번호|사고수준>`: 사고수준 변경",
    "- /session: 현재 세션/목록 조회 (버튼 클릭으로 세션 전환 가능)",
    "- `/recent [개수]`: 최근 대화 미리보기 (기본 6개)",
    "- /s 또는 /screenshot <url>: 웹 화면 캡처 후 이미지 전송",
    "- /r <번호|세션ID>: 기존 세션으로 전환",
    "- /log [개수]: 최근 이벤트 로그 조회 (기본 40줄)",
    "- /clear: 대화 기록 초기화",
    "- /ping: 연결 테스트",
    "- /id: 내 chat_id 확인",
  ];

  if (TELEGRAM_REGISTRATION_CODE) {
    base.push("- /start <인증코드>: 인증 코드로 사용 승인");
  }
  base.push("- /h 또는 /help: 이 도움말 표시");

  return base.join("\n");
}

function splitTelegramText(text: string, limit: number): string[] {
  if (text.length === 0) {
    return [""];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + limit));
    start += limit;
  }

  return chunks;
}

function truncateForStatus(text: string): string {
  if (text.length <= TELEGRAM_STATUS_TEXT_LIMIT) {
    return text;
  }
  return `${text.slice(0, TELEGRAM_STATUS_TEXT_LIMIT - 3)}...`;
}

function formatStatusText(message: string, elapsedSeconds: number, status: string): string {
  const safeMessage = message.trim();
  if (!safeMessage) {
    return `⏱ ${elapsedSeconds}초 동안 응답 생성 중...`;
  }

  const preview = truncateForStatus(safeMessage);
  return [
    `상태: ${status} (${elapsedSeconds}초)`,
    `미리보기:`,
    preview,
  ].join("\n");
}

async function callTelegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${TELEGRAM_API_BASE_URL}${getTelegramBotToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const parsed = (await response.json().catch(() => null)) as TelegramApiResponse<T> | null;
  if (!response.ok || !parsed?.ok || !parsed.result) {
    const message = parsed?.description || `HTTP ${response.status}`;
    throw new Error(`Telegram API error: ${message}`);
  }

  return parsed.result;
}

async function sendTelegramMessage(chatId: number, text: string): Promise<TelegramSentMessage> {
  const chunks = splitTelegramText(text, TELEGRAM_CHAT_TEXT_LIMIT - 64);
  let sentMessageId: number | null = null;

  for (const [index, chunk] of chunks.entries()) {
    const body = chunks.length > 1 ? `[${index + 1}/${chunks.length}]\n${chunk}` : chunk;
    const sent = await callTelegramApi<TelegramSentMessage>("sendMessage", {
      chat_id: chatId,
      text: body,
      disable_web_page_preview: true,
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
  const sent = await callTelegramApi<TelegramSentMessage>("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, TELEGRAM_CHAT_TEXT_LIMIT),
    disable_web_page_preview: true,
    reply_markup: {
      remove_keyboard: true,
    } satisfies TelegramReplyKeyboardRemove,
  });
  return sent;
}

async function sendTelegramMessageWithReplyKeyboard(
  chatId: number,
  text: string,
  replyMarkup: TelegramReplyKeyboardMarkup,
): Promise<TelegramSentMessage> {
  const sent = await callTelegramApi<TelegramSentMessage>("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, TELEGRAM_CHAT_TEXT_LIMIT),
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
  return sent;
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

async function editTelegramMessage(chatId: number, messageId: number, text: string): Promise<void> {
  const safeText = text.slice(0, TELEGRAM_CHAT_TEXT_LIMIT);
  await callTelegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: safeText,
    disable_web_page_preview: true,
  });
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

  while (Date.now() - startTime < TELEGRAM_MAX_WAIT_MS) {
    const job = await getAgentJob(jobId);
    if (!job) {
      await editTelegramMessage(chatId, progressMessageId, "작업 정보를 찾을 수 없습니다.");
      return;
    }

    const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const shouldUpdateStatus = traceEnabled &&
      (lastProgress !== job.assistantText || Date.now() - lastStatusTime > 3000);

    if (shouldUpdateStatus) {
      const nextProgress = formatStatusText(job.assistantText, elapsed, job.status);
      if (nextProgress !== lastProgress) {
        await editTelegramMessage(chatId, progressMessageId, nextProgress);
        lastProgress = nextProgress;
        lastStatusTime = Date.now();
      }
    }

    if (job.status === "completed" || job.status === "failed") {
      if (job.status === "failed") {
        const reason = job.error?.trim() || "실행 중 오류가 발생했습니다.";
        const finalMessage = `실행 실패: ${reason}`;
        await editTelegramMessage(chatId, progressMessageId, finalMessage);
        return;
      }

      const finalText = job.assistantText.trim() || "응답이 비어 있습니다.";
      const chunks = splitTelegramText(finalText, TELEGRAM_CHAT_TEXT_LIMIT);
      await editTelegramMessage(chatId, progressMessageId, chunks[0] || "응답이 비어 있습니다.");
      for (let i = 1; i < chunks.length; i += 1) {
        await sendTelegramMessage(chatId, `[${i + 1}/${chunks.length}]\n${chunks[i]}`);
      }
      return;
    }

    if (job.status === "running" && !traceEnabled && Date.now() - lastStatusTime > 4000) {
      await editTelegramMessage(chatId, progressMessageId, `응답 생성 중 (${elapsed}초)`);
      lastStatusTime = Date.now();
    }

    await sleep(TELEGRAM_POLL_INTERVAL_MS);
  }

  await sendTelegramMessage(
    chatId,
    `요청 처리 시간이 초과되었습니다. 잠시 후 /status 로 확인하거나 다시 요청해 주세요.`,
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
    const runHeader = [
      `요청 접수됨. 작업 ID: ${job.jobId}`,
      `모델: ${getModelLabel(validation.data.model)} / 사고수준: ${formatReasoningLabel(validation.data.reasoningEffort)}`,
      "응답 생성 중...",
    ].join("\n");

    const initial = await sendTelegramMessage(chatId, runHeader);
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

async function handleModelCommand(
  chatId: number,
  sessionId: string,
  value: string | undefined,
): Promise<void> {
  const session = await loadSession(sessionId);
  const currentModel = getSessionModel(session.model);

  if (!value) {
    await sendTelegramMessage(chatId, formatModelListText(currentModel));
    return;
  }

  const nextModel = resolveModelByInput(value);
  if (!nextModel) {
    await sendTelegramMessage(
      chatId,
      [
        `모델 선택에 실패했습니다: ${value}`,
        formatModelListText(currentModel),
      ].join("\n"),
    );
    return;
  }

  if (nextModel === currentModel) {
    await sendTelegramMessage(chatId, `현재 모델이 이미 ${getModelLabel(nextModel)}입니다.`);
    return;
  }

  await setSessionModel(sessionId, nextModel, session.reasoningEffort);
  await sendTelegramMessage(
    chatId,
    `기본 모델을 ${getModelLabel(nextModel)} (${nextModel})로 변경했습니다.`,
  );
}

async function handleReasoningCommand(
  chatId: number,
  sessionId: string,
  value: string | undefined,
): Promise<void> {
  const session = await loadSession(sessionId);
  const currentReasoning = getSessionReasoning(session.reasoningEffort);

  if (!value) {
    await sendTelegramMessage(chatId, formatReasoningListText(currentReasoning));
    return;
  }

  const nextReasoning = resolveReasoningByInput(value);
  if (!nextReasoning) {
    await sendTelegramMessage(
      chatId,
      [
        `사고수준 선택에 실패했습니다: ${value}`,
        formatReasoningListText(currentReasoning),
      ].join("\n"),
    );
    return;
  }

  if (nextReasoning === currentReasoning) {
    await sendTelegramMessage(chatId, `현재 사고수준이 이미 ${formatReasoningLabel(nextReasoning)}입니다.`);
    return;
  }

  await setSessionModel(sessionId, getSessionModel(session.model), nextReasoning);
  await sendTelegramMessage(
    chatId,
    `사고수준을 ${formatReasoningLabel(nextReasoning)} (${nextReasoning})로 변경했습니다.`,
  );
}

async function handleSessionInfoCommand(chatId: number, sessionId: string): Promise<void> {
  const session = await loadSession(sessionId);
  const currentTitle = session.title?.trim();
  const model = getSessionModel(session.model);
  const reasoning = getSessionReasoning(session.reasoningEffort);
  const traceMode = getTraceMode(sessionId) ? "ON" : "OFF";
  const active = session.activeJobId ? "진행중" : "없음";
  const sessions = await listSessions();
  const targets = sessions.slice(0, TELEGRAM_SESSION_LIST_LIMIT);

  const currentSessionLine = `현재 세션: ${sessionId}`;
  const selectionHelp = `총 ${sessions.length}개 중 ${targets.length}개 표시`;

  const body = [
    currentSessionLine,
    `현재 세션 제목: ${currentTitle || "(미설정)"}`,
    `모델: ${getModelLabel(model)} (${model})`,
    `사고수준: ${formatReasoningLabel(reasoning)} (${reasoning})`,
    `트레이스: ${traceMode}`,
    `진행 작업: ${active}`,
    `대화 메시지: ${session.messages.length}개`,
    "",
    selectionHelp,
    "",
    "번호를 탭하면 즉시 전환됩니다. (/r 1 형태로 즉시 실행)",
    ...targets.map((item, index) => {
      const rawLabel = item.title?.trim() || item.lastMessagePreview?.trim() || "대화 없음";
      const clippedLabel = rawLabel.length > TELEGRAM_SESSION_LIST_PREVIEW_TEXT_LIMIT
        ? `${rawLabel.slice(0, TELEGRAM_SESSION_LIST_PREVIEW_TEXT_LIMIT)}...`
        : rawLabel;
      const marker = item.sessionId === sessionId ? " [현재]" : "";
      return `${index + 1}. ${clippedLabel}${marker}`;
    }),
  ].join("\n");

  if (targets.length === 0) {
    await sendTelegramMessage(chatId, `${body}\n(최근 세션 없음)`);
    return;
  }

  const replyKeyboard = buildSessionResumeReplyKeyboard(
    targets.map((item) => ({
      sessionId: item.sessionId,
      title: item.title,
      lastMessagePreview: item.lastMessagePreview,
    })),
    sessionId,
  );

  await sendTelegramMessageWithReplyKeyboard(
    chatId,
    `${body}\n아래 버튼으로 바로 전환`,
    replyKeyboard,
  );
}

type SessionSwitchResult = {
  targetSessionId: string;
  switched: boolean;
  found: boolean;
  message: string;
};

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

  const sessions = (await listSessions()).filter(
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

function buildSessionSwitchedText(targetSessionId: string, switched: boolean): string {
  if (!switched) {
    return `이미 현재 세션입니다: ${targetSessionId}`;
  }

  return `세션을 전환했습니다.\n현재 세션: ${targetSessionId}\n이제부터 이 세션 컨텍스트에서 계속 진행됩니다.`;
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
    await appendTelegramEventLog("session_switch.result", {
      chatId,
      targetSessionId,
      currentSessionId,
      switched: false,
      found: true,
      reason: "already_current",
    });
    return {
      targetSessionId,
      switched: false,
      found: true,
      message: buildSessionSwitchedText(targetSessionId, false),
    };
  }

  await loadSession(targetSessionId);
  await setSessionOverride(chatId, targetSessionId);
  const completionNotice = await buildCrossSessionCompletionNotice(chatId, targetSessionId);
  await appendTelegramEventLog("session_switch.result", {
    chatId,
    targetSessionId,
    currentSessionId,
    switched: true,
    found: true,
    hasCompletionNotice: Boolean(completionNotice),
  });
  return {
    targetSessionId,
    switched: true,
    found: true,
    message: completionNotice
      ? `${buildSessionSwitchedText(targetSessionId, true)}\n\n${completionNotice}`
      : buildSessionSwitchedText(targetSessionId, true),
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
      message: "요청한 세션을 찾을 수 없습니다. /session을 다시 열어 최신 목록에서 선택해 주세요.",
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
  const sessions = await listSessions();
  const targets = sessions.slice(0, TELEGRAM_SESSION_LIST_LIMIT);
  if (targets.length === 0) {
    await sendTelegramMessage(chatId, "이동 가능한 세션이 없습니다.");
    return;
  }

  const trimmed = selector.trim();
  let selectedSessionId: string | null = null;
  const numberCandidate = Number.parseInt(trimmed, 10);

  if (Number.isInteger(numberCandidate) && numberCandidate > 0 && numberCandidate <= targets.length) {
    selectedSessionId = targets[numberCandidate - 1].sessionId;
  } else {
    selectedSessionId = targets.find((session) => session.sessionId === trimmed)?.sessionId ?? null;
  }

  if (!selectedSessionId) {
    await sendTelegramMessage(
      chatId,
      `세션 선택 실패: ${trimmed}\n/session 목록에서 번호(1~${targets.length}) 또는 정확한 세션 ID로 선택해 주세요.`,
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
      "로그 파일이 비어 있거나 아직 생성되지 않았습니다. `/session` 버튼을 눌러도 반응이 없으면 재현 시점을 다시 보내 주세요.",
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

async function handleNewSessionCommand(chatId: number): Promise<void> {
  const nextSessionId = createNewSessionId(chatId);
  await setSessionOverride(chatId, nextSessionId);
  await loadSession(nextSessionId);
  await sendTelegramMessage(
    chatId,
    [
      "새 세션을 시작했습니다.",
      `세션 ID: ${nextSessionId}`,
      "기존 대화 컨텍스트와 분리되어 동작합니다.",
      "이후 /run, /model, /reasoning, /status 등은 새 세션에서 처리됩니다.",
    ].join("\n"),
  );
}

async function handleScreenshotCommand(chatId: number, rawTarget: string): Promise<void> {
  const target = isValidUrl(rawTarget);
  if (!target) {
    await sendTelegramMessage(chatId, "유효한 URL이 아닙니다. http(s) 주소를 입력해 주세요.");
    return;
  }

  const progress = await sendTelegramMessage(
    chatId,
    `화면 캡처 시작: ${target}\n잠시만 기다려 주세요...`,
  );

  let imagePath: string | null = null;
  try {
    imagePath = await captureWebScreenshot(target);
    await sendTelegramPhoto(chatId, imagePath, `스크린샷: ${target}`);
    await editTelegramMessage(chatId, progress.message_id, `스크린샷 완료: ${target}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "스크린샷 처리에 실패했습니다.";
    await editTelegramMessage(chatId, progress.message_id, `스크린샷 실패: ${message}`);
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
    const webhookSecret = getWebhookSecret();
    if (webhookSecret) {
      const header = request.headers.get("x-telegram-bot-api-secret-token");
      if (header !== webhookSecret) {
        return Response.json({ error: "Invalid webhook secret." }, { status: 401 });
      }
    }

    const body = (await request.json()) as TelegramUpdate;
    const callbackQuery = body.callback_query;
    if (callbackQuery) {
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
        await answerCallbackQuery(callbackQuery.id, "버튼 데이터가 없습니다. /session을 다시 열어 주세요.");
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
        await answerCallbackQuery(callbackQuery.id, "알 수 없는 버튼입니다. /session으로 세션 목록을 다시 받아 주세요.");
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
          await editTelegramMessage(
            callbackChatId,
            callbackQuery.message.message_id,
            `${summarizeResumeSessionResult(switchResult)}\n${switchResult.message}`,
          );
        }
      } catch {
        // fallback noop
      }
      return Response.json({ ok: true }, { status: 200 });
    }

    const message = body.message ?? body.edited_message;
    if (!message || typeof message.text !== "string") {
      return Response.json({ ok: true }, { status: 200 });
    }

    const sessionId = await getSessionIdForChat(message.chat.id);
    const command = parseCommand(message.text);
    await appendTelegramEventLog("message.command", {
      chatId: message.chat.id,
      commandKind: command.kind,
      textLength: message.text.length,
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
          case "resumeSession":
            await handleResumeSessionCommand(message.chat.id, command.selector, sessionId);
            return;
          case "status": {
            const session = await loadSession(sessionId);
            const model = getSessionModel(session.model);
            const reasoning = getSessionReasoning(session.reasoningEffort);
            const activeJobId = session.activeJobId;
            if (!activeJobId) {
              await sendTelegramMessage(
                message.chat.id,
                [
                  `세션: ${sessionId}`,
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
          case "cancel":
            await handleCancelCommand(message.chat.id, sessionId);
            return;
          case "model":
            await handleModelCommand(message.chat.id, sessionId, command.value);
            return;
          case "reasoning":
            await handleReasoningCommand(message.chat.id, sessionId, command.value);
            return;
          case "sessionInfo":
            await handleSessionInfoCommand(message.chat.id, sessionId);
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
          case "screenshot":
            await handleScreenshotCommand(message.chat.id, command.target);
            return;
          case "screenshotLocal":
            await handleLocalScreenshotCommand(message.chat.id, command.target);
            return;
          case "unknown":
            await sendTelegramMessage(message.chat.id, `${command.message}\n도움이 필요하면 /h`);
            return;
          case "run":
            if (!command.message.trim()) {
              await sendTelegramMessage(message.chat.id, "실행할 내용이 비어 있습니다. /h 를 확인해 주세요.");
              return;
            }
            await handleRunCommand(message.chat.id, sessionId, command.message);
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
