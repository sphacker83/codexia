# DungeonNeko Godot Structural Refactor Tasks

Last Updated: 2026-03-11

## Verified Baseline

- [x] `godot-refactor` 사이드 트랙 `plan/context/tasks`가 생성돼 있고 `godot-porting` 메인 트랙에서 `Phase 9` 진입점으로 참조된다.
- [x] `godot-refactor-plan.md`에 `Target Folder and File Structure`를 추가해 목표 폴더/파일 구조, canonical entry, `engine/godot/*` adapter 계층을 고정했다.
- [x] `DungeonNeko-Godot/scenes/game/GameScene.tscn`에는 현재 `DebugDock`가 없다.
- [x] `DungeonNeko-Godot/scripts/app/GameScene.cs`에는 현재 public `Debug*` surface가 없다.
- [x] `DungeonNeko-Godot/scripts/application`에는 현재 `using Godot;` 의존이 없다.
- [x] 현재 live runtime 중심축은 여전히 `GameScene -> GreenfieldWorldRuntime -> DungeonMapRenderer2D`다.
- [x] `SceneRouter` autoload가 존재하며 `GameApp`, `TitleScene`, `MenuScene`은 host가 구성된 경우 scene swap 경로를 이미 사용한다.

## P0. Boundary and Bootstrap

### 1. `GameApp` tooling/runtime 경계 분리

- [x] `DungeonNeko-Godot/scripts/autoload/GameApp.cs`의 `GameApp._Ready()`에서 `DUNGEON_NEKO_GENERATE_NATIVE_CONTENT`, `DUNGEON_NEKO_GENERATE_MAPSPECS` 해석과 `MapContentGenerationJob.Run()` 호출을 `TryRunToolingBootstrap()` 계열 helper로 분리했다.
- [x] 같은 파일의 `GameApp.EnsureRuntimeContentReadyAsync()`에서 `DataRegistry.Warmup()` 단계와 `DataManager.LoadAllDataAsync()` 단계를 `EnsureRuntimeContentIndexedAsync()` / `EnsureGameplayDataLoadedAsync()`로 분리했다.
- [x] `GameApp.OpenGameScene()`는 loading scene 전환과 orchestration 중심으로 정리했고, content warmup 상세 로직은 helper 메서드로 위임했다.

세부 작업:
- `RuntimeBootstrapSuppressed`는 tooling mode 여부만 표현하도록 축소한다.
- `SetBootLoading()` 호출 책임을 runtime content bootstrap 계층으로 제한한다.
- `OpenConfiguredBootScene()` 경로가 tooling mode와 production mode를 다시 합치지 않는지 확인한다.

선행조건:
- `SceneRouter` host 기반 부팅 흐름과 `DUNGEON_NEKO_BOOT_SCENE` 동작을 유지한다.

검증 포인트:
- tool env 없이 실행하면 기존 title/menu/game 진입 순서가 유지된다.
- tool env 실행 시 `RegisterContentHost()`와 game scene bootstrap이 호출되지 않는다.
- `GameApp` 내부의 `OpenScene()` / `TryOpenScene()` helper가 host swap과 direct fallback을 한곳에서 처리한다.

### 2. `AppRoot` production host 등록 책임 고정

- [x] `DungeonNeko-Godot/scripts/app/AppRoot.cs`의 `AppRoot._Ready()`에서 `ContentRoot`, `BootLoadingOverlay`, `BootLoadingLabel` 조회와 `RegisterContentHost()` 호출을 `TryResolveProductionHostNodes()` / `RegisterProductionContentHost()` helper로 나눠 production host registration 책임으로 고정했다.
- [x] `AppRoot`에 smoke/test harness attach 흔적이 남아 있는지 재점검했고, 현재 production host registration 외 attach 흔적이 없어 별도 bootstrap 이동 태스크가 필요 없음을 확인했다.

세부 작업:
- `GameApp.RuntimeBootstrapSuppressed` 체크가 tooling 억제 외 다른 의미를 갖지 않도록 확인한다.
- `RegisterContentHost()` 호출 전에 production scene tree 외 노드를 붙이는 경로가 없는지 점검한다.

