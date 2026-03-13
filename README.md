# Codexia

🚀 개발자용 AI 워크스페이스입니다.  
🌐 웹 UI에서 작업을 보내고, 📡 Telegram에서도 같은 에이전트를 이어서 쓸 수 있습니다.  
⚙️ 응답은 실시간 스트리밍되고, 세션과 job 상태는 로컬 JSON 파일에 저장됩니다.

## ✨ 한눈에 보기

- 🧠 세션 기반 대화 유지
- 🔄 job 단위 실행 및 상태 추적
- 📜 SSE 스트리밍 응답
- 🧪 Trace 모드에서 reasoning, command, usage 표시
- 📁 `@파일경로` 자동완성
- 🔐 워크스페이스 보호 경로 / 코어 경로 정책
- 📲 Telegram 명령, 첨부 파일, 스크린샷 지원

## 🚀 빠른 시작

### 1. 준비물

- `Node.js 22+`
- `pnpm`
- `Codex CLI` (`gpt-5.x` 계열 모델 사용 시)
- `Gemini CLI` (`gemini-*` 계열 모델 사용 시)
- `GitHub CLI` (`git`/GitHub 작업까지 에이전트에게 맡길 계획이면 준비)
- `Docker` (`SignalForge` phase1 PostgreSQL을 compose로 띄울 경우)
- Telegram까지 쓸 경우 `TELEGRAM_BOT_TOKEN`

꼭 확인:

- `gpt-5.x` 모델을 쓰려면 `Codex CLI`가 필요합니다.
- `gemini-*` 모델을 쓰려면 `Gemini CLI`가 필요합니다.
- 두 계열 모델을 모두 쓸 거면 `Codex CLI`, `Gemini CLI` 둘 다 미리 OAuth 로그인 상태여야 합니다.
- Git/GitHub 작업까지 맡길 거면 `GitHub CLI`를 설치하고 `gh auth login`까지 미리 해두세요.

### 2. 설치

macOS / Linux:

```bash
git clone https://github.com/sphacker83/codexia
cd codexia
pnpm install
cp .env.local.template .env.local
```

Windows PowerShell:

```powershell
git clone https://github.com/sphacker83/codexia
cd codexia
pnpm install
Copy-Item .env.local.template .env.local
```

### 3. CLI 인증 준비

실행 전에 각 CLI가 로그인된 상태인지 먼저 확인하세요.

- `Codex CLI`
  - `gpt-5.x` 계열 모델을 쓸 거면 먼저 OAuth 로그인 완료
- `Gemini CLI`
  - `gemini-*` 계열 모델을 쓸 거면 먼저 OAuth 로그인 완료
- `GitHub CLI`
  - Git/GitHub 작업까지 에이전트에게 맡길 거면 `gh auth login` 완료

팁:

- 터미널에서 `codex`, `gemini`, `gh auth status`가 각각 정상 동작하는지 먼저 확인해 두는 편이 좋습니다.

### 4. 최소 설정

`.env.local`에 최소한 아래 값부터 맞추는 것을 권장합니다.
**가급적 기본 설정 값을 사용하는것을 추천합니다.**

```env
#접근을 허용할 최상단
AGENT_WORKSPACE_ROOT=$HOME/Workspace 

#반드시 보호해야 하는 Path (기본환경설정 추천)
AGENT_PROTECTED_PATHS=codexia/.env.local 
```

Windows 예시:

```env
AGENT_WORKSPACE_ROOT=C:/Users/yourname/Workspace
AGENT_PROTECTED_PATHS=codexia/.env.local
```

**아래는 반드시 수정해야 합니다.**
Telegram도 같이 쓸 경우:

```env
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET=replace_with_random_secret
TELEGRAM_REGISTRATION_CODE=CODEXIA-START-REGISTRATION-CODE #직접 생성 가능
```

### 5. 실행

웹만 실행:

```bash
pnpm dev:web
```

웹 + Telegram poller 같이 실행:

```bash
pnpm dev
```

Telegram 환경 변수가 아직 없으면:

```bash
pnpm dev -- --no-telegram
```

접속:

