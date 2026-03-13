# DungeonNeko Godot Native Full Rewrite Plan

Last Updated: 2026-03-10

## 문서 운영

- active 루트는 `plan/context/tasks` 3문서만 유지한다.
- `reference/`, `evidence/`, 테스트 하네스 문서 의존은 제거했다.
- 이 문서는 현재 active blocker와 parked 후속 트랙만 기록한다.

## 현재 메인 트랙

- 현재 active 구현 트랙은 `Phase 6 완료 상태 유지`다.
- `Phase 7~12`는 `Phase 6` 뒤에 이어지는 parked roadmap으로 유지한다.

## 고정 전제

- 로직/상태/시각 SoT는 `Classes/*`다.
- 로컬 도메인/경제/인벤토리 SoT는 `.server/*`다.
- 원본 리소스 SoT는 `res/*`다.
- 런타임은 Godot native only다.
- UI 확대는 카메라/렌더스케일이 아니라 `UiMetricScale = 2.0` 실치수 계산으로만 처리한다.
- `GameUiDiabloCharacterPanel`의 현재 시각 결과를 UI metric 표준 reference로 사용한다.

## Phase 6 목표

1. 메인 맵 parity를 닫는다.
   - `map 310 -> requested 151 -> resolved 300` fallback을 제거한다.
   - generated/source map coverage 또는 equivalent spec 생성으로 실제 target map을 연다.
2. 상단 UI/HUD parity를 닫는다.
   - usable baseline이 아니라 실제 플레이 기준 control/state 표현으로 맞춘다.
3. 던전 runtime parity를 닫는다.
   - 생성 규칙, 추적, 공격거리, 피격/상태이상, 복귀 흐름을 source 기준으로 맞춘다.
4. 남은 script/content workflow를 닫는다.
   - `CHSCRIPT`, `CHGAME_SCRIPT`, quest, blacksmith, quickslot 저장 의미론 잔여 차이를 정리한다.

## Phase 7 목표

1. 캐릭터 상태이상 표시를 HUD/UI에 다시 붙인다.
   - 전투 요약 문자열이 아니라, 플레이어가 바로 읽을 수 있는 상태이상 표시 규약을 복구한다.
2. 던전 하강 통로 이펙트를 네코웹 기준으로 복구한다.
   - 맵 오브젝트 레이어 문제인지, 별도 overlay/effect spawn 누락인지 먼저 분리 진단한다.
3. `폐광촌` 메인맵 NPC 시각 parity를 복구한다.
   - 창고 NPC와 상점 NPC가 흑백으로 보이는 문제를 sprite binding / palette / render path 기준으로 다시 맞춘다.
4. NPC 행동 규약을 다시 맞춘다.
   - 평상시 `0/1/2/3` 액션 제자리 반복
   - 히어로 근접 시 히어로 방향 바라보기
5. 현재 적용된 UI의 사이즈 체계를 다시 잡는다.
   - 스크롤 발생, 화면 미포함, HUD/미니맵 간섭을 패널별 설계 규칙으로 정리한다.

## Phase 8 목표

1. hero/monster 전투 규약을 presentation과 분리해 다시 잠근다.
   - damage resolution, hit state, cooldown, invincibility, condition 적용 순서를 source 기준으로 재정의한다.
2. active skill 판정과 hit timeline을 실제 액션 단위로 다시 맞춘다.
   - multi-hit, skill rect, line block, cast origin, target collection 규약을 phase 단위 책임으로 분리한다.
3. monster combat runtime과 monster effect runtime을 다시 정리한다.
   - attack wind-up/impact, melee/ranged effect request, death/reward 지연, condition effect lifecycle을 공용 파이프라인으로 정리한다.
4. combat/audio/effect 검증 셋을 재현 가능한 시나리오로 고정한다.
   - hit/miss/guard/crit/condition/kill/level-up을 fixture 수준으로 다시 검증 가능하게 만든다.

## Phase 9 목표

