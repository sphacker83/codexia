---
name: skill-developer
description: Anthropic 모범 사례에 따라 Agent Workflows 스킬을 만들고 관리합니다. 새 스킬 생성, skill-rules.json 수정, 트리거 패턴 이해, 훅 작업, 스킬 활성화 디버깅, 점진적 공개(progressive disclosure) 구현 시 사용하세요. 스킬 구조, YAML 프론트매터, 트리거 유형(키워드, 의도 패턴, 파일 경로, 콘텐츠 패턴), enforcement 레벨(block/suggest/warn), 훅 메커니즘(UserPromptSubmit/PreToolUse), 세션 추적, 500줄 규칙을 다룹니다.
---

# 스킬 개발자 가이드

## 목적

자동 활성화 시스템이 있는 Agent Workflows에서 스킬을 만들고 관리하기 위한 포괄 가이드입니다. 500줄 규칙과 점진적 공개(progressive disclosure) 패턴을 포함한 Anthropic 공식 모범 사례를 따릅니다.

## 이 스킬을 사용해야 하는 경우

다음 내용을 언급하면 자동으로 활성화됩니다:
- 스킬 생성/추가
- 스킬 트리거/규칙 수정
- 스킬 활성화 동작 방식 이해
- 스킬 활성화 이슈 디버깅
- skill-rules.json 작업
- 훅 시스템 메커니즘
- Agent Workflows 모범 사례
- 점진적 공개(progressive disclosure)
- YAML 프론트매터
- 500줄 규칙

---

## 시스템 개요

### 2-훅 아키텍처

**1. UserPromptSubmit 훅** (선제적 제안)
- **파일**: `.agents/workflows/hooks/skill-activation-prompt.ts`
- **트리거**: Gemini가 사용자 프롬프트를 보기 **이전**
- **목적**: 키워드 + 의도 패턴을 기반으로 관련 스킬 제안
- **방식**: 포맷된 리마인더를 컨텍스트로 주입(stdout → Gemini 입력)
- **사용 사례**: 주제 기반 스킬, 암묵적 작업 감지

**2. Stop 훅 - 에러 처리 리마인더** (부드러운 리마인더)
- **파일**: `.agents/workflows/hooks/error-handling-reminder.ts`
- **트리거**: Gemini가 응답을 마친 **이후**
- **목적**: 작성한 코드의 에러 처리를 스스로 점검하도록 부드럽게 리마인드
- **방식**: 편집된 파일의 위험 패턴을 분석하고 필요 시 리마인더를 표시
- **사용 사례**: 워크플로 차단 없이 에러 처리 인식 유지

**철학 변경(2025-10-27):** Sentry/에러 처리에 대해 PreToolUse로 차단하던 방식에서 벗어났습니다. 대신 워크플로를 막지 않으면서 코드 품질 인식을 유지하는, 응답 이후의 부드러운 리마인더를 사용합니다.

### 설정 파일

**위치**: `.agents/workflows/skills/skill-rules.json`

정의 내용:
- 모든 스킬과 각 스킬의 트리거 조건
- enforcement 레벨(block, suggest, warn)
- 파일 경로 패턴(glob)
- 콘텐츠 감지 패턴(regex)
- 스킵 조건(세션 추적, 파일 마커, 환경 변수)

---

## 스킬 유형

### 1. 가드레일(Guardrail) 스킬

**목적:** 오류를 방지하는 핵심 모범 사례를 강제

**특징:**
- 타입(Type): `"guardrail"`
- enforcement: `"block"`
- 우선순위(Priority): `"critical"` 또는 `"high"`
- 스킬을 사용하기 전까지 파일 편집을 차단
- 흔한 실수(컬럼명, 치명적 오류 등) 예방
- 세션 인지(Session-aware): 같은 세션에서 잔소리를 반복하지 않음

**예시:**
- `database-verification` - Prisma 쿼리 전에 테이블/컬럼명 검증
- `frontend-dev-guidelines` - React/TypeScript 패턴 준수 유도

**사용 시점:**
- 런타임 에러를 유발하는 실수
- 데이터 무결성 우려
- 치명적인 호환성 이슈

### 2. 도메인(Domain) 스킬

**목적:** 특정 영역에 대한 포괄적인 가이드를 제공

