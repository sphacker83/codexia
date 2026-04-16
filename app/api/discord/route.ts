import {
  cancelSessionActiveJob,
  createAgentJob,
  getAgentJob,
  isActiveJobError,
  listSessionJobs,
} from "@/src/application/agent/job-service";
import {
  listResumeSessions,
  loadSession,
  setSessionModel,
} from "@/src/infrastructure/agent/session-file-store";
import {
  formatDiscordCommandHelp,
} from "@/src/infrastructure/discord/commands";
import { validateAgentRequest } from "@/src/presentation/server/agent-request-validator";
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
import { after } from "next/server";
import { createPublicKey, randomUUID, verify } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCORD_MESSAGE_LIMIT = 2000;
const DISCORD_POLL_INTERVAL_MS = 1000;
const DISCORD_PROGRESS_UPDATE_INTERVAL_MS = 5000;
const DISCORD_PROGRESS_PREVIEW_LIMIT = 240;
const DISCORD_EVENT_LOG_FILE = path.resolve(
  process.cwd(),
  process.env.DISCORD_EVENT_LOG_FILE?.trim() || "data/discord-events.log",
);
const DISCORD_SESSION_OVERRIDES_FILE = path.resolve(
  process.cwd(),
  process.env.DISCORD_SESSION_OVERRIDES_FILE?.trim() || "data/discord-session-overrides.json",
);
const DISCORD_FILE_DOWNLOAD_DIR = path.resolve(
  process.cwd(),
  process.env.DISCORD_FILE_DOWNLOAD_DIR?.trim() || "data/discord-files",
);
const DISCORD_ALLOWED_USER_IDS = parseIdList(process.env.DISCORD_ALLOWED_USER_IDS);
const DISCORD_ALLOWED_CHANNEL_IDS = parseIdList(process.env.DISCORD_ALLOWED_CHANNEL_IDS);
const DISCORD_ALLOWED_GUILD_IDS = parseIdList(process.env.DISCORD_ALLOWED_GUILD_IDS);
const DISCORD_AUTH_REQUIRED =
  DISCORD_ALLOWED_USER_IDS.size > 0 ||
  DISCORD_ALLOWED_CHANNEL_IDS.size > 0 ||
  DISCORD_ALLOWED_GUILD_IDS.size > 0;
const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const DISCORD_EPHEMERAL_FLAG = 1 << 6;
const EXTERNAL_RESUME_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sessionOverrideCache = new Map<string, string>();
let sessionOverridesLoaded = false;
let sessionOverridesLoadPromise: Promise<void> | null = null;

interface DiscordUser {
  id: string;
  username?: string;
  global_name?: string | null;
}

interface DiscordAttachment {
  id: string;
  filename: string;
  url: string;
  content_type?: string;
  size?: number;
}

interface DiscordCommandOption {
  name: string;
  type: number;
  value?: string | number | boolean;
}

interface DiscordApplicationCommandData {
  id: string;
  name: string;
  options?: DiscordCommandOption[];
  resolved?: {
    attachments?: Record<string, DiscordAttachment>;
  };
}

interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number;
  token: string;
  channel_id?: string;
  guild_id?: string;
  data?: DiscordApplicationCommandData;
  member?: {
    user?: DiscordUser;
  };
  user?: DiscordUser;
}

interface DiscordWebhookPayload {
  content: string;
  flags?: number;
}

interface SessionSwitchResult {
  found: boolean;
  switched: boolean;
  targetSessionId: string;
  message: string;
}

function parseIdList(raw?: string): Set<string> {
  const result = new Set<string>();
  if (!raw) {
    return result;
  }
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (token) {
      result.add(token);
    }
  }
  return result;
}

function getDiscordPublicKey(): string {
  const value = process.env.DISCORD_PUBLIC_KEY?.trim();
  if (!value) {
    throw new Error("DISCORD_PUBLIC_KEY is not configured.");
  }
  return value;
}

function createDiscordPublicKey(publicKeyHex: string) {
  const keyBytes = Buffer.from(publicKeyHex, "hex");
  if (keyBytes.length !== 32) {
    throw new Error("DISCORD_PUBLIC_KEY must be a 32-byte hex value.");
  }
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, keyBytes]),
    format: "der",
    type: "spki",
  });
}

