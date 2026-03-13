#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs/promises") as typeof import("node:fs/promises");
const nodePath = require("node:path") as typeof import("node:path");

interface TelegramChat {
  id?: number | null;
}

interface TelegramMessage {
  chat?: TelegramChat;
}

interface TelegramCallbackQuery {
  data?: string;
  message?: TelegramMessage;
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  inline_query?: unknown;
}

interface TelegramApiResponse<T> {
  ok?: boolean;
  result?: T;
  description?: string;
}

const TELEGRAM_EVENT_LOG_FILE = nodePath.resolve(
  process.cwd(),
  process.env.TELEGRAM_EVENT_LOG_FILE?.trim() || "data/telegram-events.log",
);

async function appendPollerEventLog(
  event: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await fs.mkdir(nodePath.dirname(TELEGRAM_EVENT_LOG_FILE), { recursive: true });
    const record = {
      time: new Date().toISOString(),
      source: "telegram-poller",
      event,
      ...details,
    };
    await fs.appendFile(TELEGRAM_EVENT_LOG_FILE, `${JSON.stringify(record)}\n`, "utf8");
  } catch {
    // Polling logs are non-critical.
  }
}

function stripInlineComment(value: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === "\"" && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      const previous = index === 0 ? " " : value[index - 1];
      if (/\s/.test(previous)) {
        return value.slice(0, index).trim();
      }
    }
  }

  return value.trim();
}

async function loadEnvFile(filePath = ".env.local"): Promise<void> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const equalIndex = trimmed.indexOf("=");
      if (equalIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, equalIndex).trim();
      let value = stripInlineComment(trimmed.slice(equalIndex + 1).trim());

      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Missing env file is allowed.
  }
}

function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required.");
  }

  if (token.toLowerCase().startsWith("bot")) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN must not include the leading 'bot' prefix.",
    );
  }

  if (/\s|#/.test(token)) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN looks invalid. Remove inline comments or whitespace from .env.local.",
    );
  }

  return token;
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readOffset(statePath: string): Promise<number> {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as { nextOffset?: unknown };
    const offset = Number.parseInt(String(parsed.nextOffset ?? ""), 10);
    if (Number.isInteger(offset) && offset > 0) {
      return offset;
    }
  } catch {
    // Ignore missing or invalid state file.
  }

  return 0;
}

async function writeOffset(statePath: string, nextOffset: number): Promise<void> {
  const payload = `${JSON.stringify({ nextOffset, updatedAt: new Date().toISOString() })}\n`;
  await fs.mkdir(nodePath.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, payload, "utf8");
}

async function callGetUpdates(
  token: string,
  offset: number,
  pollTimeout: number,
): Promise<TelegramUpdate[]> {
  const allowedFromEnv = process.env.TELEGRAM_POLLER_ALLOWED_UPDATES?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const normalized = new Set(
    (allowedFromEnv?.length
      ? allowedFromEnv
      : ["message", "edited_message", "callback_query"]).filter(Boolean),
  );
  normalized.add("callback_query");
  const allowedUpdates = [...normalized];

  const params = new URLSearchParams({
    timeout: String(pollTimeout),
    limit: "100",
    allowed_updates: JSON.stringify(allowedUpdates),
  });
  params.set("offset", String(offset));

  const response = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?${params.toString()}`,
    { method: "GET" },
  );
  const body = (await response.json().catch(() => null)) as TelegramApiResponse<TelegramUpdate[]> | null;
  if (!response.ok || !body?.ok) {
    const message = body?.description || `HTTP ${response.status}`;
    throw new Error(`getUpdates failed: ${message}`);
  }
  return Array.isArray(body.result) ? body.result : [];
}

async function postUpdateToAgent(
  update: TelegramUpdate,
  localEndpoint: string,
  webhookSecret: string,
): Promise<void> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (webhookSecret) {
    headers["x-telegram-bot-api-secret-token"] = webhookSecret;
  }

  const response = await fetch(localEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`local endpoint error: ${response.status} ${body}`);
  }
}

async function deleteWebhook(token: string): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`,
    { method: "POST" },
  );
  const body = (await response.json().catch(() => null)) as TelegramApiResponse<boolean> | null;
  if (!response.ok || !body?.ok) {
    const message = body?.description || `HTTP ${response.status}`;
    throw new Error(`deleteWebhook failed: ${message}`);
  }
}

