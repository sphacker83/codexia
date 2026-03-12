# CodexOS 기능 확장 태스크

## 0. 운영 규칙

- 범위: 모델 선택 기능 + 세션 관리 기능 + 백그라운드 잡 실행/복구
- 패키지 매니저: `pnpm` 고정
- 태스크 단위: 1~3시간 내 완료 가능한 단위
- 착수 조건: 선행 태스크가 `✅ DONE`이어야 한다
- 완료 규칙: 체크리스트 완료 + DoD 충족 + 검증 통과 시 `✅ DONE`
- 완료 태스크 표기: 상태 필드는 `✅ DONE` 사용
- 기존 MVP 태스크 백업: `docs/TASK.mvp.backup.md`

## 1. 상태 정의

| 상태 | 의미 |
| --- | --- |
| TODO | 아직 시작하지 않음 |
| DOING | 작업 중 |
| BLOCKED | 외부 요인으로 진행 불가 |
| REVIEW | 구현 완료, 검증/리뷰 대기 |
| ✅ DONE | 검증 포함 완료 |

## 2. 실행 순서 (Feature Gate)

1. Gate A 완료 조건: `FEAT-001` ~ `FEAT-004`가 `✅ DONE`
2. Gate B 완료 조건: `FEAT-005` ~ `FEAT-009`가 `✅ DONE`
3. Gate C 완료 조건: `FEAT-010`이 `✅ DONE` (응답 지연 최적화)
4. Gate D 완료 조건: `FEAT-011` ~ `FEAT-013`이 `✅ DONE` (백그라운드 지속 실행)
5. 진행 규칙: Gate 미충족 시 다음 단계 착수 금지

## 3. 태스크 백로그

### FEAT-001

- 상태: ✅ DONE
- 제목: 모델 정의 파일 추가
- 예상 시간: 1h
- 선행: 없음
- 산출물: `lib/agent/models.ts`
- 작업 체크리스트:
  - [x] 지원 모델 목록 상수 정의
  - [x] 기본 모델 정의
  - [x] 모델 유효성 검사 함수 정의
- DoD: 클라이언트/서버에서 공통 모델 목록을 사용한다.
- 검증: `pnpm lint` 통과

### FEAT-002

- 상태: ✅ DONE
- 제목: Codex 실행기에 모델 옵션 연결
- 예상 시간: 2h
- 선행: FEAT-001
- 산출물: `lib/agent/codex-runner.ts`
- 작업 체크리스트:
  - [x] `runCodex`에 `model` 옵션 추가
  - [x] `codex exec -m <model> -` 인자 구성
  - [x] 고정 경로 검증/취소 처리 유지
- DoD: 요청 모델을 실행 인자에 반영한다.
- 검증: `pnpm lint` 통과

### FEAT-003

- 상태: ✅ DONE
- 제목: Agent API 모델 검증 및 세션 모델 저장
- 예상 시간: 2h
- 선행: FEAT-002
- 산출물: `app/api/agent/route.ts`, `lib/agent/session-manager.ts`, `lib/agent/types.ts`
- 작업 체크리스트:
  - [x] 요청 body의 `model` 검증
  - [x] 세션에 `model`, `updatedAt` 저장
  - [x] 입력 길이/세션 ID 검증 강화
- DoD: 서버가 지원 모델만 실행하고 세션에 모델 정보를 기록한다.
- 검증: `pnpm lint` 통과

### FEAT-004

- 상태: ✅ DONE
- 제목: 에이전트 화면 모델 드롭다운 추가
- 예상 시간: 2h
- 선행: FEAT-003
- 산출물: `app/agent/page.tsx`
- 작업 체크리스트:
  - [x] "메시지 입력" 라벨 우측 모델 선택 UI 추가
  - [x] 현재 사용 모델 표시
  - [x] 전송 시 선택 모델 포함
- DoD: 사용자가 에이전트 화면에서 모델을 확인/변경할 수 있다.
- 검증: `/agent`에서 드롭다운 선택 후 전송 요청 확인

### FEAT-005

- 상태: ✅ DONE
- 제목: 세션 목록/상세/삭제 API 추가
- 예상 시간: 2h
- 선행: FEAT-003
- 산출물:
  - `app/api/sessions/route.ts`
  - `app/api/sessions/[sessionId]/route.ts`
  - `lib/agent/session-manager.ts`
- 작업 체크리스트:
  - [x] 세션 목록 조회 API 구현
  - [x] 세션 상세 조회 API 구현
  - [x] 세션 삭제 API 구현
- DoD: 메인 화면에서 세션 데이터를 읽고 삭제할 API가 준비된다.
- 검증: API 호출 시 목록/조회/삭제 정상 응답

### FEAT-006

- 상태: ✅ DONE
- 제목: 메인 화면 세션 관리 UI 구현
- 예상 시간: 3h
- 선행: FEAT-005
- 산출물:
  - `components/session-manager.tsx`
  - `app/page.tsx`
- 작업 체크리스트:
  - [x] 세션 목록 렌더링
  - [x] 마지막 작업 시간 상대 표기(몇 분/시간/일 전)
  - [x] 새로고침/삭제 액션 추가
- DoD: 메인 화면에서 GPT 세션을 확인하고 관리할 수 있다.
- 검증: `/` 접속 후 세션 목록, 상대시간, 삭제 동작 확인

### FEAT-007

