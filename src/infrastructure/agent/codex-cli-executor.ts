import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { getAgentWorkspaceRoot } from "@/src/core/workspace/policy";

export const DEFAULT_CODEX_TIMEOUT_MS = 300_000;
const isWindows = process.platform === "win32";
const CODEX_EXECUTABLE_ENV_KEYS = ["CODEX_CLI_PATH", "CODEX_PATH"] as const;
const LEGACY_FIXED_CODEX_PATHS = [
  "/Users/ethan/.bun/bin/codex",
  "/Users/ethan/.npm-global/bin/codex",
  "/opt/homebrew/bin/codex",
  "/usr/local/bin/codex",
] as const;
const FIXED_CODEX_BASE_ARGS: readonly string[] = [
  "exec",
  "--skip-git-repo-check",
  "--sandbox",
  "danger-full-access",
];

type CodexRunnerErrorCode =
  | "COMMAND_NOT_FOUND"
  | "SPAWN_FAILED"
  | "STDOUT_MISSING"
  | "STDIN_WRITE_FAILED"
  | "TIMED_OUT"
  | "PROCESS_EXIT_NON_ZERO";

export class CodexRunnerError extends Error {
  code: CodexRunnerErrorCode;
  detail?: string;

  constructor(code: CodexRunnerErrorCode, message: string, detail?: string) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

export interface RunCodexOptions {
  prompt: string;
  timeoutMs?: number;
  model?: string;
  reasoningEffort?: string;
  jsonOutput?: boolean;
}

export interface RunCodexResult {
  stream: ReadableStream<Uint8Array>;
  completed: Promise<void>;
  commandPath: string;
  workspaceRoot: string;
  cancel: () => void;
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

function getPlatformCommandNames(commandName = "codex"): string[] {
  if (!isWindows) {
    return [commandName];
  }

  const hasExtension = /\.[a-z0-9]+$/i.test(commandName);
  if (hasExtension) {
    return [commandName];
  }

  return [`${commandName}.exe`, `${commandName}.cmd`, `${commandName}.bat`];
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

function resolveCodexCommandCandidate(candidate: string): string | null {
  const normalizedCandidate = trimWrappingQuotes(candidate);
  if (!normalizedCandidate) {
    return null;
  }

  if (looksLikePath(normalizedCandidate)) {
    return resolvePathCommand(normalizedCandidate);
  }

  return resolveCommandFromPath(normalizedCandidate);
}

function getLegacyFixedCodexPaths(): string[] {
  const windowsFallbacks = isWindows
    ? [
        process.env.APPDATA ? path.join(process.env.APPDATA, "npm", "codex.cmd") : undefined,
        process.env.APPDATA ? path.join(process.env.APPDATA, "npm", "codex.exe") : undefined,
      ]
    : [];

  return uniqueNonEmpty([...windowsFallbacks, ...LEGACY_FIXED_CODEX_PATHS]);
}

export function getCodexCommandPath(): string {
  const envOverrideCandidates = uniqueNonEmpty(
    CODEX_EXECUTABLE_ENV_KEYS.map((key) => process.env[key]),
  );
  for (const candidate of envOverrideCandidates) {
    const detectedPath = resolveCodexCommandCandidate(candidate);
    if (detectedPath) {
      return detectedPath;
    }
  }

  const pathCandidate = resolveCommandFromPath("codex");
  if (pathCandidate) {
    return pathCandidate;
  }

  for (const candidate of getLegacyFixedCodexPaths()) {
    const detectedPath = resolveCodexCommandCandidate(candidate);
    if (detectedPath) {
      return detectedPath;
    }
  }

  const searchDetail = [
    `env(${CODEX_EXECUTABLE_ENV_KEYS.join(", ")})`,
    `PATH(${getPlatformCommandNames("codex").join(", ")})`,
    ...getLegacyFixedCodexPaths(),
  ].join(", ");

  throw new CodexRunnerError(
    "COMMAND_NOT_FOUND",
    "Codex executable not found.",
    searchDetail,
  );
}

function createReadableStreamFromStdout(stdout: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stdout) as ReadableStream<Uint8Array>;
}

function buildCodexArgs(model?: string, reasoningEffort?: string, jsonOutput?: boolean): string[] {
  const args = [...FIXED_CODEX_BASE_ARGS];
  if (model && model.trim()) {
    args.push("-m", model.trim());
  }
  if (reasoningEffort && reasoningEffort.trim()) {
    args.push("-c", `model_reasoning_effort="${reasoningEffort.trim()}"`);
  }
  if (jsonOutput) {
    args.push("--json");
  }
  args.push("-");
  return args;
}

export function runCodex({
  prompt,
  timeoutMs = DEFAULT_CODEX_TIMEOUT_MS,
  model,
  reasoningEffort,
  jsonOutput,
}: RunCodexOptions): RunCodexResult {
  const commandPath = getCodexCommandPath();
  const workspaceRoot = getAgentWorkspaceRoot();
  const child = spawn(commandPath, buildCodexArgs(model, reasoningEffort, jsonOutput), {
    cwd: workspaceRoot,
    stdio: ["pipe", "pipe", "pipe"],
    shell: isWindows && /\.(cmd|bat)$/i.test(commandPath),
  });

  if (!child.stdout) {
    throw new CodexRunnerError("STDOUT_MISSING", "Codex stdout stream is unavailable.");
  }

  let timedOut = false;
  let stderrBuffer = "";
  child.stderr?.on("data", (chunk) => {
    stderrBuffer += chunk.toString();
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, timeoutMs);

  const processDone = new Promise<void>((resolve, reject) => {
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(
        new CodexRunnerError(
          "SPAWN_FAILED",
          "Failed to spawn Codex process.",
          error instanceof Error ? error.message : String(error),
        ),
      );
    });

    child.once("close", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
        reject(
          new CodexRunnerError(
            "TIMED_OUT",
            `Codex process timed out after ${timeoutSeconds} seconds.`,
          ),
        );
        return;
      }

      if (code !== 0) {
        reject(
          new CodexRunnerError(
            "PROCESS_EXIT_NON_ZERO",
            `Codex process exited with code ${code}.`,
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
      reject(new CodexRunnerError("STDIN_WRITE_FAILED", "Codex stdin stream is unavailable."));
      return;
    }

    child.stdin.write(prompt, (error) => {
      if (error) {
        child.kill("SIGKILL");
        reject(
          new CodexRunnerError(
            "STDIN_WRITE_FAILED",
            "Failed to write prompt to Codex stdin.",
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
    cancel: () => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    },
  };
}

export function isCodexRunnerError(error: unknown): error is CodexRunnerError {
  return error instanceof CodexRunnerError;
}
