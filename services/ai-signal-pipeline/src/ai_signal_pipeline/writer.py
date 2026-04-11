from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from .db import get_connection


def _normalize_snapshot_time(value: str | None) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc).isoformat()

    return parsed.astimezone(timezone.utc).isoformat()


def write_signal_delivery_snapshot(
    snapshot_path: str,
    snapshot_mode: str,
    source_name: str,
    source_run_type: str,
) -> None:
    with open(snapshot_path, "r", encoding="utf-8") as handle:
        payload: dict[str, Any] = json.load(handle)

    snapshot_id = payload.get("snapshotId") or f"pipeline-seed:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    snapshot_time = _normalize_snapshot_time(payload.get("generatedAt"))
    started_at = datetime.now(timezone.utc).isoformat()
    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO signal_source_runs (
                  source_name, run_type, started_at, finished_at, status, error_message, payload_meta
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    source_name,
                    source_run_type,
                    started_at,
                    now,
                    "success",
                    None,
                    json.dumps({"snapshot_path": snapshot_path, "mode": snapshot_mode}),
                ),
            )
            cursor.execute(
                """
                INSERT INTO signal_delivery_snapshots (
                  snapshot_id, snapshot_time, snapshot_mode, payload_json
                )
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (snapshot_id)
                DO UPDATE SET
                  snapshot_time = EXCLUDED.snapshot_time,
                  snapshot_mode = EXCLUDED.snapshot_mode,
                  payload_json = EXCLUDED.payload_json
                """,
                (snapshot_id, snapshot_time, snapshot_mode, json.dumps(payload)),
            )
            connection.commit()
