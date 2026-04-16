import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import {
  getModelProvider,
  type ModelProvider,
} from "@/src/core/agent/models";
import { getAgentWorkspaceRoot } from "@/src/core/workspace/policy";

export const DEFAULT_CLI_TIMEOUT_MS = 900_000;
export const DEFAULT_CODEX_TIMEOUT_MS = DEFAULT_CLI_TIMEOUT_MS;

const isWindows = process.platform === "win32";
const userHomeDirectory = os.homedir();
const FIXED_CODEX_BASE_ARGS: readonly string[] = [
  // Match the user's `cdx` alias behavior inside app-managed Codex launches.
  "--dangerously-bypass-approvals-and-sandbox",
  "--skip-git-repo-check",
];

type AgentCliRunnerErrorCode =
  | "COMMAND_NOT_FOUND"
  | "SPAWN_FAILED"
  | "STDOUT_MISSING"
  | "STDIN_WRITE_FAILED"
  | "TIMED_OUT"
  | "PROCESS_EXIT_NON_ZERO";

interface BuildCliArgsInput {
  model?: string;
  reasoningEffort?: string;
  jsonOutput?: boolean;
  sessionId?: string;
}

interface RunnerConfig {
  runner: ModelProvider;
  displayName: string;
  commandName: string;
  envKeys: readonly string[];
  legacyFixedPaths: readonly string[];
  buildArgs: (input: BuildCliArgsInput) => string[];
  buildEnv?: (input: BuildCliArgsInput) => Partial<NodeJS.ProcessEnv>;
}

export class AgentCliRunnerError extends Error {
  code: AgentCliRunnerErrorCode;
  detail?: string;
  runner: ModelProvider;

  constructor(
    runner: ModelProvider,
    code: AgentCliRunnerErrorCode,
    message: string,
    detail?: string,
  ) {
    super(message);
    this.code = code;
    this.detail = detail;
    this.runner = runner;
  }
}

export type CodexRunnerError = AgentCliRunnerError;

export interface RunAgentCliOptions {
  prompt: string;
  timeoutMs?: number;
  model?: string;
  reasoningEffort?: string;
  jsonOutput?: boolean;
  sessionId?: string;
  workingDirectory?: string;
}

export type RunCodexOptions = RunAgentCliOptions;

export interface RunAgentCliResult {
  stream: ReadableStream<Uint8Array>;
  completed: Promise<void>;
  commandPath: string;
  workspaceRoot: string;
  runner: ModelProvider;
  cancel: () => void;
}

export type RunCodexResult = RunAgentCliResult;

function normalizeTimeoutMs(timeoutMs: number): number | null {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    return DEFAULT_CLI_TIMEOUT_MS;
  }
  if (timeoutMs === 0) {
    return null;
  }
  return Math.floor(timeoutMs);
}

function readCliTimeoutMsFromEnv(): number | undefined {
  const raw = process.env.AGENT_CLI_TIMEOUT_MS?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_CLI_TIMEOUT_MS;
}

export function resolveAgentCliTimeoutMs(timeoutMs?: number): number | null {
  if (typeof timeoutMs === "number") {
    return normalizeTimeoutMs(timeoutMs);
  }
  const envTimeoutMs = readCliTimeoutMsFromEnv();
  return normalizeTimeoutMs(envTimeoutMs ?? DEFAULT_CLI_TIMEOUT_MS);
}

