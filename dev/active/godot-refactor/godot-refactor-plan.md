# DungeonNeko Godot Structural Refactor Plan

Last Updated: 2026-03-10

## Executive Summary

- 이 문서는 `godot-porting` 메인 parity 트랙과 분리된 구조 수술 사이드 트랙이다.
- 목표는 현재 Godot 포팅 코드의 장문 파일, 중복 구현, 죽은 코드, per-frame 비효율, 강결합을 줄여 이후 parity 작업과 유지보수를 쉽게 만드는 것이다.
- 이번 리팩터링은 `대수술 우선` 기준으로 설계하되, save schema, quickslot 의미론, `UiMetricScale = 2.0`, Phase 6/7 parity 목표는 바꾸지 않는다.

## Current State Analysis

### 핵심 구조 문제

- `GameScene`은 scene lifecycle, HUD binding, NPC dialogue, quickslot, dungeon flow, debug surface, local save/API 호출을 함께 들고 있는 god object다.
- `HudController`는 layout builder, panel state machine, input navigator, presenter 역할이 한 클래스에 몰려 있다.
- `GreenfieldWorldRuntime`는 runtime state, spawn, transition, pathing, fallback, renderer coupling을 함께 들고 있다.
- `ApplicationLocalApiFacade*`는 partial 분리는 시작됐지만 여전히 거대한 mutation script 집합에 가깝다.

### 중복 / 레거시 / 비효율

- `HudController`와 `CharacterInventoryOverlay`에 UI scale 상수, item action UI, detail rendering이 중복돼 있다.
- `TitleScene`, `MenuScene`, `GameScene`에 scene 이동 로직과 placeholder UX가 중복돼 있다.
- `AudioManager`, `DebugFlags`, `InputManager`, `HeroController`, `MapManager`는 현재 live runtime 기준으로 정리 대상이다.
- `GameScene._Process()`가 매 프레임 HUD 전체 동기화를 수행해 string/array snapshot을 반복 생성한다.

### 현재 기준선

- live runtime 기준축은 `GameScene -> GreenfieldWorldRuntime -> DungeonMapRenderer2D`다.
- 기존 `godot-porting` 문서는 parity blocker와 verification gate를 추적하는 메인 트랙으로 유지한다.
- 현재 빌드는 통과하고 warning은 0건이다.

## Proposed Future State

- `GameScene`은 scene composition, frame tick, input relay만 담당한다.
- gameplay 흐름은 `GamePlayCoordinator` 계열로 분리하고, HUD/overlay 동기화는 `GameUiBinder`와 `GameUiSnapshot`으로 이동한다.
- UI는 `HudShell + HudPanelNavigator + HudPanelState + HudLayoutFactory + HudPresenter` 구조로 나눈다.
- runtime은 `IWorldRenderer`, `IContentCatalogPort`, `IGamePersistencePort`, `IAudioPort` 뒤로 Godot/autoload 의존을 밀어낸다.
- production path에서 debug/smoke/tooling을 제거하고, test probe와 smoke bootstrap으로 격리한다.

## Target Folder and File Structure

### Architecture Freeze Rules

- 상위 폴더 축은 `app / application / autoload / engine / content / gameplay / ui / tools`를 유지한다.
- scene에 직접 붙는 진입 스크립트와 autoload anchor 파일은 경로를 고정한다.
  - `scripts/app/AppRoot.cs`
  - `scripts/app/LoadingScene.cs`
  - `scripts/app/TitleScene.cs`
  - `scripts/app/MenuScene.cs`
  - `scripts/app/GameScene.cs`
  - `scripts/autoload/GameApp.cs`
  - `scripts/autoload/SceneRouter.cs`
  - `scripts/ui/HudController.cs`
  - `scripts/ui/CharacterInventoryOverlay.cs`
  - `scripts/ui/MiniMapOverlay.cs`
