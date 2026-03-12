import { MAX_USER_MESSAGE_LENGTH } from "@/src/core/agent/prompt-builder";
import { DEFAULT_MODEL, isSupportedModel } from "@/src/core/agent/models";
import {
  DEFAULT_REASONING_EFFORT,
  isSupportedReasoningEffort,
} from "@/src/core/agent/reasoning";
import type { AgentRequest } from "@/src/core/agent/types";

export interface ValidatedAgentRequest extends AgentRequest {
  model: string;
  reasoningEffort: string;
  trace: boolean;
}

export type ValidationResult =
  | { ok: true; data: ValidatedAgentRequest }
  | { ok: false; reason: string; status: number };

export function validateAgentRequest(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "Request body must be a JSON object.", status: 400 };
  }

  const body = payload as Partial<AgentRequest>;
  if (typeof body.sessionId !== "string" || body.sessionId.trim().length === 0) {
    return { ok: false, reason: "sessionId is required.", status: 400 };
  }

  const sessionId = body.sessionId.trim();
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(sessionId)) {
    return { ok: false, reason: "sessionId format is invalid.", status: 400 };
  }

  if (typeof body.message !== "string" || body.message.trim().length === 0) {
    return { ok: false, reason: "message is required.", status: 400 };
  }

  if (body.message.trim().length > MAX_USER_MESSAGE_LENGTH) {
    return {
      ok: false,
      reason: `message exceeds ${MAX_USER_MESSAGE_LENGTH.toLocaleString()} characters.`,
      status: 400,
    };
  }

  const model =
    typeof body.model === "string" && body.model.trim().length > 0
      ? body.model.trim()
      : DEFAULT_MODEL;
  const reasoningEffort =
    typeof body.reasoningEffort === "string" && body.reasoningEffort.trim().length > 0
      ? body.reasoningEffort.trim()
      : DEFAULT_REASONING_EFFORT;

  if (!isSupportedModel(model)) {
    return { ok: false, reason: "지원하지 않는 모델입니다.", status: 400 };
  }

  if (!isSupportedReasoningEffort(reasoningEffort)) {
    return { ok: false, reason: "지원하지 않는 사고수준입니다.", status: 400 };
  }

  return {
    ok: true,
    data: {
      sessionId,
      message: body.message.trim(),
      model,
      reasoningEffort,
      trace: body.trace === true,
    },
  };
}

export function createAgentErrorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
