# Codex CLI 인프라 쇼케이스 (`.codex`, 한국어판)
**이 문서는 https://github.com/diet103/codex-code-infrastructure-showcase 를 한국어로 번역/정리한 자료를 기반으로, Codex CLI용 `.codex` 구성에 맞게 재작성한 것입니다.**

**실서비스에서 검증된 “스킬 자동 활성화” 인프라를 Codex CLI 환경에서 그대로 재사용**할 수 있도록, 훅/스킬/에이전트/명령어를 레퍼런스로 제공합니다.

> **이 저장소는 동작하는 애플리케이션이 아닙니다.** 레퍼런스 라이브러리입니다. 필요한 것만 복사해서 여러분 프로젝트에 적용하세요.

---

## 포함 내용

**실서비스 검증 완료 인프라:**
- ✅ 훅(Hook)을 통한 **스킬 자동 활성화**
- ✅ **모듈형 스킬 패턴** (500줄 규칙 + 점진적 공개)
- ✅ 복잡한 작업을 위한 **전용 에이전트**
- ✅ 컨텍스트 리셋 이후에도 유지되는 **개발 문서 시스템(Dev Docs)**
- ✅ 일반 블로그 도메인을 사용한 **포괄적 예시**

**구축 투자 시간:** 6개월 반복 개선  
**프로젝트 통합 시간:** 15~30분

---

## 빠른 시작 - 원하는 경로 선택

### 🤖 Codex CLI로 통합 중인가요?

Codex용 단계별 통합 가이드는 [`CODEX_INTEGRATION_GUIDE.md`](../CODEX_INTEGRATION_GUIDE.md)를 읽으세요.

### 🎯 스킬 자동 활성화가 필요해요

**핵심 기능:** 필요할 때 실제로 켜지는 스킬.

**필요한 것:**
1. 스킬 활성화 훅 2개 파일
2. 작업과 관련된 스킬 1~2개
3. 15분

**👉 [설정 가이드: hooks/README.md](hooks/README.md)**

### 📚 스킬 하나만 추가하고 싶어요

[스킬 카탈로그](skills/)에서 필요한 것만 골라 복사하세요.

**제공 스킬:**
- **backend-dev-guidelines** - Node.js/Express/TypeScript 패턴
- **frontend-dev-guidelines** - React/TypeScript/MUI v7 패턴
- **skill-developer** - 스킬 제작용 메타 스킬
- **route-tester** - 인증 API 라우트 테스트
- **error-tracking** - Sentry 연동 패턴

**👉 [스킬 가이드: skills/README.md](skills/README.md)**

### 🤖 전용 에이전트를 쓰고 싶어요

복잡한 작업을 위한 실전 검증 에이전트 10종:
- 코드 아키텍처 리뷰
- 리팩터링 지원
- 문서 생성
- 오류 디버깅
- 그 외 다수

**👉 [에이전트 가이드: agents/README.md](agents/README.md)**

---

## 무엇이 다른가?

### 자동 활성화의 핵심 돌파구

**문제:** 스킬이 그냥 방치됩니다. 직접 기억해서 써야 합니다.

**해결:** `UserPromptSubmit` 훅이 다음을 수행합니다.
- 프롬프트 분석
- 파일 컨텍스트 확인
- 관련 스킬 자동 제안
- `skill-rules.json` 설정 기반 동작

**결과:** "기억날 때"가 아니라 "필요할 때" 스킬이 활성화됩니다.

### 실서비스 검증 패턴

이론 예제가 아니라 실제 환경에서 추출했습니다.
- ✅ 운영 중인 마이크로서비스 6개
- ✅ TypeScript 50,000줄 이상
- ✅ 복잡한 데이터 그리드가 있는 React 프론트엔드
- ✅ 고도화된 워크플로우 엔진
- ✅ 6개월간의 일일 AI 코딩 에이전트 활용

실문제를 해결했기 때문에 동작합니다.

### 모듈형 스킬 (500줄 규칙)