- 상태: ✅ DONE
- 제목: 세션 이어하기 동선 구현
- 예상 시간: 2h
- 선행: FEAT-006
- 산출물: `app/agent/page.tsx`
- 작업 체크리스트:
  - [x] `/agent?sessionId=` 진입 지원
  - [x] 기존 세션 메시지 로드
  - [x] 이어쓰기 전송 동작 연결
- DoD: 메인 화면에서 클릭한 세션을 이어서 작업할 수 있다.
- 검증: 세션 클릭 후 기존 메시지 표시 및 추가 전송 확인

### FEAT-008

- 상태: ✅ DONE
- 제목: 스트림 중단/실패 복구 안정화
- 예상 시간: 2h
- 선행: FEAT-007
- 산출물: `app/api/agent/route.ts`, `lib/agent/codex-runner.ts`
- 작업 체크리스트:
  - [x] 클라이언트 중단 시 안전한 스트림 종료
  - [x] Codex 취소/타임아웃 시 fallback 저장
  - [x] 첫 chunk keepalive 전송
- DoD: 중단/오류 상황에서도 서버 에러 없이 복구 가능하다.
- 검증: 중단 후 재요청 가능 및 세션 기록 확인

### FEAT-009

- 상태: ✅ DONE
- 제목: 기능 검증 리포트 작성
- 예상 시간: 1h
- 선행: FEAT-008
- 산출물: `docs/e2e-report.md`
- 작업 체크리스트:
  - [x] 정상/제한/중단/저장 시나리오 기록
  - [x] 결과 PASS/FAIL 정리
- DoD: 구현 기능 검증 결과가 문서화되어 재현 가능하다.
- 검증: 리포트 파일 확인

### FEAT-010

- 상태: REVIEW
- 제목: 서버 선행 작업 최소화로 첫 응답 지연 축소
- 예상 시간: 3h
- 선행: FEAT-009
- 산출물:
  - `lib/agent/context-builder.ts`
  - `lib/agent/session-manager.ts`
  - `lib/agent/job-manager.ts`
- 작업 체크리스트:
  - [x] 세션 저장 I/O 순서 재배치(초기 응답 경로 우선)
  - [x] 컨텍스트 트림 전략 최적화(입력 길이 기반 동적 예산)
  - [x] 첫 청크 도달 시간(TTFB) 측정 로그 추가
  - [ ] 로컬 기준 5회 평균 첫 응답 도달 시간 비교 리포트 작성
- DoD: 신규/기존 세션 모두에서 동적 컨텍스트 예산과 TTFB 로그 기반 분석이 가능하다.
- 검증: `pnpm lint`, `pnpm build` 통과

### FEAT-011

- 상태: ✅ DONE
- 제목: 비동기 잡 저장소/실행 매니저 추가
- 예상 시간: 3h
- 선행: FEAT-009
- 산출물: `lib/agent/job-manager.ts`, `lib/agent/types.ts`, `lib/agent/session-manager.ts`
- 작업 체크리스트:
  - [x] `data/jobs/{jobId}.json` 저장 구조 추가
  - [x] 세션별 active job 잠금/해제 로직 추가
  - [x] 요청 응답과 실행을 분리한 백그라운드 실행 흐름 구현
- DoD: 브라우저 연결과 무관하게 서버에서 잡 실행이 계속 진행된다.
- 검증: 작업 요청 후 페이지 이탈/재접속 시 실행 상태가 유지된다.

### FEAT-012

- 상태: ✅ DONE
- 제목: 잡 조회 API 및 Agent 생성 API 전환
- 예상 시간: 2h
- 선행: FEAT-011
- 산출물: `app/api/agent/route.ts`, `app/api/jobs/[jobId]/route.ts`
- 작업 체크리스트:
  - [x] `POST /api/agent`를 `202 + jobId` 반환 방식으로 전환
  - [x] active job 충돌 시 `409 + activeJobId` 반환
  - [x] `GET /api/jobs/:jobId?since=` 상태/이벤트 조회 API 구현
- DoD: 클라이언트가 스트림 연결 대신 잡 상태 폴링으로 응답을 추적할 수 있다.
- 검증: `pnpm build` 통과 및 API 응답 스키마 확인

### FEAT-013

- 상태: ✅ DONE
- 제목: Agent 화면 잡 폴링/복구 UI 적용
- 예상 시간: 3h
- 선행: FEAT-012
- 산출물: `app/agent/page-client.tsx`
- 작업 체크리스트:
  - [x] 메시지 전송 시 잡 생성 후 상태 폴링 연결
  - [x] 세션 재진입 시 `activeJobId` 자동 복구
  - [x] 대기/진행/완료/실패 상태 및 응답시간 UI 반영
- DoD: 사용자가 페이지를 닫았다가 돌아와도 진행 중 응답을 이어서 확인할 수 있다.
- 검증: `pnpm lint`, `pnpm build` 통과 및 수동 복구 시나리오 확인

## 4. 기능 종료 체크리스트

- [x] 에이전트 화면에서 실행 모델을 확인/변경할 수 있다.
- [x] 선택한 모델이 API 실행 인자에 반영된다.
- [x] 메인 화면에서 GPT 세션 목록을 확인할 수 있다.
- [x] 세션별 마지막 작업 경과 시간이 표시된다.
- [x] 세션 클릭 시 해당 세션을 이어서 작업할 수 있다.
- [x] 세션 삭제가 가능하다.
- [x] 관련 검증 결과가 `docs/e2e-report.md`에 기록되어 있다.
- [x] 에이전트 요청이 백그라운드 잡으로 실행되어 페이지 이탈 후에도 유지된다.
- [x] 에이전트 화면 재진입 시 진행 중 잡을 자동 복구한다.
