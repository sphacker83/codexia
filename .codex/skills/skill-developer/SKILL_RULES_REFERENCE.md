# skill-rules.json - 완전 레퍼런스

`.codex/skills/skill-rules.json`의 스키마와 설정에 대한 완전 레퍼런스입니다.

## 목차

- [파일 위치](#file-location)
- [전체 TypeScript 스키마](#complete-typescript-schema)
- [필드 가이드](#field-guide)
- [예시: 가드레일 스킬](#example-guardrail-skill)
- [예시: 도메인 스킬](#example-domain-skill)
- [검증](#validation)

---

## 파일 위치

**경로(Path):** `.codex/skills/skill-rules.json`

이 JSON 파일은 자동 활성화 시스템을 위해, 모든 스킬과 트리거 조건을 정의합니다.

---

## 전체 TypeScript 스키마

```typescript
interface SkillRules {
    version: string;
    skills: Record<string, SkillRule>;
}

interface SkillRule {
    type: 'guardrail' | 'domain';
    enforcement: 'block' | 'suggest' | 'warn';
    priority: 'critical' | 'high' | 'medium' | 'low';

    promptTriggers?: {
        keywords?: string[];
        intentPatterns?: string[];  // 정규식 문자열(Regex strings)
    };

    fileTriggers?: {
        pathPatterns: string[];     // glob 패턴(Glob patterns)
        pathExclusions?: string[];  // glob 패턴(Glob patterns)
        contentPatterns?: string[]; // 정규식 문자열(Regex strings)
        createOnly?: boolean;       // 파일 생성 시에만 트리거
    };

    blockMessage?: string;  // 가드레일용, {file_path} 플레이스홀더

    skipConditions?: {
        sessionSkillUsed?: boolean;      // 세션에서 이미 사용했으면 스킵
        fileMarkers?: string[];          // 예: ["@skip-validation"]
        envOverride?: string;            // 예: "SKIP_DB_VERIFICATION"
    };
}
```

---

## 필드 가이드

### 최상위(Top Level)

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `version` | string | 예 | 스키마 버전(현재 "1.0") |
| `skills` | object | 예 | 스킬 이름 → SkillRule 매핑 |

### SkillRule 필드

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `type` | string | 예 | "guardrail"(강제) 또는 "domain"(안내) |
| `enforcement` | string | 예 | "block"(PreToolUse), "suggest"(UserPromptSubmit), 또는 "warn" |
| `priority` | string | 예 | "critical", "high", "medium", 또는 "low" |
| `promptTriggers` | object | 선택 | UserPromptSubmit 훅 트리거 |
| `fileTriggers` | object | 선택 | PreToolUse 훅 트리거 |
| `blockMessage` | string | 선택* | enforcement="block"이면 필수. `{file_path}` 플레이스홀더 사용 |
| `skipConditions` | object | 선택 | 우회(escape hatch) 및 세션 추적 |

*가드레일(guardrail)에는 필수

### promptTriggers 필드

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `keywords` | string[] | 선택 | 부분 문자열 정확 매칭(대소문자 무시) |
| `intentPatterns` | string[] | 선택 | 의도 감지를 위한 정규식 패턴 |

### fileTriggers 필드

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `pathPatterns` | string[] | 예* | 파일 경로용 glob 패턴 |
| `pathExclusions` | string[] | 선택 | 제외할 glob 패턴(예: 테스트 파일) |
| `contentPatterns` | string[] | 선택 | 파일 내용을 매칭하는 정규식 패턴 |
| `createOnly` | boolean | 선택 | 새 파일 생성 시에만 트리거 |

*fileTriggers가 있으면 필수

### skipConditions 필드

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `sessionSkillUsed` | boolean | 선택 | 이 세션에서 이미 스킬을 사용했으면 스킵 |
| `fileMarkers` | string[] | 선택 | 파일에 코멘트 마커가 있으면 스킵 |
| `envOverride` | string | 선택 | 스킬 비활성화를 위한 환경 변수 이름 |

---

## 예시: 가드레일(Guardrail) 스킬

모든 기능을 포함한 차단형 가드레일 스킬 완전 예시:

```json
{
  "database-verification": {
    "type": "guardrail",
    "enforcement": "block",
    "priority": "critical",

    "promptTriggers": {
      "keywords": [
        "prisma",
        "database",
        "table",
        "column",
        "schema",
        "query",
        "migration"
      ],
      "intentPatterns": [
        "(add|create|implement).*?(user|login|auth|tracking|feature)",
        "(modify|update|change).*?(table|column|schema|field)",
        "database.*?(change|update|modify|migration)"
      ]
    },

    "fileTriggers": {
      "pathPatterns": [
        "**/schema.prisma",
        "**/migrations/**/*.sql",
        "database/src/**/*.ts",
        "form/src/**/*.ts",
        "email/src/**/*.ts",
        "users/src/**/*.ts",
        "projects/src/**/*.ts",
        "utilities/src/**/*.ts"
      ],
      "pathExclusions": [
        "**/*.test.ts",
        "**/*.spec.ts"
      ],
      "contentPatterns": [
        "import.*[Pp]risma",
        "PrismaService",
        "prisma\\.",
        "\\.findMany\\(",
        "\\.findUnique\\(",
        "\\.findFirst\\(",
        "\\.create\\(",
        "\\.createMany\\(",
        "\\.update\\(",
        "\\.updateMany\\(",
        "\\.upsert\\(",
        "\\.delete\\(",
        "\\.deleteMany\\("
      ]
    },

    "blockMessage": "⚠️ BLOCKED - 데이터베이스 작업 감지\n\n📋 REQUIRED ACTION(필수 조치):\n1. Skill 툴 사용: 'database-verification'\n2. 스키마 기준으로 모든 테이블/컬럼명 검증\n3. DESCRIBE 명령으로 DB 구조 확인\n4. 그 다음 이 편집을 재시도\n\nReason: Prisma 쿼리에서 컬럼명 오류를 방지\nFile: {file_path}\n\n💡 TIP: 향후 검사를 스킵하려면 '// @skip-validation' 주석을 추가하세요",

    "skipConditions": {
      "sessionSkillUsed": true,
      "fileMarkers": [
        "@skip-validation"
      ],
      "envOverride": "SKIP_DB_VERIFICATION"
    }
  }
}
```

### 가드레일 핵심 포인트

1. **type**: "guardrail"이어야 함
2. **enforcement**: "block"이어야 함
3. **priority**: 보통 "critical" 또는 "high"
4. **blockMessage**: 필수, 명확하고 실행 가능한 단계(actionable steps)
5. **skipConditions**: 세션 추적으로 반복 차단/잔소리 방지
6. **fileTriggers**: 보통 path/content 패턴을 모두 포함
7. **contentPatterns**: 기술의 실제 사용을 포착

---

## 예시: 도메인(Domain) 스킬

제안(suggest) 기반 도메인 스킬의 완전 예시:

```json
{
  "project-catalog-developer": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",

    "promptTriggers": {
      "keywords": [
        "layout",
        "layout system",
        "grid",
        "grid layout",
        "toolbar",
        "column",
        "cell editor",
        "cell renderer",
        "submission",
        "submissions",
        "blog dashboard",
        "datagrid",
        "data grid",
        "CustomToolbar",
        "GridLayoutDialog",
        "useGridLayout",
        "auto-save",
        "column order",
        "column width",
        "filter",
        "sort"
      ],
      "intentPatterns": [
        "(how does|how do|explain|what is|describe).*?(layout|grid|toolbar|column|submission|catalog)",
        "(add|create|modify|change).*?(toolbar|column|cell|editor|renderer)",
        "blog dashboard.*?"
      ]
    },

    "fileTriggers": {
      "pathPatterns": [
        "frontend/src/features/submissions/**/*.tsx",
        "frontend/src/features/submissions/**/*.ts"
      ],
      "pathExclusions": [
        "**/*.test.tsx",
        "**/*.test.ts"
      ]
    }
  }
}
```

### 도메인 스킬 핵심 포인트

1. **type**: "domain"이어야 함
2. **enforcement**: 보통 "suggest"
3. **priority**: "high" 또는 "medium"
4. **blockMessage**: 불필요(차단하지 않음)
5. **skipConditions**: 선택(상대적으로 덜 중요)
6. **promptTriggers**: 보통 많은 키워드를 포함
7. **fileTriggers**: path 패턴만 가질 수 있음(content는 덜 중요)

---

## 검증

### JSON 문법 확인

```bash
cat .codex/skills/skill-rules.json | jq .
```

정상이면 jq가 JSON을 보기 좋게 출력합니다. 비정상이면 오류를 표시합니다.

### 흔한 JSON 오류

**끝의 쉼표(Trailing comma):**
```json
{
  "keywords": ["one", "two",]  // ❌ 끝의 쉼표(trailing comma)
}
```

**따옴표 누락(Missing quotes):**
```json
{
  type: "guardrail"  // ❌ 키에 따옴표 누락
}
```

**작은따옴표(유효하지 않은 JSON):**
```json
{
  'type': 'guardrail'  // ❌ 큰따옴표를 사용해야 함
}
```

### 검증 체크리스트

- [ ] JSON 문법이 유효함(`jq` 사용)
- [ ] 모든 스킬 이름이 SKILL.md 프론트매터와 일치함
- [ ] 가드레일(guardrail)에 `blockMessage`가 있음
- [ ] blockMessage에 `{file_path}` 플레이스홀더를 사용함
- [ ] 의도 패턴이 유효한 정규식(regex)임( regex101.com 에서 테스트)
- [ ] 파일 경로 패턴이 올바른 glob 문법을 사용함
- [ ] 콘텐츠 패턴에서 특수 문자를 escape함
- [ ] priority가 enforcement 레벨과 일치함
- [ ] 중복된 스킬 이름이 없음

---

**관련 파일:**
- [SKILL.md](SKILL.md) - 메인 스킬 가이드
- [TRIGGER_TYPES.md](TRIGGER_TYPES.md) - 트리거 문서 전체
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - 설정 이슈 디버깅
