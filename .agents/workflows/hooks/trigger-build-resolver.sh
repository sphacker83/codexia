#!/bin/bash
set -u

# Optional Stop hook helper for Gemini environments.
# This script does not auto-run an agent command because Agent Workflows setups vary.
# Instead, it surfaces a concise hint about which repos changed.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${GEMINI_PROJECT_DIR:-${CODEX_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}}"
export GEMINI_PROJECT_DIR="$PROJECT_DIR"

if ! command -v jq >/dev/null 2>&1; then
    exit 0
fi

event_info=$(cat)
session_id=$(echo "$event_info" | jq -r '.session_id // "default"' 2>/dev/null)
cache_dir="$PROJECT_DIR/.agents/workflows/tsc-cache/${session_id:-default}"
affected_file="$cache_dir/affected-repos.txt"

if [[ ! -f "$affected_file" ]]; then
    exit 0
fi

services_list=$(tr '\n' ' ' < "$affected_file" | xargs)

if [[ -z "$services_list" ]]; then
    exit 0
fi

echo "Build resolver hint: 변경된 저장소 -> $services_list" >&2
echo "필요하면 auto-error-resolver 에이전트를 수동으로 실행하세요." >&2

exit 0
