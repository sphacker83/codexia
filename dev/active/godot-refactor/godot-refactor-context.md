# DungeonNeko Godot Structural Refactor Context

Last Updated: 2026-03-11

## Session Progress

### ✅ Completed

- 구조 리팩터링 사이드 트랙 `godot-refactor` 문서 세트를 생성했다.
- 현재 hotspot, dead code 후보, 결합도, 성능 이슈를 정적 검토로 정리했다.
- 구현 전 메인 트랙과 분리된 우선순위를 고정했다.
- `godot-refactor-plan.md`에 목표 폴더/파일 구조, file placement rule, `engine/godot/*` adapter 계층을 고정했다.
- `godot-refactor-tasks.md`를 현재 구현 기준의 세부 체크리스트로 재작성했다.
- `GameApp._Ready()`의 tooling bootstrap 분기와 `GameApp.EnsureRuntimeContentReadyAsync()`의 runtime content 단계 분리를 반영했다.
- `AppRoot._Ready()`를 production host registration helper 기준으로 정리했다.
- `TitleScene.OpenMenu(bool)`, `MenuScene.OpenGameScene()`, `GameScene.OpenMenu()`의 direct `ChangeSceneToFile` fallback을 제거하고 `GameApp` 경유 navigation으로 통일했다.
- `scripts/application/ports/*`와 `scripts/engine/godot/*` 기본 골격을 생성하고, `GameApp`가 `GodotSceneNavigator`, `GodotRuntimeBootstrap`, `GodotAudioPort`, `GodotGamePersistencePort`, `GodotContentCatalogPort`를 composition root에서 조립하도록 바꿨다.
- `LocalApiFacadeNode`는 `GodotGamePersistencePort`와 `GodotContentCatalogPort`를 사용하도록 바뀌었고, `ApplicationLocalApiFacade.GetItemCatalog()`는 이제 `IContentCatalogPort`를 통해 runtime item source를 읽는다.
- `GameScene` / `GameScene.Quests` / `MenuScene`의 audio/save 접근은 `GameApp` port surface(`AudioPort`, `PersistencePort`) 경유로 정리됐다.
- `IContentCatalogPort`를 map/sprite/monster 조회까지 확장했고, `GreenfieldWorldRuntime`는 이제 `DataRegistry.Instance` / `DataManager.Instance` 대신 `_contentCatalogPort`를 통해 map spec, sprite binding, monster map, monster data를 읽는다.
- `HeroRuntimeBindingFactory`도 `IContentCatalogPort`를 받도록 바뀌었고, `GameScene` / `CharacterInventoryOverlay`의 hero binding preview 경로가 `GameApp.ContentCatalogPort`를 사용하도록 맞췄다.
- `AppRoot`의 production host registration 경로를 다시 확인했고, smoke/test harness attach 흔적은 현재 없다.
- `GameScene._Ready()` / `_Process()`는 `scripts/app/game_scene/GameScene.Bootstrap.cs`, `GameScene.Frame.cs`로 절개됐다.
- `GameScene`의 HUD binding/apply/query/snapshot/quickslot persistence 경계는 `GameUiBinder`, `GameUiBindingContext`, `GameUiSnapshotFactory`, `HudQueryService`, `QuickSlotPersistenceService`로 분리됐다.
- mystery dungeon / reward 흐름은 `scripts/app/game_scene/GameScene.DungeonFlow.cs`로 분리됐다.
- `HudController` / `CharacterInventoryOverlay`의 중복 UI metric/helper는 `scripts/ui/common/UiScaleMetrics.cs`, `UiControlFactory.cs`, `ItemUiFactory.cs`로 공통화됐다.
- `GreenfieldMonsterCatalogService`를 추가해 monster spawn template 조립과 monster attack effect sprite key lookup을 runtime 밖으로 이동했다.
- `GreenfieldRuntimeFallbackPolicy`와 `scripts/engine/godot/test/GodotGreenfieldRuntimeFallbackPolicyProvider.cs`를 추가해 production 기본 경로와 smoke/test opt-in fallback 경로를 분리했다.
- `GameScene.Bootstrap.cs`는 runtime 생성 시 `GreenfieldMonsterCatalogService`와 runtime fallback policy를 함께 주입하도록 바뀌었다.
- `ApplicationLocalApiFacade.Catalog.cs`는 `GetOrBuildItemCatalog(...)` helper와 주석으로 runtime catalog / static fallback merge 규칙, item lookup 순서, dungeon reward catalog surface를 코드 수준에서 문서화했다.
- legacy cluster `AudioManager`, `InputManager`, `HeroController`, `MapManager`와 각 `.uid`를 제거했고, `DebugFlags`도 live/runtime 기준 잔존 파일/참조가 없음을 재확인했다.
- `TitleScene`의 자동 menu 전환을 제거했고, `TitleScene.tscn` / `MenuScene.tscn`의 static text와 `MenuScene` runtime 문구를 production 기준 한국어 UX로 정리했다.
- `tools/pipeline/phase67_validation.py`를 추가했고, `dotnet build`, headless smoke, validation script까지 모두 통과했다.
- `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`는 warning/error 0건이다.

