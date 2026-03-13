# Dev Docs 패턴

Claude Code, Agent Workflows, Codex CLI처럼 컨텍스트 기반 에이전트 CLI에서 세션 리셋 사이에도 프로젝트 맥락을 유지하기 위한 방법론입니다.

---

## 문제

**컨텍스트 리셋이 일어나면 다음이 모두 사라집니다:**
- 구현 의사결정
- 핵심 파일과 각 파일의 역할
- 작업 진행 상황
- 기술적 제약
- 특정 접근 방식을 선택한 이유

**리셋 이후에는 에이전트가 전체 상황을 다시 파악해야 합니다.**

---

## 해결책: 지속형 Dev Docs

작업을 재개하는 데 필요한 정보를 3개 파일로 고정 저장합니다.

```
dev/active/[task-name]/
├── [task-name]-plan.md      # 전략 계획
├── [task-name]-context.md   # 핵심 의사결정 및 파일
└── [task-name]-tasks.md     # 체크리스트
```

**이 파일들은 컨텍스트 리셋 이후에도 남아있어** 새 세션에서 즉시 상태를 복구할 수 있습니다.

---

## CLI별 링크와 스코프

| CLI | 자산 루트 | 운영 규칙 파일 | 통합/참고 가이드 | Dev Docs 명령 정의 |
|---|---|---|---|---|
| Claude Code | `.claude/` | [CLAUDE.md](../CLAUDE.md) | [CLAUDE_INTEGRATION_GUIDE.md](../CLAUDE_INTEGRATION_GUIDE.md) | [`.claude/commands/dev-docs.md`](../.claude/commands/dev-docs.md), [`.claude/commands/dev-docs-update.md`](../.claude/commands/dev-docs-update.md) |
| Codex CLI | `.codex/` | [AGENTS.md](../AGENTS.md) | [CODEX_INTEGRATION_GUIDE.md](../CODEX_INTEGRATION_GUIDE.md) | [`.codex/commands/dev-docs.md`](../.codex/commands/dev-docs.md), [`.codex/commands/dev-docs-update.md`](../.codex/commands/dev-docs-update.md) |
| Agent Workflows | `.agents/workflows/` | [AGENT_WORKFLOWS.md](../AGENT_WORKFLOWS.md) | [AGENT_WORKFLOWS_INTEGRATION_GUIDE.md](../AGENT_WORKFLOWS_INTEGRATION_GUIDE.md) | [`.agents/workflows/commands/dev-docs.toml`](../.agents/workflows/commands/dev-docs.toml), [`.agents/workflows/commands/dev-docs-update.toml`](../.agents/workflows/commands/dev-docs-update.toml) |

**스코프 원칙:**
- `dev/`는 CLI와 무관한 공통 작업 스코프입니다.
- 설정/훅/스킬/명령 수정은 현재 사용 중인 CLI 루트(`.claude`/`.codex`/`.agents/workflows`)만 기본 스코프로 잡습니다.
- 다른 CLI 루트까지 함께 수정해야 하면 작업 범위에 명시하고 동기화합니다.

---

## 3파일 구조

### 1. [task-name]-plan.md

**목적:** 구현을 위한 전략 계획

**포함 내용:**
- 요약
- 현재 상태 분석
- 목표 상태
- 구현 단계
- 수용 기준이 포함된 상세 작업
- 리스크 평가
- 성공 지표
- 일정 추정

**생성 시점:** 복잡한 작업 시작 시

**업데이트 시점:** 범위 변경 또는 새 단계 발견 시

**예시:**
```markdown
# Feature Name - Implementation Plan

## Executive Summary
What we're building and why

## Current State
Where we are now

## Implementation Phases

### Phase 1: Infrastructure (2 hours)
- Task 1.1: Set up database schema
  - Acceptance: Schema compiles, relationships correct
- Task 1.2: Create service structure
  - Acceptance: All directories created

### Phase 2: Core Functionality (3 hours)
...
```

---

### 2. [task-name]-context.md

**목적:** 작업 재개를 위한 핵심 정보 저장

**포함 내용:**
- `SESSION PROGRESS` 섹션(자주 업데이트 필수)
- 완료/진행 중 상태
- 핵심 파일과 역할
- 중요한 의사결정
- 발견된 기술적 제약
- 관련 파일 링크
- 빠른 재개 안내

**생성 시점:** 작업 시작 시

**업데이트 시점:** **자주** - 주요 결정, 완료, 발견이 있을 때마다

