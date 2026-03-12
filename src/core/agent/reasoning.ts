export const SUPPORTED_REASONING_EFFORTS = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export type SupportedReasoningEffort = (typeof SUPPORTED_REASONING_EFFORTS)[number];

export const DEFAULT_REASONING_EFFORT: SupportedReasoningEffort = "medium";

export function isSupportedReasoningEffort(
  reasoningEffort: string,
): reasoningEffort is SupportedReasoningEffort {
  return (SUPPORTED_REASONING_EFFORTS as readonly string[]).includes(reasoningEffort);
}