선행조건:
- `GameApp` tooling/runtime 분리 초안이 먼저 정리돼 있어야 한다.

검증 포인트:
- production `AppRoot`가 content host 등록 외 bootstrap 부수효과를 만들지 않는다.

### 3. scene navigation canonical path 확정

- [x] `DungeonNeko-Godot/scripts/app/TitleScene.cs`의 `TitleScene.OpenMenu(bool)` direct `ChangeSceneToFile(...)` fallback을 제거하고 `GameApp` 경유 navigation으로 통일했다.
- [x] `DungeonNeko-Godot/scripts/app/MenuScene.cs`의 `MenuScene.OpenGameScene()` direct `ChangeSceneToFile(...)` fallback을 제거하고 `GameApp` 경유 navigation으로 통일했다.
- [x] `DungeonNeko-Godot/scripts/app/GameScene.cs`의 `GameScene.OpenMenu()` direct `ChangeSceneToFile(...)` fallback을 제거하고 `GameApp` 경유 navigation으로 통일했다.
- [x] `GameApp.OpenTitleScene()`, `GameApp.OpenMenuScene()`, `GameApp.OpenGameScene()`를 canonical entry로, `SceneRouter`를 low-level swap adapter로 `godot-refactor-plan.md`에 고정했다.

세부 작업:
- title/menu/game 진입 경로를 하나의 서비스 규칙으로 맞춘다.
- smoke/test 진입도 동일한 scene navigation 경로를 쓰는지 확인한다.

선행조건:
- host 기반 scene swap과 fallback 직접 전환 중 어느 쪽을 정본으로 둘지 결정한다.

검증 포인트:
- `TitleScene`, `MenuScene`, `GameScene`의 production scene 이동이 direct `ChangeSceneToFile`에 의존하지 않는다.

## P0. GameScene and HUD Split

### 1. `GameScene._Ready()` bootstrap 순서 분해

- [x] `DungeonNeko-Godot/scripts/app/GameScene.cs`의 `GameScene._Ready()`에서 node discovery (`FindNodeByPaths`, `ConfigureSnapshotLabel`, `EnsureHudController`, `EnsureMiniMapOverlay`) 단계를 `scripts/app/game_scene/GameScene.Bootstrap.cs`의 setup 메서드 군집으로 분리했다.
- [x] 같은 메서드의 player/save/API bootstrap (`LoadGeneratedItemCatalog`, `InitializeQuestTracker`, `RefreshPlayerSnapshotAsync`, `RefreshHudDataAsync`, `RefreshQuickSlotStateAsync`, `RestoreQuestTrackerStateAsync`)을 `TryBootstrapSceneDataAsync()` 경계로 묶어 bootstrap coordinator 이동 준비를 마쳤다.
- [x] world bootstrap (`TryGetBootstrapMapSpec`, `BuildBootstrapHeroSpawnHint`, `GreenfieldWorldRuntime.Initialize`, `SyncHeroConditionPresentation`, `ResetWorldMapBgmState`, `SyncCurrentMapBgm`)을 `TryBootstrapWorldAsync()` 경계로 분리했다.

세부 작업:
- `_Ready()`의 early-return 분기별 책임을 `missing local api`, `player snapshot load fail`, `bootstrap map fail`, `world init success/fail`로 나눠 문서화한다.
- `_spritePreview`, `_mapRenderer`, `_worldRuntime` 초기화 순서를 보존하면서 책임만 이동한다.

선행조건:
- `GameApp`와 `AppRoot`의 bootstrap 경계가 먼저 정리돼 있어야 한다.

검증 포인트:
- `GameScene._Ready()`는 scene composition과 coordinator 호출만 남는다.

### 2. `GameScene._Process()` frame tick 절개

