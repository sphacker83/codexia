#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

const childProcess = require("node:child_process") as typeof import("node:child_process");
const spawn = childProcess.spawn;
type ChildProcess = import("node:child_process").ChildProcess;

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";
const argv = new Set(process.argv.slice(2));
const shouldRunTelegram = !argv.has("--no-telegram");

const processes: ChildProcess[] = [];
let shuttingDown = false;
let forcedExitCode = 0;

function startProcess(name: string, args: string[]): ChildProcess {
  const proc = spawn(npmCmd, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  processes.push(proc);

  proc.on("error", (error) => {
    console.error(`[dev:telegram] ${name} start failed: ${error.message}`);
    requestShutdown(1);
  });

  proc.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      console.log(`[dev:telegram] ${name} stopped by signal: ${signal}`);
    }

    const nextCode = typeof code === "number" ? code : 1;
    console.log(`[dev:telegram] ${name} exited with code ${nextCode}`);
    requestShutdown(nextCode);
  });

  return proc;
}

function requestShutdown(code = 0): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  forcedExitCode = code;

  for (const proc of processes) {
    if (proc.killed) {
      continue;
    }

    try {
      proc.kill("SIGINT");
    } catch {
      try {
        proc.kill();
      } catch {
        // ignore
      }
    }
  }

  setTimeout(() => {
    for (const proc of processes) {
      if (proc.killed) {
        continue;
      }

      try {
        proc.kill("SIGKILL");
      } catch {
        // ignore
      }
    }

    process.exit(forcedExitCode);
  }, 1200);
}

function runTelegramDevPoller(): void {
  process.on("SIGINT", () => {
    console.log("\n[dev:telegram] Ctrl+C received, stopping both processes...");
    requestShutdown(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n[dev:telegram] SIGTERM received, stopping both processes...");
    requestShutdown(0);
  });

  if (shouldRunTelegram) {
    console.log("[dev:telegram] starting dev server and telegram poller...");
  } else {
    console.log("[dev:telegram] starting dev server only (--no-telegram)...");
  }

  startProcess("next:dev", ["run", "dev:web"]);

  if (shouldRunTelegram) {
    startProcess("telegram:poll", ["run", "telegram:poll"]);
  }
}

runTelegramDevPoller();
