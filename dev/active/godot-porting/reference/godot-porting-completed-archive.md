# DungeonNeko Godot Porting Completed Archive

Last Updated: 2026-03-08

## 목적

- 2026-03-08 기준 active `plan/context/tasks` 3문서에서 제거한 완료 이력을 백업한다.
- active 루트 문서는 진행 중 항목만 남기고, 닫힌 phase와 완료 subtask는 이 문서에서 관리한다.

## 아카이브된 완료 요약

- `Phase 0~5` 구현과 핵심 smoke gate는 닫혔다.
- active 루트는 `godot-porting-plan/context/tasks.md` 3문서만 빠르게 읽히도록 유지하고, 지원 문서는 `reference/` 하위로 정리했다.
- 최근 사용자 보고 이슈였던 맵 디버그 오버레이, 스킬/공격 frame move, 피격 프리징, 이펙트 합성 순서, transparent 배경 사각형 문제를 수정했다.
- `tools/pipeline/phase45_validation.py`로 build / phase4 smoke / skill smoke / style-rtype parity / soak 반복 자동 증빙을 묶었다.
- 2026-03-08 사용자 지시로 `Phase 4.5` 완료 기준을 `피격 프리징 해소` + `기본공격 actual tile move`로 재정의했고, 자체점검 기준으로 닫았다.
- 최신 자동 증빙 `dev/active/godot-porting/evidence/phase45/2026-03-08T01-32-11/summary.json` 기준 build / alpha-pixel parity / phase4 smoke / skill smoke / 3-cycle soak가 PASS였다.
- `ApplicationLocalApiFacade`의 local mutation/query 구현과 `GreenfieldPhase5SmokeTest` PASS 기준으로 `Phase 5`를 닫았다.
- `SpriteFrames`/씬 노드 기반 자산 저장·로딩 전환과 selective prebake는 parity blocker 해결과 분리해 `Phase 8` 후속 트랙으로 보류했다.
- `legacy` wrapper와 `scripts/legacy/*`는 제거했고, active runtime 씬/스크립트 이름을 `TitleScene` / `MenuScene` / `LoadingScene` / `GameScene` / `HudController` 표준 이름으로 승격했다.
- UI는 `UiMetricScale = 2.0` 실치수 계산 기준을 유지하면서 `HudController`/`CharacterInventoryOverlay`의 폰트, spacing, slot, button, viewport clamp 보정을 반영했다.

## 완료된 Phase 백업

### Phase 0. 명세 고정 🟢 COMPLETE

완료 항목:
- `Classes` 파일 단위 커버리지 매트릭스 작성
  - `reference/source-coverage-matrix.md`
- `.server` action inventory 및 수식/에러코드/응답 필드 1차 정리
  - `reference/server-action-inventory.md`
- `res` 리소스 커버리지 리포트 작성
  - `reference/resource-coverage-report.md`
- 렌더링 parity 명세 작성
  - `reference/rendering-parity-spec.md`
- 기존 Godot 코드 재사용 금지 범위 문서화
  - `reference/godot-runtime-structure.md`
- `Classes` 함수/전역 상태 세분화와 전수 ledger 작성
  - `reference/source-coverage-functions.md`
  - `reference/source-coverage-symbol-ledger.md`
- `.server` DTO/에러 enum/상태 전이 표준화
  - `reference/local-api-contracts.md`
- generated resource 스키마, shader/transform, local API, runtime wiring 명세 작성
  - `reference/resource-schema-spec.md`
  - `reference/rendering-shader-transform-spec.md`
  - `reference/local-api-facade-interface.md`
  - `reference/local-api-runtime-wiring.md`
  - `reference/init-main-state-partition.md`
  - `reference/map-object-placement-decode-spec.md`
  - `reference/map-spec-generator-io-contract.md`

수용 기준 충족:
- `Classes`/`.server`/`res` 기반 분석 문서가 존재한다.
- 재사용 금지 범위와 렌더링 핵심 규칙이 문서로 잠겼다.

### Phase 1. 빌드 파이프라인 🟢 COMPLETE

완료 항목:
- `res -> Godot Resource` 생성기 설계
- `MapSpecResource` / `MapTileSetResource` native 생성기 작성
- `SpriteSpecResource` 생성기 작성
- hero runtime binding generated resource화
- legacy scene wrapper 제거 및 표준 이름 승격
- `Item/Npc/Monster/Quest/Script` spec resource 생성기 작성
- missing/fallback fail-fast 리포트 작성
  - `DungeonNeko-Godot/scripts/tools/MapContentGenerationJob.cs`
  - `DungeonNeko-Godot/scripts/tools/Phase1ReferenceValidationJob.cs`
  - `DungeonNeko-Godot/assets/generated/debug/phase1-content-report.json`

