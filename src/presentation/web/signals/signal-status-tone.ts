export type SignalStatusTone = "success" | "warning" | "danger" | "info";

export function getSignalStatusToneClasses(tone: SignalStatusTone): string {
  switch (tone) {
    case "success":
      return [
        "border-[var(--theme-status-success-border)]",
        "bg-[var(--theme-status-success-bg)]",
        "text-[var(--theme-status-success-fg)]",
      ].join(" ");
    case "warning":
      return [
        "border-[var(--theme-status-warning-border)]",
        "bg-[var(--theme-status-warning-bg)]",
        "text-[var(--theme-status-warning-fg)]",
      ].join(" ");
    case "danger":
      return [
        "border-[var(--theme-status-danger-border)]",
        "bg-[var(--theme-status-danger-bg)]",
        "text-[var(--theme-status-danger-fg)]",
      ].join(" ");
    case "info":
    default:
      return [
        "border-[var(--theme-status-info-border)]",
        "bg-[var(--theme-status-info-bg)]",
        "text-[var(--theme-status-info-fg)]",
      ].join(" ");
  }
}