**예시:**
```markdown
# Feature Name - Context

## SESSION PROGRESS (2025-10-29)

### ✅ COMPLETED
- Database schema created (User, Post, Comment models)
- PostController implemented with BaseController pattern
- Sentry integration working

### 🟡 IN PROGRESS
- Creating PostService with business logic
- File: src/services/postService.ts

### ⚠️ BLOCKERS
- Need to decide on caching strategy

## Key Files

**src/controllers/PostController.ts**
- Extends BaseController
- Handles HTTP requests for posts
- Delegates to PostService

**src/services/postService.ts** (IN PROGRESS)
- Business logic for post operations
- Next: Add caching

## Quick Resume
To continue:
1. Read this file
2. Continue implementing PostService.createPost()
3. See tasks file for remaining work
```

**중요:** 의미 있는 작업이 끝날 때마다 `SESSION PROGRESS`를 반드시 갱신하세요.

---

### 3. [task-name]-tasks.md

**목적:** 진행 상황 추적 체크리스트

**포함 내용:**
- 논리적 단계별 페이즈
- 체크박스 형식 작업 항목
- 상태 표시(✅/🟡/⏳)
- 수용 기준
- 빠른 재개 섹션

**생성 시점:** 작업 시작 시

**업데이트 시점:** 작업 완료 직후 또는 신규 작업 발견 시

**예시:**
```markdown
# Feature Name - Task Checklist

## Phase 1: Setup ✅ COMPLETE
- [x] Create database schema
- [x] Set up controllers
- [x] Configure Sentry

## Phase 2: Implementation 🟡 IN PROGRESS
- [x] Create PostController
- [ ] Create PostService (IN PROGRESS)
- [ ] Create PostRepository
- [ ] Add validation with Zod

## Phase 3: Testing ⏳ NOT STARTED
- [ ] Unit tests for service
- [ ] Integration tests
- [ ] Manual API testing
```

---

## Dev Docs를 써야 할 때

**사용 권장:**
- ✅ 며칠 이상 걸리는 복잡한 작업
- ✅ 구성 요소가 많은 기능 개발
- ✅ 여러 세션에 걸칠 가능성이 큰 작업
- ✅ 계획 수립이 중요한 작업
- ✅ 대규모 리팩터링

**생략 가능:**
- ❌ 단순 버그 수정
- ❌ 단일 파일 변경
- ❌ 빠른 업데이트
- ❌ 사소한 수정

**기준:** 2시간 이상 걸리거나 여러 세션에 걸치면 Dev Docs를 사용하세요.

---

## Dev Docs 워크플로우

### 새 작업 시작

1. **CLI에서 `dev-docs` 명령 템플릿 실행**
   - `/dev-docs` 스타일을 지원하면 그대로 사용
   - 지원하지 않으면 각 CLI의 명령 정의 파일 내용을 프롬프트 템플릿으로 사용

2. **현재 CLI 에이전트가 3개 파일 생성**
   - 요구사항 분석
   - 코드베이스 확인
   - 종합 계획 생성
   - context/tasks 파일 생성

3. **검토 및 조정**
   - 계획 타당성 확인
   - 누락된 고려사항 추가
   - 일정 추정 보정

### 구현 중

1. 전체 전략은 `plan` 참고
2. `context.md`를 자주 업데이트
   - 완료 항목 표시
   - 의사결정 기록
   - 블로커 추가
3. `tasks.md` 체크박스를 진행에 맞게 갱신

### 컨텍스트 리셋 후

1. 새 세션 에이전트가 3개 파일(plan/context/tasks)을 모두 읽고
2. 수초 내 전체 상태를 파악한 뒤
3. 중단 지점부터 정확히 재개합니다.

무엇을 하던 중이었는지 다시 설명할 필요가 없습니다.

---

## 명령어 연동

### dev-docs
**기능:** 작업용 새 Dev Docs 생성

**예시(슬래시 명령 지원 시):**
```
/dev-docs implement real-time notifications
```

**생성 결과:**
- `dev/active/implement-real-time-notifications/`
  - implement-real-time-notifications-plan.md
  - implement-real-time-notifications-context.md
  - implement-real-time-notifications-tasks.md

### dev-docs-update
**기능:** 컨텍스트 리셋 전 기존 Dev Docs 갱신

**예시(슬래시 명령 지원 시):**
```
/dev-docs-update
```

**갱신 내용:**
- 완료 작업 반영
- 새로 발견한 작업 추가
- 세션 진행 상황으로 context 업데이트
- 현재 상태 스냅샷 저장

**권장 시점:** 컨텍스트 한도에 가까워지거나 세션 종료 직전

---

## 파일 구성

```
dev/
├── README.md              # 이 파일
├── active/                # 진행 중 작업
│   ├── task-1/
│   │   ├── task-1-plan.md
│   │   ├── task-1-context.md
│   │   └── task-1-tasks.md
│   └── task-2/
│       └── ...
└── archive/               # 완료 작업(선택)
    └── old-task/
        └── ...
```

`active/`: 진행 중 작업
`archive/`: 완료 작업(참고용)

---

## 실제 사용 시작 방법

