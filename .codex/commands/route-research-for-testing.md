---
description: 수정된 라우트 매핑 및 테스트 실행
argument-hint: "[/추가/경로 …]"
---

# /route-research-for-testing

## 컨텍스트

이번 세션에서 변경된 라우트 파일(자동 생성):

!cat "$CODEX_PROJECT_DIR/.codex/hooks/tsc-cache"/*/edited-files.log 2>/dev/null \
 | sed '/^\s*$/d' \
 | awk -F: '{print $2}' \
 | grep '/routes/' \
 | sort -u

사용자가 추가로 지정한 라우트: $ARGUMENTS

## 할 일

아래 번호 순서를 **그대로** 따르세요:

1. 자동 목록과 $ARGUMENTS를 합친 뒤, 중복 제거(dedupe)하고 `src/app.ts`에 정의된 모든 프리픽스(prefix)를 해석/적용합니다.
2. 최종 라우트 각각에 대해, 경로(path), 메서드(method), 예상 요청/응답 형태(shape), 유효/무효 페이로드 예시를 포함하는 JSON 레코드를 출력합니다.
3. 위 JSON을 입력으로 사용해 `auth-route-tester` 서브 에이전트를 실행하고, 라우트별 테스트 결과(pass/fail), 실패 원인, 재현 가능한 요청 예시를 요약합니다.
