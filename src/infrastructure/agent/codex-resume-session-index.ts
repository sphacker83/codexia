import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CodexResumeSessionSummary {
  sessionId: string;
  title?: string;
  conversation?: string;
  workingDirectory?: string;
  updatedAt: string;
}

interface RawCodexSessionIndexEntry {
  id?: unknown;
  thread_name?: unknown;
}

interface RawCodexSessionMetaLine {
  timestamp?: unknown;
  type?: unknown;
  payload?: {
    id?: unknown;
    timestamp?: unknown;
    cwd?: unknown;
  };
}

interface CodexSessionMeta {
  sessionId: string;
  conversation?: string;
  workingDirectory?: string;
  updatedAt: string;
}

const CODEX_HOME_DIRECTORY = process.env.CODEX_HOME?.trim()
  ? path.resolve(process.env.CODEX_HOME.trim())
  : path.join(os.homedir(), ".codex");
const CODEX_SESSIONS_DIRECTORY = path.join(CODEX_HOME_DIRECTORY, "sessions");
const CODEX_SESSION_INDEX_PATH = path.join(CODEX_HOME_DIRECTORY, "session_index.jsonl");
const CODEX_SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_RECENT_RESUME_SESSIONS = 200;
const MAX_RECENT_SESSION_SCAN_FILES = 200;
const CONVERSATION_PREVIEW_LIMIT = 96;

function isValidSessionId(value: string): boolean {
  return CODEX_SESSION_ID_PATTERN.test(value);
}

function normalizeOptionalTitle(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return Number.isNaN(Date.parse(normalized)) ? null : normalized;
}

function normalizeConversationPreview(raw: string): string | undefined {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.length > CONVERSATION_PREVIEW_LIMIT
    ? `${normalized.slice(0, CONVERSATION_PREVIEW_LIMIT).trim()}...`
    : normalized;
}

function extractConversationPreview(rawText: string): string | undefined {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("```"))
    .filter((line) => !/^#{1,6}\s/.test(line))
    .filter((line) => !/^<[^>]+>$/.test(line))
    .filter((line) => !/^(INSTRUCTIONS|SESSION PROGRESS|ULTIMATE INVARIANTS)$/i.test(line))
    .filter((line) => !line.includes("AGENTS.md instructions"))
    .filter((line) => !line.includes("environment_context"))
    .filter((line) => !line.startsWith("---"));

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const preview = normalizeConversationPreview(lines[index]);
    if (preview) {
      return preview;
    }
  }

  return undefined;
}

function parseSessionIndexLine(line: string): { sessionId: string; title?: string } | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: RawCodexSessionIndexEntry;
  try {
    parsed = JSON.parse(trimmed) as RawCodexSessionIndexEntry;
  } catch {
    return null;
  }

  if (typeof parsed.id !== "string") {
    return null;
  }

  const sessionId = parsed.id.trim();
  if (!isValidSessionId(sessionId)) {
    return null;
  }

  return {
    sessionId,
    title: normalizeOptionalTitle(parsed.thread_name),
  };
}

async function readSessionIndexTitleMap(): Promise<Map<string, string>> {
  let rawIndex = "";
  try {
    rawIndex = await fs.readFile(CODEX_SESSION_INDEX_PATH, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return new Map();
    }
    throw error;
  }

  const titles = new Map<string, string>();
  for (const line of rawIndex.split(/\r?\n/)) {
    const parsed = parseSessionIndexLine(line);
    if (!parsed?.title) {
      continue;
    }
    titles.set(parsed.sessionId, parsed.title);
  }
  return titles;
}

type SessionDirEntry = Dirent<string>;

async function listEntriesDescending(directoryPath: string): Promise<SessionDirEntry[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true, encoding: "utf8" });
  return entries.sort((left, right) => right.name.localeCompare(left.name, "en"));
}

async function collectRecentSessionFiles(
  directoryPath: string,
  limit: number,
  collected: string[] = [],
): Promise<string[]> {
  if (collected.length >= limit) {
    return collected;
  }

  let entries: SessionDirEntry[];
  try {
    entries = await listEntriesDescending(directoryPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return collected;
    }
    throw error;
  }

  for (const entry of entries) {
    if (collected.length >= limit) {
      break;
    }

    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await collectRecentSessionFiles(fullPath, limit, collected);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      collected.push(fullPath);
    }
  }

  return collected;
}

