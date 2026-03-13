# Pointer Navigation Overhaul - Context

## SESSION PROGRESS (2026-03-06)

### ✅ COMPLETED
- 현행 포인터 이동 구조 분석 완료
- 추천 알고리즘 선정 완료
- 신규 아키텍처 초안 및 구현 단계 정의 완료
- Dev Docs 3파일 생성 완료
- 포인터 이동 입력을 world-space navigator vector 경로로 확장
- `Hero.update()`가 `virtualMoveVector`를 받아 desired velocity를 만들도록 확장
- `HeroMovementController`에 `applyHeroDesiredVectorMoveWithParity()` 추가
- `UpdateLoopController`가 navigator vector 활성 시 vector parity 이동기를 사용하도록 연결
- `PointerNavigationController`가 raw tile path 외에 world corridor를 생성하고 lookahead corridor follower로 움직이도록 변경
- 신규 모듈 추가
  - `src/game/scenes/main/navigation/PathPlanner.ts`
  - `src/game/scenes/main/navigation/PathMotor.ts`

### 🟡 IN PROGRESS
- 전역 global planner는 아직 기존 tile A*를 사용 중
- `PathPlanner.ts`의 clearance-aware planner는 scaffold 상태이며, 실제 포인터 경로 계산 경로로 완전 전환되지 않음
- 디버그 오버레이/계측은 아직 미구현

## 현재 구조 요약

### 포인터 이동 파이프라인

1. `PointerNavigationController.ts`
- 타일 경로를 계산한다.
- 현재는 `pointerPathTiles`를 따라가며 `mousePathMoveInput` 4방향 불리언을 직접 만든다.

2. `UpdateLoopController.ts`
- `mousePathMoveInput`을 keyboard/touch 입력과 합친다.
- `hero.update(... virtualMove)`로 넘긴다.

3. `Hero.ts`
- `virtualMove` 불리언을 정규화된 desired velocity로 바꾼다.
- 실제 이동은 직접 하지 않는다.

4. `HeroMovementController.ts`
- `applyHeroMoveCheckParity()`에서 desired velocity를 픽셀 단위 충돌 이동으로 해석한다.
- `heroMoveCheck()`는 원본 C++ parity 기준으로 축별 이동/백오프를 수행한다.

## 왜 떨림이 생기는가

1. 포인터 추종기와 충돌기가 분리돼 있다.
- 상위는 “어느 방향키를 누를지”만 안다.
- 하위는 “실제로 얼마만큼 이동됐는지”만 안다.
- 둘 사이에 “벽을 따라 미끄러질지, 로컬 우회할지”를 결정하는 공통 상태가 없다.

2. 경로는 타일 기준, 이동은 픽셀 기준이다.
- 타일상 연결 가능과 실제 14x14 발판 통과 가능이 완전히 같지 않다.

3. 최근 패치들이 repath throttling, immediate blocked check, diagonal penalty 쪽에 쌓였다.
- 성격이 다른 문제를 상위 계층에서 계속 보정해 누적 복잡도가 높아졌다.

## 핵심 파일

**`dungeon-neko-web/src/game/scenes/main/input/PointerNavigationController.ts`**
- 포인터 경로탐색, 타깃 추적, 자동공격 연계
- 현재 교체 대상의 중심

**`dungeon-neko-web/src/game/scenes/main/movement/HeroMovementController.ts`**
- 실제 픽셀 이동과 충돌 parity 구현
- 신규 slide motor 통합 지점

**`dungeon-neko-web/src/game/entities/Hero.ts`**
- 입력을 desired velocity로 해석
- virtualMove boolean 기반 구조를 vector 기반으로 확장해야 함

**`dungeon-neko-web/src/game/scenes/main/lifecycle/UpdateLoopController.ts`**
- 입력 merge 및 update 순서 정의
- navigator update 진입점

**`dungeon-neko-web/src/game/systems/MapSystem.ts`**
- `runtimeCollisionAtb`와 `isBlockedForHeroTile()` 보유
- navigation 전용 확장 충돌맵의 원천 데이터

## 의사결정

### 채택
- `Clearance-Aware Corridor Navigation`
- 전역 계획은 grid 기반 유지
- 실제 추종은 world-space lookahead + slide로 교체

### 보류
- full navmesh 도입
- ORCA/RVO 같은 다중 에이전트 회피
- JPS 최적화

## 구현 시 주의점

1. 전투 액션 중 freeze/resume 규칙은 유지
2. 입력 기반 수동 이동은 기존 parity 유지
3. 자동공격 추적도 신규 corridor/motor 위에서만 돌려야 함
4. 맵 오브젝트 충돌은 `MapSystem`의 runtime ATB를 원천으로 삼아야 함

## Quick Resume

1. 이 문서와 plan/tasks를 읽는다.
2. `PointerNavigationController.ts`, `HeroMovementController.ts`, `UpdateLoopController.ts`를 다시 연다.
3. 먼저 디버그 오버레이와 계측부터 추가한다.
4. 그 다음 `resolveReachablePointerPath()`를 legacy tile A* 대신 `PathPlanner.planCorridorPath()`로 전환한다.
5. 마지막으로 legacy `mousePathMoveInput` 기반 흔적을 정리한다.
