# DungeonNeko GameScene Follow-up Refactor Context

Last Updated: 2026-03-11

## Why This Track Exists

- 기존 `godot-refactor` 트랙은 완료됐다.
- 남은 가장 큰 hotspot은 `GameScene` 본체의 application orchestration 잔여분이다.
- 특히 `NPC/dialogue`, `economy mutation/query`, `player snapshot / hud refresh sequencing`이 HUD, quest tracker, mine manager flow, panel open sequencing과 섞여 있다.

## Current Baseline

- `GameScene`는 현재 약 5.2k LOC다.
- HUD binding/query/snapshot/cache, quickslot persistence, dungeon/reward flow는 이미 분리됐다.
- economy mutation/query helper와 player snapshot/hud refresh partial도 이미 분리됐다.
- `GameScene._Ready()` / `_Process()` shell 분리도 이미 끝났다.
- 이번 세션 기준 반영 상태는 `NPC/dialogue`, `economy`, `player state` 1차 절개와 sequencing helper 정리까지 완료다.
- 현재 단계에서는 `NPC/dialogue`, `economy`, `player state` partial 경계를 follow-up 정본으로 유지하고, 추가 service 승격은 후속 요구가 생길 때만 검토한다.

## Current Npc Dialogue Cluster

- 새 경계 파일은 `DungeonNeko-Godot/scripts/app/game_scene/GameScene.NpcDialogue.cs`다.
- interaction entry
  - `TryHandleNpcInteractionHotkey()`
  - `UpdateNearestNpcInteractionHint()`
  - `TryResolveNearestNpc()`
- dialogue open/close
  - `BeginNpcDialogue()`
  - `ResetNpcDialogueState()`
  - `BuildNpcDialogueChoices()`
- dialogue action
  - `ExecuteNpcDialogueChoice()`
  - `TrySelectDefaultDialogueChoice()`
  - `HandleHudDialogueChoiceSelected()`
- 새 helper
  - `ResolveNpcDialogueScript()`
  - `ResolveNpcDialogueText()`
  - `ResolveNpcDialogueEndAction()`
  - `ApplyNpcDialogueQuestUpdate()`
  - `ExecuteNpcDialogueConfirmAction()`
  - `OpenNpcDialoguePanel()`
  - `FinalizeNpcDialoguePanelOpen()`
  - `ClearActiveNpcShopContext()`
  - `UpdateMineManagerDialogueSummary()`
- 현재 `GameScene.cs` 본체에는 direct definition이 아니라 shell 호출만 남는다.

## Current Economy Cluster

- 새 경계 파일은 `DungeonNeko-Godot/scripts/app/game_scene/GameScene.Economy.cs`다.
- 이동 완료된 mutation handler
  - `HandleHudEquipRequested()`
  - `HandleHudUnequipRequested()`
  - `HandleHudSellRequested()`
  - `HandleHudSellWithCountRequested()`
  - `HandleHudStoreWarehouseRequested()`
  - `HandleHudStoreWarehouseWithCountRequested()`
  - `HandleHudLoadWarehouseRequested()`
  - `HandleHudLoadWarehouseWithCountRequested()`
  - `HandleHudExpandWarehouseRequested()`
  - `HandleHudBuyFixedItemRequested()`
  - `HandleHudNpcShopPurchaseRequested()`
  - `HandleHudBuyRandomEquipmentRequested()`
  - `HandleHudBuyRandomMaterialRequested()`
  - `HandleHudBuyPotionRequested()`
  - `HandleHudBuyExperienceRequested()`
  - `HandleHudRerollRequested()`
  - `HandleHudCraftRequested()`
  - `HandleHudBlacksmithUpgradeRequested()`
  - `HandleHudBlacksmithSocketUpgradeRequested()`
  - `HandleHudBlacksmithMixRequested()`
- 이동 완료된 mutation helper
  - `ExecuteHudMutationAsync()`
  - `ExecuteEconomySessionMutationAsync()`
  - `BuildHudMutationMessage()`
  - `RefreshAfterSuccessfulMutationAsync()`를 player state 경계와 연결해 mutation 이후 sequencing을 한곳에서 사용하도록 정리했다.
- 이동 완료된 economy/query helper
  - `LoadEconomySessionAsync()`
  - `ApplyLocalEconomyPanelSnapshots()`
  - `BuildHudShopItemEntries()`
  - `TrySelectSessionInventoryItemBySnapshotId()`
  - `TrySelectSessionMaterialItemBySnapshotId()`
  - `TryResolveInventorySlotFromSnapshotId()`
- 현재 `GameScene.cs` 본체에는 economy mutation/query definition이 아니라 shell 호출만 남는다.

## Current Player State Cluster

- 새 경계 파일은 `DungeonNeko-Godot/scripts/app/game_scene/GameScene.PlayerState.cs`다.
- 이동 완료된 player snapshot / hud refresh helper
  - `RefreshPlayerSnapshotAsync()`
  - `ApplyPlayerSnapshot()`
  - `BuildHeroCombatState()`
  - `RefreshAfterSuccessfulMutationAsync()`
  - `RefreshHudDataAsync()`
  - `RefreshQuickSlotStateAsync()`
  - `RefreshHudDataDeferredAsync()`
  - `ApplyQuickSlotState()`
- 현재 남은 관심사는 panel/application coordinator를 더 service 단위로 올릴지 여부다.

## Session Goal

- 이번 세션 목표였던 `NPC/dialogue` 1차 절개는 완료됐다.
- 이어서 `economy`와 `player state` 1차 절개도 완료됐다.
- 기준은 “메서드 이동”보다 “scene 본체에서 orchestration 응집도를 높이는 것”이었고, 현재 `NPC/dialogue`, `economy`, `player state`, `mutation sequencing` 모두 그 기준을 충족한다.
- 이번 follow-up 배치는 현재 partial 경계를 정본으로 삼는 결정까지 포함해 닫았다.

## Validation Baseline

- 최근 `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`는 warning/error 0이다.
- 기존 리팩토링 gate는 [phase67_validation.py](/Users/ethan/Workspace/dev/DungeonNeko/tools/pipeline/phase67_validation.py)로 통과한 상태다.
- 이번 트랙의 현재 검증 기준은 build 유지와 `GameScene.cs`에서 `NPC/dialogue` / `economy` / `player state` 메서드 정의가 사라졌는지 확인하는 것이다.
