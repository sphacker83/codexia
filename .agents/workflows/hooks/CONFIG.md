# 훅(Hooks) 구성 가이드

이 가이드는 프로젝트에서 훅 시스템을 구성하고 커스터마이징하는 방법을 설명합니다.

## 빠른 시작 구성

### 1. .agents/workflows/settings.json에 훅 등록

프로젝트 루트에 있는 `.agents/workflows/settings.json`을 생성하거나 업데이트하세요:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.agents/workflows/hooks/skill-activation-prompt.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.agents/workflows/hooks/post-tool-use-tracker.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.agents/workflows/hooks/stop-prettier-formatter.sh"
          },
          {
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.agents/workflows/hooks/stop-build-check-enhanced.sh"
          },
          {
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.agents/workflows/hooks/error-handling-reminder.sh"
          }
        ]
      }
    ]
  }
}
```

### 2. 의존성 설치

```bash
cd .agents/workflows/hooks
npm install
```

### 3. 실행 권한 설정

```bash
chmod +x .agents/workflows/hooks/*.sh
```

## 커스터마이징 옵션

### 프로젝트 구조 감지

기본적으로 훅은 다음 디렉터리 패턴을 감지합니다:

**프론트엔드:** `frontend/`, `client/`, `web/`, `app/`, `ui/`
**백엔드:** `backend/`, `server/`, `api/`, `src/`, `services/`
**데이터베이스:** `database/`, `prisma/`, `migrations/`
**모노레포:** `packages/*`, `examples/*`

#### 커스텀 디렉터리 패턴 추가

`.agents/workflows/hooks/post-tool-use-tracker.sh`의 `detect_repo()` 함수를 수정하세요:

```bash
case "$repo" in
    # 여기에 커스텀 디렉터리를 추가하세요
    my-custom-service)
        echo "$repo"
        ;;
    admin-panel)
        echo "$repo"
        ;;
    # ... 기존 패턴
esac
```

### 빌드 명령 감지

훅은 다음 기준으로 빌드 명령을 자동 감지합니다:
1. "build" 스크립트가 있는 `package.json` 존재 여부
2. 패키지 매니저 우선순위(pnpm > npm > yarn)
3. 특수 케이스(Prisma 스키마)

#### 빌드 명령 커스터마이징

`.agents/workflows/hooks/post-tool-use-tracker.sh`의 `get_build_command()` 함수를 수정하세요:

```bash
# 커스텀 빌드 로직 추가
if [[ "$repo" == "my-service" ]]; then
    echo "cd $repo_path && make build"
    return
fi
```

### TypeScript 구성

훅은 다음을 자동으로 감지합니다:
- 표준 TypeScript 프로젝트의 `tsconfig.json`
- Vite/React 프로젝트의 `tsconfig.app.json`

#### 커스텀 TypeScript 구성

`.agents/workflows/hooks/post-tool-use-tracker.sh`의 `get_tsc_command()` 함수를 수정하세요:

```bash
if [[ "$repo" == "my-service" ]]; then
    echo "cd $repo_path && npx tsc --project tsconfig.build.json --noEmit"
    return
fi
```

### Prettier 구성

prettier 훅은 다음 순서로 설정 파일을 찾습니다:
1. 현재 파일 디렉터리(위로 올라가며 탐색)
2. 프로젝트 루트
3. Prettier 기본값으로 폴백

#### 커스텀 Prettier 설정 탐색

`.agents/workflows/hooks/stop-prettier-formatter.sh`의 `get_prettier_config()` 함수를 수정하세요:

```bash
# 커스텀 설정 위치 추가
if [[ -f "$project_root/config/.prettierrc" ]]; then
    echo "$project_root/config/.prettierrc"
    return
fi
```

### 에러 처리 리마인더

`.agents/workflows/hooks/error-handling-reminder.ts`에서 파일 카테고리 감지를 구성하세요:

```typescript
function getFileCategory(filePath: string): 'backend' | 'frontend' | 'database' | 'other' {
    // 커스텀 패턴 추가
    if (filePath.includes('/my-custom-dir/')) return 'backend';
    // ... 기존 패턴
}
```

### 에러 임계값 구성

auto-error-resolver 에이전트를 추천하는 기준을 변경합니다.

`.agents/workflows/hooks/stop-build-check-enhanced.sh`를 수정하세요:

```bash
# 기본값은 5개 에러 - 선호에 맞게 변경하세요
if [[ $total_errors -ge 10 ]]; then  # 이제 10개 이상의 에러가 필요
    # 에이전트 추천
fi
```

## 환경 변수

### 전역 환경 변수

셸 프로필(`.bashrc`, `.zshrc` 등)에 설정하세요:

```bash
# 에러 처리 리마인더 비활성화
export SKIP_ERROR_REMINDER=1

# 커스텀 프로젝트 디렉터리(기본값을 사용하지 않는 경우)
export GEMINI_PROJECT_DIR=/path/to/your/project
```

### 세션별 환경 변수

Agent Workflows를 시작하기 전에 설정하세요:

```bash
SKIP_ERROR_REMINDER=1 codex-code
```

## 훅 실행 순서

Stop 훅은 `settings.json`에 지정된 순서대로 실행됩니다:

```json
"Stop": [
  {
    "hooks": [
      { "command": "...formatter.sh" },    // 가장 먼저 실행
      { "command": "...build-check.sh" },  // 두 번째로 실행
      { "command": "...reminder.sh" }      // 세 번째로 실행
    ]
  }
]
```

**이 순서가 중요한 이유:**
1. 먼저 파일 포맷팅(코드를 깔끔하게)
2. 그다음 에러 체크
3. 마지막으로 리마인더 표시

## 선택적 훅 활성화

모든 훅이 필요하진 않습니다. 프로젝트에 맞는 것만 선택하세요:

### 최소 구성(스킬 활성화만)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.agents/workflows/hooks/skill-activation-prompt.sh"
          }
        ]
      }
    ]
  }
}
```

### 빌드 체크만(포맷팅 없음)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.agents/workflows/hooks/post-tool-use-tracker.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.agents/workflows/hooks/stop-build-check-enhanced.sh"
          }
        ]
      }
    ]
  }
}
```

### 포맷팅만(빌드 체크 없음)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.agents/workflows/hooks/post-tool-use-tracker.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.agents/workflows/hooks/stop-prettier-formatter.sh"
          }
        ]
      }
    ]
  }
}
```

## 캐시 관리

### 캐시 위치

```
$GEMINI_PROJECT_DIR/.agents/workflows/tsc-cache/[session_id]/
```

### 수동 캐시 정리

```bash
# 모든 캐시 데이터 제거
rm -rf $GEMINI_PROJECT_DIR/.agents/workflows/tsc-cache/*

# 특정 세션 제거
rm -rf $GEMINI_PROJECT_DIR/.agents/workflows/tsc-cache/[session-id]
```

### 자동 정리

build-check 훅은 빌드가 성공하면 세션 캐시를 자동으로 정리합니다.

## 구성 트러블슈팅

### 훅이 실행되지 않을 때

1. **등록 확인:** `.agents/workflows/settings.json`에 훅이 있는지 확인
2. **권한 확인:** `chmod +x .agents/workflows/hooks/*.sh` 실행
3. **경로 확인:** `$GEMINI_PROJECT_DIR`가 올바르게 설정되어 있는지 확인
4. **TypeScript 확인:** `cd .agents/workflows/hooks && npx tsc`를 실행해 에러가 있는지 확인

### 오탐(거짓 양성) 감지

**문제:** 실행되면 안 되는 파일에 대해 훅이 트리거됨

**해결:** 해당 훅에 스킵 조건을 추가하세요:

```bash
# post-tool-use-tracker.sh에서
if [[ "$file_path" =~ /generated/ ]]; then
    exit 0  # 생성된 파일 스킵
fi
```

### 성능 문제

**문제:** 훅이 느림

**해결 방법:**
1. TypeScript 체크를 변경된 파일로만 제한
2. 더 빠른 패키지 매니저 사용(pnpm > npm)
3. 스킵 조건 추가
4. 큰 파일에 대해 Prettier 비활성화

```bash
# stop-prettier-formatter.sh에서 큰 파일 스킵
file_size=$(wc -c < "$file" 2>/dev/null || echo 0)
if [[ $file_size -gt 100000 ]]; then  # 100KB 초과 파일 스킵
    continue
fi
```

### 훅 디버깅

어떤 훅에든 디버그 출력을 추가할 수 있습니다:

```bash
# 훅 스크립트 상단에 추가
set -x  # 디버그 모드 활성화

# 또는 특정 디버그 라인 추가
echo "DEBUG: file_path=$file_path" >&2
echo "DEBUG: repo=$repo" >&2
```

Agent Workflows의 로그에서 훅 실행을 확인하세요.

## 고급 구성

### 커스텀 훅 이벤트 핸들러

다른 이벤트에 대해 자신만의 훅을 만들 수 있습니다:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.agents/workflows/hooks/my-custom-bash-guard.sh"
          }
        ]
      }
    ]
  }
}
```

### 모노레포 구성

여러 패키지를 가진 모노레포의 경우:

```bash
# post-tool-use-tracker.sh의 detect_repo()에서
case "$repo" in
    packages)
        # 패키지 이름 가져오기
        local package=$(echo "$relative_path" | cut -d'/' -f2)
        if [[ -n "$package" ]]; then
            echo "packages/$package"
        else
            echo "$repo"
        fi
        ;;
esac
```

### Docker/컨테이너 프로젝트

빌드 명령을 컨테이너에서 실행해야 한다면:

```bash
# post-tool-use-tracker.sh의 get_build_command()에서
if [[ "$repo" == "api" ]]; then
    echo "docker-compose exec api npm run build"
    return
fi
```

## 권장 사항(Best Practices)

1. **최소부터 시작** - 훅을 하나씩 활성화
2. **충분히 테스트** - 변경 후 훅이 동작하는지 검증
3. **커스터마이징 문서화** - 커스텀 로직을 설명하는 코멘트 추가
4. **버전 관리** - `.agents/workflows/` 디렉터리를 git에 커밋
5. **팀 일관성** - 팀 전체에 구성 공유

## 참고

- [README.md](./README.md) - 훅 개요
- [../../docs/HOOKS_SYSTEM.md](../../docs/HOOKS_SYSTEM.md) - 훅 전체 레퍼런스
- [../../docs/SKILLS_SYSTEM.md](../../docs/SKILLS_SYSTEM.md) - 스킬 통합