큰 스킬은 컨텍스트 한도에 걸립니다. 해결 구조는 다음과 같습니다.

```
skill-name/
  SKILL.md                  # 500줄 미만, 상위 가이드
  resources/
    topic-1.md              # 각 파일 500줄 미만
    topic-2.md
    topic-3.md
```

**점진적 공개:** 에이전트는 먼저 메인 스킬을 읽고, 필요할 때만 리소스 파일을 추가로 로드합니다.

---

## 디렉터리 구조 (`.codex`)

```
.codex/
├── skills/                 # 실전 스킬 5개 + skill-rules.json
│   ├── backend-dev-guidelines/
│   ├── frontend-dev-guidelines/
│   ├── skill-developer/
│   ├── route-tester/
│   ├── error-tracking/
│   └── skill-rules.json
├── hooks/                  # 자동화를 위한 훅
│   ├── skill-activation-prompt.*  (필수)
│   ├── post-tool-use-tracker.sh   (필수)
│   ├── tsc-check.sh        (선택, 커스터마이징 필요)
│   └── trigger-build-resolver.sh  (선택)
├── agents/                 # 전용 에이전트 10개
├── commands/               # 슬래시 명령어
├── settings.json           # 예시 설정(프로젝트에 맞게 병합)
└── settings.local.json     # 로컬 권한/예외(환경별)
```

---

## 구성요소 카탈로그

### 🎨 스킬 (5)

| 스킬 | 목적 | 적합한 용도 |
|-------|---------|----------|
| [**skill-developer**](skills/skill-developer/) | 스킬 생성 및 관리 | 메타 개발 |
| [**backend-dev-guidelines**](skills/backend-dev-guidelines/) | Express/Prisma/Sentry 패턴 | 백엔드 API |
| [**frontend-dev-guidelines**](skills/frontend-dev-guidelines/) | React/MUI v7/TypeScript | React 프론트엔드 |
| [**route-tester**](skills/route-tester/) | 인증 라우트 테스트 | API 테스트 |
| [**error-tracking**](skills/error-tracking/) | Sentry 연동 | 오류 모니터링 |

**👉 [스킬 통합 방법 →](skills/README.md)**

### 🪝 훅

**필수 훅 2개부터 시작**하세요. 기본으로 바로 동작하며 스킬 자동 활성화를 켭니다.

**👉 [훅 설정 가이드 →](hooks/README.md)**

### 🤖 에이전트 (10)

**독립형이라 복사 후 바로 사용 가능합니다.**

**👉 [에이전트 동작 방식 →](agents/README.md)**

### 💬 슬래시 명령어

**👉 [명령어 목록 →](commands/)**

---

## 핵심 개념

### Hooks + skill-rules.json = 자동 활성화

**시스템 동작:**
1. 모든 사용자 프롬프트마다 **skill-activation-prompt 훅** 실행
2. **skill-rules.json**의 트리거 패턴 확인
3. 관련 스킬 자동 제안
4. 필요할 때만 스킬 로드

스킬의 1순위 문제인 "스스로 활성화되지 않음"을 해결합니다.

### 점진적 공개 (500줄 규칙)

**문제:** 큰 스킬은 컨텍스트 한도 초과

**해결:** 모듈 구조
- 메인 `SKILL.md` < 500줄 (개요 + 내비게이션)
- 리소스 파일 각각 < 500줄 (심화 내용)
- 필요 시점에 맞춰 단계적으로 로드

### 개발 문서(Dev Docs) 패턴

**문제:** 컨텍스트 리셋 시 프로젝트 맥락 손실

**해결:** 3파일 구조
- `[task]-plan.md` - 전략 계획
- `[task]-context.md` - 핵심 의사결정과 파일
- `[task]-tasks.md` - 체크리스트

**연동:** `/dev-docs` 명령어로 자동 생성 가능  
**👉 [Dev Docs 패턴](../dev/README.md)**

---

