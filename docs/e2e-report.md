# MVP E2E Report

- 실행 일시: 2026-02-09 12:15:14 +0900
- 대상: `POST /api/agent`, `/`, `/agent`
- 실행 환경: `next dev` (검증 중 타임아웃 재현용으로 `CODEX_TIMEOUT_MS=1` 서버 1회 사용)

## 시나리오 결과

| 시나리오 | 방법 | 결과 | 판정 |
| --- | --- | --- | --- |
| 정상 플로우(첫 chunk 2초 이내) | `curl -w time_starttransfer` | `0.007528s` | PASS |
| 연속 대화 컨텍스트 누적 | 동일 `sessionId` 3회 호출 후 세션 파일 확인 | `messages.length = 16` (`>= 6`) | PASS |
| 제한 검증(20,001자) | 20,001자 메시지 요청 | `400`, `message exceeds 20,000 characters.` | PASS |
| 타임아웃 처리 | `CODEX_TIMEOUT_MS=1`로 요청 | 응답: `[ERROR] Codex execution timed out ...` 메시지 확인 | PASS |
| 스트림 중단 후 재요청 | `curl --max-time 0.001` 중단 후 동일 세션 재요청 | 중단 코드 `28`, 재요청 응답 바이트 `43` | PASS |
| 세션 저장 검증 | `data/sessions/mvp020-abort.json` 확인 | `user=3`, `assistant=3`, `total=6` | PASS |

## 비고

- API는 keepalive chunk를 먼저 전송해 클라이언트가 스트림 시작을 빠르게 감지하도록 구성됨.
- 스트림 중단 시 서버 측에서 안전 종료하도록 보강했고, Codex 실패/타임아웃 시 fallback 메시지를 세션에 기록하도록 처리함.

## 기능 확장 검증 (모델 선택/세션 관리)

| 항목 | 방법 | 결과 | 판정 |
| --- | --- | --- | --- |
| 모델 선택 반영 | `POST /api/agent`에 `model=gpt-5.3-codex` 전송 | 정상 응답 확인 | PASS |
| 세션 상세 모델 저장 | `GET /api/sessions/model-check` | `session.model = gpt-5.3-codex` 확인 | PASS |
| 세션 목록 조회 | `GET /api/sessions` | 세션 배열 반환 확인 | PASS |
| 세션 삭제 | `DELETE /api/sessions/{sessionId}` | `{ "ok": true }` 확인 | PASS |
| 세션 이어하기 동선 | `/agent?sessionId=<id>` 접속 | 기존 세션 메시지 로드 확인 | PASS |