- [x] `GameScene._Process()`의 입력/overlay 단계 (`TryRecoverImmediateHeroActionDesync`, `ReconcileHeroActionRuntimeState`, `TryHandleHotkeys`, `UpdateNearestNpcInteractionHint`, `SyncQuestEscortRuntimeContext`, `PumpQuestTrackerState`)를 `scripts/app/game_scene/GameScene.Frame.cs`의 frame pre-update 메서드로 묶었다.
- [x] 같은 메서드의 runtime tick (`GreenfieldWorldRuntime.Update`)과 combat/dungeon 후처리 (`TickHeroSkillTimers`, `UpdateHeroAttackRuntime`, `UpdateHeroSkillRuntime`, `UpdateDungeonCombat`, `TryHandleMysteryDungeonSacredStonePickup`, `TryHandleMysteryDungeonGateUnderHero`)를 runtime/post-frame 단계로 분리했다.
- [x] `_Process()`에서 `SyncHudOverlayState()`를 직접 호출하지 않도록 HUD dirty-flag (`_hudSyncPending`)와 `FlushHudOverlayStateIfRequested()` 경로로 바꿨다.

세부 작업:
- overlay blocking 상태와 runtime input 생성 (`GreenfieldRuntimeInputSnapshot.Capture`)을 별도 input relay 메서드로 이동한다.
- BGM/minimap/snapshot label 후처리 (`SyncCurrentMapBgm`, `SyncMiniMapOverlay`, `RefreshSnapshotLabel`)는 UI post-frame 단계로 분리한다.

선행조건:
- HUD snapshot 갱신 경로가 dirty-flag 기반으로 정의돼 있어야 한다.

검증 포인트:
- `_Process()`는 input relay, runtime tick, post-frame orchestration만 남는다.
- `rg -n "SyncHudOverlayState\\(" DungeonNeko-Godot/scripts/app/GameScene.cs` 결과에서 `_Process()` 직접 호출이 사라진다.

### 3. HUD 바인딩과 mutation dispatch 분리

- [x] `GameScene.BindHudController()`의 resolver 주입과 30개 이상 event 구독/해제 코드를 `scripts/app/game_scene/GameUiBinder.cs`로 이동했다.
- [x] `GameScene.BindCharacterInventoryOverlay()`의 resolver/event 연결을 같은 binder와 `GameUiBindingContext` 경로로 공유하도록 정리했다.
- [x] `HandleHudEquipRequested`, `HandleHudUnequipRequested`, `HandleHudSellRequested`, `HandleHudStoreWarehouseRequested`, `HandleHudLoadWarehouseRequested`, `HandleHudNpcShopPurchaseRequested`, `HandleHudQuickSlotTriggered`, `HandleHudPotionSlotTriggered` 같은 `HandleHud*Requested` 군은 `GameUiBindingContext`를 통한 command dispatch surface로 묶었다.

세부 작업:
- HUD와 overlay가 공유하는 `ResolveHudItemLabel`, `ResolveCharacterInventoryItemDetail`, `ResolveHudItemIcon` 주입 코드를 한곳으로 모은다.
- event wiring은 데이터 구조 또는 binder 메서드 단위로 정리해 수동 detach/attach 나열을 줄인다.

선행조건:
- HUD snapshot builder와 quickslot persistence 경계가 분리 설계돼 있어야 한다.

검증 포인트:
- `GameScene` 본체에서 UI resolver/event wiring 책임이 크게 줄어든다.

### 4. HUD query/snapshot/cache 파이프라인 분리

- [x] `GameScene.RefreshHudDataAsync()`의 inventory/warehouse/shop/recipe 조회를 `scripts/application/services/HudQueryService.cs`로 이동했다.
- [x] `GameScene.RefreshQuickSlotStateAsync()`, `MutateQuickSlotStateAsync()`, `PersistRuntimeQuickSlotStateAsync()`, `PersistQuickSlotStateAsync()`를 `scripts/application/services/QuickSlotPersistenceService.cs` 중심으로 분리했다.
- [x] `GameScene.SyncHudOverlayState()`와 cache reset 책임을 `GameUiBinder` 기반 snapshot apply 계층으로 옮겼다.
- [x] `BuildHudStatusSnapshot()`, `BuildHudQuickSlots()`, `BuildHudPotionSlots()`, `BuildHudOverlayLines()`, `BuildHudShopItemEntries()`를 `scripts/app/game_scene/GameUiSnapshotFactory.cs`로 이동했다.

