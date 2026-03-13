import type { SignalHealthSource, SignalSnapshot } from "@/src/core/signals/types";
import {
  isSignalsDatabaseConfigured,
  querySignalsDb,
} from "@/src/infrastructure/db/postgres";
import {
  getDefaultSourceDetail,
  normalizeSnapshot,
  normalizeSourceStatus,
} from "@/src/infrastructure/signals/signal-snapshot-normalizer";

interface DeliverySnapshotRow {
  id: number;
  snapshot_id: string;
  snapshot_time: Date | string;
  snapshot_mode: string | null;
  payload_json: unknown;
}

interface SourceRunRow {
  source_name: string;
  run_type: string | null;
  status: string;
  updated_at: Date | string | null;
  error_message: string | null;
  detail: string | null;
}

function formatSourceLabel(value: string): string {
  return value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toIsoTimestamp(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }
  return value;
}

function parseJsonPayload(raw: unknown): unknown {
  if (typeof raw === "string") {
    return JSON.parse(raw) as unknown;
  }
  return raw;
}

export async function loadLiveSignalSnapshotFromDatabase(): Promise<SignalSnapshot | null> {
  if (!isSignalsDatabaseConfigured()) {
    return null;
  }

  const result = await querySignalsDb<DeliverySnapshotRow>(
    `
      SELECT
        id,
        snapshot_id,
        snapshot_time,
        snapshot_mode,
        payload_json
      FROM signal_delivery_snapshots
      ORDER BY snapshot_time DESC, created_at DESC, id DESC
      LIMIT 1
    `,
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const snapshot = normalizeSnapshot(parseJsonPayload(row.payload_json));
  const snapshotMode = row.snapshot_mode === "demo" ? "demo" : "live";
  const sourceHealth = snapshot.health.sources.length
    ? snapshot.health.sources
    : await loadLatestSignalSourceHealthFromDatabase();

  return {
    ...snapshot,
    snapshotId: row.snapshot_id || snapshot.snapshotId,
    generatedAt: toIsoTimestamp(row.snapshot_time) || snapshot.generatedAt,
    snapshotMode,
    health: {
      ...snapshot.health,
      status:
        snapshot.health.status === "failed"
          ? "failed"
          : snapshotMode === "demo"
            ? "demo"
            : snapshot.health.status === "demo"
              ? "healthy"
              : snapshot.health.status,
      sources: sourceHealth,
    },
  };
}

export async function loadLatestSignalSourceHealthFromDatabase(): Promise<SignalHealthSource[]> {
  if (!isSignalsDatabaseConfigured()) {
    return [];
  }

  const result = await querySignalsDb<SourceRunRow>(
    `
      WITH ranked_runs AS (
        SELECT
          source_name,
          run_type,
          status,
          COALESCE(finished_at, started_at) AS updated_at,
          error_message,
          payload_meta ->> 'detail' AS detail,
          ROW_NUMBER() OVER (
            PARTITION BY source_name
            ORDER BY COALESCE(finished_at, started_at) DESC NULLS LAST, id DESC
          ) AS rn
        FROM signal_source_runs
      )
      SELECT
        source_name,
        run_type,
        status,
        updated_at,
        error_message,
        detail
      FROM ranked_runs
      WHERE rn = 1
      ORDER BY source_name ASC
    `,
  );

  return result.rows.map((row) => {
    const status = normalizeSourceStatus(row.status);
    return {
      key: row.source_name,
      source: row.run_type ?? undefined,
      label: formatSourceLabel(row.source_name),
      status,
      updatedAt: toIsoTimestamp(row.updated_at),
      detail: row.error_message || row.detail || getDefaultSourceDetail(status),
      summary: row.run_type ?? undefined,
    };
  });
}
