# 스킬

컨텍스트에 따라 자동 활성화되는, 프로덕션에서 검증된 Roo Codex용 스킬 모음입니다.

---

## 스킬이란?

스킬은 필요할 때 Codex가 로드하는 모듈형 지식 베이스입니다. 스킬은 다음을 제공합니다:
- 도메인별 가이드라인
- 모범 사례
- 코드 예제
- 피해야 할 안티패턴

**문제:** 기본 설정만으로는 스킬이 자동으로 활성화되지 않습니다.

**해결:** 이 쇼케이스에는 스킬이 자동 활성화되도록 만드는 훅(hook) + 설정이 포함되어 있습니다.

---

## adhdtime 프로젝트 적용 상태

현재 저장소 기준으로 `skill-rules.json`이 다음처럼 튜닝되어 있습니다.

- 프론트엔드(Next.js App Router) 경로 `app/`, `components/`, `lib/`, `types/`에 맞춘 파일 트리거
- 한글/영문 프롬프트를 모두 인식하도록 키워드/의도 패턴 확장
- `frontend-dev-guidelines`는 이 프로젝트에서 과차단을 피하기 위해 `suggest` 모드로 설정

---

## 제공되는 스킬

현재 기준 **10개 스킬**이 포함되어 있습니다.

### skill-developer (메타 스킬)
**목적:** Roo Codex 스킬 생성 및 관리

**파일:** 리소스 파일 7개(총 426줄)

**사용 시점:**
- 새 스킬을 만들 때
- 스킬 구조를 이해할 때
- skill-rules.json을 다룰 때
- 스킬 활성화 문제를 디버깅할 때

**커스터마이징:** ✅ 없음 - 그대로 복사해서 사용

**[스킬 보기 →](skill-developer/)**

---

### backend-dev-guidelines
**목적:** Node.js/Express/TypeScript 개발 패턴

**파일:** 리소스 파일 12개(메인 304줄 + 리소스)

**포함 내용:**
- 레이어드 아키텍처(라우트 → 컨트롤러 → 서비스 → 리포지토리)
- BaseController 패턴
- Prisma DB 접근
- Sentry 에러 트래킹
- Zod 검증
- UnifiedConfig 패턴
- 의존성 주입
- 테스트 전략

**사용 시점:**
- API 라우트를 생성/수정할 때
- 컨트롤러 또는 서비스를 만들 때
- Prisma로 DB 작업을 할 때
- 에러 트래킹을 설정할 때

**커스터마이징:** ⚠️ skill-rules.json의 `pathPatterns`를 백엔드 디렉터리에 맞게 업데이트하세요

**pathPatterns 예시:**
```json
{
  "pathPatterns": [
    "src/api/**/*.ts",       // src/api를 쓰는 단일 앱
    "backend/**/*.ts",       // backend 디렉터리
    "services/*/src/**/*.ts" // 멀티 서비스 모노레포
  ]
}
```

**[스킬 보기 →](backend-dev-guidelines/)**

---

### frontend-dev-guidelines
**목적:** React/TypeScript/MUI v7 개발 패턴

**파일:** 리소스 파일 11개(메인 398줄 + 리소스)

**포함 내용:**
- 최신 React 패턴(Suspense, lazy loading)
- 데이터 페칭을 위한 useSuspenseQuery
- MUI v7 스타일링(`size={{}}` prop을 사용하는 Grid)
- TanStack Router
- 파일 구성(features/ 패턴)
- 성능 최적화
- TypeScript 모범 사례

**사용 시점:**
- React 컴포넌트를 만들 때
- TanStack Query로 데이터를 가져올 때
- MUI v7로 스타일링할 때
- 라우팅을 설정할 때

**커스터마이징:** ⚠️ `pathPatterns`를 업데이트하고 React/MUI를 사용 중인지 확인하세요

**pathPatterns 예시:**
```json
{
  "pathPatterns": [
    "src/**/*.tsx",          // 단일 React 앱
    "frontend/src/**/*.tsx", // 프론트엔드 디렉터리
    "apps/web/**/*.tsx"      // 모노레포 웹 앱
  ]
}
```

**참고:** 이 저장소에서는 과차단을 피하기 위해 enforcement를 **"suggest"**로 설정했습니다.

**[스킬 보기 →](frontend-dev-guidelines/)**

---

### flutter-dev-guidelines (기본 진입 + 라우터)
**목적:** Flutter 신규 개발 기본 가이드이자 아키텍처/테스트/디버깅/검증 게이트 분류 인덱스

**사용 시점:**
- Flutter/플러터가 단독으로 언급되거나 신규 개발을 시작할 때
- 어떤 Flutter 하위 스킬을 병행할지 먼저 분류할 때
- 전체 작업 플로우(구현 -> 테스트 -> 게이트 검증)를 잡을 때

**하위 스킬 라우팅:**
- 설계/레이어/모델/DI/패키지 선정 -> `flutter-architecture-guidelines`
- unit/widget/integration 테스트 설계 -> `flutter-testing-guidelines`
- Inspector/DevTools/플랫폼/성능 디버깅 -> `flutter-debugging-guidelines`
- G1~G5(+G4b) 판정/증빙 -> `flutter-validation-gates`