async function parseSessionMetaFromFile(filePath: string): Promise<CodexSessionMeta | null> {
  let rawFile: string;
  try {
    rawFile = await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }

  const lines = rawFile.split(/\r?\n/).filter(Boolean);
  const firstLine = lines[0]?.trim();
  if (!firstLine) {
    return null;
  }

  let parsed: RawCodexSessionMetaLine;
  try {
    parsed = JSON.parse(firstLine) as RawCodexSessionMetaLine;
  } catch {
    return null;
  }

  if (parsed.type !== "session_meta") {
    return null;
  }

  const rawSessionId = parsed.payload?.id;
  const updatedAt = normalizeTimestamp(parsed.payload?.timestamp) || normalizeTimestamp(parsed.timestamp);
  if (typeof rawSessionId !== "string" || !updatedAt) {
    return null;
  }

  const sessionId = rawSessionId.trim();
  if (!isValidSessionId(sessionId)) {
    return null;
  }
  const workingDirectory =
    typeof parsed.payload?.cwd === "string" && parsed.payload.cwd.trim()
      ? parsed.payload.cwd.trim()
      : undefined;

  let conversation: string | undefined;
  for (const line of lines) {
    let item: RawCodexSessionMetaLine;
    try {
      item = JSON.parse(line) as RawCodexSessionMetaLine;
    } catch {
      continue;
    }

    if (item.type !== "event_msg") {
      continue;
    }

    const payload = item.payload as { type?: unknown; message?: unknown; text?: unknown } | undefined;
    const messageType = payload?.type;
    const rawMessage = typeof payload?.message === "string"
      ? payload.message
      : typeof payload?.text === "string"
        ? payload.text
        : "";
    if (messageType === "user_message" && rawMessage.trim()) {
      conversation = extractConversationPreview(rawMessage);
      if (conversation) {
        break;
      }
    }
  }

  return {
    sessionId,
    conversation,
    workingDirectory,
    updatedAt,
  };
}

async function findSessionMetaById(sessionId: string): Promise<CodexSessionMeta | null> {
  const recentFiles = await collectRecentSessionFiles(CODEX_SESSIONS_DIRECTORY, Number.MAX_SAFE_INTEGER);
  for (const filePath of recentFiles) {
    if (!filePath.endsWith(`${sessionId}.jsonl`)) {
      continue;
    }
    const parsed = await parseSessionMetaFromFile(filePath);
    if (parsed?.sessionId === sessionId) {
      return parsed;
    }
  }

  return null;
}

export async function listCodexResumeSessions(): Promise<CodexResumeSessionSummary[]> {
  const [titlesById, recentFiles] = await Promise.all([
    readSessionIndexTitleMap(),
    collectRecentSessionFiles(CODEX_SESSIONS_DIRECTORY, MAX_RECENT_SESSION_SCAN_FILES),
  ]);

  const sessions: CodexResumeSessionSummary[] = [];
  const seenSessionIds = new Set<string>();

  for (const filePath of recentFiles) {
    if (sessions.length >= MAX_RECENT_RESUME_SESSIONS) {
      break;
    }

    const parsed = await parseSessionMetaFromFile(filePath);
    if (!parsed || seenSessionIds.has(parsed.sessionId)) {
      continue;
    }

    seenSessionIds.add(parsed.sessionId);
    sessions.push({
      sessionId: parsed.sessionId,
      conversation: parsed.conversation,
      workingDirectory: parsed.workingDirectory,
      title: titlesById.get(parsed.sessionId),
      updatedAt: parsed.updatedAt,
    });
  }

  return sessions;
}

export async function findCodexResumeSession(sessionId: string): Promise<CodexResumeSessionSummary | null> {
  if (!isValidSessionId(sessionId)) {
    return null;
  }

  const [titlesById, meta] = await Promise.all([readSessionIndexTitleMap(), findSessionMetaById(sessionId)]);
  if (!meta) {
    return null;
  }

  return {
    sessionId: meta.sessionId,
    conversation: meta.conversation,
    workingDirectory: meta.workingDirectory,
    title: titlesById.get(meta.sessionId),
    updatedAt: meta.updatedAt,
  };
}