세부 작업:
- `_lastHud*`, `_lastCharacterInventory*` cache 필드를 scene 본체에서 떼어내고 apply 계층으로 이동한다.
- `AudioService.Instance`와 minimap 상태 읽기는 snapshot builder 또는 port 경유로 정리한다.

선행조건:
- binder와 query service의 책임 분리가 먼저 정의돼 있어야 한다.

검증 포인트:
- HUD/overlay snapshot 생성과 apply가 `GameScene` 본체에서 분리된다.

### 5. mystery dungeon / reward 흐름을 coordinator로 분리

- [x] `EnterMysteryDungeonLocalAsync()`, `ApplyMysteryDungeonFloorAsync()`, `RunMysteryDungeonFloorMoveTransitionAsync()`, `TryReturnFromMysteryDungeonWithCostAsync()`, `HandleHeroDeathInMysteryDungeonAsync()`를 `scripts/app/game_scene/GameScene.DungeonFlow.cs`로 분리해 dungeon flow coordinator 이동 단위로 절개했다.
- [x] `FinalizeMonsterDefeatAsync()`, `ApplyMonsterDefeatRewardAsync()`, `ShowMysteryDungeonRewardPopup()`, `BuildMysteryDungeonRewardEntries()`, `BuildMysteryDungeonRewardItemEntries()`를 같은 partial 경계로 묶어 reward coordinator 절개 단위를 고정했다.
- [x] `_phase4State`, `_lastFlowSummary`, `_currentFloorHuntCount`, `_dungeonFloorMonsterKillCounts`, `_dungeonFloorLootItemCounts`는 dungeon flow partial이 소유하는 상태로 묶고, 다음 단계 coordinator 이관 계획을 문서에 고정했다.

세부 작업:
- dungeon transition 중 `LocalApiFacadeNode.Instance` 호출과 runtime floor apply를 분리한다.
- town return/death/reward popup 흐름에서 UI 갱신과 domain 갱신의 책임을 분리한다.

선행조건:
- HUD mutation/query 분리와 runtime coordinator 경계가 먼저 정리돼 있어야 한다.

검증 포인트:
- `GameScene`은 dungeon business flow를 직접 소유하지 않는다.

### 6. HUD/overlay 공통 UI metric 및 factory 정리

- [x] `DungeonNeko-Godot/scripts/ui/HudController.cs`와 `DungeonNeko-Godot/scripts/ui/CharacterInventoryOverlay.cs`에 중복된 `UiMetricScale`, `UiSpacingScale`, `UiElementScale`, `UiFontScale`, `LegacyFontScale`, `MinReadableFontPx`를 `scripts/ui/common/UiScaleMetrics.cs`로 이동했다.
- [x] 두 파일에 중복된 `CreateLabel`, `CreateActionButton`, `ApplyPanelStyle`, `ApplyButtonStyle`, `AttachItemIcon`, `Ui`, `UiSpace`, `UiElement` 류 helper를 `scripts/ui/common/UiControlFactory.cs`, `ItemUiFactory.cs` 경유로 정리했다.
- [x] 프로젝트 고정 규칙대로 외곽 컨테이너 크기는 유지하고 내부 폰트/아이콘/여백만 `UiMetricScale = 2.0` 기준으로 확대하도록 helper 구현에 반영했다.

세부 작업:
- `HudController`의 popup/dialogue 크기 상수와 `CharacterInventoryOverlay`의 window 크기 상수가 어떤 계층에서 관리돼야 하는지 분리한다.
- overlay 쪽 tooltip/detailed panel helper와 HUD 쪽 popup/action button helper의 공유 범위를 먼저 고정한다.

선행조건:
- `dev/active/godot-porting/godot-porting-context.md`와 `godot-porting-tasks.md`의 UI scale 규칙을 먼저 재확인한다.

