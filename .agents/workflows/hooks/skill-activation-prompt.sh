#!/bin/bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${GEMINI_PROJECT_DIR:-${CODEX_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}}"
export GEMINI_PROJECT_DIR="$PROJECT_DIR"
HOOK_TS="$PROJECT_DIR/.agents/workflows/hooks/skill-activation-prompt.ts"
HOOK_DIR="$PROJECT_DIR/.agents/workflows/hooks"

if [[ ! -f "$HOOK_TS" ]]; then
    exit 0
fi

if ! command -v npx >/dev/null 2>&1; then
    exit 0
fi

INPUT_PAYLOAD=$(cat)

if [[ ! -d "$HOOK_DIR" ]]; then
    exit 0
fi

if ! OUTPUT=$(printf '%s' "$INPUT_PAYLOAD" | (cd "$HOOK_DIR" && npx tsx skill-activation-prompt.ts) 2>/dev/null); then
    exit 0
fi

if [[ -n "$OUTPUT" ]]; then
    printf '%s\n' "$OUTPUT"
fi

exit 0
