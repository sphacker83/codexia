import { promises as fs } from "node:fs";
import path from "node:path";

import { getModelProvider, type ModelProvider } from "@/src/core/agent/models";
import type { Message, Role, Session, SessionSummary } from "@/src/core/agent/types";
import { writeTextFileAtomically } from "@/src/infrastructure/atomic-file";

const SESSION_FILE_EXTENSION = ".json";
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SESSIONS_DIRECTORY = path.join(process.cwd(), "data", "sessions");
const SESSION_SUMMARY_PREVIEW_LIMIT = 60;
const SESSION_AUTO_TITLE_PREVIEW_LIMIT = 48;
const sessionOperationQueues = new Map<string, Promise<void>>();

function assertValidSessionId(sessionId: string): void {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error("Invalid sessionId format.");
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function normalizeSession(sessionId: string, raw: Session): Session {
  const baseCreatedAt = raw.createdAt || new Date().toISOString();
  const lastMessageTime = raw.messages.at(-1)?.createdAt;
  const updatedAt = raw.updatedAt || lastMessageTime || baseCreatedAt;
  const providerSessionId =
    typeof raw.providerSessionId === "string" && raw.providerSessionId.trim()
      ? raw.providerSessionId.trim()
      : undefined;
  const providerSessionProvider =
    raw.providerSessionProvider === "codex" || raw.providerSessionProvider === "gemini"
      ? raw.providerSessionProvider
      : undefined;

  return {
    sessionId,
    createdAt: baseCreatedAt,
    updatedAt,
    title: raw.title,
    model: raw.model,
    reasoningEffort: raw.reasoningEffort,
    providerSessionId,
    providerSessionProvider,
    activeJobId: raw.activeJobId,
    messages: Array.isArray(raw.messages) ? raw.messages : [],
  };
}

function normalizeProviderSessionState(
  session: Session,
  model: string,
): Pick<Session, "providerSessionId" | "providerSessionProvider"> {
  const nextProvider = getModelProvider(model);
  if (session.providerSessionProvider && session.providerSessionProvider !== nextProvider) {
    return {
      providerSessionId: undefined,
      providerSessionProvider: undefined,
    };
  }

  return {
    providerSessionId: session.providerSessionId,
    providerSessionProvider: session.providerSessionProvider,
  };
}

function getLastMessagePreview(session: Session): string {
  const lastMessage = session.messages.at(-1);
  if (!lastMessage?.content) {
    return "";
  }

  const normalized = lastMessage.content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= SESSION_SUMMARY_PREVIEW_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, SESSION_SUMMARY_PREVIEW_LIMIT)}...`;
}

export function getSessionsDirectoryPath(): string {
  return SESSIONS_DIRECTORY;
}

export function getSessionFilePath(sessionId: string): string {
  assertValidSessionId(sessionId);
  return path.join(SESSIONS_DIRECTORY, `${sessionId}${SESSION_FILE_EXTENSION}`);
}

export function createMessage(role: Role, content: string): Message {
  return {
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function createEmptySession(sessionId: string): Session {
  const now = new Date().toISOString();
  return {
    sessionId,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

async function enqueueSessionOperation<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
  const pending = sessionOperationQueues.get(sessionId) ?? Promise.resolve();
  let releaseCurrentOperation!: () => void;
  const currentOperation = new Promise<void>((resolve) => {
    releaseCurrentOperation = resolve;
  });
  const nextOperation = pending.catch(() => undefined).then(() => currentOperation);

  sessionOperationQueues.set(sessionId, nextOperation);
  await pending.catch(() => undefined);

  try {
    return await operation();
  } finally {
    releaseCurrentOperation();
    if (sessionOperationQueues.get(sessionId) === nextOperation) {
      sessionOperationQueues.delete(sessionId);
    }
  }
}

async function updateSession(
  sessionId: string,
  updater: (session: Session) => Promise<Session> | Session,
): Promise<Session> {
  return enqueueSessionOperation(sessionId, async () => {
    const currentSession = (await readSessionFile(sessionId)) ?? createEmptySession(sessionId);
    const nextSession = normalizeSession(sessionId, await updater(currentSession));
    await writeSessionFile(sessionId, nextSession);
    return nextSession;
  });
}

export async function readSessionFile(sessionId: string): Promise<Session | null> {
  const filePath = getSessionFilePath(sessionId);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Session;
    return normalizeSession(sessionId, parsed);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return null;
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse session file: ${filePath}`, { cause: error });
    }

    throw error;
  }
}

export async function writeSessionFile(sessionId: string, session: Session): Promise<void> {
  const filePath = getSessionFilePath(sessionId);
  const normalized = normalizeSession(sessionId, session);
  const payload = `${JSON.stringify(normalized, null, 2)}\n`;

  await writeTextFileAtomically(filePath, payload);
}

export async function createSession(sessionId: string): Promise<Session> {
  assertValidSessionId(sessionId);
  return loadSession(sessionId);
}

interface SetSessionTitleOptions {
  overwrite?: boolean;
  maxLength?: number;
}

