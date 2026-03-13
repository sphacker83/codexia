# Pointer Navigation Overhaul - Plan

## Executive Summary

현재 웹 포인터 이동은 `타일 A* -> step 타일 -> 가상 방향키 4개 -> Hero.update() -> 픽셀 충돌 이동` 구조다.  
문제는 경로탐색 자체보다, 경로 추종기가 충돌 해석과 분리되어 있어 오브젝트 모서리/좁은 통로에서 좌우 떨림, 무한 재시도, 과도한 재탐색이 발생한다는 점이다.

권장안은 기존 추종기를 버리고, `클리어런스 기반 경로계획 + 월드 좌표 코리도 추종 + slide 이동 모터`로 교체하는 것이다.

## 추천 알고리즘

### 이름

`Clearance-Aware Corridor Navigation`

### 구성

1. `Expanded Collision Grid`
- 기존 타일 충돌맵을 그대로 쓰지 않고, 히어로 발판(14x14)을 기준으로 장애물을 확장한 네비게이션 전용 충돌맵을 만든다.
- 경로가 “타일상 가능”이 아니라 “실제 히어로 중심이 통과 가능한 중심점”만 지나가도록 보장한다.

2. `Global Path Planner`
- 전역 경로는 8방향 `A*`를 유지하되, 네비게이션 전용 확장 충돌맵에서만 계산한다.
- 성능이 필요하면 이후 `JPS`로 교체 가능하지만, 120x120 수준에서는 우선순위가 아니다.

3. `Corridor + String Pulling`
- 타일 경로를 그대로 따라가지 않고, line-of-sight 기반으로 waypoint를 줄여 월드 좌표 코리도를 만든다.
- 짧은 대각 반복 억제는 비용 꼼수가 아니라, 코리도 평활화 결과로 자연스럽게 해결한다.

4. `Steering Follower`
- 매 프레임 방향키 on/off를 만들지 않는다.
- 현재 위치에서 lookahead waypoint를 향한 “원하는 이동 벡터”를 계산한다.
- waypoint 도달 판정은 중심 타일 정렬이 아니라 거리 기반 radius + line-of-sight 갱신으로 처리한다.

5. `Sweep-and-Slide Motion`
- 이동 모터는 원하는 벡터를 그대로 넣고, 충돌 시 `full move -> X/Y 분해 -> 벽 따라 slide` 순서로 해석한다.
- 오브젝트 모서리에 닿았을 때 좌우 토글이 아니라 벽면 방향으로 진행한다.

6. `Stuck Recovery + Micro Replan`
- 즉시 재탐색 남발 대신, “실제 전진 거리 0 + slide도 실패”가 일정 시간 지속될 때만 로컬 재계획한다.
- 전역 목표는 유지하고, 현재 위치에서 코리도 다음 anchor까지 짧은 재탐색만 수행한다.

## 왜 이 방식이 맞는가

### 현재 방식의 구조적 한계

- 경로는 타일 기준, 충돌은 픽셀 기준이라 둘 사이 불일치가 남는다.
- 포인터 추종기가 실제 충돌 결과를 모르고 방향키만 토글한다.
- Hero 이동기는 입력 벡터를 정상 처리해도, 상위 추종기가 매 프레임 반대축 입력을 다시 만들면 떨림이 생긴다.
- 오브젝트 끼임은 “경로 재탐색 빈도”보다 “추종기와 충돌기의 분리” 문제다.

### 대안 비교

- `NavMesh + Funnel`
  - 장점: 가장 정석적이다.
  - 단점: 현재 타일/ATB 기반 맵 파이프라인과 괴리가 크고 구현량이 크다.
- `Flow Field`
  - 장점: 다수 유닛에는 좋다.
  - 단점: 단일 히어로 포인터 이동에는 과하다.
- `RVO/ORCA`
  - 장점: 동적 장애물 회피에 좋다.
  - 단점: 지금의 정적 오브젝트 끼임 문제를 직접 해결하지 못한다.

현재 프로젝트에는 `확장 충돌 그리드 + 코리도 추종 + slide 모터`가 구현 난이도 대비 효과가 가장 크다.

## 목표 상태

- 포인터 이동이 더 이상 가상 방향키 토글 중심이 아니라, 월드 좌표 목표 추종 중심으로 동작한다.
- 오브젝트 모서리에 닿아도 좌우 떨림 없이 slide 또는 짧은 로컬 우회가 발생한다.
- 자동전투 추적 중에도 목표가 조금 움직였다고 매번 전역 A*를 다시 계산하지 않는다.
- 전투 액션 중 정지/재개 규칙은 유지한다.

## 아키텍처 변경안

### 신규 모듈