### 🟡 Next Up

- 이 `godot-refactor` 트랙의 계획된 항목은 모두 완료됐다.
- 이후 작업이 필요하면 별도 follow-up 트랙으로 `GameScene` / `GreenfieldWorldRuntime` 추가 분해를 잡는 편이 맞다.

### ⚠️ Worktree Notes

- 현재 워크트리에 다음 파일의 수정사항이 이미 존재한다.
- `DungeonNeko-Godot/scripts/app/GameScene.cs`
- `DungeonNeko-Godot/scenes/game/GameScene.tscn`
- `DungeonNeko-Godot/scripts/app/TitleScene.cs`
- `DungeonNeko-Godot/scenes/title/TitleScene.tscn`
- `DungeonNeko-Godot/scripts/app/MenuScene.cs`
- `DungeonNeko-Godot/scenes/menu/MenuScene.tscn`
- `DungeonNeko-Godot/scripts/autoload/AudioService.cs`
- `DungeonNeko-Godot/scripts/autoload/GameApp.cs`
- `dev/active/godot-porting/godot-porting-context.md`
- `dev/active/godot-porting/godot-porting-tasks.md`
- 구조 리팩터링 구현 시 위 파일은 사용자 변경을 덮어쓰지 말고 병합 기준으로 다뤄야 한다.

## Baseline Facts

- `GameScene`는 현재 5,205 LOC 수준의 god object다.
- `HudController`는 현재 5,430 LOC 수준의 giant UI controller다.
- `CharacterInventoryOverlay`는 현재 1,281 LOC다.
- `GreenfieldWorldRuntime`는 현재 5,456 LOC 수준의 runtime god object다.
- `GameScene.tscn`에는 현재 `DebugDock`가 없다.
- `GameScene` public `Debug*` surface는 현재 0건으로 보인다.
- `scripts/application`의 `using Godot;` direct dependency는 현재 0건이다.
- live runtime 경로는 여전히 `GameScene -> GreenfieldWorldRuntime -> DungeonMapRenderer2D`다.
- `GameScene._Process()`는 더 이상 per-frame HUD sync 경로로 `SyncHudOverlayState()`를 직접 호출하지 않고, `_hudSyncPending` + `FlushHudOverlayStateIfRequested()` 경로를 사용한다.
- `GameScene`의 UI resolver/event wiring은 `GameUiBinder`와 `GameUiBindingContext`로 분리됐다.
- `HudController`와 `CharacterInventoryOverlay`는 더 이상 `UiMetricScale`, `UiSpacingScale`, `UiElementScale`, `UiFontScale`, `LegacyFontScale`, `MinReadableFontPx`를 중복 선언하지 않는다.
- `GameApp._Ready()`의 tooling env 분기와 `MapContentGenerationJob.Run()` 호출은 helper로 분리됐다.
- `GameApp.EnsureRuntimeContentReadyAsync()`는 runtime content indexing / gameplay data loading 두 단계 helper로 분리됐다.
- `AppRoot._Ready()`는 production host registration helper 경계로 정리됐다.
- `TitleScene`, `MenuScene`, `GameScene`의 menu/game 이동은 이제 `GameApp` 경유 navigation을 canonical path로 사용한다.
- `scripts/application/ports/*`와 `scripts/engine/godot/*` 기본 adapter 계층이 실제 파일로 생성돼 있다.
- `GameApp`는 runtime content bootstrap과 scene navigation에서 `DataRegistry`, `DataManager`, `SceneRouter`를 직접 다루지 않고 `GodotRuntimeBootstrap`, `GodotSceneNavigator`를 경유한다.
- `ApplicationLocalApiFacade.GetItemCatalog()`는 더 이상 `DataManager.Instance`를 직접 읽지 않는다.
- `GreenfieldWorldRuntime.cs`, `HeroRuntimeBindingFactory.cs` 안의 `DataRegistry.Instance`, `DataManager.Instance` 직접 참조는 현재 0건이다.
- `application/ports/*`와 별도로 `engine/godot/*` adapter 계층이 필요하다는 구조 전제를 문서에 반영했다.
- `GreenfieldWorldRuntime`는 `GreenfieldMonsterCatalogService`와 `GreenfieldRuntimeFallbackPolicy`를 주입받아 production 기본 경로를 strict하게 유지한다.
- smoke/test fallback은 `GodotGreenfieldRuntimeFallbackPolicyProvider`가 `DUNGEON_NEKO_GREENFIELD_PHASE6_SMOKE=1` 또는 `DUNGEON_NEKO_GREENFIELD_RUNTIME_TEST_FALLBACK=1`일 때만 켠다.
- `ApplicationLocalApiFacade.Catalog`의 item catalog 규칙은 `runtime items authoritative -> static fallback backfill -> normalized id lookup -> synthesized static definition` 순서로 고정됐다.
- legacy `AudioManager`, `InputManager`, `HeroController`, `MapManager`는 현재 저장소에서 제거됐다.
- `DebugFlags`는 live runtime 경로와 project/autoload 등록에서 모두 사라졌다.
- `TitleScene`는 더 이상 자동으로 메뉴로 넘어가지 않고, 명시적 입력으로만 진행한다.
- `MenuScene`과 관련 scene text는 production 한국어 UX 기준으로 정리됐다.
- `tools/pipeline/phase67_validation.py`가 현재 refactor gate 정본 검증 엔트리다.