이 저장소에는 `dev/active/*` 샘플 작업 디렉터리가 항상 포함되어 있지 않을 수 있습니다. 없으면 첫 복잡 작업에서 바로 생성해 시작하세요.

```bash
mkdir -p dev/active/your-task-name
```

필요하면 아래 명령 정의를 템플릿으로 사용하세요:
- Claude: [`.claude/commands/dev-docs.md`](../.claude/commands/dev-docs.md)
- Codex: [`.codex/commands/dev-docs.md`](../.codex/commands/dev-docs.md)
- Agent Workflows: [`.agents/workflows/commands/dev-docs.toml`](../.agents/workflows/commands/dev-docs.toml)

---

## 모범 사례

### Context를 자주 갱신

**나쁜 예:** 세션 끝에서만 업데이트
**좋은 예:** 주요 마일스톤마다 업데이트

`SESSION PROGRESS`는 항상 실제 상태를 반영해야 합니다.
```markdown
## SESSION PROGRESS (YYYY-MM-DD)

### ✅ COMPLETED (완료한 작업 전체)
### 🟡 IN PROGRESS (지금 진행 중인 작업)
### ⚠️ BLOCKERS (진행을 막는 요인)
```

### 작업 항목을 실행 가능하게 작성

**나쁜 예:** "인증 수정"
**좋은 예:** "AuthMiddleware.ts에 JWT 토큰 검증 구현 (수용 기준: 토큰 검증 성공, 오류는 Sentry 전송)"

**포함 권장:**
- 구체적 파일명
- 명확한 수용 기준
- 선행/의존 작업 정보

### Plan을 최신 상태로 유지

범위가 바뀌면:
- 계획 업데이트
- 단계 추가
- 일정 추정 조정
- 범위 변경 이유 기록

---

## CLI 공통 실행 안내

**사용자가 Dev Docs 생성을 요청하면:**

1. 현재 CLI를 확인하고 해당 스코프의 명령 정의를 우선 사용
2. 명령이 없거나 실행 불가면 수동으로 3파일 생성
   - 작업 범위 확인
   - 관련 코드 분석
   - 종합 계획 작성
   - context/tasks 생성

3. 계획 문서는 다음을 포함
   - 명확한 단계
   - 실행 가능한 작업
   - 수용 기준
   - 리스크 평가

4. context 파일은 재개 친화적으로 구성
   - 상단 `SESSION PROGRESS`
   - 빠른 재개 안내
   - 설명이 있는 핵심 파일 목록

**Dev Docs로 재개할 때:**

1. 3개 파일(plan/context/tasks) 모두 읽기
2. `context.md`부터 확인(현재 상태)
3. `tasks.md`로 완료/다음 작업 확인
4. `plan.md`로 전체 전략 파악

**자주 업데이트:**
- 작업 완료 즉시 체크
- 의미 있는 작업 후 `SESSION PROGRESS` 갱신
- 새로 발견한 작업 즉시 추가

---

## Dev Docs 수동 생성

`dev-docs` 명령이 없으면:

**1. 디렉터리 생성:**
```bash
mkdir -p dev/active/your-task-name
```

**2. `plan.md` 생성:**
- 요약
- 구현 단계
- 상세 작업
- 일정 추정

**3. `context.md` 생성:**
- `SESSION PROGRESS`
- 핵심 파일
- 중요 의사결정
- 빠른 재개 안내

**4. `tasks.md` 생성:**
- 단계별 체크박스
- `[ ]` 작업 형식
- 수용 기준

---

## 효과

**Dev Docs 이전:**
- 컨텍스트 리셋 = 처음부터 재시작
- 의사결정 이유를 잊음
- 진행 상황 추적 실패
- 작업 반복

**Dev Docs 이후:**
- 컨텍스트 리셋 = 파일 3개 읽고 즉시 재개
- 의사결정 기록 유지
- 진행률 추적 가능
- 중복 작업 감소

**절약 시간:** 컨텍스트 리셋마다 수시간

---

## 다음 단계

1. 다음 복잡한 작업에 패턴 적용
2. 가능하면 `dev-docs` 명령 템플릿 사용
3. 특히 `context.md`를 자주 갱신
4. 운영 규칙/가이드에서 현재 CLI 스코프 확인

**참고 링크:**
- Claude: [CLAUDE.md](../CLAUDE.md), [CLAUDE_INTEGRATION_GUIDE.md](../CLAUDE_INTEGRATION_GUIDE.md)
- Codex: [AGENTS.md](../AGENTS.md), [CODEX_INTEGRATION_GUIDE.md](../CODEX_INTEGRATION_GUIDE.md)
- Agent Workflows: [AGENT_WORKFLOWS.md](../AGENT_WORKFLOWS.md), [AGENT_WORKFLOWS_INTEGRATION_GUIDE.md](../AGENT_WORKFLOWS_INTEGRATION_GUIDE.md)