function uniqueNonEmpty(values: ReadonlyArray<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function trimWrappingQuotes(value: string): string {
  return value.trim().replace(/^['"]+|['"]+$/g, "");
}

function looksLikePath(value: string): boolean {
  return value.includes("/") || value.includes("\\") || path.isAbsolute(value);
}

function getPlatformCommandNames(commandName: string): string[] {
  if (!isWindows) {
    return [commandName];
  }

  const hasExtension = /\.[a-z0-9]+$/i.test(commandName);
  if (hasExtension) {
    return [commandName];
  }

  return [`${commandName}.exe`, `${commandName}.cmd`, `${commandName}.bat`];
}

function getDefaultCommandFallbacks(commandName: string): string[] {
  const windowsFallbacks = isWindows
    ? [
        process.env.APPDATA ? path.join(process.env.APPDATA, "npm", commandName) : undefined,
        process.env.APPDATA ? path.join(process.env.APPDATA, "npm", `${commandName}.cmd`) : undefined,
        process.env.APPDATA ? path.join(process.env.APPDATA, "npm", `${commandName}.exe`) : undefined,
        process.env.APPDATA ? path.join(process.env.APPDATA, "npm", `${commandName}.bat`) : undefined,
      ]
    : [];

  const userFallbacks = uniqueNonEmpty([
    userHomeDirectory ? path.join(userHomeDirectory, ".bun", "bin", commandName) : undefined,
    userHomeDirectory ? path.join(userHomeDirectory, ".npm-global", "bin", commandName) : undefined,
    userHomeDirectory ? path.join(userHomeDirectory, ".local", "bin", commandName) : undefined,
    path.join("/opt/homebrew/bin", commandName),
    path.join("/usr/local/bin", commandName),
    path.join("/usr/bin", commandName),
  ]);

  return uniqueNonEmpty([...windowsFallbacks, ...userFallbacks]);
}

function resolvePathCommand(commandPath: string): string | null {
  const normalizedPath = trimWrappingQuotes(commandPath);
  return normalizedPath && existsSync(normalizedPath) ? normalizedPath : null;
}

function resolveCommandFromPath(commandName: string): string | null {
  const normalizedName = trimWrappingQuotes(commandName);
  if (!normalizedName) {
    return null;
  }

  const pathEntries = (process.env.PATH || "")
    .split(path.delimiter)
    .map((entry) => trimWrappingQuotes(entry))
    .filter(Boolean);

  for (const entry of pathEntries) {
    for (const name of getPlatformCommandNames(normalizedName)) {
      const candidatePath = path.join(entry, name);
      if (existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

function resolveCommandCandidate(candidate: string): string | null {
  const normalizedCandidate = trimWrappingQuotes(candidate);
  if (!normalizedCandidate) {
    return null;
  }

  if (looksLikePath(normalizedCandidate)) {
    return resolvePathCommand(normalizedCandidate);
  }

  return resolveCommandFromPath(normalizedCandidate);
}

function buildCodexArgs({
  model,
  reasoningEffort,
  jsonOutput,
  sessionId,
}: BuildCliArgsInput): string[] {
  const args = sessionId ? ["exec", "resume", ...FIXED_CODEX_BASE_ARGS] : ["exec", ...FIXED_CODEX_BASE_ARGS];
  if (model && model.trim()) {
    args.push("-m", model.trim());
  }
  if (reasoningEffort && reasoningEffort.trim()) {
    args.push("-c", `model_reasoning_effort="${reasoningEffort.trim()}"`);
  }
  if (jsonOutput) {
    args.push("--json");
  }
  if (!sessionId) {
    args.push("--sandbox", "danger-full-access");
  }
  if (sessionId && sessionId.trim()) {
    args.push(sessionId.trim());
  }
  args.push("-");
  return args;
}

function buildGeminiArgs({ model, jsonOutput }: BuildCliArgsInput): string[] {
  const args = ["--approval-mode", "yolo", "--sandbox=false"];
  if (model && model.trim()) {
    args.push("--model", model.trim());
  }
  if (jsonOutput) {
    args.push("--output-format", "stream-json");
  }
  return args;
}

const RUNNER_CONFIGS: Record<ModelProvider, RunnerConfig> = {
  codex: {
    runner: "codex",
    displayName: "Codex",
    commandName: "codex",
    envKeys: ["CODEX_CLI_PATH", "CODEX_PATH"],
    legacyFixedPaths: getDefaultCommandFallbacks("codex"),
    buildArgs: buildCodexArgs,
    buildEnv: () => ({
      CODEX_SANDBOX_NETWORK_DISABLED: "0",
    }),
  },
  gemini: {
    runner: "gemini",
    displayName: "Gemini CLI",
    commandName: "gemini",
    envKeys: ["GEMINI_CLI_PATH", "GEMINI_PATH"],
    legacyFixedPaths: getDefaultCommandFallbacks("gemini"),
    buildArgs: buildGeminiArgs,
    buildEnv: () => ({
      GEMINI_SANDBOX: "false",
    }),
  },
};

function getRunnerConfig(model?: string): RunnerConfig {
  return RUNNER_CONFIGS[getModelProvider(model || "")];
}

function resolveRunnerCommandPath(config: RunnerConfig): string {
  const envOverrideCandidates = uniqueNonEmpty(
    config.envKeys.map((key) => process.env[key]),
  );
  for (const candidate of envOverrideCandidates) {
    const detectedPath = resolveCommandCandidate(candidate);
    if (detectedPath) {
      return detectedPath;
    }
  }

  const pathCandidate = resolveCommandFromPath(config.commandName);
  if (pathCandidate) {
    return pathCandidate;
  }

  for (const candidate of config.legacyFixedPaths) {
    const detectedPath = resolveCommandCandidate(candidate);
    if (detectedPath) {
      return detectedPath;
    }
  }

  const searchDetail = [
    `env(${config.envKeys.join(", ")})`,
    `PATH(${getPlatformCommandNames(config.commandName).join(", ")})`,
    ...config.legacyFixedPaths,
  ].join(", ");

  throw new AgentCliRunnerError(
    config.runner,
    "COMMAND_NOT_FOUND",
    `${config.displayName} executable not found.`,
    searchDetail,
  );
}

function createReadableStreamFromStdout(stdout: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stdout) as ReadableStream<Uint8Array>;
}

export function getCodexCommandPath(): string {
  return resolveRunnerCommandPath(RUNNER_CONFIGS.codex);
}

export function getGeminiCommandPath(): string {
  return resolveRunnerCommandPath(RUNNER_CONFIGS.gemini);
}

export function runAgentCli({
  prompt,
  timeoutMs,
  model,
  reasoningEffort,
  jsonOutput,
  sessionId,
  workingDirectory,
}: RunAgentCliOptions): RunAgentCliResult {
  const resolvedTimeoutMs = resolveAgentCliTimeoutMs(timeoutMs);
  const config = getRunnerConfig(model);
  const commandPath = resolveRunnerCommandPath(config);
  const workspaceRoot = getAgentWorkspaceRoot();
  const resolvedWorkingDirectory = (() => {
    if (!workingDirectory?.trim()) {
      return workspaceRoot;
    }

    const candidate = path.isAbsolute(workingDirectory)
      ? path.resolve(workingDirectory)
      : path.resolve(workspaceRoot, workingDirectory);
    const relative = path.relative(workspaceRoot, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AgentCliRunnerError(
        config.runner,
        "SPAWN_FAILED",
        `Working directory must stay within workspace root: ${workingDirectory}`,
      );
    }

    const stat = statSync(candidate, { throwIfNoEntry: false });
    if (!stat || !stat.isDirectory()) {
      throw new AgentCliRunnerError(
        config.runner,
        "SPAWN_FAILED",
        `Working directory does not exist: ${workingDirectory}`,
      );
    }

    return candidate;
  })();

  const child = spawn(
    commandPath,
    config.buildArgs({ model, reasoningEffort, jsonOutput, sessionId }),
    {
      cwd: resolvedWorkingDirectory,
      stdio: ["pipe", "pipe", "pipe"],
      shell: isWindows && /\.(cmd|bat)$/i.test(commandPath),
      env: {
        ...process.env,
        ...(config.buildEnv?.({ model, reasoningEffort, jsonOutput, sessionId }) ?? {}),
      },
    },
  );

  if (!child.stdout) {
    throw new AgentCliRunnerError(
      config.runner,
      "STDOUT_MISSING",
      `${config.displayName} stdout stream is unavailable.`,
    );
  }

  let timedOut = false;
  let stderrBuffer = "";
  child.stderr?.on("data", (chunk) => {
    stderrBuffer += chunk.toString();
  });

  const timeout = resolvedTimeoutMs === null
    ? null
    : setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, resolvedTimeoutMs);

  const processDone = new Promise<void>((resolve, reject) => {
    child.once("error", (error) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      reject(
        new AgentCliRunnerError(
          config.runner,
          "SPAWN_FAILED",
          `Failed to spawn ${config.displayName} process.`,
          error instanceof Error ? error.message : String(error),
        ),
      );
    });

    child.once("close", (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      if (timedOut) {
        const timeoutSeconds = Math.max(1, Math.ceil((resolvedTimeoutMs ?? DEFAULT_CLI_TIMEOUT_MS) / 1000));
        reject(
          new AgentCliRunnerError(
            config.runner,
            "TIMED_OUT",
            `${config.displayName} process timed out after ${timeoutSeconds} seconds.`,
          ),
        );
        return;
      }

      if (code !== 0) {
        reject(
          new AgentCliRunnerError(
            config.runner,
            "PROCESS_EXIT_NON_ZERO",
            `${config.displayName} process exited with code ${code}.`,
            stderrBuffer.trim(),
          ),
        );
        return;
      }

      resolve();
    });
  });

  const stdinDone = new Promise<void>((resolve, reject) => {
    if (!child.stdin) {
      reject(
        new AgentCliRunnerError(
          config.runner,
          "STDIN_WRITE_FAILED",
          `${config.displayName} stdin stream is unavailable.`,
        ),
      );
      return;
    }

    child.stdin.write(prompt, (error) => {
      if (error) {
        child.kill("SIGKILL");
        reject(
          new AgentCliRunnerError(
            config.runner,
            "STDIN_WRITE_FAILED",
            `Failed to write prompt to ${config.displayName} stdin.`,
            error.message,
          ),
        );
        return;
      }

      child.stdin.end();
      resolve();
    });
  });

  return {
    stream: createReadableStreamFromStdout(child.stdout),
    completed: Promise.all([stdinDone, processDone]).then(() => undefined),
    commandPath,
    workspaceRoot,
    runner: config.runner,
    cancel: () => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    },
  };
}

export function runCodex(options: RunCodexOptions): RunCodexResult {
  return runAgentCli(options);
}

export function isAgentCliRunnerError(error: unknown): error is AgentCliRunnerError {
  return error instanceof AgentCliRunnerError;
}

export function isCodexRunnerError(error: unknown): error is CodexRunnerError {
  return isAgentCliRunnerError(error);
}
