# DungeonNeko Godot UI Manager Refactor Context

Last Updated: 2026-03-11

## Why This Track Exists

- 현재 UI는 `HudController`와 `CharacterInventoryOverlay`가 나뉘어 있고, `GameScene`도 둘을 별도로 wiring/hotkey/blocking 처리한다.
- 사용자가 UI 전체를 관리하는 manager 하나와 전면적인 `GameUi*` 네이밍 재작성 방향을 요구했다.

## Baseline

- `HudController`는 HUD/popup/dialogue/reward를 들고 있다.
- `CharacterInventoryOverlay`는 O 패널 전용 overlay다.
- `MiniMapOverlay`는 이미 `Control` 기반이라 manager 자식 panel로 흡수 가능하다.
- `DungeonRewardPopupView`는 이미 `PanelContainer` 기반이라 manager 자식 panel로 흡수 가능하다.

## Current State

- live UI anchor는 `GameUiManager` 하나로 정리됐다.
- `GameUiCharacterPanel`, `GameUiMiniMapPanel`, `GameUiRewardPanel`은 모두 manager 자식 panel 경로로 흡수됐다.
- `GameUiSyncCoordinator`는 manager 하나만 bind/apply 한다.
- 공통 DTO는 `scripts/ui/common/GameUiModels.cs`로 이동했다.
- `GameScene`의 O panel 전용 hotkey path와 dual overlay blocking path는 제거됐다.
- `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`는 warning/error 0이다.
- `python3 tools/pipeline/phase67_validation.py`는 sandbox 밖 재실행 기준 all checks passed 상태다.

## Working Rules

- UI scale 규칙(`UiMetricScale = 2.0`)과 외곽 컨테이너 크기 유지 규칙은 바꾸지 않는다.
- `ApplicationLocalApiFacade`, `GreenfieldWorldRuntime`는 compile-through rename 외 구조 변경하지 않는다.