- 대수술은 anchor 파일을 바로 이동하지 않고, 새 책임을 하위 폴더의 partial/helper/coordinator로 추출하는 방식으로 진행한다.
- `GameApp.OpenTitleScene()`, `GameApp.OpenMenuScene()`, `GameApp.OpenGameScene()`를 scene navigation의 canonical entry로 고정한다.
- `SceneRouter`는 low-level scene swap adapter로만 사용하고, scene script가 직접 `SceneRouter`를 호출하지 않도록 수렴한다.
- `application/ports`에는 engine-independent interface만 둔다.
- `engine/godot/*`를 엔진 어댑터 계층의 정본으로 둔다.
- `engine/godot/*`에는 Godot `Node`, `Control`, `SceneTree`, `Resource`, `Texture2D`, autoload bridge를 사용하는 adapter만 둔다.
- `autoload/*`는 composition root와 engine bootstrap anchor만 두고, 실제 adapter 구현 저장소로 키우지 않는다.
- `content/*`는 generated asset/resource와 registry source만 두고, application/gameplay가 직접 참조하는 port adapter는 `engine/godot/content/*`에 둔다.
- `ui`는 Godot `Control`/`CanvasLayer`와 그 presenter/layout/navigation helper만 둔다.
- 새 partial 파일 이름은 `Type.Responsibility.cs` 규칙을 사용한다.

### Target Tree

```text
scripts/
  app/
    AppRoot.cs
    LoadingScene.cs
    TitleScene.cs
    MenuScene.cs
    GameScene.cs                         # scene shell, node wiring only
    game_scene/
      GameScene.Bootstrap.cs
      GameScene.Frame.cs
      GameScene.Input.cs
      GameScene.Navigation.cs
      GameScene.HudBinding.cs
      GameScene.NpcDialogue.cs
      GameScene.DungeonFlow.cs
      GameScene.Rewards.cs
      GameScene.Quests.cs
      GamePlayCoordinator.cs
      GameSceneBootstrapCoordinator.cs
      GameUiBinder.cs
      GameUiSnapshot.cs

  application/
    contracts/
    facade/
    persistence/
    ports/
      IAudioPort.cs
      IContentCatalogPort.cs
      IGamePersistencePort.cs
      IWorldRenderer.cs
    services/
      RuntimeContentBootstrapService.cs
      HudQueryService.cs
      QuickSlotPersistenceService.cs

  autoload/
    AudioService.cs
    DataRegistry.cs
    GameApp.cs
    LocalApiFacadeNode.cs
    SaveRepository.cs
    SceneRouter.cs

  engine/
    godot/
      audio/
        GodotAudioPort.cs
      bootstrap/
        GodotRuntimeBootstrap.cs
      content/
        GodotContentCatalogPort.cs
      navigation/
        GodotSceneNavigator.cs
      persistence/
        GodotGamePersistencePort.cs
      rendering/
        GodotWorldRenderer.cs
      test/
        GameSceneTestProbe.cs
        SmokeBootstrap.cs

  content/
    MapSpecRegistry.cs
    MapTileSetRegistry.cs
    SpriteRuntimeBindingRegistry.cs
    SpriteSpecRegistry.cs
    catalogs/
    maps/
    specs/
    sprites/

  gameplay/
    combat/
    condition/
    dungeon/
    economy/
    inventory/
    npc/
    quest/
    runtime/
    world/
      DungeonMapRenderer2D.cs            # canonical concrete renderer
      GreenfieldWorldRuntime.cs          # runtime shell/facade
      HeroRuntimeBindingFactory.cs
      runtime/
        WorldSpawnCoordinator.cs
        WorldTransitionCoordinator.cs
        WorldEffectCoordinator.cs
        WorldPathingService.cs
        WorldMonsterSpawnFactory.cs

  ui/
    HudController.cs                     # HUD shell/facade
    CharacterInventoryOverlay.cs         # overlay shell/facade
    MiniMapOverlay.cs
    common/
      UiScaleMetrics.cs
      ItemUiFactory.cs
      ItemTooltipPresenter.cs
    panels/
      hud/
        HudPanelState.cs
        HudPanelNavigator.cs
        HudLayoutFactory.cs
        HudPresenter.cs
        HudSnapshotApplier.cs
      inventory/
        CharacterInventoryLayoutFactory.cs
        CharacterInventoryPresenter.cs

  tools/
    MapContentGenerationJob.cs
    Phase1CatalogGenerationJob.cs
    ...
```

### Placement Rules by Responsibility

- scene shell
  - 위치: `scripts/app/*.cs`
  - 책임: node lookup, lifecycle entry, coordinator 호출
  - 금지: local save/API mutation, HUD snapshot 조립, dungeon reward business flow 직접 보유
- scene-specific coordinator / partial
  - 위치: `scripts/app/game_scene/*`
  - 책임: `GameScene`에서 잘라낸 bootstrap, frame tick, HUD binding, dungeon flow, reward flow, dialogue flow
- application port / service
  - 위치: `scripts/application/ports/*`, `scripts/application/services/*`
  - 책임: engine-independent interface, runtime bootstrap orchestration, HUD query/persistence orchestration
  - 금지: `using Godot`, scene tree 직접 접근