**특징:**
- 타입(Type): `"domain"`
- enforcement: `"suggest"`
- 우선순위(Priority): `"high"` 또는 `"medium"`
- 강제가 아니라 안내(Advisory)
- 주제/도메인 특화
- 포괄적인 문서 제공

**예시:**
- `backend-dev-guidelines` - Node.js/Express/TypeScript 패턴
- `frontend-dev-guidelines` - React/TypeScript 모범 사례
- `error-tracking` - Sentry 통합 가이드

**사용 시점:**
- 깊은 지식이 필요한 복잡한 시스템
- 모범 사례 문서화
- 아키텍처 패턴
- How-to 가이드

---

## 빠른 시작: 새 스킬 만들기

### 1단계: 스킬 파일 만들기

**위치:** `.agents/workflows/skills/{skill-name}/SKILL.md`

**템플릿:**
```markdown
---
name: my-new-skill
description: 이 스킬을 트리거하는 키워드를 포함한 간단한 설명을 적습니다. 주제, 파일 타입, 사용 사례를 언급하세요. 트리거 용어는 명확하게 쓰세요.
---

# 새 스킬

## 목적
이 스킬이 도와주는 것

## 사용 시점
구체적인 상황과 조건

## 핵심 정보
실제 가이드, 문서, 패턴, 예시
```

**모범 사례:**
- ✅ **name**: 소문자 + 하이픈, 동명사형(동사 + -ing) 권장
- ✅ **description**: 트리거 키워드/구문을 **모두** 포함(최대 1024자)
- ✅ **내용**: 500줄 이하 유지(자세한 내용은 레퍼런스 파일로)
- ✅ **예시**: 실제 코드 예시 포함
- ✅ **구조**: 명확한 헤딩/리스트/코드 블록

### 2단계: skill-rules.json에 추가

[SKILL_RULES_REFERENCE.md](SKILL_RULES_REFERENCE.md)에서 전체 스키마를 확인하세요.

**기본 템플릿:**
```json
{
  "my-new-skill": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "medium",
    "promptTriggers": {
      "keywords": ["keyword1", "keyword2"],
      "intentPatterns": ["(create|add).*?something"]
    }
  }
}
```

### 3단계: 트리거 테스트

**UserPromptSubmit 테스트:**
```bash
echo '{"session_id":"test","prompt":"your test prompt"}' | \
  npx tsx .agents/workflows/hooks/skill-activation-prompt.ts
```

**PreToolUse 테스트:**
```bash
cat <<'EOF' | npx tsx .agents/workflows/hooks/skill-verification-guard.ts
{"session_id":"test","tool_name":"Edit","tool_input":{"file_path":"test.ts"}}
EOF
```

### 4단계: 패턴 개선

테스트 결과를 바탕으로:
- 누락된 키워드 추가
- 오탐(false positive)을 줄이도록 의도 패턴 개선
- 파일 경로 패턴 조정
- 실제 파일에 대해 콘텐츠 패턴을 테스트

### 5단계: Anthropic 모범 사례 준수

✅ SKILL.md는 500줄 이하로 유지
✅ 레퍼런스 파일로 점진적 공개(progressive disclosure) 적용
✅ 100줄 초과 레퍼런스 파일에는 목차 추가
✅ 트리거 키워드를 포함한 상세 description 작성
✅ 문서화 전에 3개 이상의 실제 시나리오로 테스트
✅ 실제 사용 결과를 바탕으로 반복 개선

---

## Enforcement 레벨

### BLOCK(핵심 가드레일)

- Edit/Write 툴 실행을 물리적으로 차단
- 훅에서 종료 코드 2를 반환, stderr → Gemini
- Gemini가 차단 메시지를 보고, 진행하려면 스킬을 사용해야 함
- **사용 시점(Use For)**: 치명적 실수, 데이터 무결성, 보안 이슈

**예시:** DB 컬럼명 검증

### SUGGEST(권장)

- Gemini가 프롬프트를 보기 전에 리마인더를 주입
- Gemini가 관련 스킬을 인지하도록 함
- 강제는 아니고 안내만 제공
- **사용 시점(Use For)**: 도메인 가이드, 모범 사례, How-to 가이드

