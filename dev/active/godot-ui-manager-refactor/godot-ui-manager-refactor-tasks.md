# DungeonNeko Godot UI Manager Refactor Tasks

Last Updated: 2026-03-11

## P0. Anchor Unification

- [x] `HudController` -> `GameUiManager` rename
- [x] `CharacterInventoryOverlay` -> `GameUiCharacterPanel` rename
- [x] `GameScene`이 `_gameUiManager` 하나만 유지하도록 wiring 변경

## P1. UI Subview Renames

- [x] `MiniMapOverlay` -> `GameUiMiniMapPanel`
- [x] `DungeonRewardPopupView` -> `GameUiRewardPanel`
- [x] `HudTopBarControls`/top bar partial의 `GameUi*` rename

## P2. Type / Sync Rename

- [x] HUD/character DTO를 `GameUi*` 명명으로 이동
- [x] `GameUiBinder` -> `GameUiSyncCoordinator`
- [x] `GameUiBindingContext` -> `GameUiCommandContext`

## Validation

- [x] `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
- [x] `python3 tools/pipeline/phase67_validation.py`
