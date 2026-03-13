#!/bin/bash
set -u

# Skip if environment variable is set
if [ -n "${SKIP_ERROR_REMINDER:-}" ]; then
    exit 0
fi

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v npx >/dev/null 2>&1; then
    exit 0
fi

INPUT_PAYLOAD=$(cat)

if ! OUTPUT=$(printf '%s' "$INPUT_PAYLOAD" | npx tsx error-handling-reminder.ts 2>/dev/null); then
    exit 0
fi

if [[ -n "$OUTPUT" ]]; then
    printf '%s\n' "$OUTPUT"
fi

exit 0
