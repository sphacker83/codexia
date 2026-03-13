# DungeonNeko Source Coverage Symbol Ledger

Last Updated: 2026-03-06

## 목적

이 문서는 `source-coverage-matrix.md`의 파일 단위 분류를 실제 greenfield 소유 경계로 고정하기 위한 전수 ledger다.

- 범위: `Classes/*` 비서드파티 게임 소스 38개 파일
- 제외: `jsoncpp` 계열 15개 파일
- 표기 방식: 개별 오버로드/헬퍼를 모두 길게 나열하지 않고, **파일별 함수군/전역 상태군** 단위로 정규화한다
- 완료 기준: 38개 비서드파티 파일이 누락 없이 모두 등장하고, 각 파일의 새 소유 모듈이 잠겨 있다

## App / Scene Bootstrap

| 파일 | 분류 | 핵심 함수/심볼군 | 핵심 전역 상태군 | 새 소유 모듈 | 비고 |
|---|---|---|---|---|---|
| `AppDelegate.h` | Bootstrap | `AppDelegate` 생명주기 선언 | 없음 | `GameApp` | Cocos 앱 엔트리 선언만 소유 |
| `AppDelegate.cpp` | Bootstrap | `applicationDidFinishLaunching`, background/foreground lifecycle | 부트스트랩 초기화 플래그 | `GameApp`, Godot project bootstrap | SceneTree 초기화로 치환 |
| `MenuScene.h` | Rewrite | `MenuScene` 클래스 선언, 메뉴 callback signature | 메뉴 위젯 참조 | `MenuScene` | Control 씬으로 치환 |
| `MenuScene.cpp` | Rewrite | `scene/create/init`, 메뉴 버튼 callback, 공지/시작/이어하기 분기 | 메뉴 선택 상태, 임시 UI 표시 상태 | `MenuScene`, `ProfileBootFlow` | 타이틀/메뉴 flow 진입점 |
| `NewGameScene.h` | Rewrite | `NewGameScene` 선언, 생성 callback signature | 새 게임 폼 위젯 참조 | `NewGameScene` | 신규 생성 UI 경계 |
| `NewGameScene.cpp` | Rewrite | `scene/create/init`, 신규 생성 확인/취소 callback | 임시 생성 폼 상태 | `NewGameFlowService` | 로컬 프로필 생성 경로 |
| `ContinueGameScene.h` | Rewrite | `ContinueGameScene` 선언, 이어하기 callback signature | 이어하기 위젯 참조 | `ContinueGameScene` | 저장 슬롯/로그인 UI 경계 |
| `ContinueGameScene.cpp` | Rewrite | `scene/create/init`, 이어하기/로그인 callback | 선택 슬롯, 임시 인증 상태 | `ContinueGameFlowService` | 로컬 세이브 선택 flow |
| `NoticeScene.h` | Rewrite | `NoticeScene` 선언, 닫기 callback signature | 공지 UI 위젯 참조 | `NoticeOverlay` | 팝업 선언부 |
| `NoticeScene.cpp` | Rewrite | `scene/create/init`, 공지 표시/닫기 callback | 공지 표시 상태 | `NoticeOverlay` | 단순 오버레이로 축소 |

## Rendering / Resource Core

