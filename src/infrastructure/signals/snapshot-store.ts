import { promises as fs } from "node:fs";
import path from "node:path";

import { SignalDataUnavailableError } from "@/src/core/signals/errors";
import type {
  SignalHealthSource,
  SignalSnapshot,
} from "@/src/core/signals/types";
import { isSignalsDatabaseConfigured } from "@/src/infrastructure/db/postgres";
import {
  loadLatestSignalSourceHealthFromDatabase,
  loadLiveSignalSnapshotFromDatabase,
} from "@/src/infrastructure/signals/postgres-signal-repository";
import {
  ensureDemoSnapshot,
  normalizeSnapshot,
} from "@/src/infrastructure/signals/signal-snapshot-normalizer";

const SIGNALS_DIRECTORY = path.join(process.cwd(), "data", "signals");
const DEMO_SNAPSHOT_FILE = path.join(SIGNALS_DIRECTORY, "demo-snapshot.json");
const LEGACY_SNAPSHOT_FILE = path.join(SIGNALS_DIRECTORY, "latest-snapshot.json");

function isDemoModeEnabled(): boolean {
  return process.env.SIGNALS_ENABLE_DEMO_MODE === "1";
}

function resolveConfiguredDemoSnapshotFile(): string | null {
  const configuredPath = process.env.SIGNALS_SNAPSHOT_FILE?.trim();
  if (!configuredPath) {
    return null;
  }
  return path.isAbsolute(configuredPath) ? configuredPath : path.join(process.cwd(), configuredPath);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

async function readSnapshotFile(filePath: string): Promise<SignalSnapshot | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return normalizeSnapshot(parsed);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse signal snapshot: ${filePath}`);
    }
    throw error;
  }
}

function buildDatabaseFailureSource(detail: string): SignalHealthSource {
  return {
    key: "postgres",
    label: "PostgreSQL",
    status: "failed",
    updatedAt: "",
    detail,
  };
}

async function buildUnavailableError(message: string, detail: string): Promise<SignalDataUnavailableError> {
  if (!isSignalsDatabaseConfigured()) {
    return new SignalDataUnavailableError(message, [buildDatabaseFailureSource(detail)]);
  }

  try {
    const sources = await loadLatestSignalSourceHealthFromDatabase();
    if (sources.length > 0) {
      return new SignalDataUnavailableError(message, sources);
    }
  } catch {
    // Ignore secondary health-source lookup failure and fall back to the primary DB error detail.
  }

  return new SignalDataUnavailableError(message, [buildDatabaseFailureSource(detail)]);
}

async function loadDemoFallbackSnapshot(): Promise<SignalSnapshot> {
  const configuredDemoSnapshot = resolveConfiguredDemoSnapshotFile();
  if (configuredDemoSnapshot) {
    const configuredSnapshot = await readSnapshotFile(configuredDemoSnapshot);
    if (configuredSnapshot) {
      return ensureDemoSnapshot(configuredSnapshot);
    }
  }

  const legacySnapshot = await readSnapshotFile(LEGACY_SNAPSHOT_FILE);
  if (legacySnapshot) {
    return legacySnapshot;
  }

  const demoSnapshot = await readSnapshotFile(DEMO_SNAPSHOT_FILE);
  if (!demoSnapshot) {
    throw new SignalDataUnavailableError(
      "demo fallback snapshot을 찾지 못했습니다. data/signals 경로와 SIGNALS_SNAPSHOT_FILE 설정을 확인하세요.",
      [
        {
          key: "demo-fallback",
          label: "Demo Snapshot",
          status: "failed",
          updatedAt: "",
          detail: "demo fallback snapshot 파일을 찾지 못했습니다.",
        },
      ],
    );
  }

  return ensureDemoSnapshot(demoSnapshot);
}

export async function loadSignalSnapshot(): Promise<SignalSnapshot> {
  await fs.mkdir(SIGNALS_DIRECTORY, { recursive: true });

  let liveSnapshot: SignalSnapshot | null = null;
  let databaseFailureDetail: string | null = null;

  if (isSignalsDatabaseConfigured()) {
    try {
      liveSnapshot = await loadLiveSignalSnapshotFromDatabase();
    } catch (error) {
      databaseFailureDetail =
        error instanceof Error
          ? error.message
          : "PostgreSQL live signal snapshot 조회 중 알 수 없는 오류가 발생했습니다.";
    }
  }

  if (liveSnapshot) {
    return liveSnapshot;
  }

  if (isDemoModeEnabled()) {
    return loadDemoFallbackSnapshot();
  }

  if (databaseFailureDetail) {
    throw await buildUnavailableError(
      "PostgreSQL live snapshot을 읽지 못했습니다. migration과 DB 상태를 확인하세요.",
      databaseFailureDetail,
    );
  }

  if (isSignalsDatabaseConfigured()) {
    throw await buildUnavailableError(
      "PostgreSQL에 live signal snapshot이 아직 적재되지 않았습니다. pipeline writer를 먼저 연결하세요.",
      "signal_delivery_snapshots 또는 signal_source_runs에 live 데이터가 없습니다.",
    );
  }

  throw await buildUnavailableError(
    "DATABASE_URL이 설정되지 않아 live signal snapshot을 조회할 수 없습니다. PostgreSQL 또는 demo fallback을 준비하세요.",
    "DATABASE_URL이 비어 있어 PostgreSQL에 연결할 수 없습니다.",
  );
}

export function getSignalsDirectoryPath(): string {
  return SIGNALS_DIRECTORY;
}