async function runTelegramPoller(): Promise<void> {
  await loadEnvFile();

  const botToken = getTelegramBotToken();

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";
  const localEndpoint =
    process.env.TELEGRAM_POLLER_LOCAL_ENDPOINT?.trim() || "http://127.0.0.1:3000/api/telegram";
  const pollTimeout = toInt(process.env.TELEGRAM_POLLER_TIMEOUT, 25);
  const pollIntervalMs = toInt(process.env.TELEGRAM_POLLER_POLL_INTERVAL_MS, 1200);
  const statePath =
    process.env.TELEGRAM_POLLER_STATE_FILE?.trim() ||
    nodePath.join(process.cwd(), "data", "telegram-poller-state.json");
  const deleteWebhookOnStart = process.env.TELEGRAM_POLLER_DELETE_WEBHOOK === "1";

  if (deleteWebhookOnStart) {
    console.log("[telegram-poller] deleting Telegram webhook...");
    await deleteWebhook(botToken);
  }

  let nextOffset = await readOffset(statePath);
  if (nextOffset === 0) {
    console.log("[telegram-poller] starting first poll from latest updates.");
  }

  console.log("[telegram-poller] polling started");
  console.log(`[telegram-poller] local endpoint: ${localEndpoint}`);

  let stopped = false;
  let running = true;

  process.on("SIGINT", () => {
    if (running) {
      running = false;
      stopped = true;
      console.log("\n[telegram-poller] stop requested");
    }
  });

  process.on("SIGTERM", () => {
    if (running) {
      running = false;
      stopped = true;
      console.log("\n[telegram-poller] stop requested");
    }
  });

  while (running) {
    try {
      const updates = await callGetUpdates(botToken, nextOffset, pollTimeout);

      if (updates.length === 0) {
        await sleep(pollIntervalMs);
        continue;
      }

      for (const update of updates) {
        const updateId = update.update_id;
        const updateKind = update.message
          ? "message"
          : update.edited_message
            ? "edited_message"
            : update.callback_query
              ? "callback_query"
              : update.inline_query
                ? "inline_query"
                : "unknown";

        await appendPollerEventLog("update.received", {
          updateId: updateId ?? null,
          updateKind,
          hasCallbackData: Boolean(update.callback_query?.data),
          fromChatId:
            update.message?.chat?.id ??
            update.edited_message?.chat?.id ??
            update.callback_query?.message?.chat?.id ??
            null,
        });

        if (typeof updateId !== "number" || !Number.isInteger(updateId)) {
          continue;
        }

        try {
          await postUpdateToAgent(update, localEndpoint, webhookSecret);
          nextOffset = Math.max(nextOffset, updateId + 1);
          await writeOffset(statePath, nextOffset);
          await appendPollerEventLog("update.posted", {
            updateId,
            updateKind,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(
            `[telegram-poller] update ${updateId} processing failed: ${message}`,
          );
          await appendPollerEventLog("update.post_failed", {
            updateId,
            updateKind,
            error: message,
          });
          await sleep(pollIntervalMs * 2);
          break;
        }

        if (!running) {
          break;
        }
      }
    } catch (error) {
      if (!running) {
        break;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[telegram-poller] polling failed: ${message}`);
      await sleep(pollIntervalMs * 2);
    }
  }

  if (stopped) {
    await writeOffset(statePath, nextOffset);
    console.log("[telegram-poller] stopped.");
  }
}

void runTelegramPoller().catch((error) => {
  console.error(`[telegram-poller] fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
