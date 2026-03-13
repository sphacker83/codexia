export const SUPPORTED_MODELS = [
  "gpt-5.4",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];
export type ModelProvider = "codex" | "gemini";

export const DEFAULT_MODEL: SupportedModel = "gpt-5.4";
export const DEFAULT_MODEL_CONTEXT_LENGTH = 1_000_000;

const MODEL_LABELS: Record<SupportedModel, string> = {
  "gpt-5.4": "GPT-5.4",
  "gpt-5.3-codex": "GPT-5.3-Codex",
  "gpt-5.3-codex-spark": "GPT-5.3-Codex-Spark",
  "gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview",
  "gemini-3-flash-preview": "Gemini 3 Flash Preview",
};

const MODEL_CONTEXT_LENGTHS: Partial<Record<SupportedModel, number>> = {
  "gpt-5.4": 1_000_000,
  "gemini-3.1-pro-preview": 1_000_000,
  "gemini-3-flash-preview": 1_000_000,
};

const MODEL_PROVIDERS: Record<SupportedModel, ModelProvider> = {
  "gpt-5.4": "codex",
  "gpt-5.3-codex": "codex",
  "gpt-5.3-codex-spark": "codex",
  "gemini-3.1-pro-preview": "gemini",
  "gemini-3-flash-preview": "gemini",
};

export function isSupportedModel(model: string): model is SupportedModel {
  return (SUPPORTED_MODELS as readonly string[]).includes(model);
}

export function getModelProvider(model: string): ModelProvider {
  if (!isSupportedModel(model)) {
    return MODEL_PROVIDERS[DEFAULT_MODEL];
  }

  return MODEL_PROVIDERS[model];
}

export function modelSupportsReasoningEffort(model: string): boolean {
  return getModelProvider(model) === "codex";
}

export function getModelContextLength(model: string): number {
  if (!isSupportedModel(model)) {
    return DEFAULT_MODEL_CONTEXT_LENGTH;
  }

  return MODEL_CONTEXT_LENGTHS[model] ?? DEFAULT_MODEL_CONTEXT_LENGTH;
}

export function getModelLabel(model: string): string {
  if (!isSupportedModel(model)) {
    return model;
  }

  return MODEL_LABELS[model];
}