검증 메모:
- 2026-03-06 기준 phase 1 reference validation blocker 15건을 리포트에 고정했다.
- blocker 구성:
  - NPC `img_list`와 raw sprite slot 불일치 7건
  - sprite object 단일 `img_num` 한계 6건
  - `res/img/OB_12` 미추출 2건

### Phase 2. Native Render Layer 🟢 COMPLETE

완료 항목:
- `DungeonSprite2D` baseline 구현
- action/seq/frame 재생기 구현
- `SD_GetFrameMovePixel` 대응 (`CurrentFrameMovePixel`)
- clip/reverse/spread 적용
- `DGS_ALPHA` 포함 baseline shader/material 경로 구축
- `SSPR_*` 전용 effect player 구현
- Hero/NPC/Monster/effect 공통 render entry 구축
- Hero 장비 native track swap 설계 및 smoke 경로 확보

검증 메모:
- `DUNGEON_NEKO_GREENFIELD_PHASE2_SMOKE=1` 경로에서 hero native track swap `4/4` PASS를 확보했다.

### Phase 3. World/Core Runtime 🟢 COMPLETE

완료 항목:
- 새 Godot 프로젝트 폴더 구조와 autoload 구성 확정
- `GameApp` / `SceneRouter` / `DataRegistry` / `SaveRepository` 설계
- Title/Menu/Game scene 골격 작성
- `TileMapLayer` 기반 bootstrap 맵 렌더러 구축
- runtime raw map image 의존 제거
- blank screen 진단/부팅 가시성 보강
- 부팅 단계와 게임 진입 로딩 분리
- bootstrap 월드 프리뷰 엔티티와 follow camera 구축
- gate/충돌/카메라/입력 구현
- Hero/NPC/Monster 런타임 골격 작성
- `GreenfieldPhase3SmokeTest` 구축

검증 메모:
- `DUNGEON_NEKO_GREENFIELD_PHASE3_SMOKE=1 DUNGEON_NEKO_BOOT_MAP_ID=310 ...`에서 title -> menu -> game -> hero move -> gate transition PASS를 확보했다.

### Phase 4. Gameplay Logic 🟢 BASELINE COMPLETE

완료 항목:
- `LegacyParityRng` 구현
- Hero -> Monster / Monster -> Hero 전투 수식 포팅
- 상태이상/가드/치명타 포팅
- Monster AI 포팅
- 미스터리 던전 생성/층 이동 포팅
- 광산 관리자 -> 콜로세움 -> 던전 진입 포팅
- 전투 golden vector fixture / source parity smoke 구축
- hero 전투 스탯 계산 계층 분리
- hero 기본 공격 active path 연결
- 스킬 1~6 active path 연결
- hero action/frame event introspection 추가
- hero skill smoke 자동화

검증 메모:
- `dotnet build DungeonNeko-Godot/DungeonNeko.csproj` PASS
- `DUNGEON_NEKO_GREENFIELD_PHASE4_SMOKE=1 ...` PASS
- `DUNGEON_NEKO_GREENFIELD_SKILL_SMOKE=1 ...` PASS
- `DUNGEON_NEKO_COMBAT_GOLDEN_VECTOR_SMOKE=1 ...` PASS

### Phase 4.5. Runtime Parity Blockers 🟢 COMPLETE

완료 판정 규칙:
- 2026-03-08 사용자 지시로 완료 기준을 아래 두 항목으로 재정의했다.
  1. 몬스터 피격 시 hero가 프리징되지 않을 것
  2. 기본공격 frame move가 visual offset이 아니라 실제 타일 이동으로 커밋될 것
- 알파블렌딩은 같은 세션에서 사용자가 `아주 잘 되고 있다`고 확인해 blocker에서 제외했다.

완료 항목:
- `GameScene`의 hero action desync 회복 순서를 입력 처리보다 먼저 실행하도록 조정했다.
- incoming hit 시 남아 있던 attack/skill runtime과 lock을 즉시 정리해 피격 프리징을 제거했다.
- 기본공격 runtime이 `moveFrmPixel`을 실제 hero world/tile 위치에 커밋하도록 수정했다.
- `GreenfieldPhase4SmokeTest`를 hero hit 후 입력 복구와 basic attack world-position commit 검증까지 확장했다.
- `python3 tools/pipeline/phase45_validation.py` 자동 증빙을 정리했다.