**예시:** 프론트엔드 개발 가이드라인

### WARN(선택)

- 낮은 우선순위의 제안
- 안내만 제공, 최소한의 강제
- **사용 시점(Use For)**: 있으면 좋은 제안, 정보성 리마인더

**거의 사용하지 않음** - 대부분의 스킬은 BLOCK 또는 SUGGEST입니다.

---

## 스킵 조건 & 사용자 제어

### 1. 세션 추적

**목적:** 같은 세션에서 반복 차단/잔소리 방지

**동작 방식:**
- 첫 편집 → 훅이 차단하고 세션 상태를 업데이트
- 두 번째 편집(같은 세션) → 훅이 허용
- 다른 세션 → 다시 차단

**상태 파일:** `.agents/workflows/hooks/state/skills-used-{session_id}.json`

### 2. 파일 마커

**목적:** 검증된 파일은 영구적으로 스킵

**마커:** `// @skip-validation`

**사용 예:**
```typescript
// @skip-validation
import { PrismaService } from './prisma';
// 이 파일은 수동으로 검증되었습니다
```

**주의:** 남용하면 목적을 무력화합니다. 필요한 경우에만 사용하세요.

### 3. 환경 변수

**목적:** 긴급 비활성화, 임시 오버라이드

**전체 비활성화(Global disable):**
```bash
export SKIP_SKILL_GUARDRAILS=true  # 모든 PreToolUse 차단을 비활성화
```

**스킬별(Skill-specific):**
```bash
export SKIP_DB_VERIFICATION=true
export SKIP_ERROR_REMINDER=true
```

---

## 테스트 체크리스트

새 스킬을 만들 때는 아래를 확인하세요:

- [ ] `.agents/workflows/skills/{name}/SKILL.md`에 스킬 파일 생성
- [ ] name/description이 포함된 올바른 프론트매터 작성
- [ ] `skill-rules.json`에 엔트리 추가
- [ ] 실제 프롬프트로 키워드 테스트
- [ ] 다양한 표현으로 의도 패턴 테스트
- [ ] 실제 파일로 파일 경로 패턴 테스트
- [ ] 파일 내용에 대해 콘텐츠 패턴 테스트
- [ ] (가드레일인 경우) 차단 메시지가 명확하고 실행 가능(actionable)함
- [ ] 스킵 조건이 적절히 설정됨
- [ ] 우선순위가 중요도와 일치함
- [ ] 테스트에서 오탐(false positive)이 없음
- [ ] 테스트에서 미탐(false negative)이 없음
- [ ] 성능이 허용 범위(<100ms 또는 <200ms)임
- [ ] JSON 문법 검증: `jq . skill-rules.json`
- [ ] **SKILL.md 500줄 이하** ⭐
- [ ] 필요 시 레퍼런스 파일 생성
- [ ] 100줄 초과 파일에 목차 추가

---

## 레퍼런스 파일

특정 주제의 자세한 내용은 아래 레퍼런스를 참고하세요:

### [TRIGGER_TYPES.md](TRIGGER_TYPES.md)
모든 트리거 유형에 대한 완전한 가이드:
- 키워드 트리거(명시적 주제 매칭)
- 의도 패턴(암묵적 액션 감지)
- 파일 경로 트리거(glob 패턴)
- 콘텐츠 패턴(파일 내 regex)
- 각 유형별 모범 사례와 예시
- 흔한 함정과 테스트 전략

### [SKILL_RULES_REFERENCE.md](SKILL_RULES_REFERENCE.md)
skill-rules.json 전체 스키마:
- TypeScript 인터페이스 정의 전체
- 필드별 설명
- 가드레일 스킬 완전 예시
- 도메인 스킬 완전 예시
- 검증 가이드와 흔한 오류

### [HOOK_MECHANISMS.md](HOOK_MECHANISMS.md)
훅 내부 동작 딥 다이브:
- UserPromptSubmit 플로우(상세)
- PreToolUse 플로우(상세)
- 종료 코드 동작 테이블(CRITICAL)
- 세션 상태 관리
- 성능 고려사항

### [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
포괄적인 디버깅 가이드:
- 스킬이 트리거되지 않음(UserPromptSubmit)
- PreToolUse가 차단하지 않음
- 오탐(false positive)이 많음(트리거 과다)
- 훅이 아예 실행되지 않음
- 성능 이슈

