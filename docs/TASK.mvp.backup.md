# CodexOS MVP 실행 태스크

## 0. 운영 규칙

- 범위: MVP(Phase A~E)만 진행한다.
- 패키지 매니저: `pnpm`을 기본으로 사용한다.
- 태스크 단위: 1~3시간 내 완료 가능한 단위로 유지한다.
- 착수 조건: 선행 태스크가 `✅ DONE`이어야 한다.
- 완료 규칙: 체크리스트 완료 + DoD 충족 + 검증 통과 시 `✅ DONE`.
- 완료 태스크 표기: 상태 필드는 `✅ DONE`으로 표시한다.
- 문서 규칙: 구현 중 스코프 변경이 발생하면 본 문서에 먼저 반영한다.

## 1. 상태 정의

| 상태 | 의미 |
| --- | --- |
| TODO | 아직 시작하지 않음 |
| DOING | 작업 중 |
| BLOCKED | 외부 요인으로 진행 불가 |
| REVIEW | 구현 완료, 검증/리뷰 대기 |
| ✅ DONE | 검증 포함 완료 |

## 2. 실행 순서 (Phase Gate)

1. Phase A 완료 조건: `MVP-001` ~ `MVP-005`가 `✅ DONE`
2. Phase B 완료 조건: `MVP-006` ~ `MVP-010`이 `✅ DONE`
3. Phase C 완료 조건: `MVP-011` ~ `MVP-014`가 `✅ DONE`
4. Phase D 완료 조건: `MVP-015` ~ `MVP-018`, `MVP-021`이 `✅ DONE`
5. Phase E 완료 조건: `MVP-019` ~ `MVP-020`이 `✅ DONE`
6. 진행 규칙: Gate 미충족 시 다음 Phase 태스크 시작 금지

## 3. 태스크 백로그

### 3.1 고정 API/인터페이스

- API: `POST /api/agent`
- Request JSON:

```json
{ "sessionId": "string", "message": "string" }
```

- Response: 텍스트 스트리밍(`chunk`)
- 세션 타입:

```ts
type Role = "user" | "assistant";
interface Message { role: Role; content: string; createdAt: string; }
interface Session { sessionId: string; createdAt: string; messages: Message[]; }
```

- 저장 경로 규칙: `data/sessions/{sessionId}.json`

### MVP-001

- 상태: ✅ DONE
- 제목: Next.js 앱 초기화
- 예상 시간: 2h
- 선행: 없음
- 산출물: Next.js App Router 프로젝트 기본 파일
- 작업 체크리스트:
  - [x] `pnpm create next-app@latest . --ts --app --eslint --use-pnpm --no-src-dir` 실행
  - [x] 생성된 프로젝트가 루트 기준으로 구성되었는지 확인
  - [x] `pnpm dev`로 기본 실행 확인
- DoD: 브라우저에서 기본 Next.js 화면이 정상 노출된다.
- 검증: `pnpm dev` 실행 후 `http://localhost:3000` 접속 확인

### MVP-002

- 상태: ✅ DONE
- 제목: 기본 폴더 생성
- 예상 시간: 1h
- 선행: MVP-001
- 산출물: `app/agent`, `app/api/agent`, `lib/agent`, `data/sessions`
- 작업 체크리스트:
  - [x] 4개 디렉터리 생성
  - [x] `data/sessions/.gitkeep` 추가
- DoD: MVP 설계 문서의 기본 디렉터리 구조가 준비된다.
- 검증: `find app lib data -maxdepth 3 -type d` 결과 확인

### MVP-003

- 상태: ✅ DONE
- 제목: 공통 타입 정의
- 예상 시간: 2h
- 선행: MVP-002
- 산출물: `lib/agent/types.ts`
- 작업 체크리스트:
  - [x] `Role`, `Message`, `Session`, `AgentRequest` 타입 정의
  - [x] 타입을 다른 모듈에서 import 가능하게 export 구성
- DoD: 세션/요청 관련 타입이 단일 파일에서 재사용 가능하다.
- 검증: `pnpm lint` 통과