검증 포인트:
- UI metric 상수 중복이 사라지고, 외곽 컨테이너 디자인 크기는 유지된다.

## P1. Runtime and Catalog Ports

### 0. engine adapter 계층 도입

- [x] `scripts/application/ports/IAudioPort.cs`, `IContentCatalogPort.cs`, `IGamePersistencePort.cs`, `IWorldRenderer.cs`와 `scripts/engine/godot/*` 기본 adapter 경로를 생성했다.
- [x] `GameApp`는 이제 `GodotSceneNavigator`, `GodotRuntimeBootstrap`, `GodotAudioPort`, `GodotGamePersistencePort`, `GodotContentCatalogPort`를 composition root에서 조립하고, `AudioService`, `SaveRepository`, `DataRegistry`, `SceneRouter`는 autoload anchor 역할만 남긴다.
- [x] `ApplicationLocalApiFacade`와 `LocalApiFacadeNode`는 `GodotGamePersistencePort`, `GodotContentCatalogPort`를 사용하고, `GameScene` / `MenuScene`은 `GameApp` port surface 경유로 audio/save를 읽는다.

세부 작업:
- `GodotSceneNavigator`, `GodotWorldRenderer`, `GodotAudioPort`, `GodotGamePersistencePort`, `GodotContentCatalogPort`, `GodotRuntimeBootstrap`를 최소 adapter 집합으로 정의한다.
- smoke/test 전용 진입은 `engine/godot/test/*`에 둔다.

선행조건:
- `godot-refactor-plan.md`의 target tree를 정본으로 사용한다.

검증 포인트:
- `application/ports/*`의 구현체는 `engine/godot/*`에서만 찾을 수 있다.

### 1. `GreenfieldWorldRuntime`의 `DataRegistry` 직접 결합 제거

- [x] `DungeonNeko-Godot/scripts/gameplay/world/GreenfieldWorldRuntime.cs`의 `SpawnNpcRuntimes()`는 registry null-guard를 제거하고 `TryResolveRuntimeBinding()`이 `IContentCatalogPort`를 통해 sprite binding을 읽는 구조로 정리했다.
- [x] 같은 파일의 `SpawnSpriteObjectPreviews()`, `SpawnGateGuidePreviews()`, `SpawnMysteryDungeonSacredStonePreview()`에서 `DataRegistry.Instance == null` 직접 검사와 concrete registry 조회를 제거했다.
- [x] `TryResolveSpriteBinding()`, `TryResolveRuntimeBinding()`, `TryResolveTargetMapSpec()`가 `DataRegistry.Instance` 대신 `IContentCatalogPort`를 사용하도록 바꿨다.

세부 작업:
- map spec 조회와 sprite runtime binding 조회가 하나의 `IContentCatalogPort`인지, 하위 reader 인터페이스인지 먼저 결정한다.
- `TryResolveTargetMapSpec()`의 map 탐색 규칙을 port 쪽으로 이동한다.

선행조건:
- port 경계 정의가 먼저 필요하다.

검증 포인트:
- `rg -n "DataRegistry\\.Instance" DungeonNeko-Godot/scripts/gameplay/world/GreenfieldWorldRuntime.cs` 결과가 제거 목표 범위를 벗어나지 않는다.

### 2. `GreenfieldWorldRuntime`의 `DataManager` 직접 결합 제거

- [x] `GreenfieldWorldRuntime.TryBuildMapMonsterSpawnTemplates()`에서 `DataManager.Instance?.MonsterMaps`, `DataManager.Instance?.Monsters` 조회를 `IContentCatalogPort.TryGetMonsterMapEntry()` / `TryGetMonsterData()`로 이동했다.
- [x] `GreenfieldWorldRuntime.TryResolveMonsterAttackEffectSpriteKey()`에서 `DataManager.Instance?.Monsters` 조회를 제거했다.
- [x] monster spawn template 조립과 monster attack effect sprite key lookup 책임을 `scripts/gameplay/world/GreenfieldMonsterCatalogService.cs`로 옮기고, `GreenfieldWorldRuntime`는 helper 호출만 하도록 정리했다.

