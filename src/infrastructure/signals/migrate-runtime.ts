#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs/promises") as typeof import("node:fs/promises");
const nodePath = require("node:path") as typeof import("node:path");
const { Client } = require("pg") as typeof import("pg");

function stripInlineComment(value: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === "\"" && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      const previous = index === 0 ? " " : value[index - 1];
      if (/\s/.test(previous)) {
        return value.slice(0, index).trim();
      }
    }
  }

  return value.trim();
}

async function loadEnvFile(filePath = ".env.local"): Promise<void> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const equalIndex = trimmed.indexOf("=");
      if (equalIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, equalIndex).trim();
      let value = stripInlineComment(trimmed.slice(equalIndex + 1).trim());

      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Missing env file is allowed if DATABASE_URL is already set.
  }
}

function getDatabaseSslConfig(): false | { rejectUnauthorized: false } {
  const raw = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "require") {
    return { rejectUnauthorized: false };
  }
  return false;
}

function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required. Set it in the shell or .env.local before running signals:migrate.");
  }
  return value;
}

async function ensureMigrationTable(client: import("pg").Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      scope TEXT NOT NULL,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (scope, name)
    )
  `);
}

async function listMigrationFiles(directoryPath: string): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function run(): Promise<void> {
  await loadEnvFile(nodePath.join(process.cwd(), ".env.local"));

  const migrationDirectory = nodePath.join(process.cwd(), "db", "migrations", "signals");
  const migrationFiles = await listMigrationFiles(migrationDirectory);

  const client = new Client({
    connectionString: getDatabaseUrl(),
    ssl: getDatabaseSslConfig(),
  });

  await client.connect();

  try {
    await ensureMigrationTable(client);

    const appliedResult = await client.query<{
      name: string;
    }>(
      `
        SELECT name
        FROM schema_migrations
        WHERE scope = $1
        ORDER BY name ASC
      `,
      ["signals"],
    );
    const appliedMigrations = new Set(appliedResult.rows.map((row) => row.name));

    for (const fileName of migrationFiles) {
      if (appliedMigrations.has(fileName)) {
        console.log(`= ${fileName}`);
        continue;
      }

      const filePath = nodePath.join(migrationDirectory, fileName);
      const sql = await fs.readFile(filePath, "utf8");

      console.log(`> ${fileName}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `
            INSERT INTO schema_migrations (scope, name)
            VALUES ($1, $2)
          `,
          ["signals", fileName],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("SignalForge migrations are up to date.");
  } finally {
    await client.end();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
