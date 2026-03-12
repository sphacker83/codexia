# Codex 개인 AI 에이전트 설계 문서

## 1. 개요

이 프로젝트는 개인 AI 에이전트 시스템으로 동작한다.

### 동작 구조

1. 웹 UI (Next.js)
2. API 서버
3. Agent Layer
4. Codex CLI 실행
5. 결과를 스트리밍으로 UI에 전달

이 에이전트는 단순 채팅이 아니라 개인 개발 에이전트로 동작해야 한다.

### 목표 역할

- 코드 생성
- 코드 수정
- 디버깅
- 프로젝트 구조 설계
- 개발 자동화 지원

## 2. 전체 동작 흐름

1. 사용자 입력
2. `/api/agent` 요청
3. 세션 로드
4. 프롬프트 구성
5. Codex CLI 실행
6. `stdout` 스트리밍
7. UI에 실시간 전달
8. 결과 세션에 저장

## 3. 에이전트 역할 구성

### 3.1 CodexAgent (핵심 역할)

#### 역할

- 실행 가능한 코드 생성
- 문제 해결 중심 답변
- 불필요한 설명 최소화
- 실무 중심 출력

#### 성격

- 시니어 개발자
- 시스템 설계자
- 자동화 엔지니어

#### 응답 원칙

- 간결하게
- 바로 실행 가능한 형태로
- 장황한 설명 금지

### 3.2 세션 관리자

#### 기능

- 세션별 대화 기록 유지
- 이전 대화 기반 컨텍스트 구성

#### 세션 구조

```txt
sessionId
createdAt
messages[]
```

#### messages 구조

```txt
role: user 또는 assistant
content: 문자열
```

#### 저장 위치 (MVP)

`/data/sessions/{sessionId}.json`

#### 향후

- SQLite
- Redis

### 3.3 컨텍스트 생성기

#### 프롬프트 구조

```txt
System: 당신은 개인 개발 AI 에이전트입니다.
Conversation: 이전 대화 내용
User: 사용자 입력
```

#### 역할

- 최근 대화만 포함
- 최대 길이 제한 적용
- 불필요한 기록 제거

### 3.4 Codex 실행 컨트롤러

`Node.js child_process`를 사용한다.

#### 기능

- Codex CLI 실행
- `stdin`으로 프롬프트 전달
- `stdout` 스트리밍
- 에러 처리
- 타임아웃 적용 (기본 300초)

#### MVP 방식

요청마다 Codex 실행 (Stateless)

#### 확장

세션별 Persistent 프로세스

## 4. API 규격

### 엔드포인트

`POST /api/agent`

### 요청

```json
{
  "sessionId": "string",
  "message": "string"
}
```

### 응답

텍스트 스트리밍(`chunk`)

UI는 스트림을 받아 실시간으로 표시해야 한다.

## 5. 스트리밍 규칙

- `chunk` 단위 전달
- 프로세스 종료 시 스트림 종료
- 오류 발생 시 안전 종료
- 중단 시 재요청 가능

## 6. 보안 제한

- 입력 길이 제한 (20,000자)
- Codex 실행 시간 제한 (기본 300초)
- Codex 실행 경로 고정
- 임의 shell 실행 금지

## 7. 예상 폴더 구조

```txt
/app/api/agent/route.ts

/lib/agent
  - agent-controller.ts
  - codex-runner.ts
  - context-builder.ts
  - session-manager.ts

/data/sessions
```

## 8. 향후 확장 (Phase 2 이후)

### 추가 예정 기능

- 파일 읽기/쓰기
- Git 제어
- 터미널 실행
- 프로젝트 자동 생성

### 동작 흐름

1. 사용자 요청
2. Agent 판단
3. Tool 실행
4. 결과를 Codex에 전달

## 9. 성공 기준

에이전트는 다음을 수행해야 한다.

- 실행 가능한 코드 생성
- 대화 컨텍스트 유지
- 응답 스트리밍
- 오류 발생 시 복구
- 여러 세션 처리 가능

## 10. 에이전트 응답 스타일

### 톤

- 직접적
- 간결함
- 실무 중심
- 불필요한 설명 없음