### MVP-004

- 상태: ✅ DONE
- 제목: 세션 파일 I/O 유틸 작성
- 예상 시간: 2h
- 선행: MVP-003
- 산출물: `lib/agent/session-manager.ts`(read/write 기본 함수)
- 작업 체크리스트:
  - [x] 세션 파일 경로 계산 함수 구현
  - [x] JSON 파일 읽기 함수 구현
  - [x] JSON 파일 쓰기 함수 구현
- DoD: 주어진 `sessionId`로 세션 파일을 읽고 쓸 수 있다.
- 검증: Node 스크립트 또는 API 임시 호출로 파일 생성/읽기 확인

### MVP-005

- 상태: ✅ DONE
- 제목: 세션 생성/로드/메시지 append API 완성
- 예상 시간: 3h
- 선행: MVP-004
- 산출물: `lib/agent/session-manager.ts`(public 함수 완성)
- 작업 체크리스트:
  - [x] `createSession(sessionId)` 구현
  - [x] `loadSession(sessionId)` 구현
  - [x] `appendMessage(sessionId, message)` 구현
  - [x] 존재하지 않는 세션 처리 정책 반영(자동 생성)
- DoD: 세션 생성부터 메시지 누적 저장까지 단일 모듈에서 처리된다.
- 검증: 같은 `sessionId`에 메시지 2회 append 후 파일 내용 확인

### MVP-006

- 상태: ✅ DONE
- 제목: 컨텍스트 빌더 골격 작성
- 예상 시간: 2h
- 선행: MVP-005
- 산출물: `lib/agent/context-builder.ts`
- 작업 체크리스트:
  - [x] 시스템 프롬프트 템플릿 함수 구현
  - [x] 세션 메시지 -> 프롬프트 문자열 변환 함수 구현
  - [x] 사용자 입력 결합 함수 구현
- DoD: API에서 호출 가능한 프롬프트 생성 함수가 준비된다.
- 검증: 샘플 세션 입력으로 문자열 결과 확인

### MVP-007

- 상태: ✅ DONE
- 제목: 대화 길이 제한 로직 구현
- 예상 시간: 2h
- 선행: MVP-006
- 산출물: `lib/agent/context-builder.ts` 길이 제한 기능
- 작업 체크리스트:
  - [x] 입력 길이 20,000자 제한 로직 구현
  - [x] 과거 메시지 트리밍 정책 구현(최근 대화 우선)
  - [x] 길이 초과 시 에러 객체 규격화
- DoD: 길이 제한 정책이 일관되게 적용된다.
- 검증: 20,001자 입력 케이스에서 즉시 실패 확인

### MVP-008

- 상태: ✅ DONE
- 제목: Codex 실행기 골격 작성
- 예상 시간: 2h
- 선행: MVP-007
- 산출물: `lib/agent/codex-runner.ts`(spawn/경로 고정)
- 작업 체크리스트:
  - [x] `child_process.spawn` 기반 실행기 생성
  - [x] Codex 실행 경로 상수화
  - [x] `stdin`으로 프롬프트 전달 처리
- DoD: 고정된 경로의 Codex 프로세스를 기동할 수 있다.
- 검증: 더미 프롬프트 전달 시 프로세스 시작/종료 로그 확인

### MVP-009

- 상태: ✅ DONE
- 제목: Codex stdout 스트리밍 전달 구현
- 예상 시간: 3h
- 선행: MVP-008
- 산출물: `lib/agent/codex-runner.ts`(Readable -> Web Stream 변환)
- 작업 체크리스트:
  - [x] `stdout` chunk 수신 처리
  - [x] 웹 스트림 enqueue 로직 구현
  - [x] 종료 시 스트림 close 처리
- DoD: Codex 출력이 API 응답 스트림으로 전달된다.
- 검증: 샘플 출력이 chunk 단위로 전달되는지 확인

### MVP-010