| 파일 | 분류 | 핵심 함수/심볼군 | 핵심 전역 상태군 | 새 소유 모듈 | 비고 |
|---|---|---|---|---|---|
| `GroupHeader.h` | Replace | 거대 공용 include / typedef / 매크로 우산 | 없음 | 명시적 모듈 import | 런타임 소유 모듈 없음 |
| `CHFunction.h` | Rewrite | 랜덤, draw style, image/text/sound, resource codec API 선언 | 렌더 상태 extern 선언, 사운드/이미지 핸들 선언 | `LegacyParityCore`, `DungeonRenderKernel`, `AudioService` | API 표면 잠금 역할 |
| `CHFunction.cpp` | Rewrite | `CH_Random*`, draw/image/text helper, 압축 해제, 사운드 제어 | `grpStyle`, alpha/depth/color/spread, 리소스 캐시 | `LegacyParityCore`, `DungeonRenderKernel`, `ResourcePipeline` | 렌더 parity 핵심 |
| `CHSPRITE.h` | Rewrite | sprite/frame/clip/action/style 구조체 선언, 접근 함수 선언 | 없음 | `SpriteSpecResource`, `DungeonSprite2D`, `DungeonStyleSpritePlayer2D` | DAT schema 경계 |
| `CHSPRITE.cpp` | Rewrite | sprite DAT 로드/언로드, frame/action/style draw helper | transient decode buffer | build-time sprite importer + runtime sprite renderer | native sprite 재생 기준 |
| `DRAW_MAIN.h` | Rewrite | world/UI/popup draw entry 선언 | 없음 | `GameRenderOrchestrator`, UI render services | draw entry API |
| `DRAW_MAIN.cpp` | Rewrite | `draw_GamePlay`, `draw_Map`, `draw_Popup*`, world/object/UI/effect draw 함수군 | `DmgDraw`, portrait/target frame, weather draw refs, map name frame | `GameRenderOrchestrator`, `DungeonMapRenderer2D`, Control UI | 렌더 orchestration |
| `INIT_MAIN.h` | Rewrite | 전역 구조체/enum/define 선언, `set_*` 선언 | `Hero`, `Npc`, `Mon`, `Map`, inventory, popup, shop, dungeon, network, worldmap 전역 | `GameSessionState`, `UiStateStore`, `ModeStateStore`, generated spec models | 전역 저장소 헤더 |
| `INIT_MAIN.cpp` | Rewrite | `set_InitMain`, 리소스 로드, 맵/던전 세팅, `set_Hero*`, `set_Map*`, `set_*State` 초기화군 | 구체 전역 초기값, 로드 순서, bootstrap wiring | `BootstrapPipeline`, `DataRegistry`, `WorldBootstrap`, mode/runtime factory | 초기화 파이프라인 기준 |

## Game State / Logic

| 파일 | 분류 | 핵심 함수/심볼군 | 핵심 전역 상태군 | 새 소유 모듈 | 비고 |
|---|---|---|---|---|---|
| `GAME_MAIN.h` | Rewrite | 메인/서브 상태 define, flow 상수 | 없음 | `FlowState`, `UiState` enum/resource | 매크로 state 묶음 |
| `GAME_FUNCTION.h` | Rewrite | 전투/이동/충돌/아이템/퀘스트/스탯 계산 선언 | 없음 | `CombatService`, `MovementService`, `InventoryRuleService`, `HeroStatService` | 규칙 API 선언 |
| `GAME_FUNCTION.cpp` | Rewrite | hero/monster 전투식, 충돌 판정, 이동 계산, item use, stat calc, quest reward 함수군 | Hero tmp stat/condition mutation, drop/item temp refs | `CombatService`, `MovementService`, `HeroStatService`, `InventoryRuleService`, `QuestRewardService` | gameplay 규칙 핵심 |
| `UPDATE_MAIN.h` | Rewrite | update loop 선언 | 없음 | `GameLoopOrchestrator` | 루프 API |
| `UPDATE_MAIN.cpp` | Rewrite | `Game_MainUpdate`, hero/npc/monster/world/dungeon update, AI/state/frame tick 함수군 | wait/chase/skill/weather/frame timer 계열 | `GameLoopOrchestrator`, `HeroRuntime`, `NpcRuntime`, `MonsterRuntime`, `DungeonRuntime` | frame loop 핵심 |
| `KEYEVENT_MAIN.h` | Rewrite | key/touch handler 선언 | 없음 | `InputRouter` | 입력 API |
| `KEYEVENT_MAIN.cpp` | Rewrite | `Game_MainKey_P/R`, `Game_MainTouch_P/R/M`, popup/menu/input routing | cursor/current selection, 터치 temp state, 입력 플래그 | `InputRouter`, `PopupInputController`, 상태별 입력 핸들러 | 입력 상태머신 |
| `QUEST.h` | Rewrite | quest 구조체/조건/보상 선언 | quest 배열/인덱스 선언 | `QuestSpecResource`, `QuestRuntime` | quest schema |
| `QUEST.cpp` | Rewrite | quest 수락/갱신/완료/보상 처리 함수군 | quest progress mutation | `QuestRuntime`, `QuestRewardService` | quest runtime 규칙 |
| `CHSCRIPT.h` | Rewrite | opcode define, `SCRIPTDAT` / list 구조 선언 | 없음 | `ScriptSpecResource`, `ScriptOpcode` enum | script schema |
| `CHSCRIPT.cpp` | Rewrite | script load/unload helper | script buffer/index | build-time script importer + runtime loader | script asset bridge |
| `CHGAME_SCRIPT.h` | Rewrite | script main/sub state 선언 | script runtime state 선언 | `ScriptRuntime` | script runtime header |
| `CHGAME_SCRIPT.cpp` | Rewrite | `gameScript_Set/unSet/update/draw`, dialogue/event/input helper | script main/substate, typing/scroll/select timer 상태 | `ScriptRuntime`, `DialogueRuntime`, `EventFlowRuntime` | script 실행기 |

