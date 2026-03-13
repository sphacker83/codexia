# Godot Top Menu Parity Tasks

Last Updated: 2026-03-11

## P0 UI Shell

- [x] `HudController` 상단 카드 구조를 웹 top menu 셸로 교체
- [x] 기존 `지도`/panel shortcut 버튼 제거
- [x] `안티얼레이싱 ON/OFF` 토글 추가
- [x] 우측 가이드를 실제 `인벤토리` 버튼으로 교체

## P1 State Surface

- [x] `GameUiSnapshot` top menu state 추가
- [x] `GameUiBinder` top menu apply/cache 추가
- [x] `GameUiBindingContext` handler surface 추가
- [x] `GameScene` top menu state/handler 추가

## P2 Runtime Actions

- [x] `popup mode` cycle 구현
- [x] `vision fog` overlay 구현
- [x] `auto explore` pathfinding/input 합성 구현
- [x] `auto attack` 2상태 toggle 구현 (`수동전투` / `근접대응`)
- [x] `sprite render mode`를 runtime sprite composition quality toggle로 교정
- [x] top menu 전역 로컬 설정 저장 구현

## P3 Verification

- [x] `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
- [ ] top menu visual/interaction smoke
- [ ] mystery dungeon `탐색` / `전투모드` 동작 확인
