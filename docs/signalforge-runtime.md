# SignalForge Runtime Guide

이 문서는 SignalForge를 `codexia` 안에서 어떤 런타임 경계로 운영할지 정리한 문서다. 목표는 프론트엔드와 백엔드를 억지로 분리하지 않으면서도, PostgreSQL과 로컬 medium을 안정적으로 붙일 수 있는 최소 구조를 고정하는 것이다.

## 1. 권장 런타임

핵심 원칙은 세 가지다.

- Next.js 앱은 계속 `delivery app` 으로 둔다.
- SignalForge의 live source of truth는 PostgreSQL로 옮긴다.
- 로컬 권한이 필요한 실행기는 컨테이너 안이 아니라 호스트의 `local medium` 으로 둔다.

```mermaid
flowchart LR
    User["User"] --> Web["Next.js Web UI"]
    User --> Telegram["Telegram Bot"]
    Web --> Backend["Next.js Route Handlers / BFF"]
    Telegram --> Poller["Telegram Poller (Local Medium)"]
    Poller --> Backend
    Backend --> Pg["PostgreSQL"]
    Pipeline["Signal Pipeline<br/>future Python service"] --> Pg
    Medium["Local Medium<br/>Codex CLI / local FS / screenshots"] --> Backend
```

이 구조에서 Next.js는 프론트엔드와 API를 함께 가진다. 지금 시점에 프론트엔드만 따로 컨테이너로 떼는 것은 얻는 이점보다 SSR/API 재배선 비용이 크다. 반면 PostgreSQL과 local medium을 먼저 분리하면, SignalForge live path와 Codex 실행 경계가 동시에 명확해진다.

## 2. 왜 프론트엔드만 분리하지 않는가

현재 저장소는 단일 Next.js 앱 안에 아래가 함께 있다.

- 웹 화면
- `/api/signals/*`
- `/api/telegram`
- agent job 생성과 CLI 실행

```mermaid
flowchart TD
    App["codexia Next.js app"] --> UI["Web pages"]
    App --> Signals["Signal APIs"]
    App --> TelegramRoute["Telegram route"]
    App --> Agent["Agent job service"]
    Agent --> Cli["Codex/Gemini CLI"]
```

이 상태에서 프론트엔드만 별도 컨테이너로 분리하면 화면 렌더링 문제보다 API 재배치가 먼저 터진다. 그래서 phase1에서는 `frontend/backend split` 보다 `storage split` 이 우선이다.

## 3. Local Medium의 역할

local medium은 프론트엔드와 백엔드 사이의 프록시가 아니라, 백엔드 옆에서 로컬 권한을 대신 수행하는 실행기 계층이다.

```mermaid
sequenceDiagram
    participant User as User
    participant Backend as Next.js Backend
    participant Medium as Local Medium
    participant Host as Host OS
    participant DB as PostgreSQL

    User->>Backend: job 요청 / Telegram 명령
    Backend->>Medium: 실행 요청 또는 poll 전달
    Medium->>Host: codex exec / screenshot / local file access
    Medium-->>Backend: 결과 payload / 상태
    Backend->>DB: 결과 저장
    Backend-->>User: UI / Telegram 응답
```

현재 저장소에서 local medium에 해당하는 것은 주로 아래 둘이다.

- `src/infrastructure/agent/codex-cli-executor.ts`
- `src/infrastructure/telegram/poller-runtime.ts`

즉 `codex exec`, 텔레그램 long polling, 로컬 파일 접근은 호스트에서 유지하고, SignalForge live 데이터만 PostgreSQL로 고정하는 방향이 phase1의 부담을 가장 덜어준다.

## 4. PostgreSQL을 compose에 넣는 이유

SignalForge는 JSON mock shell에서 실데이터 시스템으로 넘어가는 중간 단계다. 이때 가장 먼저 필요한 것은 수집기보다 `storage spine` 이다.

```mermaid
flowchart LR
    Compose["docker compose"] --> Pg["postgres:16"]
    Pg --> Migrations["db/migrations/signals/*.sql"]
    Migrations --> ReadRepo["src/infrastructure/signals/postgres-signal-repository.ts"]
    ReadRepo --> Service["src/application/signals/signal-service.ts"]
    Service --> API["/api/signals/*"]
    API --> UI["Web / Telegram"]
```

이 구조에서는 다음 원칙이 유지된다.

- live snapshot 기본 경로는 PostgreSQL이다.
- `SIGNALS_ENABLE_DEMO_MODE=1` 일 때만 JSON demo fallback을 허용한다.
- DB가 비어 있거나 migration이 안 된 상태에서는 `health=failed` 로 fail-closed 한다.

## 5. 현재 compose에 넣는 범위

지금 기준 compose 범위는 작게 유지한다.

- `postgres`
- `adminer` (`tools` profile, 선택)

넣지 않는 것:

- Next.js app 전체
- Telegram poller
- Codex CLI executor
- future Python pipeline

이유는 간단하다. 앱과 medium을 함께 컨테이너화하면 오히려 로컬 CLI 경로, 파일 시스템, 스크린샷, Telegram callback 경로가 더 복잡해진다.

## 6. phase1에서 바뀐 실제 경계

```mermaid
flowchart LR
    Demo["data/signals/demo-snapshot.json"] --> Fallback["demo fallback only"]
    DB["signal_delivery_snapshots"] --> Live["live read path"]
    Live --> Service["signal-service"]
    Fallback --> Service
    Sources["signal_source_runs"] --> Health["health detail"]
    Health --> Service
```

이번 phase1에서는 live snapshot 기본 경로를 JSON에서 PostgreSQL로 바꿨다.

- `src/infrastructure/signals/snapshot-store.ts`
  - PostgreSQL live read 우선
  - demo flag가 켜진 경우에만 JSON fallback
- `src/infrastructure/signals/postgres-signal-repository.ts`
  - `signal_delivery_snapshots` 와 `signal_source_runs` read model
- `db/migrations/signals/001_init.sql`
  - phase2/3까지 버틸 storage spine

## 7. 운영 순서

```mermaid
flowchart TD
    A["pnpm signals:db:up"] --> B["DATABASE_URL 설정"]
    B --> C["pnpm signals:migrate"]
    C --> D["pipeline writer 또는 seed 준비"]
    D --> E["pnpm dev:web"]
```

로컬에서 가장 가벼운 실행 순서는 다음과 같다.

1. `pnpm signals:db:up`
2. `DATABASE_URL=postgresql://codexia:codexia@127.0.0.1:54329/codexia`
3. `pnpm signals:migrate`
4. `pnpm dev:web`

DB가 아직 비어 있으면 `/api/signals/health` 는 `503 failed` 를 반환한다. demo 화면이 필요하면 `SIGNALS_ENABLE_DEMO_MODE=1` 로만 열어 둔다.
