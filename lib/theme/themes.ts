export type ThemeId = "midnight" | "dawn" | "forest" | "dark";

type ThemeVariables = {
  "--theme-bg": string;
  "--theme-fg": string;
  "--theme-muted": string;
  "--theme-surface": string;
  "--theme-surface-soft": string;
  "--theme-border": string;
  "--theme-accent": string;
  "--theme-accent-fg": string;
  "--theme-glow-a": string;
  "--theme-glow-b": string;
  "--theme-status-success-border": string;
  "--theme-status-success-bg": string;
  "--theme-status-success-fg": string;
  "--theme-status-warning-border": string;
  "--theme-status-warning-bg": string;
  "--theme-status-warning-fg": string;
  "--theme-status-danger-border": string;
  "--theme-status-danger-bg": string;
  "--theme-status-danger-fg": string;
  "--theme-status-info-border": string;
  "--theme-status-info-bg": string;
  "--theme-status-info-fg": string;
};

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  variables: ThemeVariables;
}

export const THEME_STORAGE_KEY = "codexia-theme";
export const DEFAULT_THEME_ID: ThemeId = "midnight";

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "dawn",
    label: "Dawn",
    description: "밝은 톤의 라이트 테마",
    variables: {
      "--theme-bg": "#f8f6f2",
      "--theme-fg": "#1f2430",
      "--theme-muted": "#5f687d",
      "--theme-surface": "#ffffff",
      "--theme-surface-soft": "#f2ede3",
      "--theme-border": "#d8d1c2",
      "--theme-accent": "#ff8a5b",
      "--theme-accent-fg": "#3b1708",
      "--theme-glow-a": "rgba(255, 138, 91, 0.26)",
      "--theme-glow-b": "rgba(255, 214, 125, 0.24)",
      "--theme-status-success-border": "rgba(37, 99, 55, 0.28)",
      "--theme-status-success-bg": "rgba(46, 125, 50, 0.12)",
      "--theme-status-success-fg": "#1f6a31",
      "--theme-status-warning-border": "rgba(180, 83, 9, 0.28)",
      "--theme-status-warning-bg": "rgba(245, 158, 11, 0.16)",
      "--theme-status-warning-fg": "#9a4d00",
      "--theme-status-danger-border": "rgba(185, 28, 28, 0.24)",
      "--theme-status-danger-bg": "rgba(220, 38, 38, 0.12)",
      "--theme-status-danger-fg": "#a61b1b",
      "--theme-status-info-border": "rgba(37, 99, 235, 0.22)",
      "--theme-status-info-bg": "rgba(59, 130, 246, 0.12)",
      "--theme-status-info-fg": "#1d4ed8",
    },
  },
  {
    id: "dark",
    label: "Dark",
    description: "차콜 블랙 중심의 기본 다크 테마",
    variables: {
      "--theme-bg": "#121212",
      "--theme-fg": "#f1f1f1",
      "--theme-muted": "#a3a3a3",
      "--theme-surface": "#1b1b1b",
      "--theme-surface-soft": "#242424",
      "--theme-border": "#353535",
      "--theme-accent": "#9a9a9a",
      "--theme-accent-fg": "#111111",
      "--theme-glow-a": "rgba(154, 154, 154, 0.24)",
      "--theme-glow-b": "rgba(86, 86, 86, 0.22)",
      "--theme-status-success-border": "rgba(52, 211, 153, 0.34)",
      "--theme-status-success-bg": "rgba(16, 185, 129, 0.16)",
      "--theme-status-success-fg": "#b7f7da",
      "--theme-status-warning-border": "rgba(251, 191, 36, 0.34)",
      "--theme-status-warning-bg": "rgba(245, 158, 11, 0.16)",
      "--theme-status-warning-fg": "#fde7a3",
      "--theme-status-danger-border": "rgba(248, 113, 113, 0.34)",
      "--theme-status-danger-bg": "rgba(239, 68, 68, 0.16)",
      "--theme-status-danger-fg": "#fecaca",
      "--theme-status-info-border": "rgba(96, 165, 250, 0.34)",
      "--theme-status-info-bg": "rgba(59, 130, 246, 0.16)",
      "--theme-status-info-fg": "#cfe6ff",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "딥 블루 기반 집중 테마",
    variables: {
      "--theme-bg": "#090f1d",
      "--theme-fg": "#e6eefc",
      "--theme-muted": "#9fb2d6",
      "--theme-surface": "#111b2f",
      "--theme-surface-soft": "#16233d",
      "--theme-border": "#23375c",
      "--theme-accent": "#4ecdc4",
      "--theme-accent-fg": "#052522",
      "--theme-glow-a": "rgba(78, 205, 196, 0.28)",
      "--theme-glow-b": "rgba(111, 173, 255, 0.22)",
      "--theme-status-success-border": "rgba(52, 211, 153, 0.34)",
      "--theme-status-success-bg": "rgba(16, 185, 129, 0.14)",
      "--theme-status-success-fg": "#bcf7e0",
      "--theme-status-warning-border": "rgba(251, 191, 36, 0.34)",
      "--theme-status-warning-bg": "rgba(245, 158, 11, 0.14)",
      "--theme-status-warning-fg": "#ffe6a6",
      "--theme-status-danger-border": "rgba(248, 113, 113, 0.34)",
      "--theme-status-danger-bg": "rgba(239, 68, 68, 0.14)",
      "--theme-status-danger-fg": "#ffd0d0",
      "--theme-status-info-border": "rgba(96, 165, 250, 0.34)",
      "--theme-status-info-bg": "rgba(59, 130, 246, 0.14)",
      "--theme-status-info-fg": "#d6e8ff",
    },
  },
  {
    id: "forest",
    label: "Forest",
    description: "그린 계열의 편안한 테마",
    variables: {
      "--theme-bg": "#0d1a14",
      "--theme-fg": "#e8f7ef",
      "--theme-muted": "#9fc8b1",
      "--theme-surface": "#12251b",
      "--theme-surface-soft": "#173025",
      "--theme-border": "#2f5b43",
      "--theme-accent": "#8bd17c",
      "--theme-accent-fg": "#1b2b14",
      "--theme-glow-a": "rgba(139, 209, 124, 0.24)",
      "--theme-glow-b": "rgba(63, 155, 123, 0.2)",
      "--theme-status-success-border": "rgba(74, 222, 128, 0.32)",
      "--theme-status-success-bg": "rgba(34, 197, 94, 0.14)",
      "--theme-status-success-fg": "#d5f7d2",
      "--theme-status-warning-border": "rgba(250, 204, 21, 0.32)",
      "--theme-status-warning-bg": "rgba(234, 179, 8, 0.14)",
      "--theme-status-warning-fg": "#f7ebb5",
      "--theme-status-danger-border": "rgba(248, 113, 113, 0.32)",
      "--theme-status-danger-bg": "rgba(239, 68, 68, 0.14)",
      "--theme-status-danger-fg": "#ffd2d2",
      "--theme-status-info-border": "rgba(125, 211, 252, 0.32)",
      "--theme-status-info-bg": "rgba(14, 165, 233, 0.14)",
      "--theme-status-info-fg": "#d9f1ff",
    },
  },
];

export const THEME_MAP: Record<ThemeId, ThemeOption> = Object.fromEntries(
  THEME_OPTIONS.map((theme) => [theme.id, theme]),
) as Record<ThemeId, ThemeOption>;

const THEME_ID_SET = new Set<ThemeId>(THEME_OPTIONS.map((theme) => theme.id));

export function isThemeId(value: string): value is ThemeId {
  return THEME_ID_SET.has(value as ThemeId);
}
