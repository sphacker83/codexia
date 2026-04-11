#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

const nodeChildProcess = require("node:child_process") as typeof import("node:child_process");
const nodeNet = require("node:net") as typeof import("node:net");
const nodePath = require("node:path") as typeof import("node:path");
const spawnChild = nodeChildProcess.spawn;
type ChildProcess = import("node:child_process").ChildProcess;

const argv = new Set(process.argv.slice(2));
const shouldRunTelegram = !argv.has("--no-telegram");
const runtimeArgs = ["--experimental-strip-types"];
const TELEGRAM_POLLER_CONFLICT_EXIT_CODE = 20;

const processes: ChildProcess[] = [];
let shuttingDown = false;
let forcedExitCode = 0;

function startProcess(
  name: string,
  scriptPath: string,
  args: string[] = [],
  env: NodeJS.ProcessEnv = process.env,
): ChildProcess {
  const proc = spawnChild(process.execPath, [...runtimeArgs, nodePath.resolve(process.cwd(), scriptPath), ...args], {
    stdio: "inherit",
    shell: false,
    env,
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
    if (name === "telegram:poll" && nextCode === TELEGRAM_POLLER_CONFLICT_EXIT_CODE) {
      console.log(
        "[dev:telegram] telegram poller stopped because another bot instance is already polling this token. Web dev server will keep running.",
      );
      return;
    }
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

function toPositiveInt(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "0.0.0.0" || hostname === "::1";
}

function getPreferredDevPort(): number {
  const explicitPort = toPositiveInt(process.env.PORT?.trim());
  if (explicitPort) {
    return explicitPort;
  }

  const endpoint = process.env.TELEGRAM_POLLER_LOCAL_ENDPOINT?.trim();
  if (endpoint) {
    try {
      const url = new URL(endpoint);
      const endpointPort = toPositiveInt(url.port);
      if (endpointPort && isLoopbackHostname(url.hostname)) {
        return endpointPort;
      }
    } catch {
      // ignore invalid endpoint and fall back to the default port.
    }
  }

  return 3000;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = nodeNet.createServer();
    server.unref();

    server.once("error", () => {
      resolve(false);
    });

    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

async function resolveAvailablePort(preferredPort: number): Promise<number> {
  if (await isPortAvailable(preferredPort)) {
    return preferredPort;
  }

  for (let nextPort = preferredPort + 1; nextPort <= preferredPort + 100; nextPort += 1) {
    if (await isPortAvailable(nextPort)) {
      return nextPort;
    }
  }

  throw new Error(`No available local dev port found near ${preferredPort}.`);
}

function buildPollerLocalEndpoint(port: number): string {
  const configuredEndpoint = process.env.TELEGRAM_POLLER_LOCAL_ENDPOINT?.trim();
  if (!configuredEndpoint) {
    return `http://127.0.0.1:${port}/api/telegram`;
  }

  try {
    const url = new URL(configuredEndpoint);
    if (isLoopbackHostname(url.hostname)) {
      url.port = String(port);
      return url.toString();
    }
  } catch {
    // ignore invalid endpoint and fall back to a local default.
  }

  return configuredEndpoint;
}

async function createSharedDevEnv(): Promise<NodeJS.ProcessEnv> {
  const preferredPort = getPreferredDevPort();
  const selectedPort = await resolveAvailablePort(preferredPort);
  const env = {
    ...process.env,
    PORT: String(selectedPort),
  };

  if (selectedPort !== preferredPort) {
    console.log(`[dev:telegram] port ${preferredPort} is busy, using ${selectedPort}.`);
  }

  if (shouldRunTelegram) {
    env.TELEGRAM_POLLER_LOCAL_ENDPOINT = buildPollerLocalEndpoint(selectedPort);
    console.log(`[dev:telegram] poller endpoint: ${env.TELEGRAM_POLLER_LOCAL_ENDPOINT}`);
  } else {
    console.log(`[dev:telegram] dev server port: ${selectedPort}`);
  }

  return env;
}

async function runTelegramDevPoller(): Promise<void> {
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

  const sharedEnv = await createSharedDevEnv();

  startProcess("next:dev", "src/infrastructure/web/next-runtime.ts", ["dev"], sharedEnv);

  if (shouldRunTelegram) {
    startProcess("telegram:poll", "src/infrastructure/telegram/poller-runtime.ts", [], sharedEnv);
  }
}

void runTelegramDevPoller().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dev:telegram] startup failed: ${message}`);
  process.exit(1);
});
