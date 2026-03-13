# 트러블슈팅 - 스킬 활성화 이슈

스킬 활성화 문제를 디버깅하기 위한 완전한 가이드입니다.

## 목차

- [스킬이 트리거되지 않음](#skill-not-triggering)
  - [UserPromptSubmit이 제안하지 않음](#userpromptsubmit-not-suggesting)
  - [PreToolUse가 차단하지 않음](#pretooluse-not-blocking)
- [오탐(False Positives)](#false-positives)
- [훅이 실행되지 않음](#hook-not-executing)
- [성능 이슈](#performance-issues)

---

## 스킬이 트리거되지 않음

### UserPromptSubmit이 제안하지 않음

**증상:** 질문했는데 출력에 스킬 제안이 나타나지 않습니다.

**흔한 원인:**

####  1. 키워드가 매칭되지 않음

**확인:**
- skill-rules.json의 `promptTriggers.keywords` 확인
- 사용자 프롬프트에 해당 키워드가 실제로 들어있는지 확인
- 대소문자 무시(case-insensitive) 부분 문자열(substring) 매칭임을 기억

**예시:**
```json
"keywords": ["layout", "grid"]
```
- "how does the layout work?" → ✅ "layout" 매칭
- "how does the grid system work?" → ✅ "grid" 매칭
- "how do layouts work?" → ✅ "layout" 매칭
- "how does it work?" → ❌ 매칭 없음
 
- "Matches" = 매칭됨, "No match" = 매칭되지 않음

**해결:** skill-rules.json에 더 많은 키워드 변형을 추가하세요.

#### 2. 의도 패턴이 너무 구체적임

**확인:**
- `promptTriggers.intentPatterns` 확인
- https://regex101.com/ 에서 정규식 테스트
- 더 넓은 패턴이 필요할 수 있음

**예시:**
```json
"intentPatterns": [
  "(create|add).*?(database.*?table)"  // 너무 구체적
]
```
- "create a database table" → ✅ 매칭됨
- "add new table" → ❌ 매칭되지 않음("database"가 없음)

**해결:** 패턴을 더 넓히세요:
```json
"intentPatterns": [
  "(create|add).*?(table|database)"  // Better
]
```

#### 3. 스킬 이름 오타

**확인:**
- SKILL.md 프론트매터의 스킬 이름(name)
- skill-rules.json의 스킬 이름(키)
- 두 값이 정확히 일치해야 함

**예시:**
```yaml
# SKILL.md
name: project-catalog-developer
```
```json
// skill-rules.json
"project-catalogue-developer": {  // ❌ Typo: catalogue vs catalog
  ...
}
```

**해결:** 이름이 정확히 일치하도록 맞추세요.

#### 4. JSON 문법 오류

**확인:**
```bash
cat .agents/workflows/skills/skill-rules.json | jq .
```

JSON이 유효하지 않으면 jq가 오류를 표시합니다.

**흔한 오류:**
- 끝의 쉼표(trailing comma)
- 따옴표 누락
- 큰따옴표 대신 작은따옴표 사용
- 문자열 내 이스케이프되지 않은 문자

**해결:** JSON 문법을 수정하고 jq로 검증하세요.

#### 디버그 명령

훅을 수동으로 테스트하세요:

```bash
echo '{"session_id":"debug","prompt":"your test prompt here"}' | \
  npx tsx .agents/workflows/hooks/skill-activation-prompt.ts
```

기대 결과: 출력에 해당 스킬이 나타나야 합니다.

---

### PreToolUse가 차단하지 않음

**증상:** 가드레일이 트리거되어야 하는 파일을 편집했는데 차단이 발생하지 않습니다.

**흔한 원인:**

#### 1. 파일 경로가 패턴과 매칭되지 않음

**확인:**
- 편집 중인 파일 경로
- skill-rules.json의 `fileTriggers.pathPatterns`
- glob 패턴 문법

**예시:**
```json
"pathPatterns": [
  "frontend/src/**/*.tsx"
]
```
- 편집: `frontend/src/components/Dashboard.tsx` → ✅ 매칭됨
- 편집: `frontend/tests/Dashboard.test.tsx` → ✅ 매칭됨(exclusion 추가 필요!)
- 편집: `backend/src/app.ts` → ❌ 매칭되지 않음

**해결:** glob 패턴을 조정하거나 누락된 경로를 추가하세요.

#### 2. pathExclusions로 제외됨

**확인:**
- 테스트 파일을 편집하고 있나요?
- `fileTriggers.pathExclusions` 확인

**예시:**
```json
"pathExclusions": [
  "**/*.test.ts",
  "**/*.spec.ts"
]
```
- 편집: `services/user.test.ts` → ❌ 제외됨
- 편집: `services/user.ts` → ✅ 제외되지 않음

**해결:** 테스트 제외가 너무 광범위하면 범위를 좁히거나 제거하세요

#### 3. 콘텐츠 패턴이 발견되지 않음

**확인:**
- 파일에 해당 패턴이 실제로 존재하나요?
- `fileTriggers.contentPatterns` 확인
- 정규식(regex)이 올바른가요?

**예시:**
```json
"contentPatterns": [
  "import.*[Pp]risma"
]
```
- 파일에 다음이 있음: `import { PrismaService } from './prisma'` → ✅ 매칭됨
- 파일에 다음이 있음: `import { Database } from './db'` → ❌ 매칭되지 않음

**디버그:**
```bash
# 파일에 패턴이 존재하는지 확인
grep -i "prisma" path/to/file.ts
```

**해결:** 콘텐츠 패턴을 조정하거나 필요한 import를 추가하세요

#### 4. 세션에서 이미 스킬을 사용함

**세션 상태 확인:**
```bash
ls .agents/workflows/hooks/state/
cat .agents/workflows/hooks/state/skills-used-{session-id}.json
```

**예시:**
```json
{
  "skills_used": ["database-verification"],
  "files_verified": []
}
```

`skills_used`에 해당 스킬이 있으면, 같은 세션에서는 다시 차단하지 않습니다.

**해결:** 초기화하려면 상태 파일을 삭제하세요:
```bash
rm .agents/workflows/hooks/state/skills-used-{session-id}.json
```

#### 5. 파일 마커가 존재함

**스킵 마커가 있는지 확인:**
```bash
grep "@skip-validation" path/to/file.ts
```

있다면 해당 파일은 영구적으로 스킵됩니다.

**해결:** 다시 검증이 필요하면 마커를 제거하세요

#### 6. 환경 변수 오버라이드

**확인:**
```bash
echo $SKIP_DB_VERIFICATION
echo $SKIP_SKILL_GUARDRAILS
```

설정되어 있으면 해당 스킬(또는 가드레일)이 비활성화됩니다.

**해결:** 환경 변수를 해제(unset)하세요:
```bash
unset SKIP_DB_VERIFICATION
```

#### 디버그 명령

훅을 수동으로 테스트하세요:

```bash
cat <<'EOF' | npx tsx .agents/workflows/hooks/skill-verification-guard.ts 2>&1
{
  "session_id": "debug",
  "tool_name": "Edit",
  "tool_input": {"file_path": "/root/git/your-project/form/src/services/user.ts"}
}
EOF
echo "Exit code: $?"
```

기대 결과:
- 차단되어야 한다면: 종료 코드 2 + stderr 메시지
- 허용되어야 한다면: 종료 코드 0 + 출력 없음

---

## 오탐(False Positives)

**증상:** 스킬이 트리거되면 안 되는 상황에서 트리거됩니다.

**흔한 원인 & 해결책:**

### 1. 키워드가 너무 일반적임

**문제:**
```json
"keywords": ["user", "system", "create"]  // Too broad
```
- 다음에서도 트리거됨: "user manual", "file system", "create directory"

**해결:** 키워드를 더 구체적으로 만드세요
```json
"keywords": [
  "user authentication",
  "user tracking",
  "create feature"
]
```

### 2. 의도 패턴이 너무 넓음

**문제:**
```json
"intentPatterns": [
  "(create)"  // "create"가 들어가면 전부 매칭됨
]
```
- 다음에서도 트리거됨: "create file", "create folder", "create account"

**해결:** 패턴에 컨텍스트를 추가하세요
```json
"intentPatterns": [
  "(create|add).*?(database|table|feature)"  // More specific
]
```

**고급:** 부정형 전방 탐색(negative lookahead)으로 제외 조건을 추가
```regex
(create)(?!.*test).*?(feature)  // Don't match if "test" appears
```

### 3. 파일 경로 패턴이 너무 일반적임

**문제:**
```json
"pathPatterns": [
  "form/**"  // form/ 아래는 전부 매칭됨
]
```
- 테스트 파일, 설정 파일 등 모든 것에서 트리거됨

**해결:** 더 좁은 패턴을 사용하세요
```json
"pathPatterns": [
  "form/src/services/**/*.ts",  // Only service files
  "form/src/controllers/**/*.ts"
]
```

### 4. 콘텐츠 패턴이 무관한 코드까지 잡음

**문제:**
```json
"contentPatterns": [
  "Prisma"  // 주석/문자열 등에서도 매칭됨
]
```
- `// Don't use Prisma here` 같은 주석에서도 트리거됨
- `const note = "Prisma is cool"` 같은 문자열에서도 트리거됨

**해결:** 패턴을 더 구체적으로 만드세요
```json
"contentPatterns": [
  "import.*[Pp]risma",        // Only imports
  "PrismaService\\.",         // Only actual usage
  "prisma\\.(findMany|create)" // Specific methods
]
```

### 5. Enforcement 레벨 조정

**최후의 수단:** 오탐이 잦다면:

```json
{
  "enforcement": "block"  // Change to "suggest"
}
```

이렇게 하면 차단(block) 대신 안내(suggest)로 동작합니다.

---

## 훅이 실행되지 않음

**증상:** 훅이 아예 실행되지 않습니다(제안도 없고, 차단도 없음).

**흔한 원인:**

### 1. 훅이 등록되지 않음

**Check `.agents/workflows/settings.json`:**
```bash
cat .agents/workflows/settings.json | jq '.hooks.UserPromptSubmit'
cat .agents/workflows/settings.json | jq '.hooks.PreToolUse'
```

기대 결과: 훅 엔트리가 존재해야 함

**해결:** 누락된 훅 등록을 추가하세요:
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

### 2. Bash 래퍼가 실행 불가(executable 아님)

**확인:**
```bash
ls -l .agents/workflows/hooks/*.sh
```

기대 결과: `-rwxr-xr-x` (실행 가능)

**해결:**
```bash
chmod +x .agents/workflows/hooks/*.sh
```

### 3. shebang이 올바르지 않음

**확인:**
```bash
head -1 .agents/workflows/hooks/skill-activation-prompt.sh
```

기대 결과: `#!/bin/bash`

**해결:** 첫 줄에 올바른 shebang을 추가하세요

### 4. npx/tsx를 사용할 수 없음

**확인:**
```bash
npx tsx --version
```

기대 결과: 버전 번호 출력

**해결:** 의존성을 설치하세요:
```bash
cd .agents/workflows/hooks
npm install
```

### 5. TypeScript 컴파일 에러

**확인:**
```bash
cd .agents/workflows/hooks
npx tsc --noEmit skill-activation-prompt.ts
```

기대 결과: 출력 없음(에러 없음)

**해결:** TypeScript 문법 에러를 수정하세요

---

## 성능 이슈

**증상:** 훅이 느려서 프롬프트/편집 전에 지연이 체감됩니다.

**흔한 원인:**

### 1. 패턴이 너무 많음

**확인:**
- skill-rules.json의 패턴 개수
- 패턴 1개 = regex 컴파일 + 매칭 비용

**해결:** 패턴 수를 줄이세요
- 유사한 패턴은 합치기
- 중복 패턴 제거
- 더 구체적인 패턴 사용(더 빠른 매칭)

### 2. 복잡한 정규식(regex)

**Problem:**
```regex
(create|add|modify|update|implement|build).*?(feature|endpoint|route|service|controller|component|UI|page)
```
- 긴 alternation(대안 목록)은 느립니다

**해결:** 단순화
```regex
(create|add).*?(feature|endpoint)  // Fewer alternatives
```

### 3. 검사 대상 파일이 너무 많음

**Problem:**
```json
"pathPatterns": [
  "**/*.ts"  // Checks ALL TypeScript files
]
```

**Solution:** Be more specific
```json
"pathPatterns": [
  "form/src/services/**/*.ts",  // Only specific directory
  "form/src/controllers/**/*.ts"
]
```

### 4. Large Files

콘텐츠 패턴 매칭은 파일 전체를 읽기 때문에, 큰 파일에서는 느릴 수 있습니다.

**해결:**
- 꼭 필요할 때만 콘텐츠 패턴 사용
- 파일 크기 제한을 고려(향후 개선)

### 성능 측정

```bash
# UserPromptSubmit
time echo '{"prompt":"test"}' | npx tsx .agents/workflows/hooks/skill-activation-prompt.ts

# PreToolUse
time cat <<'EOF' | npx tsx .agents/workflows/hooks/skill-verification-guard.ts
{"tool_name":"Edit","tool_input":{"file_path":"test.ts"}}
EOF
```

**목표 지표(Target metrics):**
- UserPromptSubmit: < 100ms
- PreToolUse: < 200ms

---

**관련 파일:**
- [SKILL.md](SKILL.md) - 메인 스킬 가이드
- [HOOK_MECHANISMS.md](HOOK_MECHANISMS.md) - 훅 동작 방식
- [SKILL_RULES_REFERENCE.md](SKILL_RULES_REFERENCE.md) - 설정 레퍼런스