### [PATTERNS_LIBRARY.md](PATTERNS_LIBRARY.md)
바로 사용할 수 있는 패턴 모음:
- 의도 패턴 라이브러리(regex)
- 파일 경로 패턴 라이브러리(glob)
- 콘텐츠 패턴 라이브러리(regex)
- 사용 사례별 정리
- 복사-붙여넣기 가능

### [ADVANCED.md](ADVANCED.md)
향후 개선과 아이디어:
- 동적 규칙 업데이트
- 스킬 의존성
- 조건부 enforcement
- 스킬 분석(analytics)
- 스킬 버저닝(versioning)

---

## 빠른 참조 요약

### 새 스킬 만들기(5단계)

1. 프론트매터를 포함해 `.agents/workflows/skills/{name}/SKILL.md` 생성
2. `.agents/workflows/skills/skill-rules.json`에 엔트리 추가
3. `npx tsx` 명령으로 테스트
4. 테스트 결과를 바탕으로 패턴 개선
5. SKILL.md는 500줄 이하로 유지

### 트리거 유형

- **Keywords**: 주제를 명시적으로 언급
- **Intent**: 액션을 암묵적으로 감지
- **File Paths**: 위치(경로) 기반 활성화
- **Content**: 기술/패턴 기반 감지

[TRIGGER_TYPES.md](TRIGGER_TYPES.md)에서 자세한 내용을 확인하세요.

### Enforcement

- **BLOCK**: 종료 코드 2, 치명적 상황에만
- **SUGGEST**: 컨텍스트 주입, 가장 흔함
- **WARN**: 안내만 제공, 거의 사용하지 않음

### 스킵 조건

- **세션 추적**: 자동(반복 차단/잔소리 방지)
- **파일 마커**: `// @skip-validation`(영구 스킵)
- **환경 변수**: `SKIP_SKILL_GUARDRAILS`(긴급 비활성화)

### Anthropic 모범 사례

✅ **500줄 규칙**: SKILL.md는 500줄 이하로 유지
✅ **점진적 공개**: 자세한 내용은 레퍼런스 파일로 분리
✅ **목차**: 100줄 초과 레퍼런스 파일에 목차 추가
✅ **1단계 깊이**: 레퍼런스를 깊게 중첩하지 않기
✅ **풍부한 description**: 모든 트리거 키워드 포함(최대 1024자)
✅ **먼저 테스트**: 자세한 문서화 전에 3개 이상 평가/테스트 구성
✅ **동명사 네이밍**: 동사 + -ing 권장(예: "processing-pdfs")

### 트러블슈팅

훅을 수동으로 테스트:
```bash
# UserPromptSubmit
echo '{"prompt":"test"}' | npx tsx .agents/workflows/hooks/skill-activation-prompt.ts

# PreToolUse
cat <<'EOF' | npx tsx .agents/workflows/hooks/skill-verification-guard.ts
{"tool_name":"Edit","tool_input":{"file_path":"test.ts"}}
EOF
```

전체 디버깅 가이드는 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)를 참고하세요.

---

## 관련 파일

**설정(Configuration):**
- `.agents/workflows/skills/skill-rules.json` - 마스터 설정
- `.agents/workflows/hooks/state/` - 세션 추적
- `.agents/workflows/settings.json` - 훅 등록

**훅(Hooks):**
- `.agents/workflows/hooks/skill-activation-prompt.ts` - UserPromptSubmit
- `.agents/workflows/hooks/error-handling-reminder.ts` - Stop 이벤트(부드러운 리마인더)

**모든 스킬(All Skills):**
- `.agents/workflows/skills/*/SKILL.md` - 스킬 콘텐츠 파일

---

**스킬 상태(Skill Status)**: COMPLETE - Anthropic 모범 사례에 맞게 재구성 ✅
**라인 수(Line Count)**: < 500 (500줄 규칙 준수) ✅
**점진적 공개(Progressive Disclosure)**: 자세한 내용은 레퍼런스 파일로 분리 ✅

**다음(Next)**: 더 많은 스킬을 만들고, 실제 사용 결과를 바탕으로 패턴을 개선하세요
