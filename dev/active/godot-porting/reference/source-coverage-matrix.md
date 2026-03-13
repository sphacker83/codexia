# DungeonNeko Godot Rewrite Source Coverage Matrix

Last Updated: 2026-03-06

## 범위

이 문서는 `Classes/*` 전수를 greenfield Godot rewrite 관점에서 분류한 1차 매트릭스다.

- 전체 파일: 53
- 게임 소스: 38
- `jsoncpp` 서드파티: 15

분류 규칙:

- `Rewrite`: 원본 동작을 새 Godot 런타임으로 다시 구현해야 하는 파일
- `Replace`: 기능은 유지하되 Godot/로컬 서비스로 대체할 파일
- `Bootstrap`: 런타임 구조는 바뀌지만 초기 진입 책임은 참고할 파일
- `ThirdPartyExclude`: 게임 로직 전수 포팅 범위에서 제외

## 클러스터 요약

| 클러스터 | 파일 수 | 전략 |
|---|---:|---|
| 앱/씬 부트스트랩 | 10 | Godot SceneTree와 오토로드로 대체 |
| 렌더링/리소스 코어 | 8 | 규약 단위로 재구현 |
| 게임 상태/로직 | 12 | 상태머신/전투/던전/퀘스트를 새 도메인으로 포팅 |
| 네트워크/서버 경계 | 6 | 로컬 애플리케이션 서비스로 치환 |
| 서드파티 `jsoncpp` | 15 | 제외 |

## 앱/씬 부트스트랩

| 파일 | LOC | 분류 | 레거시 역할 | 새 rewrite 타깃 |
|---|---:|---|---|---|
| `AppDelegate.h` | 40 | Bootstrap | Cocos 앱 생명주기 선언 | `GameApp` 오토로드, Godot project 설정 |
| `AppDelegate.cpp` | 73 | Bootstrap | GL/Director 초기화, 앱 foreground/background | Godot 앱 lifecycle 훅 |
| `MenuScene.h` | 35 | Rewrite | 메뉴 씬 인터페이스 | `MenuScene` Godot Control 씬 |
| `MenuScene.cpp` | 307 | Rewrite | 시작 메뉴, 로그인/생성 진입 | `MenuScene` + local profile bootstrap |
| `NewGameScene.h` | 26 | Rewrite | 새 게임 생성 UI 선언 | `NewGameScene` |
| `NewGameScene.cpp` | 93 | Rewrite | 새 게임 시작 요청 | `NewGameFlowService` |
| `ContinueGameScene.h` | 29 | Rewrite | 이어하기 UI 선언 | `ContinueGameScene` |
| `ContinueGameScene.cpp` | 115 | Rewrite | 이어하기/로그인 요청 | `ContinueGameFlowService` |
| `NoticeScene.h` | 24 | Rewrite | 공지 팝업 선언 | `NoticeOverlay` |
| `NoticeScene.cpp` | 105 | Rewrite | 공지 표시/종료 | `NoticeOverlay` |

## 렌더링/리소스 코어

| 파일 | LOC | 분류 | 레거시 역할 | 새 rewrite 타깃 |
|---|---:|---|---|---|
| `GroupHeader.h` | 23 | Replace | 거대 공용 include 집합 | 명시적 모듈 import, 공용 타입 패키지 |
| `CHFunction.h` | 462 | Rewrite | 메모리/랜덤/그래픽/이미지/텍스트/사운드 API 선언 | `LegacyParityCore`, `RenderMath`, `ResourceCodec`, `TextRenderer`, `AudioService` |
| `CHFunction.cpp` | 7151 | Rewrite | 랜덤, 리소스 해제/압축해제, draw style, BMP 텍스트, 사운드 | `LegacyParityCore`, `DungeonRenderKernel`, `ResourcePipeline` |
| `CHSPRITE.h` | 154 | Rewrite | `SPRITEDAT`, frame/clip/action/style 구조 | `SpriteSpecResource`, `DungeonSprite2D`, `DungeonStyleSpritePlayer2D` |
| `CHSPRITE.cpp` | 301 | Rewrite | 스프라이트 DAT 해석, 프레임/스타일 재생 | build-time sprite importer + runtime renderer |
| `DRAW_MAIN.h` | 38 | Rewrite | 메인 draw entry 및 UI/팝업 draw 함수 선언 | `GameRenderOrchestrator`, UI scene/render services |
| `DRAW_MAIN.cpp` | 6595 | Rewrite | 월드/오브젝트/UI/팝업 draw 전체 | Godot scene composition + `DungeonMapRenderer2D` + Control UI |
| `INIT_MAIN.h` | 2566 | Rewrite | 거의 모든 전역 상태/구조체 선언 | 도메인 상태 모델 분해, generated spec resource |
| `INIT_MAIN.cpp` | 7254 | Rewrite | 초기화, 리소스 로드, 맵/던전 세팅, 데이터 구성 | `BootstrapPipeline`, `DataRegistry`, `MysteryDungeonService`, `SceneInitService` |

## 게임 상태/로직

