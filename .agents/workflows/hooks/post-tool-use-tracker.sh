#!/bin/bash
set -e

# Post-tool-use hook that tracks edited files and their repos.
# This runs after Edit, MultiEdit, or Write tools complete successfully.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${GEMINI_PROJECT_DIR:-${CODEX_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}}"
export GEMINI_PROJECT_DIR="$PROJECT_DIR"

if ! command -v jq >/dev/null 2>&1; then
    exit 0
fi

tool_info=$(cat)

tool_name=$(echo "$tool_info" | jq -r '.tool_name // empty')
session_id=$(echo "$tool_info" | jq -r '.session_id // empty')

# Skip if not an edit tool.
if [[ ! "$tool_name" =~ ^(Edit|MultiEdit|Write)$ ]]; then
    exit 0
fi

cache_dir="$PROJECT_DIR/.agents/workflows/tsc-cache/${session_id:-default}"
mkdir -p "$cache_dir"

# Collect file paths from tool payload.
if [[ "$tool_name" == "MultiEdit" ]]; then
    file_paths=$(echo "$tool_info" | jq -r '.tool_input.edits[].file_path // empty')
else
    file_paths=$(echo "$tool_info" | jq -r '.tool_input.file_path // empty')
fi

if [[ -z "$file_paths" ]]; then
    exit 0
fi

detect_repo() {
    local file="$1"
    local project_root="$PROJECT_DIR"
    local relative_path="${file#$project_root/}"
    local repo

    repo=$(echo "$relative_path" | cut -d'/' -f1)

    case "$repo" in
        # Single-app Next.js directories should map to project root.
        app|components|lib|types|public|styles)
            echo "root"
            ;;
        # Frontend monorepo variations.
        frontend|client|web|ui)
            echo "$repo"
            ;;
        # Backend variations.
        backend|server|api|src|services)
            echo "$repo"
            ;;
        # Database.
        database|prisma|migrations)
            echo "$repo"
            ;;
        # Package/monorepo structure.
        packages)
            local package
            package=$(echo "$relative_path" | cut -d'/' -f2)
            if [[ -n "$package" ]]; then
                echo "packages/$package"
            else
                echo "$repo"
            fi
            ;;
        # Examples directory.
        examples)
            local example
            example=$(echo "$relative_path" | cut -d'/' -f2)
            if [[ -n "$example" ]]; then
                echo "examples/$example"
            else
                echo "$repo"
            fi
            ;;
        *)
            if [[ ! "$relative_path" =~ / ]]; then
                echo "root"
            else
                echo "unknown"
            fi
            ;;
    esac
}

get_repo_path() {
    local repo="$1"
    if [[ "$repo" == "root" ]]; then
        echo "$PROJECT_DIR"
    else
        echo "$PROJECT_DIR/$repo"
    fi
}

get_build_command() {
    local repo="$1"
    local repo_path
    repo_path=$(get_repo_path "$repo")

    if [[ -f "$repo_path/package.json" ]]; then
        if grep -q '"build"' "$repo_path/package.json" 2>/dev/null; then
            if [[ -f "$repo_path/pnpm-lock.yaml" ]]; then
                echo "cd $repo_path && pnpm build"
            elif [[ -f "$repo_path/package-lock.json" ]]; then
                echo "cd $repo_path && npm run build"
            elif [[ -f "$repo_path/yarn.lock" ]]; then
                echo "cd $repo_path && yarn build"
            else
                echo "cd $repo_path && npm run build"
            fi
            return
        fi
    fi

    if [[ "$repo" == "database" ]] || [[ "$repo" =~ prisma ]]; then
        if [[ -f "$repo_path/schema.prisma" ]] || [[ -f "$repo_path/prisma/schema.prisma" ]]; then
            echo "cd $repo_path && npx prisma generate"
            return
        fi
    fi

    echo ""
}

get_tsc_command() {
    local repo="$1"
    local repo_path
    repo_path=$(get_repo_path "$repo")

    if [[ -f "$repo_path/tsconfig.json" ]]; then
        if [[ -f "$repo_path/tsconfig.app.json" ]]; then
            echo "cd $repo_path && npx tsc --project tsconfig.app.json --noEmit"
        else
            echo "cd $repo_path && npx tsc --noEmit"
        fi
        return
    fi

    echo ""
}

while IFS= read -r file_path; do
    if [[ -z "$file_path" ]]; then
        continue
    fi

    if [[ "$file_path" =~ \.(md|markdown)$ ]]; then
        continue
    fi

    repo=$(detect_repo "$file_path")

    if [[ "$repo" == "unknown" ]] || [[ -z "$repo" ]]; then
        continue
    fi

    echo "$(date +%s):$file_path:$repo" >> "$cache_dir/edited-files.log"

    if ! grep -q "^$repo$" "$cache_dir/affected-repos.txt" 2>/dev/null; then
        echo "$repo" >> "$cache_dir/affected-repos.txt"
    fi

    build_cmd=$(get_build_command "$repo")
    tsc_cmd=$(get_tsc_command "$repo")

    if [[ -n "$build_cmd" ]]; then
        echo "$repo:build:$build_cmd" >> "$cache_dir/commands.txt.tmp"
    fi

    if [[ -n "$tsc_cmd" ]]; then
        echo "$repo:tsc:$tsc_cmd" >> "$cache_dir/commands.txt.tmp"
    fi
done <<< "$file_paths"

if [[ -f "$cache_dir/commands.txt.tmp" ]]; then
    sort -u "$cache_dir/commands.txt.tmp" > "$cache_dir/commands.txt"
    rm -f "$cache_dir/commands.txt.tmp"
fi

exit 0