- 상태: ✅ DONE
- 제목: 타임아웃/비정상 종료 에러 매핑 구현
- 예상 시간: 2h
- 선행: MVP-009
- 산출물: `lib/agent/codex-runner.ts` 에러 처리 확장
- 작업 체크리스트:
  - [x] 60초 타임아웃 타이머 구현
  - [x] 프로세스 exit code 기반 에러 분기
  - [x] 타임아웃/실패 에러 메시지 표준화
- DoD: 실패 원인이 구분 가능한 형태로 API 레이어에 전달된다.
- 검증: 의도적 지연/오류 실행으로 에러 코드 확인

### MVP-011

- 상태: ✅ DONE
- 제목: `/api/agent` 요청 스키마 검증 구현
- 예상 시간: 2h
- 선행: MVP-010
- 산출물: `app/api/agent/route.ts` 요청 검증 로직
- 작업 체크리스트:
  - [x] `sessionId`, `message` 필수값 검증
  - [x] 타입/빈 문자열 검증
  - [x] 검증 실패 시 4xx 응답 처리
- DoD: 잘못된 요청이 Codex 실행 전 차단된다.
- 검증: 누락/빈 문자열 케이스로 API 호출

### MVP-012

- 상태: ✅ DONE
- 제목: `/api/agent` 스트리밍 응답 핸들러 구현
- 예상 시간: 3h
- 선행: MVP-011
- 산출물: `app/api/agent/route.ts` `POST` 핸들러
- 작업 체크리스트:
  - [x] `POST` 요청 본문 파싱
  - [x] 스트리밍 `Response` 반환 구조 작성
  - [x] 헤더(`text/plain` 또는 필요한 스트리밍 헤더) 설정
- DoD: API에서 스트리밍 응답을 정상 시작한다.
- 검증: `curl`로 호출 시 스트리밍 응답 수신 확인

### MVP-013

- 상태: ✅ DONE
- 제목: API에서 세션/컨텍스트/실행기 연결
- 예상 시간: 3h
- 선행: MVP-012
- 산출물: `app/api/agent/route.ts` 통합 로직
- 작업 체크리스트:
  - [x] 세션 로드 호출 연결
  - [x] 컨텍스트 빌더 호출 연결
  - [x] Codex 러너 호출 및 스트림 연결
- DoD: API 한 요청으로 컨텍스트 기반 Codex 실행이 동작한다.
- 검증: 실제 메시지 1회 요청 후 응답 텍스트 확인

### MVP-014

- 상태: ✅ DONE
- 제목: 응답 완료 후 세션 저장 구현
- 예상 시간: 2h
- 선행: MVP-013
- 산출물: `app/api/agent/route.ts` 저장 후처리
- 작업 체크리스트:
  - [x] 유저 메시지 저장
  - [x] 어시스턴트 최종 응답 저장
  - [x] 저장 실패 시 로깅/오류 처리
- DoD: 요청 완료 시 세션 파일에 user/assistant 메시지가 모두 누적된다.
- 검증: 같은 `sessionId` 재호출 시 이전 대화 반영 확인

### MVP-015

- 상태: ✅ DONE
- 제목: `/agent` 페이지 UI 뼈대 생성
- 예상 시간: 2h
- 선행: MVP-014
- 산출물: `app/agent/page.tsx`
- 작업 체크리스트:
  - [x] 메시지 리스트 영역 추가
  - [x] 입력창(Textarea) 추가
  - [x] 전송 버튼 추가
- DoD: 사용자 입력을 받을 수 있는 기본 UI가 렌더링된다.
- 검증: `/agent` 접속 시 UI 요소 표시 확인

### MVP-021

- 상태: ✅ DONE
- 제목: 메인 화면(`/`) 랜딩 UI 구성
- 예상 시간: 2h
- 선행: MVP-001
- 산출물: `app/page.tsx`
- 작업 체크리스트:
  - [x] `/` 경로에 제품 메인 랜딩 UI 구성
  - [x] `/agent` 진입 버튼 추가
  - [x] 모바일/데스크톱 반응형 레이아웃 적용