1. `NavigationCollisionService`
- 위치: `src/game/scenes/main/navigation/`
- 책임:
  - 네비게이션용 확장 충돌맵 생성/캐시
  - 월드 좌표 line-of-sight 검사
  - world center -> navigation cell 변환

2. `PathPlanner`
- 책임:
  - start/goal 기반 전역 경로 계산
  - fallback reachable goal 탐색
  - string pulling 기반 corridor 생성

3. `PathMotor`
- 책임:
  - corridor lookahead 추종
  - desired move vector 계산
  - stuck/sliding/micro-replan 상태 관리

### 기존 모듈 변경

1. `PointerNavigationController.ts`
- 포인터 타깃/NPC/몬스터/자동공격 상태머신만 담당
- 더 이상 `mousePathMoveInput`을 직접 토글하지 않음
- 대신 `PathMotor`에 goal/corridor를 공급

2. `HeroMovementController.ts`
- `applyHeroMoveCheckParity()`와 별개로 `applyNavigatorMoveWithSlide()` 추가
- 입력 기반 이동과 포인터 이동 모드를 분리

3. `Hero.ts`
- `virtualMove` 불리언 외에 `virtualMoveVector` 또는 navigator vector 입력을 받을 수 있게 확장
- 방향 갱신은 벡터 기반, 애니메이션 시퀀스는 기존 4방향 유지

4. `UpdateLoopController.ts`
- 포인터 이동 시 `updatePointerTargetFollow()` + `PathMotor.update()`
- keyboard/touch 입력이 들어오면 navigator state clear

## 구현 단계

### Phase 0. 계측/기준선 고정
- 현재 재현 케이스 3종 고정
  - 오브젝트 모서리 스침
  - 좁은 통로 진입
  - 자동전투 추격 중 장애물 우회
- 디버그 오버레이 추가
  - current goal
  - corridor waypoint
  - lookahead point
  - last progress delta
- Acceptance:
  - 떨림 케이스를 로그와 화면에서 반복 재현 가능

### Phase 1. 네비게이션 충돌맵 분리
- hero footprint 기준으로 타일을 확장한 navigation occupancy 생성
- `MapSystem.isBlockedForHeroTile()`와 별도로 navigation용 walkability API 추가
- Acceptance:
  - navigation grid 상 “통과 가능” 셀은 hero 중심이 실제로 설 수 있음

### Phase 2. 전역 경로 + corridor 생성기
- `PathPlanner` 신규 구현
- A* 결과를 string pulling으로 월드 좌표 waypoint로 단순화
- 경로 재계산 조건을 명시적 이벤트 기반으로 축소
- Acceptance:
  - 열린 공간에서 불필요한 지그재그가 사라짐
  - 장애물 우회 경로가 waypoint 몇 개만 남는지 디버그 가능

### Phase 3. PathMotor + slide 이동기
- lookahead 추종
- full vector 충돌 시 slide
- slide 실패 시 짧은 micro-replan
- Acceptance:
  - 오브젝트 모서리 접촉 시 좌우 떨림 없이 벽 따라 이동하거나 재우회

### Phase 4. 자동전투/추격 통합
- 몬스터 추적은 “목표 타일”이 아니라 “목표 근접 반경” 기준으로 corridor 유지
- 전투 액션 중 motor freeze, 종료 후 resume
- Acceptance:
  - 추격 중 목표가 미세 이동해도 전역 replanning 폭주 없음

### Phase 5. 구 로직 제거
- `mousePathMoveInput` 기반 포인터 추종 삭제
- 임시 stuck/repath 패치 제거
- Acceptance:
  - 포인터 이동 관련 상태가 신규 motor 중심으로 일원화

## 리스크

1. 기존 전투 프레임 이동과 충돌할 수 있다.
- 대응: 일반 포인터 이동만 신규 motor를 거치고, 스킬/런지 이동은 기존 parity 유지

2. line-of-sight 비용이 커질 수 있다.
- 대응: 맵 캐시 + Bresenham/DDA 기반 셀 검사 + corridor 생성 시에만 사용

3. 4방향 애니메이션과 실제 이동 벡터가 어색할 수 있다.
- 대응: 렌더 방향은 dominant axis 기준으로 snap

## 성공 지표

- 동일 클릭 반복 시 떨림 재현율이 체감상 사라진다.
- 자동전투 추적 중 repath 호출 빈도가 현재 대비 명확히 감소한다.
- 오브젝트 모서리 접촉 시 “정지”보다 “slide 또는 재우회”가 우선 발생한다.

## 예상 작업량

- 설계/계측: 0.5일
- 충돌맵/플래너: 0.5일
- motor/slide 이동기: 1일
- 자동전투 통합/정리/검증: 0.5~1일

총 2.5~3일 규모