세부 작업:
- monster spawn template builder와 monster attack effect resolver가 같은 monster read port를 재사용하도록 설계한다.
- `TryResolveMonsterData()`와 monster lookup 반복 코드를 catalog reader 쪽으로 밀어낸다.

선행조건:
- `DataManager`가 transitional source로 남더라도 접근은 port 뒤에서만 일어나야 한다.

검증 포인트:
- `GreenfieldWorldRuntime` 본체에서 `DataManager.Instance` 직접 참조가 사라진다.

### 3. production fallback 제거 대상을 메서드 단위로 절개

- [x] `GreenfieldWorldRuntime.TryResolveTargetMapSpec()`의 "요청 map 실패 시 임의 gate map 선택" fallback을 production 기본 경로에서 제거하고, `GreenfieldRuntimeFallbackPolicy.AllowGateTargetMapFallback`가 켜진 test-only path에서만 허용하도록 바꿨다.
- [x] `GreenfieldWorldRuntime.TryResolveArrivalSpawn()`의 reverse-gate / first-gate / fallback-direction 경로를 production 규칙과 test bootstrap 규칙으로 분리하고, arrival fallback은 `AllowArrivalSpawnFallback` policy에 묶었다.
- [x] `GreenfieldWorldRuntime.PickMysteryDungeonMonsterSpawnTiles()`의 center-tile fallback을 production/runtime와 검증 전용 fallback으로 분리하고, production 기본은 빈 리스트를 반환하도록 고정했다.
- [x] `PlayMonsterAttackCommonFallback()` 및 `ResolveFallbackMonsterAttackEffectRequests()` 사용 경로를 production 의존에서 분리하고, `AllowMonsterAttackEffectFallback`가 켜진 test-only policy에서만 타도록 격리했다.

세부 작업:
- fallback 제거 전에 smoke가 기대하는 최소 test provider 동작을 먼저 정의한다.
- fallback 제거 순서를 gate transition -> arrival spawn -> mystery dungeon spawn -> monster attack effect 순으로 고정한다.

선행조건:
- smoke/test bootstrap 대체 경로가 있어야 한다.

검증 포인트:
- production runtime이 임의 map/spec/effect fallback 없이도 정상 동작한다.

### 4. `ApplicationLocalApiFacade` catalog 경계 정리

- [x] `DungeonNeko-Godot/scripts/application/facade/ApplicationLocalApiFacade.Catalog.cs`의 `ApplicationLocalApiFacade.GetItemCatalog()`가 `DataManager.Instance?.Items` 대신 `IContentCatalogPort.GetRuntimeItems()` 결과를 사용하도록 바꿨다.
- [x] `_itemCatalogCacheHasDataManagerItems` 플래그를 제거하고 `ItemCatalogCacheSource` enum 기반 cache source 추적으로 바꿨다.
- [x] `BuildRuntimeItemCatalog(...)`, `TryResolveItemCatalogEntry(...)`, dungeon reward item 생성 경로가 어떤 fallback catalog를 쓰는지 `GetOrBuildItemCatalog(...)`와 관련 코드 주석 기준으로 문서화했다.

세부 작업:
- 런타임 catalog와 fallback static catalog의 merge 규칙을 먼저 고정한다.
- facade constructor에 port 주입을 추가할 경우, 현재 composition root 영향 범위를 함께 기록한다.

선행조건:
- `GameApp` runtime content bootstrap이 catalog port 수명주기와 맞아야 한다.

검증 포인트:
- `rg -n "DataManager\\.Instance" DungeonNeko-Godot/scripts/application/facade/ApplicationLocalApiFacade*.cs` 결과가 제거 목표 범위 안으로 축소된다.

## P2. Legacy and Navigation Cleanup

### 1. legacy cluster 제거 배치 확정

