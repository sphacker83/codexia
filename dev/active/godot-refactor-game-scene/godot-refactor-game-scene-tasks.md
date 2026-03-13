# DungeonNeko GameScene Follow-up Refactor Tasks

Last Updated: 2026-03-11

## Verified Baseline

- [x] 기존 `godot-refactor` 트랙은 완료됐다.
- [x] `GameScene`의 HUD/dungeon/bootstrap 분리는 이미 끝났다.
- [x] 이번 follow-up 트랙의 첫 우선순위는 `NPC/dialogue` 1차 분리다.

## P0. Npc Dialogue Orchestration Split

### 1. interaction entry와 nearest NPC 해석 절개

- [x] `DungeonNeko-Godot/scripts/app/GameScene.cs`의 `TryHandleNpcInteractionHotkey()`를 새 `NPC/dialogue` 경계로 이동했다.
- [x] 같은 파일의 `UpdateNearestNpcInteractionHint()`와 `TryResolveNearestNpc()`를 같은 경계로 이동했다.
- [x] `_nearestNpc`, `_npcDialogueOpen`, `_hud`, `_worldRuntime` 의존이 `GameScene.NpcDialogue.cs` 메서드 군집 안에서 주로 보이도록 정리했다.

세부 작업:
- `ui_ok` 입력과 overlay blocking 전제 조건을 한 메서드 군집에서 읽히게 정리한다.
- interaction hint 문자열 설정 책임을 dialogue 경계 안으로 유지한다.

검증 포인트:
- `GameScene.cs` 본체에서 interaction entry / nearest NPC helper가 빠진다.

### 2. dialogue open/close 상태 절개

- [x] `BeginNpcDialogue()`를 새 `NPC/dialogue` 경계로 이동했다.
- [x] `ResetNpcDialogueState(bool)`를 같은 경계로 이동했다.
- [x] `BuildNpcDialogueChoices(...)`를 같은 경계로 이동했다.

세부 작업:
- `_activeNpcDialogueNpcId`, `_activeNpcDialogueScriptNum`, `_activeNpcDialogueEndAction`, `_activeNpcDialogueShopListNum` 업데이트 경로를 한 파일에 모은다.
- quest override, mine manager special-case, HUD dialogue open 호출이 같은 흐름 안에서 읽히도록 정리한다.

검증 포인트:
- `GameScene.cs` 본체에서 dialogue state open/close helper가 빠진다.

### 3. dialogue choice 실행 절개

- [x] `ExecuteNpcDialogueChoice(string)`를 새 `NPC/dialogue` 경계로 이동했다.
- [x] `TrySelectDefaultDialogueChoice()`를 같은 경계로 이동했다.
- [x] `HandleHudDialogueChoiceSelected(string)`를 같은 경계로 이동했다.

세부 작업:
- `DialogueChoiceConfirm` 분기에서 `shop/warehouse/blacksmith/quests` panel open 흐름을 `ExecuteNpcDialogueConfirmAction()` / `OpenNpcDialoguePanel()` helper로 더 잘게 나눴다.
- `TrackNpcDialogueForQuests(...)`, `ApplyQuestDialogueUpdateAsync(...)`, `_activeShop*` state update를 `ApplyNpcDialogueQuestUpdate()` / `ClearActiveNpcShopContext()` 경계 안에서 응집시켰다.
- mine manager flow summary 갱신도 `UpdateMineManagerDialogueSummary()`에서 끝나게 정리했다.

검증 포인트:
- `GameScene.cs` 본체에서 dialogue choice 실행 helper가 빠진다.

### 4. back/confirm 입력과의 접점 유지

- [x] `HandleOverlayBackOrDialogueConfirm()`는 dialogue confirm/back 시 새 dialogue 경계 호출만 남도록 맞췄다.
- [x] `TryHandleHotkeys()`는 NPC interaction hotkey를 새 경계로 위임한다.

세부 작업:
- `_npcDialogueOpen`을 직접 읽는 위치를 줄이고, dialogue 경계 호출 중심으로 정리한다.

검증 포인트:
- `HandleOverlayBackOrDialogueConfirm()`는 shell 역할만 유지한다.

## P1. Economy Orchestration Split

### 1. HUD economy mutation 군집 절개 준비

- [x] `HandleHudEquipRequested()`부터 `HandleHudBlacksmithMixRequested()`까지의 mutation 군을 `GameScene.Economy.cs` partial 경계로 이동했다.
- [x] `shop/warehouse/blacksmith/craft` 군을 같은 economy mutation 경계로 묶었고, `ExecuteHudMutationAsync(...)` / `ExecuteEconomySessionMutationAsync(...)` / `BuildHudMutationMessage(...)`를 함께 이관했다.
- [x] `LoadEconomySessionAsync()`, `ApplyLocalEconomyPanelSnapshots()`, `BuildHudShopItemEntries()`, `TrySelectSessionInventoryItemBySnapshotId()`, `TrySelectSessionMaterialItemBySnapshotId()`, `TryResolveInventorySlotFromSnapshotId()`를 같은 economy 경계로 이동했다.