function verifyDiscordSignature(body: Buffer, timestamp: string, signature: string): boolean {
  const key = createDiscordPublicKey(getDiscordPublicKey());
  return verify(
    null,
    Buffer.concat([Buffer.from(timestamp, "utf8"), body]),
    key,
    Buffer.from(signature, "hex"),
  );
}

function getDiscordUser(interaction: DiscordInteraction): DiscordUser | null {
  return interaction.member?.user ?? interaction.user ?? null;
}

function getDiscordOption(
  interaction: DiscordInteraction,
  name: string,
): DiscordCommandOption | undefined {
  return interaction.data?.options?.find((option) => option.name === name);
}

function getDiscordOptionString(
  interaction: DiscordInteraction,
  name: string,
): string | undefined {
  const value = getDiscordOption(interaction, name)?.value;
  return typeof value === "string" ? value.trim() : undefined;
}

function getDiscordOptionInteger(
  interaction: DiscordInteraction,
  name: string,
): number | undefined {
  const value = getDiscordOption(interaction, name)?.value;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function getDiscordAttachment(
  interaction: DiscordInteraction,
  name: string,
): DiscordAttachment | null {
  const attachmentId = getDiscordOption(interaction, name)?.value;
  if (typeof attachmentId !== "string") {
    return null;
  }
  return interaction.data?.resolved?.attachments?.[attachmentId] ?? null;
}

function toDiscordInteractionResponse(content: string): Response {
  return Response.json({
    type: 4,
    data: {
      content,
      flags: DISCORD_EPHEMERAL_FLAG,
    },
  });
}

function toDiscordDeferredResponse(): Response {
  return Response.json({
    type: 5,
    data: {
      flags: DISCORD_EPHEMERAL_FLAG,
    },
  });
}

function splitDiscordText(text: string, limit = DISCORD_MESSAGE_LIMIT): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return ["응답이 비어 있습니다."];
  }
  if (normalized.length <= limit) {
    return [normalized];
  }

  const chunks: string[] = [];
  let rest = normalized;
  while (rest.length > limit) {
    let splitIndex = rest.lastIndexOf("\n", limit);
    if (splitIndex <= 0) {
      splitIndex = rest.lastIndexOf(" ", limit);
    }
    if (splitIndex <= 0) {
      splitIndex = limit;
    }
    chunks.push(rest.slice(0, splitIndex).trim());
    rest = rest.slice(splitIndex).trim();
  }
  if (rest) {
    chunks.push(rest);
  }
  return chunks;
}

function getDiscordDisplayName(user: DiscordUser | null): string {
  if (!user) {
    return "unknown";
  }
  return user.global_name?.trim() || user.username?.trim() || user.id;
}

function toDiscordScopeKey(interaction: DiscordInteraction): string {
  const user = getDiscordUser(interaction);
  const userId = user?.id || "anonymous";
  if (interaction.guild_id) {
    return `${interaction.guild_id}_${userId}`;
  }
  return `dm_${userId}`;
}

function toDiscordSessionRoot(scopeKey: string): string {
  const safe = scopeKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `dc_${safe}`;
}

function createDiscordSessionId(scopeKey: string): string {
  const token = randomUUID().replace(/-/g, "").slice(0, 10);
  return `${toDiscordSessionRoot(scopeKey)}_${Date.now().toString(36)}_${token}`;
}

function isSessionOwnedByScope(scopeKey: string, sessionId: string): boolean {
  const root = toDiscordSessionRoot(scopeKey);
  return sessionId === root || sessionId.startsWith(`${root}_`);
}

function isResumeSessionVisibleToScope(scopeKey: string, sessionId: string): boolean {
  return isSessionOwnedByScope(scopeKey, sessionId) || EXTERNAL_RESUME_SESSION_ID_PATTERN.test(sessionId);
}

