# 훅(Hooks)

스킬 자동 활성화, 파일 추적, 검증을 가능하게 하는 Agent Workflows 훅입니다.

---

## 훅이란?

훅은 Gemini의 워크플로우에서 특정 시점에 실행되는 스크립트입니다:
- **UserPromptSubmit**: 사용자가 프롬프트를 제출할 때
- **PreToolUse**: 도구가 실행되기 전에
- **PostToolUse**: 도구 실행이 완료된 후
- **Stop**: 사용자가 중지를 요청할 때

**핵심 인사이트:** 훅은 프롬프트를 수정하고, 동작을 차단하고, 상태를 추적할 수 있어 Gemini만으로는 할 수 없는 기능을 가능하게 합니다.

---

## 필수 훅(여기부터 시작)

### skill-activation-prompt (UserPromptSubmit)

**목적:** 사용자 프롬프트와 파일 컨텍스트를 기반으로 관련 스킬을 자동으로 제안

**동작 방식:**
1. `skill-rules.json`을 읽음
2. 사용자 프롬프트를 트리거 패턴과 매칭
3. 사용자가 작업 중인 파일을 확인
4. Gemini 컨텍스트에 스킬 제안을 주입

**필수인 이유:** 스킬을 자동 활성화하게 만드는 핵심 훅입니다.

**통합:**
```bash
# 두 파일 모두 복사
cp skill-activation-prompt.sh your-project/.agents/workflows/hooks/
cp skill-activation-prompt.ts your-project/.agents/workflows/hooks/

# 실행 가능하도록 설정
chmod +x your-project/.agents/workflows/hooks/skill-activation-prompt.sh

# 의존성 설치
cd your-project/.agents/workflows/hooks
npm install
```

**settings.json에 추가:**
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

**커스터마이징:** ✅ 필요 없음 - `skill-rules.json`을 자동으로 읽습니다.

---

### post-tool-use-tracker (PostToolUse)

**목적:** 세션 간 컨텍스트 유지를 위해 파일 변경을 추적

**동작 방식:**
1. Edit/Write/MultiEdit 도구 호출을 모니터링
2. 어떤 파일이 수정되었는지 기록
3. 컨텍스트 관리를 위한 캐시 생성
4. 프로젝트 구조를 자동 감지(frontend, backend, packages 등)

**필수인 이유:** Gemini가 코드베이스에서 어떤 부분이 활성화되어 있는지 이해하는 데 도움이 됩니다.

**통합:**
```bash
# 파일 복사
cp post-tool-use-tracker.sh your-project/.agents/workflows/hooks/

# 실행 가능하도록 설정
chmod +x your-project/.agents/workflows/hooks/post-tool-use-tracker.sh
```

**settings.json에 추가:**
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
    ]
  }
}
```

**커스터마이징:** ✅ 필요 없음 - 구조를 자동 감지합니다.

---

## 선택 훅(커스터마이징 필요)

### tsc-check (Stop)

**목적:** 사용자가 중지할 때 TypeScript 컴파일 체크

**⚠️ 경고:** 멀티 서비스 모노레포 구조에 맞춰 구성되어 있습니다.

**통합:**

**먼저, 이것이 적합한지 판단하세요:**
- ✅ 사용 권장: 멀티 서비스 TypeScript 모노레포
- ❌ 사용 비권장: 단일 서비스 프로젝트 또는 다른 빌드 구성

**사용한다면:**
1. tsc-check.sh를 복사
2. **서비스 감지 로직 수정(약 28번째 줄):**
   ```bash
   # 예시 서비스를 YOUR 서비스로 교체:
   case "$repo" in
       api|web|auth|payments|...)  # ← 실제 서비스들
   ```
3. settings.json에 추가하기 전에 수동으로 테스트

**커스터마이징:** ⚠️⚠️⚠️ 많이 필요함

---

### trigger-build-resolver (Stop)

**목적:** 변경된 저장소 목록을 요약해서 수동 후속 조치(예: auto-error-resolver 실행)를 안내

**의존성:** tsc-check 훅이 정상 동작해야 함

**커스터마이징:** ✅ 없음(단, tsc-check가 먼저 동작해야 함)

---

## Agent Workflows용

**사용자에게 훅을 설정해줄 때:**

1. 먼저 **[AGENT_WORKFLOWS.md](../../AGENT_WORKFLOWS.md)**를 읽으세요
2. **항상 두 개의 필수 훅부터 시작**하세요
3. **Stop 훅 추가 전에는 반드시 확인**하세요 - 잘못 구성되면 작업을 막을 수 있습니다
4. **설정 후 검증:**
   ```bash
   ls -la .agents/workflows/hooks/*.sh | grep rwx
   ```

**질문이 있나요?** [AGENT_WORKFLOWS.md](../../AGENT_WORKFLOWS.md)를 참고하세요.