- DoD: 사용자 진입 시 `/`에서 제품 소개와 `/agent` 이동 동선이 제공된다.
- 검증: `/` 접속 후 메인 화면 렌더링 및 `/agent` 이동 확인

### MVP-016

- 상태: ✅ DONE
- 제목: 메시지 입력/전송 상태 관리 구현
- 예상 시간: 2h
- 선행: MVP-015
- 산출물: `app/agent/page.tsx` 상태 로직
- 작업 체크리스트:
  - [x] 입력 상태(state) 바인딩
  - [x] 전송 중 상태(loading) 처리
  - [x] 전송 버튼 비활성화 조건 구현
- DoD: 사용자 입력과 전송 상태가 UI에서 일관되게 관리된다.
- 검증: 전송 중 중복 클릭 방지 동작 확인

### MVP-017

- 상태: ✅ DONE
- 제목: 스트림 청크 수신 및 실시간 렌더링 구현
- 예상 시간: 3h
- 선행: MVP-016
- 산출물: `app/agent/page.tsx` 스트리밍 처리 로직
- 작업 체크리스트:
  - [x] `fetch` 스트리밍 응답 reader 처리
  - [x] chunk 누적 렌더링 구현
  - [x] 응답 완료 시 최종 메시지 확정 처리
- DoD: 어시스턴트 메시지가 실시간으로 화면에 갱신된다.
- 검증: 긴 응답 요청 시 단계적 텍스트 출력 확인

### MVP-018

- 상태: ✅ DONE
- 제목: 오류/타임아웃 UI 처리 및 재시도 구현
- 예상 시간: 2h
- 선행: MVP-017
- 산출물: `app/agent/page.tsx` 오류 처리 UX
- 작업 체크리스트:
  - [x] 오류 메시지 표시 영역 구현
  - [x] 타임아웃 시 사용자 안내 문구 처리
  - [x] 재요청 버튼 또는 재전송 동작 구현
- DoD: 실패 케이스에서 사용자 재시도가 가능하다.
- 검증: API 실패 강제 후 UI 오류/재시도 동작 확인

### MVP-019

- 상태: ✅ DONE
- 제목: 기본 보안 규칙 적용
- 예상 시간: 2h
- 선행: MVP-018
- 산출물: API/Runner 보안 가드 로직
- 작업 체크리스트:
  - [x] Codex 실행 경로 고정 검증
  - [x] shell 실행 금지 정책 반영
  - [x] 입력 검증 강화(길이/형식)
- DoD: MVP 보안 요구사항 3종이 코드 수준으로 강제된다.
- 검증: 비정상 입력/경로 변조 시도에 대한 차단 확인

### MVP-020

- 상태: ✅ DONE
- 제목: 수동 E2E 점검 시나리오 수행 및 결과 기록
- 예상 시간: 3h
- 선행: MVP-019
- 산출물: `docs/e2e-report.md` 또는 `docs/TASK.md` 내 결과 기록
- 작업 체크리스트:
  - [x] 정상 플로우 점검 기록
  - [x] 연속 대화 점검 기록
  - [x] 제한/타임아웃/중단 복구 점검 기록
  - [x] 세션 저장 검증 기록
- DoD: MVP 수동 검증 결과가 재현 가능한 형태로 문서화된다.
- 검증: 아래 테스트 시나리오 6개 전부 `PASS` 기록

## 4. MVP 종료 체크리스트

- [x] 정상 플로우: 메시지 전송 시 첫 chunk가 2초 내 도착
- [x] 연속 대화: 동일 `sessionId` 3회 요청 시 컨텍스트 누적 반영
- [x] 제한 검증: 20,001자 입력 시 즉시 거절
- [x] 타임아웃: 60초 내 프로세스 종료 및 오류 반환
- [x] 스트림 중단: UI 실패 상태 전환 후 재요청 가능
- [x] 저장 검증: 세션 파일에 user/assistant 메시지 모두 기록
- [x] 메인 화면 검증: `/` 접속 시 랜딩 노출 및 `/agent` 이동 가능