- [x] `DungeonNeko-Godot/scripts/core/AudioManager.cs`의 live reference와 project/autoload 등록 여부를 다시 확인했고, 외부 참조 0건이어서 파일과 `.uid`를 제거했다.
- [x] `DungeonNeko-Godot/scripts/core/InputManager.cs`의 live reference와 project 등록 여부를 다시 확인했고, 외부 참조 0건이어서 파일과 `.uid`를 제거했다.
- [x] `DungeonNeko-Godot/scripts/gameplay/hero/HeroController.cs`와 `DungeonNeko-Godot/scripts/map/MapManager.cs`는 동일 배치 usage audit 후 외부 참조 0건을 확인하고 함께 제거했다.
- [x] `DebugFlags`는 현재 파일/등록/참조가 모두 없음을 재확인했다.

세부 작업:
- `HeroController`/`MapManager` 제거 전에 legacy scene/prefab/resource에서 type reference가 없는지 확인한다.
- `AudioService`가 BGM/SFX 책임을 완전히 대체하는지 build/smoke로 재검증한다.

선행조건:
- live runtime이 legacy cluster를 전혀 참조하지 않는다는 증빙이 먼저 필요하다.

검증 포인트:
- live path에서 `AudioManager`, `InputManager`, `HeroController`, `MapManager`, `DebugFlags` 참조 0건.

### 2. title/menu UX와 placeholder 흔적 정리

- [x] `TitleScene.ScheduleAutoMenuTransitionAsync()`의 2프레임 뒤 자동 menu 전환은 placeholder UX로 판단하고 제거했다.
- [x] `MenuScene.RefreshMenuPresentation()`의 `Continue (New Game)`류 문구와 저장 데이터 안내 문구를 본편 UX 기준의 한국어 문구로 다시 썼다.
- [x] `MenuScene` 확인 다이얼로그 문구와 action naming을 debug/rewrite 느낌이 줄어들도록 정리했고, static scene text도 함께 한국어 production 문구로 맞췄다.

세부 작업:
- auto-transition을 유지할 경우 왜 필요한지 문서화하고, 제거할 경우 수동 진입 UX로 바꿀 대체 흐름을 기록한다.
- title/menu UX 문구 정리는 navigation canonical path 정리와 한 배치로 묶는다.

선행조건:
- scene navigation entry가 먼저 하나로 정리돼 있어야 한다.

검증 포인트:
- 본편 경로에서 placeholder/debug 성격 문구가 노출되지 않는다.

## Validation Gates

- [x] `rg -n "DebugDock" DungeonNeko-Godot/scenes/game/GameScene.tscn`
- [x] `rg -n "public .*Debug|Debug[A-Z]" DungeonNeko-Godot/scripts/app/GameScene.cs -S`
- [x] `rg -n "using Godot;" DungeonNeko-Godot/scripts/application -S`
- [x] `rg -n "SyncHudOverlayState\\(" DungeonNeko-Godot/scripts/app/game_scene/GameScene.Frame.cs -S`
- [x] `rg -n "DataRegistry\\.Instance|DataManager\\.Instance" DungeonNeko-Godot/scripts/gameplay/world/GreenfieldWorldRuntime.cs -S`
- [x] `rg -n "DataManager\\.Instance" DungeonNeko-Godot/scripts/application/facade/ApplicationLocalApiFacade*.cs -S`
- [x] `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
- [x] `DUNGEON_NEKO_GREENFIELD_PHASE6_SMOKE=1 godot --headless --path DungeonNeko-Godot --quit-after 30`
- [x] `python3 tools/pipeline/phase67_validation.py`
- [x] build warning 0건 확인

## Resolved Decisions

- [x] `GameScene`, `TitleScene`, `MenuScene`, `AudioService`, `GameApp` 주변 변경은 현재 worktree 기준으로 병합된 상태로 유지한다.
- [x] `IContentCatalogPort`는 이번 트랙에서는 단일 포트로 유지한다.
- [x] gate transition / arrival spawn / monster effect fallback은 production strict + test-only provider 정책으로 고정했다.
- [x] scene navigation 정본은 `GameApp` wrapper로 유지한다.
- [x] `DataManager`는 transitional autoload로 남기되, live runtime/application 경로에서는 port 뒤로 숨기는 방향으로 고정했다.