function normalizeSessionTitle(raw: string, maxLength: number = SESSION_AUTO_TITLE_PREVIEW_LIMIT): string {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trim()}...`;
}

export function summarizeSessionTitleFromResponse(raw: string): string {
  const normalized = raw.replace(/\r/g, " ").replace(/\s+\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  const firstLine = normalized.split("\n")[0]?.trim() || "";
  return normalizeSessionTitle(firstLine || normalized, SESSION_AUTO_TITLE_PREVIEW_LIMIT);
}

export async function loadExistingSession(sessionId: string): Promise<Session | null> {
  assertValidSessionId(sessionId);
  return readSessionFile(sessionId);
}

export async function loadSession(sessionId: string): Promise<Session> {
  assertValidSessionId(sessionId);
  const existing = await readSessionFile(sessionId);
  if (existing) {
    return existing;
  }

  return enqueueSessionOperation(sessionId, async () => {
    const reloaded = await readSessionFile(sessionId);
    if (reloaded) {
      return reloaded;
    }

    const session = createEmptySession(sessionId);
    await writeSessionFile(sessionId, session);
    return session;
  });
}

export async function appendMessage(sessionId: string, message: Message): Promise<Session> {
  assertValidSessionId(sessionId);
  return updateSession(sessionId, async (session) => ({
    ...session,
    updatedAt: message.createdAt || new Date().toISOString(),
    messages: [...session.messages, message],
  }));
}

export async function setSessionModel(
  sessionId: string,
  model: string,
  reasoningEffort?: string,
): Promise<Session> {
  assertValidSessionId(sessionId);
  return updateSession(sessionId, async (session) => {
    const providerSessionState = normalizeProviderSessionState(session, model);
    return {
      ...session,
      ...providerSessionState,
      model,
      reasoningEffort,
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function setSessionTitle(
  sessionId: string,
  title: string,
  options?: SetSessionTitleOptions,
): Promise<Session> {
  assertValidSessionId(sessionId);
  const overwrite = options?.overwrite ?? true;
  const maxLength = options?.maxLength ?? SESSION_AUTO_TITLE_PREVIEW_LIMIT;

  return updateSession(sessionId, async (session) => {
    const normalized = normalizeSessionTitle(title, maxLength);
    if (!normalized) {
      throw new Error("Session title is empty.");
    }

    if (!overwrite && session.title?.trim()) {
      return session;
    }

    return {
      ...session,
      title: normalized,
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function setSessionTitleIfMissing(sessionId: string, title: string): Promise<boolean> {
  assertValidSessionId(sessionId);
  let didSetTitle = false;

  await updateSession(sessionId, async (session) => {
    if (session.title?.trim()) {
      return session;
    }

    const normalized = summarizeSessionTitleFromResponse(title);
    if (!normalized) {
      return session;
    }

    didSetTitle = true;

    return {
      ...session,
      title: normalized,
      updatedAt: new Date().toISOString(),
    };
  });

  return didSetTitle;
}

interface RecordUserTurnInput {
  model: string;
  reasoningEffort?: string;
  userMessage: string;
}

export async function recordUserTurn(
  sessionId: string,
  { model, reasoningEffort, userMessage }: RecordUserTurnInput,
): Promise<Session> {
  assertValidSessionId(sessionId);
  return updateSession(sessionId, async (session) => {
    const userMessageRecord = createMessage("user", userMessage);
    const providerSessionState = normalizeProviderSessionState(session, model);
    return {
      ...session,
      ...providerSessionState,
      model,
      reasoningEffort,
      updatedAt: userMessageRecord.createdAt,
      messages: [...session.messages, userMessageRecord],
    };
  });
}

export async function setSessionProviderSession(
  sessionId: string,
  provider: ModelProvider,
  providerSessionId: string,
): Promise<Session> {
  assertValidSessionId(sessionId);
  const normalizedProviderSessionId = providerSessionId.trim();
  if (!normalizedProviderSessionId) {
    throw new Error("providerSessionId is empty.");
  }

  return updateSession(sessionId, async (session) => ({
    ...session,
    providerSessionProvider: provider,
    providerSessionId: normalizedProviderSessionId,
    updatedAt: new Date().toISOString(),
  }));
}

export async function setSessionActiveJob(sessionId: string, jobId?: string): Promise<Session> {
  assertValidSessionId(sessionId);
  return updateSession(sessionId, async (session) => ({
    ...session,
    activeJobId: jobId,
    updatedAt: new Date().toISOString(),
  }));
}

export function getSessionLastActivity(session: Session): string {
  return session.messages.at(-1)?.createdAt || session.updatedAt || session.createdAt;
}

export async function listSessions(): Promise<SessionSummary[]> {
  await fs.mkdir(SESSIONS_DIRECTORY, { recursive: true });
  const files = await fs.readdir(SESSIONS_DIRECTORY);
  const sessionFiles = files.filter((file) => file.endsWith(SESSION_FILE_EXTENSION));
  const summaries: SessionSummary[] = [];

  for (const fileName of sessionFiles) {
    const sessionId = fileName.slice(0, -SESSION_FILE_EXTENSION.length);
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      continue;
    }
    try {
      const session = await readSessionFile(sessionId);
      if (!session) {
        continue;
      }
      summaries.push({
        sessionId,
        createdAt: session.createdAt,
        updatedAt: getSessionLastActivity(session),
        title: session.title,
        lastMessagePreview: getLastMessagePreview(session),
        messageCount: session.messages.length,
        model: session.model,
        reasoningEffort: session.reasoningEffort,
        activeJobId: session.activeJobId,
      });
    } catch {
      // ignore invalid session files
    }
  }

  summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return summaries;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const filePath = getSessionFilePath(sessionId);
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