**[스킬 보기 →](flutter-dev-guidelines/)**

---

### flutter-architecture-guidelines
**목적:** MVVM + Clean Architecture, 모델 경계(Entity/DTO/Model/Mapper/VO), DI(단일 Composition Root), Flutter Favorite 정책 강제

**사용 시점:**
- 신규 feature 구조를 설계/구현할 때
- Entity/DTO/Mapper 분리나 DI 바인딩을 정리할 때
- 패키지 도입 전 아키텍처 영향도를 검토할 때

**[스킬 보기 →](flutter-architecture-guidelines/)**

---

### flutter-testing-guidelines
**목적:** unit/widget/integration 테스트 전략과 ViewModel 테스트 책임(상태 전이 assertion) 표준화

**사용 시점:**
- 테스트 코드를 신규 작성/수정할 때
- ViewModel 변경에 대응하는 단위 테스트를 보강할 때
- CI 테스트 명령 및 패턴을 정리할 때

**[스킬 보기 →](flutter-testing-guidelines/)**

---

### flutter-debugging-guidelines
**목적:** Flutter Inspector/DevTools 기반 디버깅, lifecycle/플랫폼 이슈 분석, 성능 병목 추적 흐름 제공

**사용 시점:**
- 재현은 되지만 원인이 불명확한 버그를 추적할 때
- Android/iOS 권한/설정/플러그인 이슈를 조사할 때
- 프레임 드랍/메모리 증가 같은 성능 문제를 분석할 때

**[스킬 보기 →](flutter-debugging-guidelines/)**

---

### flutter-validation-gates
**목적:** G1~G5(+G4b) 게이트, 증빙 규칙, PASS/FAIL 판정 명령 표준화

**사용 시점:**
- PR/릴리스 전 완료 판정을 실행할 때
- `dev/evidence/flutter/<task-name>/` 증빙을 생성/검토할 때
- CI 게이트 자동화 기준을 맞출 때

**[스킬 보기 →](flutter-validation-gates/)**

---

### route-tester

**목적:** JWT 쿠키 인증으로 보호된 API 라우트 테스트

**파일:** 메인 파일 1개(389줄)

**포함 내용:**
- JWT 쿠키 기반 인증 테스트
- test-auth-route.js 스크립트 패턴
- 쿠키 인증을 사용하는 cURL
- 인증 이슈 디버깅
- POST/PUT/DELETE 작업 테스트

**사용 시점:**
- API 엔드포인트를 테스트할 때
- 인증 문제를 디버깅할 때
- 라우트 동작을 검증할 때

**커스터마이징:** ⚠️ JWT 쿠키 인증 설정이 필요합니다

**먼저 질문:** "JWT 쿠키 기반 인증을 사용하고 있나요?"
- YES: 서비스 URL을 복사하고 커스터마이즈하세요
- NO: 건너뛰거나, 현재 인증 방식에 맞게 수정하세요

**[스킬 보기 →](route-tester/)**

---

### error-tracking
**목적:** Sentry 에러 트래킹 및 모니터링 패턴

**파일:** 메인 파일 1개(약 250줄)

**포함 내용:**
- Sentry v8 초기화
- 에러 캡처 패턴
- Breadcrumbs 및 사용자 컨텍스트
- 성능 모니터링
- Express/React 통합

**사용 시점:**
- 에러 트래킹을 설정할 때
- 예외를 캡처할 때
- 에러 컨텍스트를 추가할 때
- 프로덕션 이슈를 디버깅할 때

**커스터마이징:** ⚠️ 백엔드에 맞게 `pathPatterns`를 업데이트하세요

**[스킬 보기 →](error-tracking/)**

---

## 프로젝트에 스킬 추가하기

### 빠른 통합

**Roo Codex에서:**
```
User: "내 프로젝트에 backend-dev-guidelines 스킬을 추가해줘"

Codex should:
1. 프로젝트 구조를 질문한다
2. 스킬 디렉터리를 복사한다
3. skill-rules.json의 경로를 사용자의 경로로 업데이트한다
4. 통합을 검증한다
```

전체 안내는 [CODEX_INTEGRATION_GUIDE.md](../../CODEX_INTEGRATION_GUIDE.md)를 참고하세요.

### 수동 통합

**1단계: 스킬 디렉터리 복사**
```bash
cp -r codex-code-infrastructure-showcase/.codex/skills/backend-dev-guidelines \\
      your-project/.codex/skills/
```

**2단계: skill-rules.json 업데이트**

없다면 생성하세요:
```bash
cp codex-code-infrastructure-showcase/.codex/skills/skill-rules.json \\
   your-project/.codex/skills/
```

그 다음 프로젝트에 맞게 `pathPatterns`를 커스터마이즈하세요:
```json
{
  "skills": {
    "backend-dev-guidelines": {
      "fileTriggers": {
        "pathPatterns": [
          "YOUR_BACKEND_PATH/**/*.ts"  // ← 여기 수정!
        ]
      }
    }
  }
}
```

