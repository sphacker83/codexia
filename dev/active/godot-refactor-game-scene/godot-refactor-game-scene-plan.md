# DungeonNeko Godot GameScene Follow-up Refactor Plan

Last Updated: 2026-03-11

## Executive Summary

- 이 문서는 완료된 `godot-refactor` 후속 트랙이다.
- 목표는 `GameScene`에 남아 있는 application orchestration 책임을 추가로 분해해 scene shell에 더 가깝게 만드는 것이다.
- 이번 트랙은 `NPC/dialogue orchestration`을 먼저 절개하고, 이어서 `economy/shop/warehouse/blacksmith orchestration`, `player snapshot/application mutation surface`를 정리한다.

## Current Problem

- `GameScene`는 frame shell, HUD sync, dungeon flow는 일부 절개됐지만 여전히 application mutation과 panel open flow를 직접 소유한다.
- 특히 `NPC/dialogue -> quest turn-in -> panel open(shop/warehouse/blacksmith/quests)` 경로가 scene input, HUD, quest tracker, mine manager flow를 한 메서드 묶음에 섞고 있다.
- `HandleHud*Requested` economy mutation 군도 scene 본체에 직접 남아 있어 다음 분해 축으로 이어진다.

## Target State

- `GameScene`는 scene shell, input relay, coordinator 호출만 유지한다.
- `NPC/dialogue`는 `GameScene.NpcDialogue.cs` 같은 전용 partial/helper로 모이고, choice 실행 분기는 작은 helper 메서드로 다시 절개된다.
- `HUD -> application mutation` 호출은 장기적으로 `GameScene economy coordinator/service`로 이동한다.

## Track Scope

### P0. Npc Dialogue Slice

- `TryHandleNpcInteractionHotkey`
- `BeginNpcDialogue`
- `ExecuteNpcDialogueChoice`
- `TrySelectDefaultDialogueChoice`
- `ResetNpcDialogueState`
- `BuildNpcDialogueChoices`
- `HandleHudDialogueChoiceSelected`
- `UpdateNearestNpcInteractionHint`
- `TryResolveNearestNpc`

### P1. Economy Mutation Slice

- `HandleHudEquipRequested`
- `HandleHudUnequipRequested`
- `HandleHudSellRequested`
- `HandleHudSellWithCountRequested`
- `HandleHudStoreWarehouseRequested`
- `HandleHudStoreWarehouseWithCountRequested`
- `HandleHudLoadWarehouseRequested`
- `HandleHudLoadWarehouseWithCountRequested`
- `HandleHudExpandWarehouseRequested`
- `HandleHudBuyFixedItemRequested`
- `HandleHudNpcShopPurchaseRequested`
- `HandleHudBuyRandomEquipmentRequested`
- `HandleHudBuyRandomMaterialRequested`
- `HandleHudBuyPotionRequested`
- `HandleHudBuyExperienceRequested`
- `HandleHudRerollRequested`
- `HandleHudCraftRequested`
- `HandleHudBlacksmithUpgradeRequested`
- `HandleHudBlacksmithSocketUpgradeRequested`
- `HandleHudBlacksmithMixRequested`

### P2. Player Snapshot / Mutation Surface

- `ExecuteHudMutationAsync`
- `ApplyPlayerSnapshot`
- `RefreshPlayerSnapshotAsync`
- `RefreshHudDataAsync` 호출 후속 orchestration 정리
- panel-open 이후 snapshot/hud refresh sequencing 정리

## First Session Goal

- 이번 세션은 `NPC/dialogue` 묶음을 `GameScene.cs` 본체 밖으로 분리한다.
- `HandleOverlayBackOrDialogueConfirm()`와 `TryHandleHotkeys()`는 새 dialogue 경계를 호출하도록 유지한다.
- `shop/warehouse/blacksmith/quests` panel open 분기는 `ExecuteNpcDialogueChoice()` 내부에서 별도 helper 메서드로 먼저 절개한다.

## Validation

- `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
- `rg -n "TryHandleNpcInteractionHotkey|BeginNpcDialogue|ExecuteNpcDialogueChoice|TrySelectDefaultDialogueChoice|ResetNpcDialogueState|BuildNpcDialogueChoices|HandleHudDialogueChoiceSelected|UpdateNearestNpcInteractionHint|TryResolveNearestNpc" DungeonNeko-Godot/scripts/app/GameScene.cs`
- `rg -n "TryHandleNpcInteractionHotkey|BeginNpcDialogue|ExecuteNpcDialogueChoice|TrySelectDefaultDialogueChoice|ResetNpcDialogueState|BuildNpcDialogueChoices|HandleHudDialogueChoiceSelected|UpdateNearestNpcInteractionHint|TryResolveNearestNpc" DungeonNeko-Godot/scripts/app/game_scene -S`