수용 기준 충족:
- 몬스터 피격 후 공격/스킬/이동 입력이 프리징되지 않는다.
- 기본공격 애니메이션의 frame move가 실제 타일 이동으로 반영된다.
- 알파블렌딩은 blocker가 아니다.
- 최신 build / phase4 smoke / skill smoke / phase45 validation이 PASS했다.

### Phase 5. Local Domain Services 🟢 COMPLETE

완료 항목:
- 플레이어 성장 서비스 구현
  - `addstat`, `resetstat`, `buyexp`
- 인벤토리/장착/해제/판매 서비스 구현
  - `inventory`, `takeon`, `takeoff`, `sell`
- 창고 서비스 구현
  - `safebox`, `save`, `load`, `addbox`
- 상점 서비스 구현
  - `shoplist`, `buy`, `buyr`, `potionbuy`
- 조합/옵션변경 서비스 구현
  - `mixlist`, `mix`, `buyr`
- 던전 보상/사망/복귀/조회 로컬 경로 유지
  - `dungeon`, `down`, `up`, `town`, `dead`, `info`
- 세이브/로드 서비스 구현
- `GreenfieldPhase5SmokeTest`와 env hook `DUNGEON_NEKO_GREENFIELD_PHASE5_SMOKE=1` 추가

수용 기준 충족:
- HTTP 없이 phase5 범위 query/mutation이 로컬에서 동작한다.
- `.server` 주요 action 대응 기능이 `ApplicationLocalApiFacade`에 존재한다.
- `DUNGEON_NEKO_GREENFIELD_PHASE5_SMOKE=1 ...` PASS

## Phase 6에서 이미 닫힌 하위 작업 백업

- `GameScene` 메인 레이아웃 승격
  - `MapPreview + InfoCard` 디버그 프리뷰를 제거하고 월드 viewport 중심 레이아웃으로 전환했다.
- 마을 테스트 몬스터 제거
  - `map=314` town 경로에서 bootstrap fallback 몬스터 샘플 2마리를 제거했다.
- 메인씬 초기 UI 선로드 완화
  - `_Ready()`에서 `CharacterInventoryOverlay` eager 생성과 즉시 `RefreshHudDataAsync()`를 제거하고 lazy/deferred로 분리했다.
- 월드 카메라 기본 줌 `2.0` 고정
- UI 스케일 규칙 고정 적용
  - `UiMetricScale = 2.0` 실치수 계산 유지
- legacy UI 재사용 제거
- phase6 usable-baseline smoke 검증 추가
  - `GreenfieldPhase6SmokeTest` + `DUNGEON_NEKO_GREENFIELD_PHASE6_SMOKE=1`
- HUD/O 오버레이 가독성 보정
  - `font 2x 계열`, spacing/slot/button 확대, viewport-aware clamp, icon-first inventory/tooltip 경로 보강
- HUD 패널 workflow baseline 보강
  - `shop/warehouse/blacksmith` 패널을 legacy workflow 기반으로 연결
  - `shoplistnum -> _activeShopListNum -> GetShopCatalog(...)` 경로 정리
  - `blacksmith upgrade/socket/mix`, `craft`를 façade mutation으로 연결
- quest panel baseline 보강
  - `GreenfieldQuestTracker`로 `진행중 / 완료 / 보고가능 / 완료됨` 상태와 일부 진행도 계산을 패널에 반영

## 아카이브된 검증/운영 메모

- 최신 `Phase 4.5` 자동 증빙:
  - `python3 tools/pipeline/phase45_validation.py`
- 최신 baseline 검증 엔트리:
  - `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
  - `DUNGEON_NEKO_GREENFIELD_PHASE4_SMOKE=1 godot --headless --path DungeonNeko-Godot --quit-after 30000`
  - `DUNGEON_NEKO_GREENFIELD_SKILL_SMOKE=1 godot --headless --path DungeonNeko-Godot --quit-after 30000`
  - `DUNGEON_NEKO_GREENFIELD_PHASE5_SMOKE=1 godot --headless --path DungeonNeko-Godot --quit-after 30000`
  - `DUNGEON_NEKO_GREENFIELD_PHASE6_SMOKE=1 godot --headless --path DungeonNeko-Godot --quit-after 30000`

## active 문서와의 경계

- active `plan/context/tasks`는 열려 있는 Phase 6~8과 즉시 다음 작업만 남긴다.
- 완료된 phase 설명, 검증 PASS 로그, 닫힌 checkbox는 이 문서에서만 유지한다.
