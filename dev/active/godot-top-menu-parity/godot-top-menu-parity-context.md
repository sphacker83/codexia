# Godot Top Menu Parity Context

Last Updated: 2026-03-11

## 배경

- 웹 구현은 `GameOverlay.tsx`에 상단 메뉴 셸이 이미 완성되어 있다.
- 현재 Godot `HudController.BuildAudioCard()`는
  - `BGM`
  - `SFX`
  - `지도`
  - `가방/장비/스킬/퀘스트/상점/창고/제작`
  구조라서 웹 top menu와 다르다.
- 메인 `godot-porting` 문서에는 예전에 `상단 UI parity`가 닫힌 것으로 남아 있지만, 실제 구현 기준으로는 reopened 상태다.

## 웹 기준 상태

- `AudioUiState`
  - `bgmEnabled`
  - `sfxEnabled`
- `AutomationUiState`
  - `autoExploreEnabled`
  - `autoAttackEnabled`
  - `popupMode`
  - `visionFogEnabled`
- `DisplayUiState`
  - `spriteRenderMode`

## Godot 현재 상태

- 이미 있음
  - `BGM mute`
  - `SFX mute`
  - `popup mode`
  - `vision fog`
  - `auto explore`
  - `auto attack toggle`
  - `sprite render mode`
  - 전역 로컬 저장 복원

## 구현 메모

- auto explore는 `GreenfieldRuntimeInputSnapshot` 합성으로 붙인다.
- pathfinding은 `MapSpecResource` + `DungeonMapRenderer2D.IsTileBlocked(...)` + runtime entity 점유 상태를 기준으로 BFS를 사용한다.
- vision fog는 world 위에 full-screen overlay를 두고 hero screen position을 기준으로 구멍을 뚫는 shader로 처리한다.
- render mode는 월드 전체 필터가 아니라 `DungeonSprite2D` 런타임 합성 결과의 `RGB565 legacy` / `원본 RGB high-quality` 차이로 해석한다.
- `display HQ`는 웹 대비 의미 오해로 들어온 divergence라 제거한다.

## 현재 상태

- `HudController.BuildAudioCard()`는 더 이상 quick menu가 아니라 웹 top menu shell을 그린다.
- `BGM`, `SFX`, `팝업`, `시야`, `탐색`, `전투모드`, `안티`, `인벤토리`가 같은 순서로 배치된다.
- `GameUiSnapshot` / `GameUiBinder` / `GameUiBindingContext`는 `GameUiTopMenuState`와 새 handler surface를 포함한다.
- `GameScene`은
  - popup mode notice 정책
  - vision fog shader overlay
  - mystery dungeon auto explore input 합성
  - `수동전투` / `근접대응` 2상태 전투 토글
  - runtime sprite render mode sync
  - `인벤토리` 버튼은 generic inventory popup이 아니라 `ToggleCharacterPanel()` 경로를 호출
  - top menu 전역 로컬 저장 복원
  를 실제 동작으로 가진다.
- mystery dungeon reward popup은 이전 사용자 지시에 맞춰 여전히 수동 닫힘이다.

## 검증

- `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
  - 경고 0 / 오류 0
- `godot --headless --path DungeonNeko-Godot --quit-after 5`
  - 권한 상승 재실행 기준 title scene 정상 로드 확인

## 구현 메모 추가

- `auto explore`
  - `GreenfieldWorldRuntime.TryBuildHeroPathToTile(...)`를 사용해 sacred stone / down gate로 이동한다.
- `auto attack`
  - `근접대응`일 때 사거리 안 타깃만 자동 공격한다.
  - 자동 추적/자동 접근은 제거한다.
- `vision fog`
  - full-screen `ColorRect` + shader uniform `hero_uv`로 구현
- `sprite render mode`
  - `DungeonSprite2D.CompositeImage()`의 RGB565 legacy 양자화 여부로 구현
  - `고품질`일 때는 runtime sprite clip/effect/composed node와 ground tile layer만 `Linear`, minimap과 map object sprite는 계속 `Nearest`
  - 상단 UI에는 `프리뷰 레거시/고품질` 대신 `안티 ON/OFF` 단일 토글 버튼으로 노출하고, 실제 버튼 폭은 `BGM` 기준으로 통일한다.
  - 다만 `DgsPltAlpha`와 raw-source screen/dodge 계열 effect는 outline 방지를 위해 안티 ON이어도 `Nearest` fallback을 유지한다.

## 남은 확인

- 실제 픽셀/여백/색상 parity의 수동 시각 확인
- mystery dungeon에서 `탐색` / `근접대응` 체감 확인
