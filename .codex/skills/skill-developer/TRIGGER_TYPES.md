# 트리거 유형 - 완전 가이드

Roo Codex 스킬 자동 활성화 시스템에서 스킬 트리거를 설정하기 위한 완전 레퍼런스입니다.

## 목차

- [키워드 트리거(명시적)](#keyword-triggers-explicit)
- [의도 패턴 트리거(암묵적)](#intent-pattern-triggers-implicit)
- [파일 경로 트리거](#file-path-triggers)
- [콘텐츠 패턴 트리거](#content-pattern-triggers)
- [모범 사례 요약](#best-practices-summary)

---

## 키워드 트리거(명시적)

### 동작 방식

사용자 프롬프트에서 대소문자 구분 없이 부분 문자열을 매칭합니다.

### 사용 목적

사용자가 주제를 명시적으로 언급하는 경우의 주제 기반 활성화에 사용합니다.

### 설정

```json
"promptTriggers": {
  "keywords": ["layout", "grid", "toolbar", "submission"]
}
```

### 예시

- 사용자 프롬프트: "how does the **layout** system work?"
- 매칭: "layout" 키워드
- 활성화: `project-catalog-developer`

### 모범 사례

- 구체적이고 모호하지 않은 용어를 사용하세요
- 흔한 변형을 포함하세요("layout", "layout system", "grid layout")
- 지나치게 일반적인 단어는 피하세요("system", "work", "create")
- 실제 프롬프트로 테스트하세요

---

## 의도 패턴 트리거(암묵적)

### 동작 방식

사용자가 주제를 명시적으로 언급하지 않아도, 정규식 패턴 매칭으로 의도를 감지합니다.

### 사용 목적

특정 주제보다 “무엇을 하고 싶은지”를 설명하는 경우의 액션 기반 활성화에 사용합니다.

### 설정

```json
"promptTriggers": {
  "intentPatterns": [
    "(create|add|implement).*?(feature|endpoint)",
    "(how does|explain).*?(layout|workflow)"
  ]
}
```

### 예시

**DB 작업(Database Work):**
- 사용자 프롬프트: "add user tracking feature"
- 매칭: `(add).*?(feature)`
- 활성화: `database-verification`, `error-tracking`

**컴포넌트 생성(Component Creation):**
- 사용자 프롬프트: "create a dashboard widget"
- 매칭: `(create).*?(component)` (패턴에 component가 있는 경우)
- 활성화: `frontend-dev-guidelines`

### 모범 사례

- 흔한 액션 동사를 포착하세요: `(create|add|modify|build|implement)`
- 도메인 명사를 포함하세요: `(feature|endpoint|component|workflow)`
- non-greedy 매칭을 사용하세요: `.*` 대신 `.*?`
- 정규식 테스터(https://regex101.com/)로 충분히 테스트하세요
- 패턴을 너무 넓게 만들지 마세요(오탐 유발)
- 패턴을 너무 좁게 만들지 마세요(미탐 유발)

### 자주 쓰는 패턴 예시

```regex
# Database Work
(add|create|implement).*?(user|login|auth|feature)

# Explanations
(how does|explain|what is|describe).*?

# Frontend Work
(create|add|make|build).*?(component|UI|page|modal|dialog)

# Error Handling
(fix|handle|catch|debug).*?(error|exception|bug)

# Workflow Operations
(create|add|modify).*?(workflow|step|branch|condition)
```

---

## 파일 경로 트리거

### 동작 방식

편집 중인 파일 경로에 대해 glob 패턴 매칭을 수행합니다.

### 사용 목적

프로젝트 내 파일 위치를 기반으로, 도메인/영역별 활성화에 사용합니다.

### 설정

```json
"fileTriggers": {
  "pathPatterns": [
    "frontend/src/**/*.tsx",
    "form/src/**/*.ts"
  ],
  "pathExclusions": [
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

### Glob 패턴 문법

- `**` = 디렉터리 임의 개수(0개 포함)
- `*` = 디렉터리 이름 안의 임의 문자열
- 예시:
  - `frontend/src/**/*.tsx` = frontend/src 및 하위 디렉터리의 모든 .tsx 파일
  - `**/schema.prisma` = 프로젝트 어디든 있는 schema.prisma
  - `form/src/**/*.ts` = form/src 하위 디렉터리의 모든 .ts 파일

### 예시

- 편집 중인 파일: `frontend/src/components/Dashboard.tsx`
- 매칭: `frontend/src/**/*.tsx`
- 활성화: `frontend-dev-guidelines`

### 모범 사례

- 오탐을 줄이려면 구체적으로 작성하세요
- 테스트 파일은 제외(exclusion)하세요: `**/*.test.ts`
- 하위 디렉터리 구조를 고려하세요
- 실제 파일 경로로 패턴을 테스트하세요
- 가능하면 더 좁은 패턴을 사용하세요: `form/**`보다 `form/src/services/**`

### 자주 쓰는 경로 패턴

```glob
# Frontend
frontend/src/**/*.tsx        # All React components
frontend/src/**/*.ts         # All TypeScript files
frontend/src/components/**   # Only components directory

# Backend Services
form/src/**/*.ts            # Form service
email/src/**/*.ts           # Email service
users/src/**/*.ts           # Users service

# Database
**/schema.prisma            # Prisma schema (anywhere)
**/migrations/**/*.sql      # Migration files
database/src/**/*.ts        # Database scripts

# Workflows
form/src/workflow/**/*.ts              # Workflow engine
form/src/workflow-definitions/**/*.json # Workflow definitions

# Test Exclusions
**/*.test.ts                # TypeScript tests
**/*.test.tsx               # React component tests
**/*.spec.ts                # Spec files
```

---

## 콘텐츠 패턴 트리거

### 동작 방식

파일의 실제 내용(파일 안의 코드)에 대해 정규식 패턴 매칭을 수행합니다.

### 사용 목적

코드가 import/사용하는 기술(Prisma, 컨트롤러, 특정 라이브러리 등)에 기반한 기술별 활성화에 사용합니다.

### 설정

```json
"fileTriggers": {
  "contentPatterns": [
    "import.*[Pp]risma",
    "PrismaService",
    "\\.findMany\\(",
    "\\.create\\("
  ]
}
```

### 예시

**Prisma 감지(Detection):**
- 파일에 다음이 포함됨: `import { PrismaService } from '@project/database'`
- 매칭: `import.*[Pp]risma`
- 활성화: `database-verification`

**컨트롤러 감지(Detection):**
- 파일에 다음이 포함됨: `export class UserController {`
- 매칭: `export class.*Controller`
- 활성화: `error-tracking`

### 모범 사례

- import를 매칭하세요: `import.*[Pp]risma`([Pp]로 대소문자 변형 처리)
- 정규식 특수 문자를 escape하세요: `.findMany(`가 아니라 `\\.findMany\\(`
- 패턴은 대소문자 무시(case-insensitive)로 동작합니다
- 실제 파일 내용으로 테스트하세요
- 오매칭을 피할 만큼 충분히 구체적으로 만드세요

### 자주 쓰는 콘텐츠 패턴

```regex
# Prisma/Database
import.*[Pp]risma                # Prisma imports
PrismaService                    # PrismaService usage
prisma\.                         # prisma.something
\.findMany\(                     # Prisma query methods
\.create\(
\.update\(
\.delete\(

# Controllers/Routes
export class.*Controller         # Controller classes
router\.                         # Express router
app\.(get|post|put|delete|patch) # Express app routes

# Error Handling
try\s*\{                        # Try blocks
catch\s*\(                      # Catch blocks
throw new                        # Throw statements

# React/Components
export.*React\.FC               # React functional components
export default function.*       # Default function exports
useState|useEffect              # React hooks
```

---

## 모범 사례 요약

### 할 것(DO):
✅ 구체적이고 모호하지 않은 키워드를 사용하기
✅ 모든 패턴을 실제 예시로 테스트하기
✅ 흔한 변형을 포함하기
✅ non-greedy regex 사용하기: `.*?`
✅ 콘텐츠 패턴에서 특수 문자를 escape하기
✅ 테스트 파일 제외(exclusion) 추가하기
✅ 파일 경로 패턴은 좁고 구체적으로 만들기

### 하지 말 것(DON'T):
❌ 지나치게 일반적인 키워드 사용("system", "work")
❌ 의도 패턴을 너무 넓게 만들기(오탐)
❌ 패턴을 너무 좁게 만들기(미탐)
❌ 정규식 테스터(https://regex101.com/)로 테스트하는 것을 잊기
❌ greedy regex 사용하기: `.*?` 대신 `.*`
❌ 파일 경로에서 너무 넓게 매칭하기

### 트리거 테스트하기

**키워드/의도 트리거 테스트:**
```bash
echo '{"session_id":"test","prompt":"your test prompt"}' | \
  npx tsx .codex/hooks/skill-activation-prompt.ts
```

**파일 경로/콘텐츠 트리거 테스트:**
```bash
cat <<'EOF' | npx tsx .codex/hooks/skill-verification-guard.ts
{
  "session_id": "test",
  "tool_name": "Edit",
  "tool_input": {"file_path": "/path/to/test/file.ts"}
}
EOF
```

---

**관련 파일:**
- [SKILL.md](SKILL.md) - 메인 스킬 가이드
- [SKILL_RULES_REFERENCE.md](SKILL_RULES_REFERENCE.md) - skill-rules.json 전체 스키마
- [PATTERNS_LIBRARY.md](PATTERNS_LIBRARY.md) - 바로 사용할 수 있는 패턴 라이브러리