- 🌐 Web: [http://localhost:3000](http://localhost:3000)

### 6. SignalForge DB 준비

SignalForge live path는 이제 JSON이 아니라 PostgreSQL을 기준으로 읽습니다. 로컬에서는 compose로 DB만 먼저 띄우는 구성이 가장 가볍습니다.

```bash
pnpm signals:db:up
pnpm signals:migrate
```

기본 compose 포트는 `54329` 이고, `.env.local` 예시는 아래와 같습니다.

```env
DATABASE_URL=postgresql://codexia:codexia@127.0.0.1:54329/codexia
DATABASE_SSL=0
SIGNALS_ENABLE_DEMO_MODE=0
```

운영 확인:

- `GET /api/signals/health`
  - live snapshot이 아직 없으면 `503 failed`
  - `SIGNALS_ENABLE_DEMO_MODE=1` 이면 demo fallback 허용

## 📲 Telegram 기능 먼저 보기

Codexia는 Telegram 지원이 강한 편입니다. 단순 알림 수준이 아니라, 같은 에이전트 계층을 Telegram에서도 그대로 사용합니다.

### Telegram으로 할 수 있는 것

- 💬 텍스트만 보내도 바로 에이전트 실행
- ▶️ `/run <요청>` 으로 명시 실행
- 📊 `/status`, `/jobs`, `/recent` 로 현재 상황 확인
- 🛑 `/cancel` 로 진행 중 작업 취소
- 🧵 `/session`, `/new`, `/r <번호|세션ID>` 로 세션 전환
- 🏷️ `/title` 로 현재 세션 제목 변경
- 🤖 `/model`, `/effort` 로 실행 옵션 변경
- 📎 문서/이미지 첨부 후 로컬 파일로 저장하여 분석 요청
- 📸 `/screencap [라벨]` 로 내 화면 캡처 전송
- 📝 `/log [개수]` 로 최근 Telegram 이벤트 로그 확인

### Telegram 실행 방식

- `pnpm dev`
  - 개발 서버 + Telegram poller 동시 실행
- `pnpm telegram:poll`
  - poller만 실행
- `pnpm telegram:dev`
  - 개발 서버 + poller 동시 실행

### 꼭 알아둘 점

- `pnpm dev`는 기본적으로 Telegram poller까지 같이 시작합니다.
- `TELEGRAM_BOT_TOKEN`이 없으면 poller가 종료되고 개발 흐름도 불편해질 수 있습니다.
- Telegram을 아직 안 쓸 때는 `pnpm dev:web` 또는 `pnpm dev -- --no-telegram`이 더 안전합니다.

## 🖥️ 웹 사용 흐름

### 홈 화면

- 📚 저장된 세션 목록 조회
- ♻️ 기존 세션 재진입
- 🗑️ 세션 삭제
- 🛑 활성 작업 일괄 종료

### 워크스페이스 화면

- 🆕 새 세션 자동 생성 또는 기존 세션 재사용
- 🤖 모델 선택
- 🧠 사고수준 선택
- 🧪 Trace 모드 on/off
- 📏 컨텍스트 사용량 표시
- 📝 실시간 응답 스트리밍
- 📂 `@파일명` 자동완성

## 🤖 실행 모델과 옵션

### 지원 모델

- `gpt-5.4`
- `gpt-5.3-codex`
- `gpt-5.3-codex-spark`
- `gemini-3.1-pro-preview`
- `gemini-3-flash-preview`

### 사고수준

- `minimal`
- `low`
- `medium`
- `high`
- `xhigh`

참고:

- Codex 계열 모델은 사고수준 조정이 적용됩니다.
- Gemini 계열 모델은 현재 reasoning effort override를 사용하지 않습니다.
- Codex 계열을 쓰려면 Codex CLI, Gemini 계열을 쓰려면 Gemini CLI가 준비되어 있어야 합니다.

## 🧩 CLI 설치와 경로

서버는 선택한 모델에 따라 Codex CLI 또는 Gemini CLI를 직접 실행합니다.

경로 탐색 순서:

1. 환경변수
2. `PATH`
3. 일반 설치 경로 fallback

Codex:

1. `CODEX_CLI_PATH` 또는 `CODEX_PATH`
2. `PATH` 내 `codex`, `codex.exe`, `codex.cmd`
3. 일반 설치 경로 fallback

Gemini:

1. `GEMINI_CLI_PATH` 또는 `GEMINI_PATH`
2. `PATH` 내 `gemini`, `gemini.exe`, `gemini.cmd`
3. 일반 설치 경로 fallback

macOS / Linux fallback 예시:

- `$HOME/.bun/bin/codex`
- `$HOME/.npm-global/bin/codex`
- `$HOME/.bun/bin/gemini`
- `$HOME/.npm-global/bin/gemini`
- `/opt/homebrew/bin/codex`
- `/opt/homebrew/bin/gemini`
- `/usr/local/bin/codex`
- `/usr/local/bin/gemini`

Windows fallback 예시:

- `%APPDATA%\npm\codex.cmd`
- `%APPDATA%\npm\codex.exe`
- `%APPDATA%\npm\gemini.cmd`
- `%APPDATA%\npm\gemini.exe`

Windows에서 PATH 인식이 애매하면 직접 지정:

```env
CODEX_CLI_PATH=C:/Users/yourname/AppData/Roaming/npm/codex.cmd
GEMINI_CLI_PATH=C:/Users/yourname/AppData/Roaming/npm/gemini.cmd
```

권장:

- `Codex CLI`, `Gemini CLI` 모두 한 번씩 직접 실행해서 OAuth 인증 완료
- Git/GitHub 작업이 필요하면 `GitHub CLI`도 설치 후 `gh auth login` 완료

## 🔐 워크스페이스 보호 정책

Codexia는 단순히 프롬프트만 보내지 않고, 워크스페이스 경계를 시스템 프롬프트에 반영합니다.

### 보호 경로

`AGENT_PROTECTED_PATHS`에 등록된 경로는 다음 접근이 금지됩니다.

- 읽기
- 검색
- 수정
- 삭제
- 이동
- 목록 조회
- 메타데이터 확인

### 승인 필요 경로

현재 코드 기준으로 `src/core`는 코어 영역으로 취급됩니다.

- 읽기/분석은 가능
- 수정/삭제/이동은 현재 대화에서 사용자가 명시적으로 허락했을 때만 허용

## ⚙️ 환경 변수 상세

환경변수 설명은 유지하되, 설치 흐름을 먼저 읽을 수 있게 아래로 내렸습니다.

### 공통

| 변수명 | 필수 | 설명 |
| --- | --- | --- |
| `AGENT_WORKSPACE_ROOT` | 권장 | 에이전트가 작업할 루트 디렉터리입니다. 미설정 시 현재 프로젝트 루트를 사용합니다. |
| `AGENT_PROTECTED_PATHS` | 선택 | 에이전트가 접근하면 안 되는 경로 목록입니다. 쉼표 또는 줄바꿈 구분을 지원합니다. 상대 경로는 `AGENT_WORKSPACE_ROOT` 기준으로 해석됩니다. |
| `AGENT_DISABLE_DYNAMIC_CONTEXT` | 선택 | `1`이면 입력 길이에 따라 컨텍스트 길이를 줄이는 동적 조절을 비활성화합니다. |
| `AGENT_DISABLE_PARALLEL_SESSION_WRITE` | 선택 | `1`이면 사용자 메시지 저장과 Codex 실행을 병렬 처리하지 않고 직렬 처리합니다. |
| `AGENT_TELEGRAM_RESPONSE_STYLE_ENABLED` | 선택 | `0`이면 Telegram 전용 응답 형식 프롬프트를 끕니다. |
| `AGENT_TELEGRAM_RESPONSE_STYLE_FILE` | 선택 | Telegram 응답 형식 지침 파일 경로입니다. 기본값은 `config/telegram-response-style.txt`입니다. |
| `AGENT_TELEGRAM_RESPONSE_STYLE_PROMPT` | 선택 | Telegram 응답 형식을 인라인 문자열로 강제 지정합니다. 파일 설정보다 우선합니다. |

### Telegram

| 변수명 | 필수 | 설명 |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Telegram 사용 시 필수 | Telegram Bot API 토큰 |
| `TELEGRAM_WEBHOOK_SECRET` | 권장 | 웹훅 검증용 시크릿 |
| `TELEGRAM_ALLOWED_CHAT_IDS` | 선택 | 허용할 chat id 목록 |
| `TELEGRAM_REGISTRATION_CODE` | 선택 | 최초 등록용 코드 |
| `TELEGRAM_DEFAULT_TRACE_MODE` | 선택 | Telegram 기본 Trace 모드, 기본값은 활성 |
| `TELEGRAM_AUTHORIZED_CHATS_FILE` | 선택 | 승인된 chat 저장 파일 경로 |
| `TELEGRAM_SESSION_OVERRIDES_FILE` | 선택 | chat별 현재 세션 선택 상태 저장 파일 경로 |
| `TELEGRAM_COMPLETION_CURSOR_FILE` | 선택 | chat별 마지막 완료 시점 저장 파일 경로 |
| `TELEGRAM_EVENT_LOG_FILE` | 선택 | Telegram 이벤트 로그 파일 경로 |
| `TELEGRAM_SCREENSHOT_TIMEOUT_MS` | 선택 | 원격 웹 캡처 타임아웃 |
| `TELEGRAM_POLLER_LOCAL_ENDPOINT` | 선택 | 로컬 poller가 요청을 보낼 에이전트 endpoint |
| `TELEGRAM_POLLER_TIMEOUT` | 선택 | `getUpdates` 타임아웃(초) |
| `TELEGRAM_POLLER_POLL_INTERVAL_MS` | 선택 | poll 주기(ms) |
| `TELEGRAM_POLLER_STATE_FILE` | 선택 | poller offset 상태 파일 |
| `TELEGRAM_POLLER_DELETE_WEBHOOK` | 선택 | 시작 시 Telegram webhook 삭제 여부 |
| `TELEGRAM_POLLER_ALLOWED_UPDATES` | 선택 | poller가 허용할 update type 목록 |

### Signals

| 변수명 | 필수 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | SignalForge live 사용 시 필수 | SignalForge PostgreSQL 연결 문자열입니다. phase1부터 live read path의 기본값입니다. |
| `DATABASE_SSL` | 선택 | managed PostgreSQL 등 SSL 연결이 필요하면 `1`, `true`, `require` 중 하나로 설정합니다. |
| `SIGNALS_ENABLE_DEMO_MODE` | 선택 | `1`이면 live snapshot이 없을 때 `data/signals/demo-snapshot.json` 또는 `SIGNALS_SNAPSHOT_FILE` 로 demo fallback을 허용합니다. |
| `SIGNALS_SNAPSHOT_FILE` | 선택 | demo fallback용 snapshot 파일 경로입니다. 상대 경로는 프로젝트 루트 기준으로 해석되며 로컬 검증용으로만 사용합니다. |

## 🗂️ 저장 구조

기본 agent/Telegram 상태는 로컬 JSON 파일에 저장되고, SignalForge live snapshot은 PostgreSQL을 source of truth로 사용합니다.

- `data/sessions/*.json`
- `data/jobs/*.json`
- `data/telegram-authorized-chats.json`
- `data/telegram-session-overrides.json`
- `data/telegram-completion-cursors.json`
- `data/telegram-events.log`
- `data/telegram-files/`
- `data/telegram-screenshots/`
- `data/telegram-poller-state.json`
- `db/migrations/signals/*.sql`
- `signal_delivery_snapshots` (PostgreSQL)
- `signal_source_runs` (PostgreSQL)

세션에는 다음 정보가 저장됩니다.

- `sessionId`
- `createdAt`
- `updatedAt`
- `title`
- `model`
- `reasoningEffort`
- `activeJobId`
- `messages[]`

job에는 다음 정보가 저장됩니다.

- 상태 (`queued`, `running`, `completed`, `failed`)
- assistant 누적 출력
- usage 정보
- context meta
- 이벤트 목록

## 🧪 개발 명령어

```bash
pnpm dev
pnpm dev:web
pnpm build
pnpm start
pnpm lint
pnpm signals:db:up
pnpm signals:db:tools
pnpm signals:db:down
pnpm signals:migrate
pnpm telegram:poll
pnpm telegram:dev
```

### 의미

- `pnpm dev`
  - 웹 개발 서버 + Telegram poller
- `pnpm dev:web`
  - 웹 개발 서버만 실행
- `pnpm telegram:poll`
  - Telegram long polling만 실행
- `pnpm telegram:dev`
  - 웹 개발 서버 + Telegram poller
- `pnpm build`
  - production build
- `pnpm start`
  - Next.js 서버 실행
- `pnpm signals:db:up`
  - SignalForge용 PostgreSQL 컨테이너 실행
- `pnpm signals:db:tools`
  - PostgreSQL + Adminer 실행
- `pnpm signals:db:down`
  - compose 정리
- `pnpm signals:migrate`
  - `db/migrations/signals` 적용

## 🚢 배포 메모

이 프로젝트는 정적 사이트가 아니라 서버에서 CLI와 파일 저장소를 다루는 앱입니다.

필수 조건:

- `child_process.spawn` 가능
- Codex CLI 또는 Gemini CLI 설치
- `data/` 디렉터리 쓰기 가능
- SSE 스트리밍 차단 없음
- 장시간 요청/프로세스 허용

권장:

- 🖥️ VM 또는 자체 서버
- 💾 지속 가능한 로컬 디스크
- 🌐 리버스 프록시에서 SSE 버퍼링 비활성화

## ⚠️ 현재 제약

- JSON 파일 저장소 기반이라 고부하 다중 인스턴스 운영에는 추가 설계가 필요합니다.
- 활성 job 추적과 취소는 현재 프로세스 메모리에 일부 의존합니다.
- 웹에는 별도 인증이 없으므로 외부 공개 배포 시 인프라 레벨 보호가 필요합니다.
- `pnpm dev`는 Telegram poller까지 함께 실행하므로, Telegram 환경이 없으면 개발 흐름이 불편할 수 있습니다.
- SignalForge는 phase1 기준으로 PostgreSQL read spine까지만 들어가 있으며, 실제 수집/계산 파이프라인은 이후 phase에서 추가됩니다.

## 📚 문서

- 📄 PRD: [`docs/PRD.md`](docs/PRD.md)
- 🏗️ Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 🧭 SignalForge Runtime: [`docs/signalforge-runtime.md`](docs/signalforge-runtime.md)
- 🧠 SignalForge Structure: [`docs/signalforge.md`](docs/signalforge.md)
- ✍️ Telegram 응답 형식: [`config/telegram-response-style.txt`](config/telegram-response-style.txt)

## 📄 라이선스

현재 저장소에는 별도 라이선스 문서가 포함되어 있지 않습니다.