## Hotspots

### 1. `GameScene`

- scene lifecycle/HUD/dungeon flow가 partial과 service로 절개됐지만, NPC dialogue, economy mutation, local save/API 호출, world runtime orchestration은 아직 한 클래스 안에 남아 있다.
- 다음 절개 대상은 runtime-independent coordinator와 command surface를 partial 밖 클래스로 승격하는 것이다.

### 2. `HudController` / `CharacterInventoryOverlay`

- layout builder, input navigator, panel state machine, presenter가 여전히 큰 클래스에 섞여 있다.
- UI scale 상수와 공통 factory/helper 중복은 제거됐고, 남은 문제는 panel/state/rendering 역할 분리다.

### 3. `GreenfieldWorldRuntime`

- runtime state, transition, combat/effect playback, renderer coupling이 한 클래스에 몰려 있다.
- singleton direct access, monster spawn template builder, production/test fallback 분리는 끝났다.
- 남은 hotspot은 runtime orchestration 자체의 추가 분해지만, 이번 트랙의 범위 밖이다.

### 4. `ApplicationLocalApiFacade`

- partial 분리는 돼 있고 catalog lookup도 `IContentCatalogPort` 뒤로 밀렸다.
- runtime catalog/fallback catalog merge 규칙은 코드 수준에서 문서화됐다.
- 남은 문제는 economy/reward 책임이 여전히 큰 partial에 몰려 있다는 점이지만, 이번 트랙의 필수 범위는 닫혔다.

## Retired Legacy

- `DungeonNeko-Godot/scripts/core/AudioManager.cs`
  - live reference 0건 확인 후 제거 완료
- `DungeonNeko-Godot/scripts/core/InputManager.cs`
  - live reference 0건 확인 후 제거 완료
- `DungeonNeko-Godot/scripts/gameplay/hero/HeroController.cs`
  - `MapManager`와 함께 usage audit 후 제거 완료
- `DungeonNeko-Godot/scripts/map/MapManager.cs`
  - `HeroController`와 함께 usage audit 후 제거 완료
- `DebugFlags`
  - live/runtime 기준 파일/등록/참조 없음 확인

## Deferred Removal Candidates

- `DungeonNeko-Godot/scripts/data/DataManager.cs`
  - `GreenfieldWorldRuntime`, `ApplicationLocalApiFacade.Catalog` 경로의 port 치환이 끝난 뒤 제거 여부 확정

## Coupling Map

- presentation -> singleton
  - `GameScene` -> `LocalApiFacadeNode.Instance`
  - `GameScene` -> `GameApp.Instance` -> `IGamePersistencePort`
  - `GameScene` -> `GameApp.Instance` -> `IAudioPort`
- runtime -> concrete catalog/renderer
  - `GreenfieldWorldRuntime` -> `DungeonMapRenderer2D`
  - `GreenfieldWorldRuntime` -> `IContentCatalogPort`
- application facade -> data singleton
  - `ApplicationLocalApiFacade.GetItemCatalog()` -> `IContentCatalogPort.GetRuntimeItems()`

## Performance / Complexity Notes

- `GameScene` 본체에 아직 남은 mutation/business flow가 다음 구조 절개의 핵심이다.
- `GameApp` bootstrap 경계와 scene navigation canonical path, runtime fallback strict/test policy 분리는 정리됐다.
- 이번 트랙의 즉시 리스크는 해소됐고, 남은 것은 차기 트랙 수준의 추가 분해다.

## Quick Resume

1. `godot-refactor-plan.md`의 `Target Folder and File Structure`를 정본으로 삼고, 새 파일은 그 구조 밖에 만들지 않는다.
2. `P0`, `P1`, `P2`, validation gate는 모두 완료됐다.
3. 새 구조 작업이 필요하면 별도 follow-up 트랙으로 `GameScene` / `GreenfieldWorldRuntime` 추가 분해를 잡는다.
4. 검증 재실행은 `python3 tools/pipeline/phase67_validation.py`를 정본으로 사용한다.