## ⚠️ 중요: 그대로는 동작하지 않는 부분

### settings.json
포함된 `settings.json`은 **예시 전용**입니다.
- Stop 훅이 특정 모노레포 구조를 참조할 수 있음
- 서비스명은 예시일 수 있음
- MCP 서버는 여러분 환경에 없을 수 있음

**사용 방법:**
1. `UserPromptSubmit`, `PostToolUse` 훅만 우선 추출
2. Stop 훅은 커스터마이징하거나 제외
3. MCP 서버 목록을 환경에 맞게 수정

### 블로그 도메인 예시
스킬 예시는 일반적인 블로그 모델(Post/Comment/User)을 사용합니다.
- **학습용 예시**일 뿐 필수 아님
- 패턴은 어떤 도메인에도 적용 가능(이커머스, SaaS 등)
- 비즈니스 로직에 맞춰 변형 필요

### 훅 디렉터리 구조
일부 훅은 특정 구조를 가정합니다.
- `tsc-check.sh`는 서비스 디렉터리 구조를 기대할 수 있음
- 프로젝트 레이아웃에 맞게 수정 필요

---

## 통합 워크플로우

**권장 순서:**

### 1단계: 스킬 활성화 (15분)
1. `skill-activation-prompt` 훅 복사
2. `post-tool-use-tracker` 훅 복사
3. `settings.json` 업데이트(병합)
4. 훅 의존성 설치

### 2단계: 첫 스킬 추가 (10분)
1. 관련 스킬 1개 선택
2. 스킬 디렉터리 복사
3. `skill-rules.json` 생성/수정
4. 경로 패턴 커스터마이징

### 3단계: 테스트 및 반복 (5분)
1. 파일 편집 시 스킬 활성화 확인
2. 질문 시 스킬 제안 확인
3. 필요에 따라 스킬 추가

### 4단계: 선택 고도화
- 유용한 에이전트 추가
- 슬래시 명령어 추가
- Stop 훅 고급 커스터마이징

---

## 도움받기

### 사용자용
**통합이 잘 안 되나요?**
1. [`CODEX_INTEGRATION_GUIDE.md`](../CODEX_INTEGRATION_GUIDE.md) 확인
2. Codex에게 질문: "왜 [skill]이 활성화되지 않지?"
3. 프로젝트 구조와 함께 이슈 등록

### Codex CLI용
사용자 통합 지원 시:
1. **먼저 `CODEX_INTEGRATION_GUIDE.md` 읽기**
2. 프로젝트 구조 질문
3. 무작정 복사하지 말고 맞춤 적용
4. 통합 후 검증

---

## 커뮤니티

**도움이 되었다면:**
- ⭐ 저장소 스타
- 🐛 이슈/개선안 제보
- 💬 여러분의 스킬/훅/에이전트 공유
- 📝 도메인별 예시 기여

**배경:**
이 인프라는 제가 Reddit에 작성한 글 ["Roo Codex is a Beast – Tips from 6 Months of Hardcore Use"](https://www.reddit.com/r/CodexAI/comments/1oivjvm/claude_code_is_a_beast_tips_from_6_months_of/)에서 자세히 소개했습니다. 수백 건의 요청 이후, 커뮤니티가 패턴을 쉽게 적용할 수 있도록 이 쇼케이스를 만들었습니다.

---

## 라이선스

MIT 라이선스 - 개인/상업 프로젝트에서 자유롭게 사용하세요.

---

## 빠른 링크

- 📖 [Codex 통합 가이드](../CODEX_INTEGRATION_GUIDE.md) - Codex CLI 설정/통합
- 🎨 [스킬 문서](skills/README.md)
- 🪝 [훅 설정](hooks/README.md)
- 🤖 [에이전트 가이드](agents/README.md)
- 📝 [Dev Docs 패턴](../dev/README.md)

**시작 방법:** 필수 훅 2개를 복사하고 스킬 1개를 추가한 뒤 자동 활성화를 확인하세요.
