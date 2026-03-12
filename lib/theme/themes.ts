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