| 파일 | LOC | 분류 | 레거시 역할 | 새 rewrite 타깃 |
|---|---:|---|---|---|
| `GAME_MAIN.h` | 673 | Rewrite | 메인/서브 상태 define 집합 | `GameState`, `UiState`, `FlowState` enum/resource |
| `GAME_FUNCTION.h` | 374 | Rewrite | 충돌/이동/전투/아이템/퀘스트 유틸 선언 | `CombatService`, `MovementService`, `CollisionService`, `InventoryRuleService` |
| `GAME_FUNCTION.cpp` | 4211 | Rewrite | 전투 공식, 충돌 판정, 아이템 사용, 각종 계산 | `CombatService`, `MovementService`, `QuestRuleService` |
| `UPDATE_MAIN.h` | 179 | Rewrite | 상태별 update 루프 선언 | `GameLoopOrchestrator`, 각 runtime subsystem |
| `UPDATE_MAIN.cpp` | 8015 | Rewrite | 전체 게임 update 루프 | `GameLoopOrchestrator`, `HeroRuntime`, `NpcRuntime`, `MonsterRuntime`, `DungeonRuntime` |
| `KEYEVENT_MAIN.h` | 46 | Rewrite | 키/터치 이벤트 선언 | `InputRouter`, `TouchUiController`, `GameplayInputController` |
| `KEYEVENT_MAIN.cpp` | 7528 | Rewrite | 상태별 입력 루프, UI 입력, 던전 조작 | `InputRouter`, UI control scenes, interaction services |
| `QUEST.h` | 266 | Rewrite | 퀘스트 구조 및 API 선언 | `QuestSpecResource`, `QuestRuntime`, `QuestEventBus` |
| `QUEST.cpp` | 994 | Rewrite | 퀘스트 상태 갱신/보상/제한 처리 | `QuestRuntime`, `QuestRewardService` |
| `CHSCRIPT.h` | 147 | Rewrite | 스크립트 포맷, opcode define, `SCRIPTDAT` | `ScriptSpecResource`, `ScriptOpcode` enum |
| `CHSCRIPT.cpp` | 409 | Rewrite | 스크립트 로드/언로드 | build-time script importer + runtime loader |
| `CHGAME_SCRIPT.h` | 73 | Rewrite | 스크립트 메인 상태/전이 선언 | `ScriptRuntime`, `DialogueFlowService` |
| `CHGAME_SCRIPT.cpp` | 2370 | Rewrite | 스크립트 실행, 대화/이벤트/캐릭터 제어 | `ScriptRuntime`, `DialogueRuntime`, `EventCommandRuntime` |

## 네트워크/서버 경계

| 파일 | LOC | 분류 | 레거시 역할 | 새 rewrite 타깃 |
|---|---:|---|---|---|
| `CHNETPROC.h` | 551 | Replace | 통신/응답 코드/텔레콤 네트워크 상수 | local error/result code registry |
| `CHNETPROC.cpp` | 2573 | Replace | 저수준 네트워크 프로토콜/플랫폼 처리 | 제거, local command bus로 치환 |
| `GAME_NET.h` | 185 | Rewrite | 서버 JSON 계약, 플레이어/보상 구조, request 함수 선언 | `LocalApiContracts`, `ApplicationServices`, DTO model |
| `GAME_NET.cpp` | 1574 | Rewrite | 서버 응답 파싱 및 적용 | `LocalApiFacade`, result mappers |
| `HelloWorldScene.h` | 138 | Rewrite | 메인 게임 씬, 오디오, 입력, HTTP 콜백 선언 | `GameScene`, `AudioService`, `LocalApiFacade` |
| `HelloWorldScene.cpp` | 1392 | Rewrite | 메인 씬 진입, HTTP 콜백 체인, 게임 루프 진입 | `GameScene`, `SceneRouter`, local service orchestration |

## 서드파티 제외

다음 15개 파일은 `jsoncpp`로 보고 전수 포팅 범위에서 제외한다.

| 파일 | 분류 | 비고 |
|---|---|---|
| `json.h` | ThirdPartyExclude | `jsoncpp` umbrella header |
| `json_autolink.h` | ThirdPartyExclude | `jsoncpp` |
| `json_batchallocator.h` | ThirdPartyExclude | `jsoncpp` |
| `json_config.h` | ThirdPartyExclude | `jsoncpp` |
| `json_features.h` | ThirdPartyExclude | `jsoncpp` |
| `json_forwards.h` | ThirdPartyExclude | `jsoncpp` |
| `json_internalarray.inl` | ThirdPartyExclude | `jsoncpp` |
| `json_internalmap.inl` | ThirdPartyExclude | `jsoncpp` |
| `json_reader.h` | ThirdPartyExclude | `jsoncpp` |
| `json_reader.cpp` | ThirdPartyExclude | `jsoncpp` |
| `json_value.h` | ThirdPartyExclude | `jsoncpp` |
| `json_value.cpp` | ThirdPartyExclude | `jsoncpp` |
| `json_valueiterator.inl` | ThirdPartyExclude | `jsoncpp` |
| `json_writer.h` | ThirdPartyExclude | `jsoncpp` |
| `json_writer.cpp` | ThirdPartyExclude | `jsoncpp` |

## 우선 포팅 순서

### P0
- `CHSPRITE.*`
- `CHFunction.*`
- `INIT_MAIN.*`
- `GAME_MAIN.h`
- `GAME_FUNCTION.*`
- `UPDATE_MAIN.*`
- `KEYEVENT_MAIN.*`
- `CHSCRIPT.*`
- `CHGAME_SCRIPT.*`
- `GAME_NET.*`
- `.server/*` 대응 로컬 서비스

### P1
- `HelloWorldScene.*`
- `QUEST.*`
- `DRAW_MAIN.*`

### P2
- `MenuScene.*`
- `NewGameScene.*`
- `ContinueGameScene.*`
- `NoticeScene.*`
- `AppDelegate.*`
- `CHNETPROC.*`

## 현재 결론

- 렌더링/게임플레이/서버 경계의 핵심은 모두 `Rewrite` 또는 `Replace` 대상이다.
- 기존 Godot 구현을 이어받아 리팩터링하는 접근은 이 매트릭스 기준과 맞지 않는다.
- 다음 단계는 파일 단위 매트릭스를 함수/전역 상태 단위 매트릭스로 세분화하는 것이다.
