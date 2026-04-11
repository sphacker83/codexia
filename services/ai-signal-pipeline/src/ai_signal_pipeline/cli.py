from __future__ import annotations

import argparse

from .writer import write_signal_delivery_snapshot


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Signal delivery snapshot writer")
    parser.add_argument(
        "--snapshot-path",
        default="data/signals/demo-snapshot.json",
        help="Snapshot JSON path to write into signal_delivery_snapshots",
    )
    parser.add_argument(
        "--mode",
        default="live",
        choices=("live", "demo"),
        help="snapshot_mode to store",
    )
    parser.add_argument("--source-name", default="signal_pipeline_bootstrap", help="Source identifier")
    parser.add_argument("--source-run-type", default="bootstrap", help="Source run type")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    write_signal_delivery_snapshot(
        snapshot_path=args.snapshot_path,
        snapshot_mode=args.mode,
        source_name=args.source_name,
        source_run_type=args.source_run_type,
    )
    print(f"wrote snapshot from {args.snapshot_path} to signal_delivery_snapshots (mode={args.mode})")


if __name__ == "__main__":
    main()
