# Godot Top Menu Parity Plan

Last Updated: 2026-03-11

## 목표

네코웹 `GameOverlay.tsx` 상단 메뉴를 Godot HUD에 1차 구조가 아니라 실제 플레이 기준으로 포팅한다.

## 범위

1. 웹 상단 메뉴 레이아웃과 버튼군을 Godot `HudController`에 재현한다.
2. `BGM`, `SFX`, `팝업`, `시야`, `탐색`, `전투모드`, `안티`, `가이드 라벨`을 동일한 순서와 상태 표현으로 노출한다.
3. `GameScene`과 runtime에 필요한 상태/토글/자동화 로직을 추가한다.
4. 현재 남아 있는 `빠른 메뉴`형 상단 카드와 panel shortcut 버튼은 웹 parity 기준으로 제거한다.

## 구현 원칙

- 웹 소스 기준 파일:
  - `dungeon-neko-web/src/components/GameOverlay.tsx`
  - `dungeon-neko-web/src/game/ui/types.ts`
  - `dungeon-neko-web/src/game/scenes/MainScene.ts`
- top menu는 `quick menu`가 아니라 `web parity shell`로 취급한다.
- 던전 보상 팝업 수동 닫힘 규칙은 유지한다.
- `popup mode`는 reward popup이 아니라 일반 notice/popup 정책으로 유지한다.
- `auto explore`는 mystery dungeon 기준 `sacred stone -> down gate` 자동 경로로 구현한다.
- `auto attack`은 `수동전투` / `근접대응` 2상태 순환으로 구현한다.
- `sprite render mode`는 월드 필터가 아니라 런타임 스프라이트 합성 품질로 해석한다.

## 작업 축

### P0 UI Shell

- `HudController` 상단 카드 전체 재작성
- 버튼 색상/텍스트/순서/가이드 라벨 복제
- 반응형 폭/높이 재조정

### P1 State Surface

- `GameUiSnapshot`에 top menu 상태 추가
- `GameUiBinder`/`GameUiBindingContext` 확장
- `GameScene` top menu handler 추가

### P2 Runtime Actions

- popup mode cycle
- vision fog overlay
- auto explore pathfinding
- auto attack toggle
- sprite render mode toggle
- top menu local settings persistence

### P3 Verification

- `dotnet build`
- 입력/토글 smoke
- mystery dungeon 자동 탐색/공격 수동 확인

## 수용 기준

- 상단 우측 메뉴가 네코웹과 같은 항목 순서로 나온다.
- 각 버튼의 ON/OFF/모드 텍스트가 웹과 같은 의미로 변한다.
- `탐색`, `전투모드`, `시야`, `안티`가 실제 화면/플레이에 반응한다.
- 기존 quick menu 버튼 묶음이 제거된다.
