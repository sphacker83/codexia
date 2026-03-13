# 훅 메커니즘 - 딥 다이브

UserPromptSubmit 및 PreToolUse 훅이 어떻게 동작하는지에 대한 기술적 딥 다이브 문서입니다.

## 목차

- [UserPromptSubmit 훅 플로우](#userpromptsubmit-hook-flow)
- [PreToolUse 훅 플로우](#pretooluse-hook-flow)
- [종료 코드 동작(중요)](#exit-code-behavior-critical)
- [세션 상태 관리](#session-state-management)
- [성능 고려사항](#performance-considerations)

---

## UserPromptSubmit 훅 플로우

### 실행 순서

```
사용자가 프롬프트를 제출
    ↓
.codex/settings.json이 훅을 등록
    ↓
skill-activation-prompt.sh 실행
    ↓
npx tsx skill-activation-prompt.ts
    ↓
훅이 stdin을 읽음(프롬프트가 포함된 JSON)
    ↓
skill-rules.json 로드
    ↓
키워드 + 의도 패턴을 매칭
    ↓
우선순위로 그룹화(critical → high → medium → low)
    ↓
포맷된 메시지를 stdout으로 출력
    ↓
stdout이 Codex의 컨텍스트가 됨(프롬프트 전에 주입)
    ↓
Codex가 봄: [스킬 제안] + 사용자 프롬프트
```

### 핵심 포인트

- **종료 코드(Exit code)**: 항상 0(허용)
- **stdout**: → Codex 컨텍스트(시스템 메시지로 주입)
- **타이밍**: Codex가 프롬프트를 처리하기 *이전*에 실행
- **동작**: 비차단, 안내(advisory) 전용
- **목적**: 관련 스킬을 Codex가 인지하도록 함

### 입력 포맷

```json
{
  "session_id": "abc-123",
  "transcript_path": "/path/to/transcript.json",
  "cwd": "/root/git/your-project",
  "permission_mode": "normal",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "how does the layout system work?"
}
```

### 출력 포맷(stdout)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 스킬 활성화 체크
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 추천 스킬:
  → project-catalog-developer

ACTION: 응답하기 전에 Skill 툴을 사용하세요
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Codex는 이 출력을 사용자 프롬프트 처리 전에 추가 컨텍스트로 받습니다.

---

## PreToolUse 훅 플로우

### 실행 순서

```
Codex가 Edit/Write 툴을 호출
    ↓
.codex/settings.json이 훅을 등록(matcher: Edit|Write)
    ↓
skill-verification-guard.sh 실행
    ↓
npx tsx skill-verification-guard.ts
    ↓
훅이 stdin을 읽음(tool_name, tool_input이 포함된 JSON)
    ↓
skill-rules.json 로드
    ↓
파일 경로 패턴을 확인(glob 매칭)
    ↓
파일 내용을 읽어 콘텐츠 패턴을 확인(파일이 존재하면)
    ↓
세션 상태를 확인(이미 스킬을 사용했는지?)
    ↓
스킵 조건을 확인(파일 마커, 환경 변수)
    ↓
매칭되고 스킵되지 않았다면:
  세션 상태 업데이트(스킬을 enforced로 표시)
  차단 메시지를 stderr로 출력
  종료 코드 2로 종료(BLOCK)
그 외:
  종료 코드 0으로 종료(ALLOW)
    ↓
차단(BLOCK)된 경우:
  stderr → Codex가 메시지를 봄
  Edit/Write 툴이 실행되지 않음
  Codex가 스킬을 사용한 뒤 재시도해야 함
허용(ALLOW)된 경우:
  툴이 정상 실행
```

### 핵심 포인트

- **종료 코드 2**: 차단(BLOCK) (stderr → Codex)
- **종료 코드 0**: 허용(ALLOW)
- **타이밍**: 툴 실행 *이전*에 실행
- **세션 추적**: 같은 세션에서 반복 차단을 방지
- **Fail open**: 오류가 나면 작업을 허용(워크플로를 깨지 않음)
- **목적**: 핵심 가드레일을 강제

### 입력 포맷

```json
{
  "session_id": "abc-123",
  "transcript_path": "/path/to/transcript.json",
  "cwd": "/root/git/your-project",
  "permission_mode": "normal",
  "hook_event_name": "PreToolUse",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/root/git/your-project/form/src/services/user.ts",
    "old_string": "...",
    "new_string": "..."
  }
}
```

### 출력 포맷(차단 시 stderr)

```
⚠️ BLOCKED - 데이터베이스 작업 감지

📋 REQUIRED ACTION(필수 조치):
1. Use Skill tool: 'database-verification'
2. 스키마 기준으로 모든 테이블/컬럼명을 검증
3. DESCRIBE 명령으로 DB 구조 확인
4. 그 다음 이 편집을 재시도

Reason: Prisma 쿼리에서 컬럼명 오류를 방지
File: form/src/services/user.ts

💡 TIP: 향후 검사를 스킵하려면 '// @skip-validation' 주석을 추가하세요
```

Codex는 이 메시지를 보고, 편집을 재시도하기 전에 스킬을 사용해야 한다고 이해합니다.

---

## 종료 코드 동작(중요)

### 종료 코드 레퍼런스 테이블

| 종료 코드(Exit Code) | stdout | stderr | 툴 실행 | Codex가 보는 것 |
|-----------|--------|--------|----------------|-------------|
| 0 (UserPromptSubmit) | → 컨텍스트 | → 사용자만 | 해당 없음 | stdout 내용 |
| 0 (PreToolUse) | → 사용자만 | → 사용자만 | **진행** | 없음 |
| 2 (PreToolUse) | → 사용자만 | → **CLAUDE** | **BLOCKED** | stderr 내용 |
| Other | → 사용자만 | → 사용자만 | 차단 | 없음 |

### 종료 코드 2가 중요한 이유

이는 enforcement를 위한 가장 핵심 메커니즘입니다:

1. PreToolUse에서 Codex에게 메시지를 보낼 수 있는 **유일한 방법**
2. stderr 내용이 Codex에게 "자동으로 피드백"됨
3. Codex가 차단 메시지를 보고 다음 행동을 이해함
4. 툴 실행이 방지됨
5. 가드레일 enforcement에 핵심적

### 대화 플로우 예시

```
User: "Prisma로 새 user 서비스를 추가해줘"

Codex: "user 서비스를 만들겠습니다..."
    [Attempts to Edit form/src/services/user.ts]

PreToolUse Hook: [Exit code 2]
    stderr: "⚠️ BLOCKED - Use database-verification"

Codex가 에러를 보고 응답:
    "먼저 데이터베이스 스키마를 검증해야 합니다."
    [Uses Skill tool: database-verification]
    [Verifies column names]
    [Retries Edit - now allowed (session tracking)]
```

---

## 세션 상태 관리

### 목적

같은 세션에서 반복적으로 잔소리하듯 차단하지 않기 위해, Codex가 한 번 스킬을 사용하면 다시 차단하지 않도록 합니다.

### 상태 파일 위치

`.codex/hooks/state/skills-used-{session_id}.json`

### 상태 파일 구조

```json
{
  "skills_used": [
    "database-verification",
    "error-tracking"
  ],
  "files_verified": []
}
```

### 동작 방식

1. Prisma가 포함된 파일의 **첫 편집**:
   - 훅이 종료 코드 2로 차단
   - 세션 상태 업데이트: skills_used에 "database-verification" 추가
   - Codex가 메시지를 보고 스킬을 사용

2. **두 번째 편집**(같은 세션):
   - 훅이 세션 상태를 확인
   - skills_used에서 "database-verification"을 찾음
   - 종료 코드 0으로 종료(허용)
   - Codex에게 메시지 없음

3. **다른 세션**:
   - 새 session_id = 새 상태 파일
   - 훅이 다시 차단

### 한계

훅은 스킬이 *실제로* 실행되었는지 감지할 수 없습니다. 스킬당/세션당 한 번만 차단합니다. 즉:

- Codex가 스킬을 쓰지 않고 다른 편집을 해도 다시 차단하지 않을 수 있음
- Codex가 지시를 따를 것이라는 전제를 둠
- 향후 개선: 실제 Skill tool 사용을 감지

---

## 성능 고려사항

### 목표 지표

- **UserPromptSubmit**: < 100ms
- **PreToolUse**: < 200ms

### 성능 병목

1. **skill-rules.json 로딩** (매 실행마다)
   - 향후: 메모리에 캐시
   - 향후: 변경 감시 후 필요할 때만 리로드

2. **파일 내용 읽기** (PreToolUse)
   - contentPatterns가 설정된 경우에만
   - 파일이 존재하는 경우에만
   - 큰 파일에서는 느릴 수 있음

3. **glob 매칭** (PreToolUse)
   - 패턴별 regex 컴파일 비용
   - 향후: 한 번 컴파일 후 캐시

4. **정규식(regex) 매칭** (두 훅 모두)
   - Intent patterns (UserPromptSubmit)
   - Content patterns (PreToolUse)
   - 향후: 지연 컴파일(lazy compile), 컴파일된 regex 캐시

### 최적화 전략

**패턴 수 줄이기:**
- 더 구체적인 패턴 사용(검사 대상 감소)
- 가능하면 유사 패턴을 결합

**파일 경로 패턴:**
- 더 구체적일수록 검사할 파일이 줄어듦
- 예: `form/**`보다 `form/src/services/**`가 더 좋음

**콘텐츠 패턴:**
- 정말 필요할 때만 추가
- 단순한 regex일수록 더 빠르게 매칭

---

**관련 파일:**
- [SKILL.md](SKILL.md) - 메인 스킬 가이드
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - 훅 이슈 디버깅
- [SKILL_RULES_REFERENCE.md](SKILL_RULES_REFERENCE.md) - 설정 레퍼런스