## Network / Server Boundary

| 파일 | 분류 | 핵심 함수/심볼군 | 핵심 전역 상태군 | 새 소유 모듈 | 비고 |
|---|---|---|---|---|---|
| `CHNETPROC.h` | Replace | 프로토콜 상수, 네트워크/응답 코드 선언 | 네트워크 상태 extern 선언 | local result/error registry | transport 자체는 제거 |
| `CHNETPROC.cpp` | Replace | 저수준 네트워크 처리, 패킷/HTTP helper | request queue / transport temp state | local command bus로 치환 | 구현 유지 불필요 |
| `GAME_NET.h` | Rewrite | `PLAYERDATA`, `THINGDATA`, reward/make DTO, request 선언 | player/item/reward envelope 선언 | `LocalApiContracts`, DTO models | 로컬 facade 계약 기준 |
| `GAME_NET.cpp` | Rewrite | `request_*` 파서, 서버 응답 apply, player stat assembly | `player`, `thingDat`, `makeDat`, `rewardDat`, `equipDat` | `LocalApiFacade`, `LegacyParityEnvelopeAssembler` | 서버 응답의 SoT |
| `HelloWorldScene.h` | Rewrite | 메인 씬 클래스, callback/net/audio/input 선언 | scene-local handle/timer/audio ref 선언 | `GameScene`, `AudioService` | 메인 씬 브리지 |
| `HelloWorldScene.cpp` | Rewrite | `request_GameInit`, `net_*`, `callback_*`, `GameLogic`, `RenderScene` | 현재 액션 플래그, HTTP callback glue, scene transition temp state | `GameScene`, `SceneRouter`, `LocalApiFacade`, `AudioService` | 로컬 오케스트레이션 치환 대상 |

## 전수 판정

- 비서드파티 `Classes` 38개 파일이 모두 ledger에 포함됐다.
- 각 파일별로 함수군/전역 상태군/새 소유 모듈이 잠겼다.
- 상세 함수 설명은 `source-coverage-functions.md`, 거대 전역 분해는 `init-main-state-partition.md`가 책임진다.

## ThirdPartyExclude

다음 15개 파일은 `jsoncpp` 서드파티로 분류하고 전수 포팅 범위에서 제외한다.

| 파일 | 제외 근거 |
|---|---|
| `json.h` | `jsoncpp` umbrella header |
| `json_autolink.h` | `jsoncpp` 빌드 보조 헤더 |
| `json_batchallocator.h` | `jsoncpp` 내부 allocator |
| `json_config.h` | `jsoncpp` 설정 헤더 |
| `json_features.h` | `jsoncpp` feature flag |
| `json_forwards.h` | `jsoncpp` 전방 선언 |
| `json_internalarray.inl` | `jsoncpp` 내부 inline 구현 |
| `json_internalmap.inl` | `jsoncpp` 내부 inline 구현 |
| `json_reader.h` | `jsoncpp` reader API |
| `json_reader.cpp` | `jsoncpp` reader 구현 |
| `json_value.h` | `jsoncpp` value API |
| `json_value.cpp` | `jsoncpp` value 구현 |
| `json_valueiterator.inl` | `jsoncpp` iterator inline 구현 |
| `json_writer.h` | `jsoncpp` writer API |
| `json_writer.cpp` | `jsoncpp` writer 구현 |
