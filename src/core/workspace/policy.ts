import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const AGENT_WORKSPACE_ROOT_ENV = "AGENT_WORKSPACE_ROOT";
const AGENT_PROTECTED_PATHS_ENV = "AGENT_PROTECTED_PATHS";
const AGENT_TELEGRAM_RESPONSE_STYLE_ENABLED_ENV = "AGENT_TELEGRAM_RESPONSE_STYLE_ENABLED";
const AGENT_TELEGRAM_RESPONSE_STYLE_FILE_ENV = "AGENT_TELEGRAM_RESPONSE_STYLE_FILE";
const AGENT_TELEGRAM_RESPONSE_STYLE_PROMPT_ENV = "AGENT_TELEGRAM_RESPONSE_STYLE_PROMPT";
const DEFAULT_TELEGRAM_RESPONSE_STYLE_FILE = path.resolve(
  process.cwd(),
  "config/telegram-response-style.txt",
);

export type AgentPromptChannel = "web" | "telegram";

interface AgentSystemPromptOptions {
  channel?: AgentPromptChannel;
}

const CORE_APPROVAL_REQUIRED_RELATIVE_PATHS = ["src/core"] as const;

export function getAgentWorkspaceRoot(): string {
  const configured = process.env[AGENT_WORKSPACE_ROOT_ENV]?.trim();
  if (!configured) {
    return process.cwd();
  }

  const resolved = path.resolve(configured);
  if (!existsSync(resolved)) {
    throw new Error(
      `${AGENT_WORKSPACE_ROOT_ENV} 경로가 존재하지 않습니다: ${resolved}`,
    );
  }

  const stat = statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(
      `${AGENT_WORKSPACE_ROOT_ENV} 경로가 디렉터리가 아닙니다: ${resolved}`,
    );
  }

  return resolved;
}

function resolveWorkspacePath(workspaceRoot: string, targetPath: string): string {
  const trimmed = targetPath.trim();
  if (!trimmed) {
    return workspaceRoot;
  }

  return path.isAbsolute(trimmed)
    ? path.normalize(trimmed)
    : path.resolve(workspaceRoot, trimmed);
}

function isWithinWorkspaceRoot(workspaceRoot: string, targetPath: string): boolean {
  const relative = path.relative(workspaceRoot, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isSameOrNestedPath(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(parentPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function splitProtectedPathEntries(raw: string): string[] {
  return raw
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toWorkspaceLabel(workspaceRoot: string, targetPath: string): string {
  const relative = path.relative(workspaceRoot, targetPath);
  if (!relative) {
    return ".";
  }
  return relative.replaceAll(path.sep, "/");
}

export function getAgentProtectedPaths(): string[] {
  const configured = process.env[AGENT_PROTECTED_PATHS_ENV]?.trim();
  if (!configured) {
    return [];
  }

  const workspaceRoot = getAgentWorkspaceRoot();
  const unique = new Set<string>();

  for (const entry of splitProtectedPathEntries(configured)) {
    const resolved = resolveWorkspacePath(workspaceRoot, entry);
    if (!isWithinWorkspaceRoot(workspaceRoot, resolved)) {
      continue;
    }
    unique.add(resolved);
  }

  return [...unique].sort((left, right) => left.localeCompare(right, "ko"));
}

export function getAgentProtectedPathLabels(): string[] {
  const workspaceRoot = getAgentWorkspaceRoot();

  return getAgentProtectedPaths().map((protectedPath) => {
    return toWorkspaceLabel(workspaceRoot, protectedPath);
  });
}

export function isAgentProtectedPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return getAgentProtectedPaths().some((protectedPath) =>
    isSameOrNestedPath(protectedPath, resolved),
  );
}

export function getAgentApprovalRequiredPaths(): string[] {
  const workspaceRoot = getAgentWorkspaceRoot();
  const unique = new Set<string>();

  for (const relativePath of CORE_APPROVAL_REQUIRED_RELATIVE_PATHS) {
    const resolved = resolveWorkspacePath(workspaceRoot, relativePath);
    if (!isWithinWorkspaceRoot(workspaceRoot, resolved)) {
      continue;
    }
    unique.add(resolved);
  }

  return [...unique].sort((left, right) => left.localeCompare(right, "ko"));
}

export function getAgentApprovalRequiredPathLabels(): string[] {
  const workspaceRoot = getAgentWorkspaceRoot();
  return getAgentApprovalRequiredPaths().map((approvalPath) =>
    toWorkspaceLabel(workspaceRoot, approvalPath),
  );
}

export function isAgentApprovalRequiredPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return getAgentApprovalRequiredPaths().some((approvalPath) =>
    isSameOrNestedPath(approvalPath, resolved),
  );
}

function isTelegramResponseStyleEnabled(): boolean {
  return process.env[AGENT_TELEGRAM_RESPONSE_STYLE_ENABLED_ENV] !== "0";
}

function readTextFileIfExists(filePath: string): string | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  const content = readFileSync(filePath, "utf8").trim();
  return content || undefined;
}

function resolveOptionalConfigPath(
  configuredPath: string | undefined,
  defaultPath: string,
): string {
  return configuredPath?.trim() ? path.resolve(process.cwd(), configuredPath) : defaultPath;
}

function readTelegramResponseStyleInstructionPrompt(): string | undefined {
  const configuredPath = resolveOptionalConfigPath(
    process.env[AGENT_TELEGRAM_RESPONSE_STYLE_FILE_ENV],
    DEFAULT_TELEGRAM_RESPONSE_STYLE_FILE,
  );
  return readTextFileIfExists(configuredPath);
}

function getTelegramResponseStylePrompt(): string | undefined {
  const inlinePrompt = process.env[AGENT_TELEGRAM_RESPONSE_STYLE_PROMPT_ENV]?.trim();
  if (inlinePrompt) {
    return inlinePrompt;
  }

  const instructionPrompt = readTelegramResponseStyleInstructionPrompt();

  if (instructionPrompt) {
    return instructionPrompt;
  }

  return undefined;
}

export function getAgentSystemPrompt(
  basePrompt: string,
  options: AgentSystemPromptOptions = {},
): string {
  const sections = [basePrompt];
  const protectedPathLabels = getAgentProtectedPathLabels();
  const approvalRequiredPathLabels = getAgentApprovalRequiredPathLabels();

  if (protectedPathLabels.length > 0) {
    sections.push(
      [
        "다음 경로는 불가침 영역입니다.",
        "사용자가 요청하더라도 읽기, 검색, 수정, 삭제, 이동, 목록 조회, 메타데이터 확인을 포함한 어떤 접근도 하지 마세요.",
        ...protectedPathLabels.map((label) => `- ${label}`),
        "가능한 경우 불가침 경로를 제외한 다른 위치에서만 작업하세요.",
      ].join("\n"),
    );
  }

  if (approvalRequiredPathLabels.length > 0) {
    sections.push(
      [
        "다음 경로는 코어 영역입니다.",
        "현재 대화에서 사용자가 이 경로 변경을 명시적으로 허락한 경우에만 수정, 삭제, 이동하세요.",
        "허락이 없다면 읽기와 분석은 가능하지만 변경 작업은 하지 마세요.",
        ...approvalRequiredPathLabels.map((label) => `- ${label}`),
      ].join("\n"),
    );
  }

  if (options.channel === "telegram" && isTelegramResponseStyleEnabled()) {
    const telegramResponseStylePrompt = getTelegramResponseStylePrompt();
    if (telegramResponseStylePrompt) {
      sections.push(telegramResponseStylePrompt);
    }
  }

  return sections.join("\n\n");
}
