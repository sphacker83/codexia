import { DEFAULT_MODEL_CONTEXT_LENGTH } from "./models";
import type { Message, Session } from "./types";

export const DEFAULT_SYSTEM_PROMPT = "당신은 개인 개발 AI 에이전트입니다.";
export const MAX_USER_MESSAGE_LENGTH = 20_000;
export const DEFAULT_CONTEXT_LENGTH_LIMIT = DEFAULT_MODEL_CONTEXT_LENGTH;
const MIN_DYNAMIC_CONTEXT_LENGTH_LIMIT = 6_000;
const CONTEXT_SHRINK_START_INPUT_LENGTH = 400;
const CONTEXT_SHRINK_FULL_INPUT_LENGTH = 4_000;
const MAX_DYNAMIC_CONTEXT_REDUCTION = 8_000;

type ContextBuilderErrorCode = "EMPTY_MESSAGE" | "INPUT_TOO_LONG";

export class ContextBuilderError extends Error {
  code: ContextBuilderErrorCode;

  constructor(code: ContextBuilderErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

interface BuildPromptOptions {
  session: Session;
  userMessage: string;
  systemPrompt?: string;
  maxContextLength?: number;
  disableDynamicContext?: boolean;
}

interface ComputePromptMetaOptions {
  messages: Message[];
  userMessage: string;
  systemPrompt?: string;
  maxContextLength?: number;
  disableDynamicContext?: boolean;
  allowEmptyUserMessage?: boolean;
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

function singleLine(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n/g, "\\n");
}

function wrapBlock(label: string, text: string): string {
  let start = `<<<${label}>>>`;
  let end = `<<<END_${label}>>>`;
  let suffix = 0;
  while (text.includes(start) || text.includes(end)) {
    suffix += 1;
    start = `<<<${label}_${suffix}>>>`;
    end = `<<<END_${label}_${suffix}>>>`;
  }
  return `${start}\n${text}\n${end}`;
}

function formatMessage(message: Message): string {
  return `[${message.role}] ${singleLine(message.content)}`;
}

interface TrimConversationResult {
  selectedMessages: Message[];
  consumedLength: number;
}

function trimConversation(messages: Message[], maxLength: number): TrimConversationResult {
  if (maxLength <= 0) {
    return {
      selectedMessages: [],
      consumedLength: 0,
    };
  }

  let totalLength = 0;
  const selected: Message[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const lineLength = formatMessage(message).length + 1;
    if (totalLength + lineLength > maxLength) {
      break;
    }
    selected.push(message);
    totalLength += lineLength;
  }

  return {
    selectedMessages: selected.reverse(),
    consumedLength: totalLength,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveDynamicContextLength(maxContextLength: number, userMessageLength: number): number {
  const requested = Math.max(MIN_DYNAMIC_CONTEXT_LENGTH_LIMIT, maxContextLength);
  const shrinkRatio = clamp(
    (userMessageLength - CONTEXT_SHRINK_START_INPUT_LENGTH) /
      (CONTEXT_SHRINK_FULL_INPUT_LENGTH - CONTEXT_SHRINK_START_INPUT_LENGTH),
    0,
    1,
  );
  const reducedBy = Math.round(MAX_DYNAMIC_CONTEXT_REDUCTION * shrinkRatio);
  return Math.max(MIN_DYNAMIC_CONTEXT_LENGTH_LIMIT, requested - reducedBy);
}

function normalizeUserMessage(userMessage: string, allowEmptyUserMessage = false): string {
  const trimmed = userMessage.trim();

  if (!allowEmptyUserMessage && !trimmed) {
    throw new ContextBuilderError("EMPTY_MESSAGE", "Message is required.");
  }

  if (trimmed.length > MAX_USER_MESSAGE_LENGTH) {
    throw new ContextBuilderError(
      "INPUT_TOO_LONG",
      `Message exceeds ${MAX_USER_MESSAGE_LENGTH} characters.`,
    );
  }

  return trimmed;
}

export function validateUserMessage(userMessage: string): string {
  return normalizeUserMessage(userMessage);
}

function resolvePromptBuildMeta({
  messages,
  userMessage,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  maxContextLength = DEFAULT_CONTEXT_LENGTH_LIMIT,
  disableDynamicContext = false,
  allowEmptyUserMessage = false,
}: ComputePromptMetaOptions): {
  validUserMessage: string;
  selectedMessages: Message[];
  meta: PromptBuildMeta;
} {
  const validUserMessage = normalizeUserMessage(userMessage, allowEmptyUserMessage);
  const appliedContextLength = disableDynamicContext
    ? Math.max(MIN_DYNAMIC_CONTEXT_LENGTH_LIMIT, maxContextLength)
    : resolveDynamicContextLength(maxContextLength, validUserMessage.length);
  const fixedLength = systemPrompt.length + validUserMessage.length + 32;
  const conversationBudget = Math.max(0, appliedContextLength - fixedLength);
  const { selectedMessages, consumedLength } = trimConversation(messages, conversationBudget);

  return {
    validUserMessage,
    selectedMessages,
    meta: {
      requestedContextLength: maxContextLength,
      appliedContextLength,
      fixedLength,
      conversationBudget,
      conversationConsumedLength: consumedLength,
      selectedMessageCount: selectedMessages.length,
      droppedMessageCount: Math.max(0, messages.length - selectedMessages.length),
      promptLength: 0,
    },
  };
}

export function computePromptBuildMeta(options: ComputePromptMetaOptions): PromptBuildMeta {
  const { meta, selectedMessages, validUserMessage } = resolvePromptBuildMeta(options);
  const conversationText =
    selectedMessages.length > 0
      ? selectedMessages.map((message) => formatMessage(message)).join("\n")
      : "(이전 대화 없음)";
  const prompt = `System: ${options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT}
Conversation:
${wrapBlock("CONVERSATION", conversationText)}
User:
${wrapBlock("USER_MESSAGE", validUserMessage)}`;

  return {
    ...meta,
    promptLength: prompt.length,
  };
}

export function buildPromptWithMeta({
  session,
  userMessage,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  maxContextLength = DEFAULT_CONTEXT_LENGTH_LIMIT,
  disableDynamicContext = false,
}: BuildPromptOptions): { prompt: string; meta: PromptBuildMeta } {
  const { validUserMessage, selectedMessages, meta } = resolvePromptBuildMeta({
    messages: session.messages,
    userMessage,
    systemPrompt,
    maxContextLength,
    disableDynamicContext,
  });
  const conversationText =
    selectedMessages.length > 0
      ? selectedMessages.map((message) => formatMessage(message)).join("\n")
      : "(이전 대화 없음)";

  const prompt = `System: ${systemPrompt}
Conversation:
${wrapBlock("CONVERSATION", conversationText)}
User:
${wrapBlock("USER_MESSAGE", validUserMessage)}`;

  return {
    prompt,
    meta: {
      ...meta,
      promptLength: prompt.length,
    },
  };
}

export function buildPrompt(options: BuildPromptOptions): string {
  return buildPromptWithMeta(options).prompt;
}
