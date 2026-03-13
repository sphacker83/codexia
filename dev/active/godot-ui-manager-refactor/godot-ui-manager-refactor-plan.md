# DungeonNeko Godot UI Manager Refactor Plan

Last Updated: 2026-03-11

## Summary

- 기존 `HudController` + `CharacterInventoryOverlay` 이중 anchor를 제거하고 `GameUiManager` 단일 anchor로 재편한다.
- `ui_diablo_inventory`(O 패널)는 별도 overlay가 아니라 `GameUiManager` 내부의 `Character` route로 흡수한다.
- UI 파일/타입 네이밍은 live 경로에서 `GameUi*`로 통일한다.

## Target State

- `GameScene`은 `_gameUiManager` 하나만 소유한다.
- manager는 character/minimap/reward/dialogue/popup/hud subview를 자식 control로 소유한다.
- `GameUiSyncCoordinator`는 manager 하나만 bind/apply 한다.
- `GameUiSnapshot`과 관련 DTO는 `GameUi*` 명명으로 정리한다.

## Validation

- `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
- `python3 tools/pipeline/phase67_validation.py`
- `rg -n "HudController|CharacterInventoryOverlay|HandleCharacterInventoryOverlayHotkey" DungeonNeko-Godot/scripts/app DungeonNeko-Godot/scripts/ui -S`