세부 작업:
- mutation/query helper가 같은 partial 안에서 읽히도록 정리했다.

## P2. Player Snapshot / Mutation Surface

### 1. player snapshot / hud refresh partial 절개

- [x] `RefreshPlayerSnapshotAsync()`, `ApplyPlayerSnapshot()`, `RefreshHudDataAsync()`를 `GameScene.PlayerState.cs`로 이동했다.
- [x] `BuildHeroCombatState()`, `RefreshQuickSlotStateAsync()`, `RefreshHudDataDeferredAsync()`, `ApplyQuickSlotState()`를 같은 partial로 함께 이동했다.
- [x] `RefreshAfterSuccessfulMutationAsync(bool rebuildHeroState, bool refreshQuickSlots = true)`를 도입해 mutation 이후 refresh/application sequencing을 `GameScene.PlayerState.cs`에 모았다.
- [x] `GameScene.NpcDialogue.cs`의 panel open 뒤 refresh/sync 분기는 `FinalizeNpcDialoguePanelOpen(bool requiresHudRefresh)` helper로 정리했다.
- [x] panel/application coordinator는 현재 단계에서는 별도 service로 올리지 않고, `GameScene.NpcDialogue.cs` / `GameScene.Economy.cs` / `GameScene.PlayerState.cs` partial 경계를 정본으로 유지하기로 결정했다.

세부 작업:
- `GameScene.Economy.cs`와 `GameScene.PlayerState.cs` 사이의 direct sequencing은 helper 경계 기준으로 정리됐다.

## Validation

- [x] `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
- [x] `rg -n "private .*TryHandleNpcInteractionHotkey|private .*BeginNpcDialogue|private .*ExecuteNpcDialogueChoice|private .*TrySelectDefaultDialogueChoice|private .*ResetNpcDialogueState|private .*BuildNpcDialogueChoices|private .*HandleHudDialogueChoiceSelected|private .*UpdateNearestNpcInteractionHint|private .*TryResolveNearestNpc" DungeonNeko-Godot/scripts/app/GameScene.cs -S`
- [x] `rg -n "TryHandleNpcInteractionHotkey|BeginNpcDialogue|ExecuteNpcDialogueChoice|TrySelectDefaultDialogueChoice|ResetNpcDialogueState|BuildNpcDialogueChoices|HandleHudDialogueChoiceSelected|UpdateNearestNpcInteractionHint|TryResolveNearestNpc" DungeonNeko-Godot/scripts/app/game_scene/GameScene.NpcDialogue.cs -S`
- [x] `rg -n "private .*HandleHudEquipRequested|private .*HandleHudUnequipRequested|private .*HandleHudSellRequested|private .*HandleHudStoreWarehouseRequested|private .*HandleHudLoadWarehouseRequested|private .*HandleHudBuyFixedItemRequested|private .*HandleHudNpcShopPurchaseRequested|private .*HandleHudCraftRequested|private .*HandleHudBlacksmithUpgradeRequested|private .*ExecuteHudMutationAsync|private .*ExecuteEconomySessionMutationAsync|private .*BuildHudMutationMessage" DungeonNeko-Godot/scripts/app/GameScene.cs -S`
- [x] `rg -n "HandleHudEquipRequested|HandleHudUnequipRequested|HandleHudSellRequested|HandleHudStoreWarehouseRequested|HandleHudLoadWarehouseRequested|HandleHudBuyFixedItemRequested|HandleHudNpcShopPurchaseRequested|HandleHudCraftRequested|HandleHudBlacksmithUpgradeRequested|ExecuteHudMutationAsync|ExecuteEconomySessionMutationAsync|BuildHudMutationMessage" DungeonNeko-Godot/scripts/app/game_scene/GameScene.Economy.cs -S`
- [x] `rg -n "private .*RefreshPlayerSnapshotAsync|private .*ApplyPlayerSnapshot|private .*BuildHeroCombatState|private .*RefreshAfterSuccessfulMutationAsync|private .*RefreshHudDataAsync|private .*RefreshQuickSlotStateAsync|private .*RefreshHudDataDeferredAsync|private .*ApplyQuickSlotState" DungeonNeko-Godot/scripts/app/GameScene.cs -S`
- [x] `rg -n "RefreshPlayerSnapshotAsync|ApplyPlayerSnapshot|BuildHeroCombatState|RefreshAfterSuccessfulMutationAsync|RefreshHudDataAsync|RefreshQuickSlotStateAsync|RefreshHudDataDeferredAsync|ApplyQuickSlotState" DungeonNeko-Godot/scripts/app/game_scene/GameScene.PlayerState.cs -S`