async function ensureSessionOverridesLoaded(): Promise<void> {
  if (sessionOverridesLoaded) {
    return;
  }
  if (sessionOverridesLoadPromise) {
    await sessionOverridesLoadPromise;
    return;
  }

  sessionOverridesLoadPromise = (async () => {
    try {
      const raw = await fs.readFile(DISCORD_SESSION_OVERRIDES_FILE, "utf8");
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed && typeof parsed === "object") {
        for (const [scopeKey, sessionId] of Object.entries(parsed)) {
          if (typeof sessionId === "string" && sessionId.trim()) {
            sessionOverrideCache.set(scopeKey, sessionId.trim());
          }
        }
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load discord session overrides.", error);
      }
    } finally {
      sessionOverridesLoaded = true;
    }
  })();

  await sessionOverridesLoadPromise;
}

async function persistSessionOverrides(): Promise<void> {
  await fs.mkdir(path.dirname(DISCORD_SESSION_OVERRIDES_FILE), { recursive: true });
  const payload: Record<string, string> = {};
  for (const [scopeKey, sessionId] of sessionOverrideCache.entries()) {
    payload[scopeKey] = sessionId;
  }
  await fs.writeFile(DISCORD_SESSION_OVERRIDES_FILE, JSON.stringify(payload, null, 2), "utf8");
}

async function getSessionIdForScope(scopeKey: string): Promise<string> {
  await ensureSessionOverridesLoaded();
  return sessionOverrideCache.get(scopeKey) ?? toDiscordSessionRoot(scopeKey);
}

async function setSessionIdForScope(scopeKey: string, sessionId: string): Promise<void> {
  await ensureSessionOverridesLoaded();
  sessionOverrideCache.set(scopeKey, sessionId);
  await persistSessionOverrides();
}

async function appendDiscordEventLog(event: string, details?: Record<string, unknown>): Promise<void> {
  try {
    await fs.mkdir(path.dirname(DISCORD_EVENT_LOG_FILE), { recursive: true });
    const payload = JSON.stringify({
      time: new Date().toISOString(),
      event,
      ...(details ? details : {}),
    });
    await fs.appendFile(DISCORD_EVENT_LOG_FILE, `${payload}\n`, "utf8");
  } catch {
    // Logging must not break the request flow.
  }
}

function isAuthorizedInteraction(interaction: DiscordInteraction): boolean {
  if (!DISCORD_AUTH_REQUIRED) {
    return true;
  }
  const userId = getDiscordUser(interaction)?.id;
  const channelId = interaction.channel_id;
  const guildId = interaction.guild_id;

  return (
    (userId ? DISCORD_ALLOWED_USER_IDS.has(userId) : false) ||
    (channelId ? DISCORD_ALLOWED_CHANNEL_IDS.has(channelId) : false) ||
    (guildId ? DISCORD_ALLOWED_GUILD_IDS.has(guildId) : false)
  );
}

function getSessionModel(model?: string): SupportedModel {
  return isSupportedModel(model ?? "") ? model as SupportedModel : DEFAULT_MODEL;
}

function getSessionReasoning(reasoning?: string): SupportedReasoningEffort {
  return isSupportedReasoningEffort(reasoning ?? "")
    ? reasoning as SupportedReasoningEffort
    : DEFAULT_REASONING_EFFORT;
}

function formatReasoningListText(current: SupportedReasoningEffort): string {
  return [
    `현재 사고수준: ${current}`,
    `지원 목록: ${SUPPORTED_REASONING_EFFORTS.join(", ")}`,
  ].join("\n");
}

function buildWaitingText(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  return `작업 실행 중...\n경과: ${seconds}초`;
}

function formatProgressPreview(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= DISCORD_PROGRESS_PREVIEW_LIMIT) {
    return normalized;
  }
  return `${normalized.slice(0, DISCORD_PROGRESS_PREVIEW_LIMIT - 3)}...`;
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