- engine adapter
  - 위치: `scripts/engine/godot/*`
  - 책임: `application/ports` 구현, Godot API bridge, scene navigation/render/audio/persistence/content adapter
  - 금지: gameplay rule, quest/combat/inventory business logic 직접 보유
- autoload adapter
  - 위치: `scripts/autoload/*`
  - 책임: composition root, autoload lifetime, engine adapter 조립
- content adapter
  - 위치: `scripts/engine/godot/content/*`
  - 책임: `DataRegistry` 기반 catalog/map/sprite 조회 adapter
- gameplay runtime
  - 위치: `scripts/gameplay/world/*`, `scripts/gameplay/world/runtime/*`
  - 책임: world update, spawn, transition, effect, pathing
  - 금지: autoload singleton 직접 접근, Godot `SceneTree`/`Resource` 직접 접근
- UI shell / presenter / layout
  - 위치: `scripts/ui/*`, `scripts/ui/common/*`, `scripts/ui/panels/*`
  - 책임: Control tree, panel state, navigation, presenter, common UI metrics
  - 금지: save repository, local API facade 직접 접근

### File-Level Migration Mapping

- `GameScene.cs`
  - 유지: scene shell, public scene-facing entry
  - 추출 대상:
    - `_Ready()` bootstrap -> `app/game_scene/GameScene.Bootstrap.cs`
    - `_Process()` frame orchestration -> `app/game_scene/GameScene.Frame.cs`
    - HUD event wiring / snapshot apply -> `app/game_scene/GameScene.HudBinding.cs`
    - menu/navigation -> `app/game_scene/GameScene.Navigation.cs`
    - NPC dialogue -> `app/game_scene/GameScene.NpcDialogue.cs`
    - mystery dungeon / rewards -> `app/game_scene/GameScene.DungeonFlow.cs`, `GameScene.Rewards.cs`
- `HudController.cs`
  - 유지: shell/facade, public event surface, root `CanvasLayer`
  - 추출 대상:
    - panel state -> `ui/panels/hud/HudPanelState.cs`
    - input navigation -> `ui/panels/hud/HudPanelNavigator.cs`
    - control tree build -> `ui/panels/hud/HudLayoutFactory.cs`
    - snapshot render -> `ui/panels/hud/HudPresenter.cs`
- `CharacterInventoryOverlay.cs`
  - 유지: shell/facade
  - 추출 대상:
    - layout build -> `ui/panels/inventory/CharacterInventoryLayoutFactory.cs`
    - snapshot/detail presentation -> `ui/panels/inventory/CharacterInventoryPresenter.cs`
    - 공통 scale/icon/button helper -> `ui/common/UiScaleMetrics.cs`, `ui/common/ItemUiFactory.cs`
- `GameApp.cs`
  - 유지: composition root와 scene navigation entry
  - 추출 대상:
    - runtime content bootstrap orchestration -> `application/services/RuntimeContentBootstrapService.cs`
    - Godot bootstrap bridge -> `engine/godot/bootstrap/GodotRuntimeBootstrap.cs`
- `SceneRouter.cs`
  - 유지: low-level Godot scene swap utility
  - 추출 대상:
    - application-facing navigation adapter -> `engine/godot/navigation/GodotSceneNavigator.cs`
- `AudioService.cs`, `SaveRepository.cs`, `DataRegistry.cs`
  - 유지: Godot autoload anchor
  - 추출 대상:
    - audio/persistence/content port 구현 -> `engine/godot/audio/*`, `engine/godot/persistence/*`, `engine/godot/content/*`
- `GreenfieldWorldRuntime.cs`
  - 유지: runtime shell/facade
  - 추출 대상:
    - spawn/transition/effect/pathing -> `gameplay/world/runtime/*`
    - renderer/content read 제거 -> `application/ports/*` + `engine/godot/*`
- `ApplicationLocalApiFacade*.cs`
  - 유지: local API facade entry
  - 추출 대상:
    - catalog read dependency -> `application/ports/IContentCatalogPort.cs`

## Implementation Phases

### Phase 0. Docs and Guardrails (S)

목표:
- 구조 리팩터링 문서와 게이트를 먼저 고정한다.

작업:
1. `godot-refactor` Dev Docs 3파일 생성
   - Acceptance: `plan/context/tasks`가 현재 판단과 우선순위를 반영한다.
