# DungeonNeko Godot Runtime Structure

Last Updated: 2026-03-06

## 목적

이 문서는 기존 `DungeonNeko-Godot` 코드를 버리고, 같은 프로젝트 루트 안에서 Godot native 주 런타임을 어떤 구조로 다시 세울지 고정하는 설계 초안이다.

## 결정 사항

1. Godot 프로젝트 루트는 계속 `DungeonNeko-Godot/`를 사용한다.
2. 런타임 언어는 Godot 4 C#을 기본으로 한다.
3. 원본 SoT는 저장소 루트의 `Classes`, `.server`, `res`다.
4. `DungeonNeko-Godot/assets/*`의 기존 raw copy는 disposable cache다.
5. 기존 `scripts/*`, `scenes/*`의 구조와 책임은 승계하지 않는다.

## 왜 C#인가

- 현재 Godot 프로젝트가 Mono/C# 기반이다.
- `.server` 치환 레이어와 gameplay/domain 모델에 강타입 계약이 필요하다.
- large enum, DTO, importer, 검증 파이프라인을 GDScript보다 안정적으로 유지하기 쉽다.

제약:

- C#을 쓰더라도 Godot native API만 사용한다.
- 외부 서버, 외부 렌더러, 웹 레이어는 사용하지 않는다.

## 재사용 금지 범위

다음 항목은 "참고는 가능하지만 코드/구조 재사용 금지" 대상으로 본다.

- `DungeonNeko-Godot/scripts/*`
- `DungeonNeko-Godot/scenes/*`
- `DungeonNeko-Godot/assets/sprites/rendered/*`
- `DungeonNeko-Godot/assets/dat/*`
- 기존 네트워크/웹 패리티를 전제로 한 보조 코드

허용되는 것은 다음뿐이다.

- 원본 분석 근거로서의 열람
- 리소스 복제 상태 확인
- parity test 아이디어 차용

금지:

- 기존 C# 클래스를 이름만 바꿔 이식하는 방식
- 기존 scene tree를 유지한 채 내부만 수선하는 방식
- `assets/*`에 이미 있는 generated 결과물을 새 런타임 입력으로 삼는 방식

## 타깃 디렉터리 구조

```text
DungeonNeko-Godot/
  project.godot
  assets/
    authored/
      themes/
      ui/
    generated/
      specs/
        sprites/
        maps/
        world/
        quests/
        scripts/
        items/
        monsters/
        npcs/
        objects/
        text/
        audio/
      textures/
      manifests/
      debug/
  scenes/
    app/
    title/
    menu/
    game/
    world/
    ui/
    debug/
    test/
  scripts/
    autoload/
    app/
    core/
    content/
    rendering/
    world/
    gameplay/
    domain/
    application/
    ui/
    debug/
    tests/
  shaders/
    sprite/
    blend/
    effects/
  tests/
    fixtures/
    golden/
```

## 현재 생성된 골격

2026-03-06 기준 실제로 생성된 항목:

- `scripts/autoload/GameApp.cs`
- `scripts/autoload/SceneRouter.cs`
- `scripts/autoload/DataRegistry.cs`
- `scripts/autoload/SaveRepository.cs`
- `scripts/autoload/LocalApiFacadeNode.cs`
- `scripts/autoload/AudioService.cs`
- `scripts/autoload/DebugFlags.cs`
- `scripts/application/contracts/*`
- `scripts/application/facade/*`
- `scripts/application/persistence/GameSaveState.cs`
- `scripts/app/AppRoot.cs`
- `scripts/app/TitleScene.cs`
- `scripts/app/MenuScene.cs`
- `scripts/app/GameScene.cs`
- `scenes/app/AppRoot.tscn`
- `scenes/title/TitleScene.tscn`
- `scenes/menu/MenuScene.tscn`
- `scenes/game/GameScene.tscn`

현재 엔트리 상태:

- `project.godot`의 `run/main_scene`는 `res://scenes/app/AppRoot.tscn`
- autoload는 새 native 스택으로 교체했다
- 이 골격은 bootstrap/UI placeholder 수준이며, world/render/domain 실구현은 아직 없다

## 디렉터리별 책임

## `assets/authored`

- 사람이 직접 만드는 Godot 전용 자산만 둔다.
- 예:
  - `Theme`
  - UI frame/9-slice
  - editor helper resource

금지:

- `res/*` 원본을 수동 복사해 누적하는 방식

## `assets/generated`

- 빌드 파이프라인 산출물만 둔다.
- 런타임은 여기만 로드한다.

하위 책임:

- `specs/sprites`: `SpriteSpecResource`, `SpriteActionSpecResource`
- `specs/maps`: `MapSpecResource`
- `specs/world`: 월드맵/게이트/오브젝트 배치
- `specs/quests`: `QuestSpecResource`
- `specs/scripts`: `ScriptSpecResource`
- `specs/items|monsters|npcs|objects`: 도메인 spec
- `specs/text`: locale catalog
- `specs/audio`: cue registry
- `textures`: build-time verified texture registry
- `manifests`: coverage, diff, importer trace

## `scenes`

- SceneTree 구성만 책임진다.
- 도메인 로직은 넣지 않는다.

추천 씬:

- `app/AppRoot.tscn`
- `title/TitleScene.tscn`
- `menu/MenuScene.tscn`
- `game/GameScene.tscn`
- `world/WorldRoot.tscn`
- `ui/HudRoot.tscn`
- `debug/ParityViewer.tscn`

## `scripts/autoload`

오토로드 고정 후보:

