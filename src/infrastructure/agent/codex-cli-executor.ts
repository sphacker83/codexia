import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { Readable } from "node:stream";

import { getAgentWorkspaceRoot } from "@/src/core/workspace/policy";

export const DEFAULT_CODEX_TIMEOUT_MS = 300_000;
const FIXED_CODEX_PATHS = [
  "/Users/ethan/.bun/bin/codex",
  "/Users/ethan/.npm-global/bin/codex",
  "/opt/homebrew/bin/codex",
  "/usr/local/bin/codex",
] as const;
const FIXED_CODEX_BASE_ARGS: readonly string[] = ["exec", "--skip-git-repo-check"];

type CodexRunnerErrorCode =
  | "FIXED_PATH_NOT_FOUND"
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

export function getFixedCodexPath(): string {
  const detectedPath = FIXED_CODEX_PATHS.find((path) => existsSync(path));
  if (!detectedPath) {
    throw new CodexRunnerError(
      "FIXED_PATH_NOT_FOUND",
      "Codex executable not found in fixed paths.",
      FIXED_CODEX_PATHS.join(", "),
    );
  }
  return detectedPath;
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
  const commandPath = getFixedCodexPath();
  const workspaceRoot = getAgentWorkspaceRoot();
  const child = spawn(commandPath, buildCodexArgs(model, reasoningEffort, jsonOutput), {
    cwd: workspaceRoot,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
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