**3단계: 테스트**
- 백엔드 디렉터리 안의 파일을 편집하세요
- 스킬이 자동으로 활성화되어야 합니다

---

## skill-rules.json 설정

### 하는 일

다음 조건에 따라 스킬이 언제 활성화될지 정의합니다:
- 사용자 프롬프트의 **키워드**("backend", "API", "route")
- **의도 패턴**(사용자 의도를 정규식으로 매칭)
- **파일 경로 패턴**(백엔드 파일을 편집할 때)
- **콘텐츠 패턴**(코드에 Prisma 쿼리가 포함될 때)

### 설정 포맷

```json
{
  "skill-name": {
    "type": "domain" | "guardrail",
    "enforcement": "suggest" | "block",
    "priority": "high" | "medium" | "low",
    "promptTriggers": {
      "keywords": ["list", "of", "keywords"],
      "intentPatterns": ["regex patterns"]
    },
    "fileTriggers": {
      "pathPatterns": ["path/to/files/**/*.ts"],
      "contentPatterns": ["import.*Prisma"]
    }
  }
}
```

### Enforcement 레벨

- **suggest**: 스킬을 제안으로 표시(차단하지 않음)
- **block**: 진행 전에 스킬을 반드시 사용해야 함(가드레일)

**"block"을 사용하는 경우:**
- 파괴적 변경 방지(MUI v6→v7)
- 중요한 데이터베이스 작업
- 보안에 민감한 코드

**"suggest"를 사용하는 경우:**
- 일반적인 모범 사례
- 도메인 가이드
- 코드 구성

---

## 나만의 스킬 만들기

다음 내용을 포함한 전체 가이드는 **skill-developer** 스킬을 참고하세요:
- 스킬 YAML 프론트매터 구조
- 리소스 파일 구성
- 트리거 패턴 설계
- 스킬 활성화 테스트

**빠른 템플릿:**
```markdown
---
name: my-skill
description: 이 스킬이 하는 일
---

# 내 스킬 제목

## 목적
[이 스킬이 존재하는 이유]

## 이 스킬을 사용해야 하는 경우
[자동 활성화 시나리오]

## 빠른 참조
[핵심 패턴과 예시]

## 리소스 파일
- [topic-1.md](resources/topic-1.md)
- [topic-2.md](resources/topic-2.md)
```

---

## 문제 해결(트러블슈팅)

### 스킬이 활성화되지 않아요

**확인:**
1. 스킬 디렉터리가 `.codex/skills/`에 있나요?
2. 스킬이 `skill-rules.json`에 등록되어 있나요?
3. `pathPatterns`가 실제 파일과 매칭되나요?
4. 훅이 설치되어 있고 정상 동작하나요?
5. settings.json이 올바르게 설정되어 있나요?

**디버그:**
```bash
# 스킬 존재 확인
ls -la .codex/skills/

# skill-rules.json 검증
cat .codex/skills/skill-rules.json | jq .

# 훅 실행 권한 확인
ls -la .codex/hooks/*.sh

# 훅 수동 실행 테스트
./.codex/hooks/skill-activation-prompt.sh
```

### 스킬이 너무 자주 활성화돼요

skill-rules.json을 업데이트하세요:
- 키워드를 더 구체적으로 만들기
- `pathPatterns`를 더 좁히기
- `intentPatterns`의 구체성을 높이기

### 스킬이 절대 활성화되지 않아요

skill-rules.json을 업데이트하세요:
- 키워드를 더 추가하기
- `pathPatterns`를 더 넓히기
- `intentPatterns`를 더 추가하기

---

## Roo Codex용 가이드

**사용자에게 스킬을 통합해줄 때:**

1. 먼저 **[CODEX_INTEGRATION_GUIDE.md](../../CODEX_INTEGRATION_GUIDE.md)**를 읽으세요
2. 프로젝트 구조를 질문하세요
3. skill-rules.json의 `pathPatterns`를 커스터마이즈하세요
4. 스킬 파일에 하드코딩된 경로가 없는지 확인하세요
5. 통합 후 활성화를 테스트하세요

**자주 하는 실수:**
- 예시 경로(blog-api/, frontend/)를 그대로 두는 것
- 모노레포인지 단일 앱인지 묻지 않는 것
- 커스터마이징 없이 skill-rules.json을 복사하는 것

---

## 다음 단계

1. **쉽게 시작:** 지금 하는 작업과 맞는 스킬 1개를 먼저 추가하세요
2. **활성화 검증:** 관련 파일을 편집했을 때 스킬이 제안되는지 확인하세요
3. **추가 확장:** 첫 스킬이 잘 동작하면 다른 스킬을 추가하세요
4. **커스터마이즈:** 워크플로에 맞게 트리거를 조정하세요

**질문이 있나요?** 더 자세한 통합 가이드는 [CODEX_INTEGRATION_GUIDE.md](../../CODEX_INTEGRATION_GUIDE.md)를 참고하세요.