| 클래스 | 책임 |
|---|---|
| `GameApp` | 앱 부트스트랩, 런타임 모드, 세션 진입 |
| `SceneRouter` | 씬 전환 |
| `DataRegistry` | generated resource 로딩과 캐시 |
| `SaveRepository` | 로컬 세이브 저장소 |
| `LocalApiFacade` | `.server` 치환 command/query 진입점 |
| `AudioService` | BGM/SFX 재생 |
| `DebugFlags` | parity/debug 플래그 |

## `scripts/app`

- 앱 시작 흐름
- title -> menu -> game 진입 orchestration
- profile/new game/continue flow

## `scripts/core`

- 엔진 의존이 약한 공통 모듈
- 예:
  - `Result<T>`
  - `Option<T>`
  - `LegacyParityRng`
  - `EntityId`
  - `FixedPointMath`
  - `FrameClock`

## `scripts/content`

- generated spec loader
- importer output adapter
- resource lookup service

예:

- `SpriteSpecRegistry`
- `MapSpecRegistry`
- `QuestSpecRegistry`
- `TextCatalog`
- `AudioCueRegistry`

## `scripts/rendering`

렌더링 전용 계층이다.

필수 클래스:

- `DungeonSprite2D`
- `DungeonRenderCommandBuffer`
- `DungeonBlendMaterialLibrary`
- `DungeonStyleSpritePlayer2D`
- `DungeonMapRenderer2D`
- `DungeonClipTransform`

규칙:

- `DGS_*`, `Spread`, `RType`, `SSPR_*`, `SD_GetFrameMovePixel`은 여기서 해결한다.
- 전투 수식과 인벤토리 로직은 여기 들어오면 안 된다.

## `scripts/world`

- 월드/맵/카메라/충돌/엔티티 루트

예:

- `WorldRuntime`
- `HeroRuntime`
- `NpcRuntime`
- `MonsterRuntime`
- `MapObjectRuntime`
- `GateRuntime`
- `DungeonCameraController`

## `scripts/gameplay`

- frame update와 상호작용 orchestration

예:

- `GameLoopOrchestrator`
- `CombatRuntime`
- `MovementRuntime`
- `QuestRuntime`
- `ScriptRuntime`
- `MysteryDungeonRuntime`

## `scripts/domain`

- 엔진 독립 규칙 계층

서브폴더:

- `player`
- `inventory`
- `equipment`
- `shop`
- `blacksmith`
- `dungeon`
- `quest`
- `script`

규칙:

- 이 계층은 `Node`, `SceneTree`, `Sprite2D`를 참조하지 않는다.
- 계산식과 상태 전이는 여기서 정의한다.

## `scripts/application`

- UI/월드에서 호출하는 use case 계층

서브폴더:

- `commands`
- `queries`
- `handlers`
- `dto`
- `legacy`

예:

- `AddStatHandler`
- `EnterDungeonHandler`
- `InventoryQueryHandler`
- `LegacyParityEnvelopeAssembler`

## `scripts/ui`

- HUD, 팝업, 인벤토리, 상점, 퀘스트, 대화 UI
- AGENTS 규칙의 UI 실치수 스케일 정책을 준수한다.

서브폴더:

- `hud`
- `inventory`
- `shop`
- `dialogue`
- `widgets`

## `scripts/tests`, `tests`

- headless/unit/integration/parity 테스트
- golden frame, replay, resource coverage 결과 보관

## 빌드 파이프라인 위치

원본 읽기와 generated asset 생성은 Godot 런타임 밖에서 끝낸다.

타깃 경로:

```text
tools/
  pipeline/
    godot-porting/
      import-dat
      import-img
      import-objects
      import-text
      import-audio
      verify-coverage
```

규칙:

- 입력: 저장소 루트 `res/*`, `Classes/*`, `.server/*`
- 출력: `DungeonNeko-Godot/assets/generated/*`
- 런타임은 `res/*`를 직접 읽지 않는다

## 씬/서비스 연결 원칙

```text
TitleScene
  -> SceneRouter
MenuScene
  -> NewGameFlowService / ContinueGameFlowService
GameScene
  -> WorldRuntime + HudRoot
Hud/UI
  -> LocalApiFacade
LocalApiFacade
  -> Application Handlers
Application Handlers
  -> Domain Services + SaveRepository
```

## 런타임 경계 규칙

1. Scene는 JSON을 직접 파싱하지 않는다.
2. UI는 `.server` action 이름을 직접 알지 않는다.
3. 렌더링 계층은 gameplay 수식을 계산하지 않는다.
4. domain 계층은 Godot Node를 직접 참조하지 않는다.
5. generated resource가 없으면 fallback 렌더링이 아니라 fail-fast로 막는다.

## 1차 구현 순서

1. `scripts/autoload`, `scripts/core`, `scripts/application/dto` 골격 생성
2. `assets/generated/specs` importer 출력 형식 고정
3. `scripts/rendering`에 `DungeonSprite2D`와 blend/effect kernel 구현
4. `scenes/title`, `scenes/menu`, `scenes/game` 최소 shell 작성
5. `scripts/domain`과 `scripts/application`에 `.server` 치환 서비스 작성

## 남은 결정 항목

1. `DungeonNeko-Godot/` 내부의 기존 파일을 어느 시점에 물리적으로 정리할지
2. generated resource 파일 포맷을 `.tres` 중심으로 갈지, binary `.res`까지 섞을지
3. golden parity viewer를 Godot 내부 scene로 둘지 외부 test runner로 뺄지
