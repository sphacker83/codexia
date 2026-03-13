#!/bin/bash
set -e

# Stop event hook that runs build checks and prints warning-only guidance.
# This runs when Gemini finishes responding.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${GEMINI_PROJECT_DIR:-${CODEX_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}}"
export GEMINI_PROJECT_DIR="$PROJECT_DIR"

if ! command -v jq >/dev/null 2>&1; then
    exit 0
fi

event_info=$(cat)
session_id=$(echo "$event_info" | jq -r '.session_id // empty')

cache_dir="$PROJECT_DIR/.agents/workflows/tsc-cache/${session_id:-default}"

if [[ ! -d "$cache_dir" ]]; then
    exit 0
fi

if [[ ! -f "$cache_dir/affected-repos.txt" ]]; then
    exit 0
fi

if [[ ! -f "$cache_dir/commands.txt" ]]; then
    exit 0
fi

results_dir="$cache_dir/results"
mkdir -p "$results_dir"

total_errors=0
has_errors=false

count_tsc_errors() {
    local output="$1"
    local count

    count=$(echo "$output" | grep -E "\.tsx?.*:.*error TS[0-9]+:" | wc -l | tr -d ' ')
    if [[ "$count" == "0" ]] && [[ -n "$output" ]]; then
        # Fallback for non-standard TypeScript failure output.
        count=1
    fi

    echo "$count"
}

> "$results_dir/error-summary.txt"

while IFS= read -r repo; do
    tsc_cmd=$(grep "^$repo:tsc:" "$cache_dir/commands.txt" 2>/dev/null | cut -d':' -f3-)

    if [[ -z "$tsc_cmd" ]]; then
        continue
    fi

    if ! output=$(eval "$tsc_cmd" 2>&1); then
        has_errors=true

        error_count=$(count_tsc_errors "$output")
        total_errors=$((total_errors + error_count))

        echo "$output" > "$results_dir/$repo-errors.txt"
        echo "$repo:$error_count" >> "$results_dir/error-summary.txt"
    else
        echo "$repo:0" >> "$results_dir/error-summary.txt"
    fi
done < "$cache_dir/affected-repos.txt"

if [[ "$has_errors" == "true" ]]; then
    > "$cache_dir/last-errors.txt"
    for error_file in "$results_dir"/*-errors.txt; do
        if [[ -f "$error_file" ]]; then
            repo_name=$(basename "$error_file" -errors.txt)
            echo "=== Errors in $repo_name ===" >> "$cache_dir/last-errors.txt"
            cat "$error_file" >> "$cache_dir/last-errors.txt"
            echo "" >> "$cache_dir/last-errors.txt"
        fi
    done

    cp "$cache_dir/commands.txt" "$cache_dir/tsc-commands.txt"

    echo "" >&2
    echo "## TypeScript Check Warning (Non-blocking)" >&2
    echo "" >&2

    if [[ $total_errors -ge 5 ]]; then
        echo "Found $total_errors TypeScript errors across the following repos:" >&2
        while IFS=':' read -r repo count; do
            if [[ $count -gt 0 ]]; then
                echo "- $repo: $count errors" >&2
            fi
        done < "$results_dir/error-summary.txt"
        echo "" >&2
        echo "Please use the auto-error-resolver agent to fix these errors systematically." >&2
        echo "The error details are cached at: $cache_dir/last-errors.txt" >&2
        echo "TSC command cache: $cache_dir/tsc-commands.txt" >&2
    else
        echo "Found $total_errors TypeScript error(s). Details:" >&2
        echo "" >&2
        cat "$cache_dir/last-errors.txt" | sed 's/^/  /' >&2
        echo "" >&2
        echo "Please fix these errors in the affected files." >&2
    fi

    # Warning-only policy: do not block workflow.
    exit 0
fi

rm -rf "$cache_dir"
exit 0
