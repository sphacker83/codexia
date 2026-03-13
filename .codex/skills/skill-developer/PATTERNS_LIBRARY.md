# 공통 패턴 라이브러리

스킬 트리거에 바로 사용할 수 있는 정규식(regex)과 glob 패턴 모음입니다. 복사해서 스킬에 맞게 커스터마이즈하세요.

---

## 의도(Intent) 패턴(Regex)

### 기능/엔드포인트 생성
```regex
(add|create|implement|build).*?(feature|endpoint|route|service|controller)
```

### 컴포넌트 생성
```regex
(create|add|make|build).*?(component|UI|page|modal|dialog|form)
```

### DB 작업
```regex
(add|create|modify|update).*?(user|table|column|field|schema|migration)
(database|prisma).*?(change|update|query)
```

### 에러 처리
```regex
(fix|handle|catch|debug).*?(error|exception|bug)
(add|implement).*?(try|catch|error.*?handling)
```

### 설명 요청
```regex
(how does|how do|explain|what is|describe|tell me about).*?
```

### 워크플로 작업
```regex
(create|add|modify|update).*?(workflow|step|branch|condition)
(debug|troubleshoot|fix).*?workflow
```

### 테스트
```regex
(write|create|add).*?(test|spec|unit.*?test)
```

---

## 파일 경로 패턴(Glob)

### 프론트엔드
```glob
frontend/src/**/*.tsx        # All React components
frontend/src/**/*.ts         # All TypeScript files
frontend/src/components/**   # Only components directory
```

### 백엔드 서비스
```glob
form/src/**/*.ts            # Form service
email/src/**/*.ts           # Email service
users/src/**/*.ts           # Users service
projects/src/**/*.ts        # Projects service
```

### 데이터베이스
```glob
**/schema.prisma            # Prisma schema (anywhere)
**/migrations/**/*.sql      # Migration files
database/src/**/*.ts        # Database scripts
```

### 워크플로
```glob
form/src/workflow/**/*.ts              # Workflow engine
form/src/workflow-definitions/**/*.json # Workflow definitions
```

### 테스트 제외
```glob
**/*.test.ts                # TypeScript tests
**/*.test.tsx               # React component tests
**/*.spec.ts                # Spec files
```

---

## 콘텐츠 패턴(Regex)

### Prisma/DB
```regex
import.*[Pp]risma                # Prisma imports
PrismaService                    # PrismaService usage
prisma\.                         # prisma.something
\.findMany\(                     # Prisma query methods
\.create\(
\.update\(
\.delete\(
```

### 컨트롤러/라우트
```regex
export class.*Controller         # Controller classes
router\.                         # Express router
app\.(get|post|put|delete|patch) # Express app routes
```

### 에러 처리
```regex
try\s*\{                        # Try blocks
catch\s*\(                      # Catch blocks
throw new                        # Throw statements
```

### React/컴포넌트
```regex
export.*React\.FC               # React functional components
export default function.*       # Default function exports
useState|useEffect              # React hooks
```

---

**사용 예시:**

```json
{
  "my-skill": {
    "promptTriggers": {
      "intentPatterns": [
        "(create|add|build).*?(component|UI|page)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "frontend/src/**/*.tsx"
      ],
      "contentPatterns": [
        "export.*React\\.FC",
        "useState|useEffect"
      ]
    }
  }
}
```

---

**관련 파일:**
- [SKILL.md](SKILL.md) - Main skill guide
- [TRIGGER_TYPES.md](TRIGGER_TYPES.md) - Detailed trigger documentation
- [SKILL_RULES_REFERENCE.md](SKILL_RULES_REFERENCE.md) - Complete schema