async function downloadDiscordAttachment(
  attachment: DiscordAttachment,
): Promise<{ savedPath: string; fileName: string }> {
  const response = await fetch(attachment.url);
  if (!response.ok) {
    throw new Error(`Discord attachment download failed: HTTP ${response.status}`);
  }
  const content = Buffer.from(await response.arrayBuffer());
  const safeName = path.basename(attachment.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 12)}-${safeName}`;
  const savedPath = path.join(DISCORD_FILE_DOWNLOAD_DIR, uniqueName);
  await fs.mkdir(DISCORD_FILE_DOWNLOAD_DIR, { recursive: true });
  await fs.writeFile(savedPath, content);
  return { savedPath, fileName: safeName };
}

async function editDiscordOriginalResponse(
  applicationId: string,
  interactionToken: string,
  content: string,
): Promise<void> {
  const response = await fetch(
    `${DISCORD_API_BASE_URL}/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content } satisfies DiscordWebhookPayload),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Discord original response edit failed: HTTP ${response.status} ${detail}`.trim());
  }
}

async function sendDiscordFollowupMessage(
  applicationId: string,
  interactionToken: string,
  content: string,
): Promise<void> {
  const response = await fetch(
    `${DISCORD_API_BASE_URL}/webhooks/${applicationId}/${interactionToken}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content,
        flags: DISCORD_EPHEMERAL_FLAG,
      } satisfies DiscordWebhookPayload),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Discord followup failed: HTTP ${response.status} ${detail}`.trim());
  }
}

async function sendDiscordFinalText(
  applicationId: string,
  interactionToken: string,
  text: string,
): Promise<void> {
  const chunks = splitDiscordText(text);
  await editDiscordOriginalResponse(applicationId, interactionToken, chunks[0]);
  for (const chunk of chunks.slice(1)) {
    await sendDiscordFollowupMessage(applicationId, interactionToken, chunk);
  }
}

async function waitForJobAndUpdateDiscordResponse(
  applicationId: string,
  interactionToken: string,
  jobId: string,
): Promise<void> {
  const startedAt = Date.now();
  let lastProgressText = "";
  let lastProgressAt = 0;

  while (true) {
    const job = await getAgentJob(jobId);
    if (!job) {
      await sendDiscordFinalText(
        applicationId,
        interactionToken,
        "작업 정보를 찾지 못했습니다. /status 로 현재 세션을 확인해 주세요.",
      );
      return;
    }

    if (job.status === "completed") {
      await sendDiscordFinalText(
        applicationId,
        interactionToken,
        job.assistantText || "작업은 완료되었지만 응답 본문이 비어 있습니다.",
      );
      return;
    }

    if (job.status === "failed") {
      await sendDiscordFinalText(
        applicationId,
        interactionToken,
        job.error ? `요청 처리 실패: ${job.error}` : "요청 처리 실패",
      );
      return;
    }

    const now = Date.now();
    if (now - lastProgressAt >= DISCORD_PROGRESS_UPDATE_INTERVAL_MS) {
      const preview = formatProgressPreview(job.assistantText);
      const nextProgress = preview
        ? `${buildWaitingText(now - startedAt)}\n\n미리보기:\n${preview}`
        : buildWaitingText(now - startedAt);
      if (nextProgress !== lastProgressText) {
        await editDiscordOriginalResponse(applicationId, interactionToken, nextProgress);
        lastProgressText = nextProgress;
      }
      lastProgressAt = now;
    }

    await new Promise((resolve) => setTimeout(resolve, DISCORD_POLL_INTERVAL_MS));
  }
}

function formatStatusText(sessionId: string, session: Awaited<ReturnType<typeof loadSession>>): string {
  const title = session.title?.trim() || "(미설정)";
  const model = getSessionModel(session.model);
  const reasoning = getSessionReasoning(session.reasoningEffort);
  return [
    `세션: ${sessionId}`,
    `세션 제목: ${title}`,
    `모델: ${getModelLabel(model)} (${model})`,
    `사고수준: ${reasoning}`,
    `진행 작업: ${session.activeJobId || "없음"}`,
    `대화 메시지: ${session.messages.length}개`,
  ].join("\n");
}

async function handleStatusCommand(scopeKey: string): Promise<string> {
  const sessionId = await getSessionIdForScope(scopeKey);
  const session = await loadSession(sessionId);
  if (!session.activeJobId) {
    return `${formatStatusText(sessionId, session)}\n현재 진행 중인 작업이 없습니다.`;
  }
  const activeJob = await getAgentJob(session.activeJobId);
  if (!activeJob) {
    return `${formatStatusText(sessionId, session)}\n현재 작업 정보를 찾을 수 없습니다.`;
  }
  return [
    formatStatusText(sessionId, session),
    `작업 상태: ${activeJob.status}`,
    `작업 ID: ${activeJob.jobId}`,
    `업데이트: ${activeJob.updatedAt}`,
  ].join("\n");
}

async function handleJobsCommand(scopeKey: string, limit = 5): Promise<string> {
  const sessionId = await getSessionIdForScope(scopeKey);
  const jobs = (await listSessionJobs(sessionId)).slice(0, limit);
  if (jobs.length === 0) {
    return "최근 작업 이력이 없습니다.";
  }
  return [
    `최근 작업 ${jobs.length}개:`,
    ...jobs.map((job, index) => {
      const text = job.message.replace(/\s+/g, " ").trim();
      const preview = text.length > 60 ? `${text.slice(0, 57)}...` : text || "(빈 요청)";
      return `${index + 1}. ${job.jobId} | ${job.status} | ${preview}`;
    }),
  ].join("\n");
}

async function handleRecentCommand(scopeKey: string, count = 5): Promise<string> {
  const sessionId = await getSessionIdForScope(scopeKey);
  const session = await loadSession(sessionId);
  const messages = session.messages.slice(-Math.max(1, Math.min(count, 10)));
  if (messages.length === 0) {
    return "최근 대화가 없습니다.";
  }
  return [
    `최근 대화 ${messages.length}개:`,
    ...messages.map((message, index) => {
      const preview = message.content.replace(/\s+/g, " ").trim();
      const clipped = preview.length > 120 ? `${preview.slice(0, 117)}...` : preview;
      return `${index + 1}. [${message.role}] ${clipped}`;
    }),
  ].join("\n");
}

async function handleSessionCommand(scopeKey: string): Promise<string> {
  const sessionId = await getSessionIdForScope(scopeKey);
  const session = await loadSession(sessionId);
  const ownedSessions = (await listResumeSessions())
    .filter((item) => isResumeSessionVisibleToScope(scopeKey, item.sessionId))
    .slice(0, 8);
  return [
    formatStatusText(sessionId, session),
    "",
    "최근 세션:",
    ...(ownedSessions.length > 0
      ? ownedSessions.map((item, index) => {
          const label = item.title?.trim() || item.lastMessagePreview?.trim() || "대화 없음";
          const clipped = label.length > 50 ? `${label.slice(0, 47)}...` : label;
          const marker = item.sessionId === sessionId ? " [현재]" : "";
          return `${index + 1}. ${item.sessionId} | ${clipped}${marker}`;
        })
      : ["최근 세션 없음"]),
    "",
    "전환: /resume selector:<세션 ID 또는 번호>",
  ].join("\n");
}

async function handleResumeCommand(scopeKey: string, selector: string): Promise<string> {
  const currentSessionId = await getSessionIdForScope(scopeKey);
  const ownedSessions = (await listResumeSessions()).filter((item) =>
    isResumeSessionVisibleToScope(scopeKey, item.sessionId),
  );
  let targetSessionId = selector.trim();
  const asIndex = Number.parseInt(selector, 10);
  if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= ownedSessions.length) {
    targetSessionId = ownedSessions[asIndex - 1].sessionId;
  }

  const result: SessionSwitchResult = {
    found: false,
    switched: false,
    targetSessionId,
    message: "",
  };

  if (!isResumeSessionVisibleToScope(scopeKey, targetSessionId)) {
    result.message = `이 scope에서 사용할 수 없는 세션입니다: ${targetSessionId}`;
    return result.message;
  }

  try {
    await loadSession(targetSessionId);
  } catch (error) {
    result.message = error instanceof Error ? error.message : "세션을 열지 못했습니다.";
    return `세션 전환 실패: ${result.message}`;
  }

  result.found = true;
  result.switched = targetSessionId !== currentSessionId;
  await setSessionIdForScope(scopeKey, targetSessionId);

  if (!result.switched) {
    return `이미 현재 세션입니다.\n세션: ${targetSessionId}`;
  }

  return `세션을 전환했습니다.\n이전: ${currentSessionId}\n현재: ${targetSessionId}`;
}

async function handleNewCommand(scopeKey: string): Promise<string> {
  const nextSessionId = createDiscordSessionId(scopeKey);
  await setSessionIdForScope(scopeKey, nextSessionId);
  await loadSession(nextSessionId);
  return [
    "새 세션을 시작했습니다.",
    `세션 ID: ${nextSessionId}`,
    "이후 /run, /status, /model, /effort 는 새 세션 기준으로 동작합니다.",
  ].join("\n");
}

async function handleModelCommand(scopeKey: string, value?: string): Promise<string> {
  const sessionId = await getSessionIdForScope(scopeKey);
  const session = await loadSession(sessionId);
  const currentModel = getSessionModel(session.model);
  if (!value) {
    return [
      `현재 모델: ${getModelLabel(currentModel)} (${currentModel})`,
      `지원 모델: ${SUPPORTED_MODELS.join(", ")}`,
    ].join("\n");
  }
  if (!isSupportedModel(value)) {
    return `지원하지 않는 모델입니다.\n지원 모델: ${SUPPORTED_MODELS.join(", ")}`;
  }
  if (value === currentModel) {
    return `현재 모델이 이미 ${getModelLabel(currentModel)} (${currentModel})입니다.`;
  }
  await setSessionModel(sessionId, value, session.reasoningEffort);
  return `기본 모델을 ${getModelLabel(value)} (${value})로 변경했습니다.`;
}

async function handleEffortCommand(scopeKey: string, value?: string): Promise<string> {
  const sessionId = await getSessionIdForScope(scopeKey);
  const session = await loadSession(sessionId);
  const currentReasoning = getSessionReasoning(session.reasoningEffort);
  if (!value) {
    return formatReasoningListText(currentReasoning);
  }
  if (!isSupportedReasoningEffort(value)) {
    return `지원하지 않는 사고수준입니다.\n지원 목록: ${SUPPORTED_REASONING_EFFORTS.join(", ")}`;
  }
  if (value === currentReasoning) {
    return `현재 사고수준이 이미 ${currentReasoning}입니다.`;
  }
  await setSessionModel(sessionId, getSessionModel(session.model), value);
  return `사고수준을 ${value}로 변경했습니다.`;
}

async function handleCancelCommand(scopeKey: string): Promise<string> {
  const sessionId = await getSessionIdForScope(scopeKey);
  const canceled = await cancelSessionActiveJob(sessionId);
  if (!canceled.ok) {
    if (canceled.reason === "no-active-job") {
      return "현재 진행 중인 작업이 없습니다.";
    }
    if (canceled.reason === "job-already-finished") {
      return "현재 작업은 이미 종료되었습니다.";
    }
    return "작업 취소 대상이 없습니다.";
  }
  return `작업을 취소 처리했습니다. (${canceled.jobId})`;
}

async function runDiscordCommand(interaction: DiscordInteraction): Promise<void> {
  const scopeKey = toDiscordScopeKey(interaction);
  const sessionId = await getSessionIdForScope(scopeKey);
  const session = await loadSession(sessionId);
  const rawMessage = getDiscordOptionString(interaction, "message") || "";
  const attachment = getDiscordAttachment(interaction, "attachment");

  let downloadedAttachmentPath: string | null = null;
  try {
    if (attachment) {
      const downloaded = await downloadDiscordAttachment(attachment);
      downloadedAttachmentPath = downloaded.savedPath;
      await appendDiscordEventLog("discord.attachment_downloaded", {
        fileName: downloaded.fileName,
        size: attachment.size ?? null,
      });
    }

    const message = appendAttachmentContextToRunMessage(rawMessage, downloadedAttachmentPath);
    const validation = validateAgentRequest({
      sessionId,
      message,
      model: getSessionModel(session.model),
      reasoningEffort: getSessionReasoning(session.reasoningEffort),
      trace: false,
    });

    if (!validation.ok) {
      await sendDiscordFinalText(interaction.application_id, interaction.token, validation.reason);
      return;
    }

    const job = await createAgentJob({
      sessionId: validation.data.sessionId,
      message: validation.data.message,
      model: validation.data.model,
      reasoningEffort: validation.data.reasoningEffort,
      trace: false,
      source: "web",
    });
    await waitForJobAndUpdateDiscordResponse(interaction.application_id, interaction.token, job.jobId);
  } catch (error) {
    if (isActiveJobError(error)) {
      await sendDiscordFinalText(
        interaction.application_id,
        interaction.token,
        `현재 이 세션은 이미 처리 중인 작업이 있습니다. (${error.activeJobId})`,
      );
      return;
    }
    const message = error instanceof Error ? error.message : "작업 처리 실패";
    await sendDiscordFinalText(interaction.application_id, interaction.token, `요청 처리 실패: ${message}`);
  } finally {
    if (downloadedAttachmentPath) {
      try {
        await fs.unlink(downloadedAttachmentPath);
      } catch {
        // noop
      }
    }
  }
}

async function handleImmediateCommand(interaction: DiscordInteraction): Promise<string> {
  const scopeKey = toDiscordScopeKey(interaction);
  const commandName = interaction.data?.name;
  switch (commandName) {
    case "status":
      return handleStatusCommand(scopeKey);
    case "jobs":
      return handleJobsCommand(scopeKey, getDiscordOptionInteger(interaction, "limit") ?? 5);
    case "recent":
      return handleRecentCommand(scopeKey, getDiscordOptionInteger(interaction, "count") ?? 5);
    case "session":
      return handleSessionCommand(scopeKey);
    case "resume": {
      const selector = getDiscordOptionString(interaction, "selector");
      return selector ? handleResumeCommand(scopeKey, selector) : "selector 값이 필요합니다.";
    }
    case "new":
      return handleNewCommand(scopeKey);
    case "model":
      return handleModelCommand(scopeKey, getDiscordOptionString(interaction, "value"));
    case "effort":
      return handleEffortCommand(scopeKey, getDiscordOptionString(interaction, "value"));
    case "cancel":
      return handleCancelCommand(scopeKey);
    case "help":
      return formatDiscordCommandHelp();
    default:
      return [
        `지원하지 않는 명령입니다: ${commandName || "unknown"}`,
        formatDiscordCommandHelp(),
      ].join("\n\n");
  }
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    return Response.json({ error: "Missing Discord signature headers." }, { status: 401 });
  }

  try {
    if (!verifyDiscordSignature(rawBody, timestamp, signature)) {
      return Response.json({ error: "Invalid Discord signature." }, { status: 401 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "signature verification failed";
    console.error("[discord] signature verification failed", message);
    return Response.json({ error: "Discord signature verification failed." }, { status: 500 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody.toString("utf8")) as DiscordInteraction;
  } catch {
    return Response.json({ error: "Invalid Discord request payload." }, { status: 400 });
  }

  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

  if (interaction.type !== 2 || !interaction.data?.name) {
    return toDiscordInteractionResponse("지원하지 않는 Discord interaction 입니다.");
  }

  const user = getDiscordUser(interaction);
  await appendDiscordEventLog("discord.command.received", {
    command: interaction.data.name,
    userId: user?.id ?? null,
    userName: getDiscordDisplayName(user),
    guildId: interaction.guild_id ?? null,
    channelId: interaction.channel_id ?? null,
  });

  if (!isAuthorizedInteraction(interaction)) {
    return toDiscordInteractionResponse("이 Discord 사용자 또는 채널은 아직 허용되지 않았습니다.");
  }

  if (interaction.data.name === "run") {
    after(async () => {
      try {
        await runDiscordCommand(interaction);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown";
        await appendDiscordEventLog("discord.command.run_failed", {
          error: message,
          userId: user?.id ?? null,
        });
      }
    });
    return toDiscordDeferredResponse();
  }

  try {
    const content = await handleImmediateCommand(interaction);
    return toDiscordInteractionResponse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await appendDiscordEventLog("discord.command.error", {
      command: interaction.data.name,
      error: message,
      userId: user?.id ?? null,
    });
    return toDiscordInteractionResponse(`처리 중 오류가 발생했습니다.\n${message}`);
  }
}
