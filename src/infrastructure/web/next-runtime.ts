#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

const childProcess = require("node:child_process") as typeof import("node:child_process");
const spawn = childProcess.spawn;

const command = process.argv[2];
const forwardedArgs = process.argv.slice(3);

function resolveNextArgs(mode: string | undefined): string[] {
  switch (mode) {
    case "dev":
      return ["dev", "--webpack", ...forwardedArgs];
    case "build":
      return ["build", "--webpack", ...forwardedArgs];
    default:
      throw new Error("Usage: next-runtime.ts <dev|build> [...args]");
  }
}

function run(): void {
  const env = { ...process.env };
  delete env.TURBOPACK;

  if (command === "build") {
    env.NODE_ENV = "production";
  }

  const nextBin = require.resolve("next/dist/bin/next");
  const nextArgs = resolveNextArgs(command);
  const child = spawn(process.execPath, [nextBin, ...nextArgs], {
    stdio: "inherit",
    shell: false,
    env,
  });

  const requestShutdown = (): void => {
    if (child.killed) {
      return;
    }

    try {
      child.kill("SIGINT");
    } catch {
      try {
        child.kill();
      } catch {
        // ignore
      }
    }
  };

  process.on("SIGINT", requestShutdown);
  process.on("SIGTERM", requestShutdown);

  child.on("error", (error) => {
    console.error(`[next-runtime] failed: ${error.message}`);
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`[next-runtime] stopped by signal: ${signal}`);
    }

    process.exit(code ?? 1);
  });
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[next-runtime] ${message}`);
  process.exit(1);
}
