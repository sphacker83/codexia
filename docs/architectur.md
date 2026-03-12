# Architecture

## CodexOS 시스템 구조

### 전체 구조

1. Browser
2. Next.js UI
3. API Route
4. Agent Layer
5. Codex CLI
6. Stream Response

## 요청 흐름

1. 사용자 메시지 입력
2. `POST /api/agent` 호출
3. 세션 로드
4. 컨텍스트 생성
5. Codex CLI 실행
6. `stdout` 스트리밍
7. UI에 실시간 전달
8. 메시지 저장

## 계층 구조

### UI Layer

`/app/agent/page.tsx`

#### 역할

- 사용자 입력
- 메시지 표시
- 스트리밍 처리

### API Layer

`/app/api/agent/route.ts`

#### 역할

- 요청 처리
- Agent 호출
- 스트림 반환

### Agent Layer

```txt
/src/core
/src/application
/src/infrastructure
/src/presentation
```

#### 구성

- `src/core`: 타입, 모델, 프롬프트 예산, 워크스페이스 정책
- `src/application`: 잡 오케스트레이션과 유스케이스
- `src/infrastructure`: Codex 실행기와 세션 저장소
- `src/presentation`: 서버 스트림/검증과 웹/텔레그램 프레젠테이션

## Codex 실행 구조

Node `child_process` 사용

### 동작

1. `spawn codex`
2. `stdin` -> 프롬프트
3. `stdout` -> 스트림

### MVP

요청마다 실행 (Stateless)

## 세션 구조

### 저장 경로

`/data/sessions/{sessionId}.json`

### 내용

```txt
sessionId
createdAt
messages[]
```

## 보안 설계

- Codex 실행 경로 고정
- 실행 시간 제한 (60초)
- 입력 길이 제한
- shell 실행 금지

## 확장 구조 (향후)

### Phase 2

- 파일 읽기/쓰기
- 프로젝트 컨텍스트

### Phase 3

- Git Tool
- Terminal Tool

### Phase 4

- 자동 프로젝트 생성 에이전트

## 최종 목표 구조

1. User
2. Web UI
3. Agent
4. Tools
5. Codex
6. Action
