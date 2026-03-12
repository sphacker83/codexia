export const SUPPORTED_MODELS = [
  "gpt-5.4",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gpt-5.2-codex",
  "gpt-5.2",
  "gpt-5.1-codex-max",
  "gpt-5.1-codex-mini",
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

export const DEFAULT_MODEL: SupportedModel = "gpt-5.4";
export const DEFAULT_MODEL_CONTEXT_LENGTH = 16_000;

const MODEL_LABELS: Record<SupportedModel, string> = {
  "gpt-5.4": "GPT-5.4",
  "gpt-5.3-codex": "GPT-5.3-Codex",
  "gpt-5.3-codex-spark": "GPT-5.3-Codex-Spark",
  "gpt-5.2-codex": "GPT-5.2-Codex",
  "gpt-5.2": "GPT-5.2",
  "gpt-5.1-codex-max": "GPT-5.1-Codex-Max",
  "gpt-5.1-codex-mini": "GPT-5.1-Codex-Mini",
};

const MODEL_CONTEXT_LENGTHS: Partial<Record<SupportedModel, number>> = {
  "gpt-5.4": 1_000_000,
};

export function isSupportedModel(model: string): model is SupportedModel {
  return (SUPPORTED_MODELS as readonly string[]).includes(model);
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