1. `Phase 9` 리팩터링은 `godot-refactor` 사이드 트랙 3문서를 정본으로 사용한다.
   - 관련 문서:
   - `dev/active/godot-refactor/godot-refactor-plan.md`
   - `dev/active/godot-refactor/godot-refactor-context.md`
   - `dev/active/godot-refactor/godot-refactor-tasks.md`
2. `godot-porting` 문서는 리팩터링 진입점과 우선순위만 유지한다.
   - 세부 분해, acceptance, 진행 상태 갱신은 항상 `godot-refactor` 3문서에서 수행한다.
3. `Phase 9`의 실제 작업 범위는 아래 네 축으로 고정한다.
   - production/test boundary split
   - `GameScene` / HUD 분해
   - runtime/resource port 경계 도입
   - legacy cluster cleanup

## Phase 10 목표

1. 임시 공간

## Phase 11 목표

1. 검증 게이트를 다시 세운다.
   - build, source coverage, resource coverage, replay diff, golden frame diff, 성능 baseline을 phase 단위 게이트로 고정한다.
2. `폐광촌` 기준으로 닫은 parity를 재현 가능한 검증 셋으로 묶는다.
   - town -> UI/HUD -> quest/shop/warehouse/blacksmith -> dungeon entry/down/up/return 루프를 deterministic 검증 흐름으로 만든다.
3. 메인 맵 parity를 별도 후속 트랙으로 검증 가능 상태까지 다시 끌어올린다.
   - 현재 보류 중인 main map fallback 문제는 이 단계에서 다시 게이트에 편입한다.

## Phase 12 목표

1. 자산 저장/로딩 경로를 Godot editor 친화적으로 정리한다.
   - runtime parity 구조를 깨지 않는 범위에서 resource loading 규약을 확정한다.
2. selective prebake 범위를 measured hot path 기준으로만 다시 정의한다.
   - parity blocker 우회를 위한 임시 최적화로 사용하지 않는다.
3. hero/monster/effect 자산 구조를 에디터에서 직접 확인 가능한 형태로 정리한다.
   - frame/action 검증 가능한 asset layout과 책임 경계를 문서화한다.

## 수용 기준

- 메인 맵 gate target fallback이 0건이다.
- 메인 맵에 source에 없는 bootstrap fallback이 없다.
- 상단 UI/HUD가 placeholder 없이 플레이 경로에 맞춰 동작한다.
- 던전 entry/down/up/return 루프가 실제 runtime 규칙으로 유지된다.
- 테스트용 API, 테스트 결과물, 참조문서 의존 없이 작업면이 유지된다.

## 현재 리스크

- `151` 계열 map coverage가 비어 있으면 메인 맵 parity가 계속 막힌다.
- HUD/top UI를 더 만지기 전에 script/state 경계를 닫지 않으면 다시 어긋날 수 있다.
- 던전 runtime 규칙 차이가 남아 있으면 Phase 6 완료 선언이 틀어진다.
- `Phase 11` 게이트 정의가 사라지면 완료 이후 regression을 다시 잡기 어려워진다.
- `Phase 12` 자산 파이프라인 트랙이 문서에서 빠지면 parity 작업과 editor-friendly 자산 정리가 다시 섞일 수 있다.

## 즉시 시작 항목

1. `151` target map 입력/생성 범위를 열어 메인 맵 fallback을 제거한다.
2. 상단 UI/HUD의 실제 남은 parity gap만 정리한다.
3. 던전 runtime과 잔여 script workflow를 blocker 순서로 닫는다.

## 후속 parked 트랙

1. `Phase 7`
   - 미적용 이펙트 / UI 재작성
2. `Phase 8`
   - 전투 로직 수정 / 몬스터 이펙트
3. `Phase 9`
   - 리팩토링(엔진 분리, 느슨한 결합 등)
4. `Phase 10`
   - 임시 공간
5. `Phase 11`
   - source/resource/replay/frame/perf 게이트 복원
6. `Phase 12`
   - resource loading / selective prebake / editor-facing asset layout 정리
