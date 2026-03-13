# Pointer Navigation Overhaul - Tasks

## Phase 0. 계측 ⏳ NOT STARTED
- [ ] 포인터 이동 디버그 오버레이 추가
- [ ] 재현 케이스 3종 기록
- [ ] repath/stuck/slide 실패 카운터 로그 추가

## Phase 1. Navigation Collision Grid ⏳ NOT STARTED
- [ ] 히어로 footprint 기준 확장 충돌맵 생성
- [ ] world <-> navigation cell 변환 유틸 추가
- [ ] line-of-sight 검사 유틸 추가

## Phase 2. PathPlanner 🟡 IN PROGRESS
- [x] 신규 `PathPlanner` 모듈 생성
- [ ] A* 경로를 navigation grid 기준으로 계산
- [ ] reachable fallback goal 탐색 구현
- [ ] string pulling 기반 corridor 생성

## Phase 3. PathMotor 🟡 IN PROGRESS
- [x] lookahead waypoint 추종 구현
- [x] progress/stuck 상태머신 구현
- [x] micro-replan 조건 구현

## Phase 4. Slide Movement 🟡 IN PROGRESS
- [x] `HeroMovementController`에 navigator 전용 vector move API 추가
- [x] 기존 `applyHeroVectorMoveWithParity()`를 navigator vector 이동 경로에 연결
- [x] wall hugging 시 애니메이션 방향 snap 규칙 추가
- [ ] full move -> axis split -> slide 전용 API로 추가 정제

## Phase 5. Integration 🟡 IN PROGRESS
- [x] `PointerNavigationController`를 goal/corridor 상태머신 중심으로 1차 정리
- [x] `UpdateLoopController`에 navigator update 순서 통합
- [x] 전투 액션 pause/resume 연동 유지
- [x] 자동전투 추적을 신규 corridor follower에 연결
- [ ] global planner를 신규 planner로 완전 교체

## Phase 6. Cleanup & Validation ⏳ NOT STARTED
- [ ] `mousePathMoveInput` 기반 포인터 추종 제거
- [ ] 임시 repath/stuck 패치 정리
- [ ] 헤디드/수동 검증 케이스 수행
- [ ] progress.md 업데이트

## Acceptance Checklist
- [ ] 오브젝트 모서리에서 좌우 떨림 없이 이동 지속 또는 재우회
- [ ] 좁은 통로 진입 실패율 현저히 감소
- [ ] 자동전투 추격 중 과도한 재탐색 억제
- [ ] 전투 액션 종료 후 자연스럽게 resume