2. 목표 폴더/파일 구조 고정
   - Acceptance: 이 문서의 `Target Folder and File Structure`를 정본으로 삼아 새 파일 배치를 결정한다.
3. 구조 가드 정의
   - Acceptance: 아래 항목을 문서상 수용 기준으로 고정한다.
   - `GameScene` public `Debug*` 0건
   - production scene `DebugDock` 0건
   - `scripts/application`의 `using Godot` 0건
   - build warning 0건

### Phase 1. Production/Test Boundary Split (M)

목표:
- production 경로에서 debug/smoke/tooling 오염을 제거한다.

작업:
1. `GameScene` public `Debug*` surface를 `GameSceneTestProbe`로 이동
   - Acceptance: smoke는 probe를 통해서만 runtime을 제어한다.
2. `GameScene.tscn`의 `DebugDock` 제거
   - Acceptance: production scene tree에 debug UI가 남지 않는다.
3. `AppRoot` smoke harness attach 로직 분리
   - Acceptance: 본편 composition root가 smoke node를 직접 add 하지 않는다.
4. `GameApp`의 content-generation env 분기 분리
   - Acceptance: runtime bootstrap과 tooling entry가 분리된다.

### Phase 2. GameScene and HUD Surgery (L)

목표:
- 스파게티 중심축인 `GameScene`과 `HudController`를 먼저 절개한다.

작업:
1. `GameSceneShell`, `GamePlayCoordinator`, `GameUiBinder`로 1차 분해
   - Acceptance: `GameScene`은 scene lifecycle, input relay, tick orchestration만 남긴다.
2. HUD dirty-flag snapshot 도입
   - Acceptance: `_Process()`에서 HUD 전체 sync를 직접 호출하지 않는다.
3. `HudController` 분해
   - Acceptance: navigator/state/layout/presenter가 분리되고 unused event가 사라진다.
4. `CharacterInventoryOverlay` 공통화
   - Acceptance: scale constant와 item action UI 중복 0건

### Phase 3. Runtime / Resource Decoupling (L)

목표:
- engine/UI/resource 교체 가능성을 높이는 포트 경계를 만든다.

작업:
1. `IWorldRenderer`, `IContentCatalogPort`, `IGamePersistencePort`, `IAudioPort` 도입
   - Acceptance: `GameScene`, `GreenfieldWorldRuntime`, `ApplicationLocalApiFacade*`의 singleton 직접 접근이 제거된다.
2. runtime fallback 제거
   - Acceptance: bootstrap monster/object, gate/object fallback이 production runtime에서 사라진다.
3. `DataManager` 의존 축소
   - Acceptance: quest/catalog 경로가 port 기반으로 이동한다.

### Phase 4. Legacy Cluster Removal (M)

목표:
- live path 밖의 dead cluster와 중복 구현을 제거한다.

작업:
1. `AudioManager`, `DebugFlags` 제거
   - Acceptance: live reference 0건 유지
2. `InputManager`, `HeroController`, `MapManager` 일괄 제거
   - Acceptance: live path가 `DungeonMapRenderer2D` 중심으로 단일화된다.
3. `TitleScene`, `MenuScene` placeholder UX 교체
   - Acceptance: rewrite/debug 문구가 본편 경로에 노출되지 않는다.

## Risks and Mitigations

- 기존 parity 작업과 충돌할 수 있다.
  - 완화: `godot-porting` 메인 트랙과 분리하고 구조 변경은 side track에서만 관리한다.
- 사용자 워크트리 변경과 충돌할 수 있다.
  - 완화: `GameScene`, `TitleScene`, `MenuScene`, `AudioService`, `GameApp` 변경 전 반드시 현재 diff를 다시 읽고 병합 전략을 정한다.
- runtime fallback 제거가 smoke를 깨뜨릴 수 있다.
  - 완화: production fallback 제거 전에 test-only provider를 먼저 도입한다.

## Success Metrics

- `GameScene` public `Debug*` 0건
- production scene의 `DebugDock` 0건
- build warning 0건
- `GameScene`의 singleton direct access 0건
- `HudController`와 `CharacterInventoryOverlay`의 scale/action UI 중복 0건
- live path에서 `AudioManager`, `DebugFlags`, `InputManager`, `HeroController`, `MapManager` 참조 0건
- `dotnet build`, `Phase 6 smoke`, `phase67_validation.py` PASS

## Dependencies

- `godot-porting` 메인 문서의 parity 기준
- 현재 dirty worktree의 사용자 변경사항
- `DungeonMapRenderer2D`를 canonical renderer로 유지하는 전제
