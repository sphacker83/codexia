# DungeonNeko Godot Native Full Rewrite Context

Last Updated: 2026-03-12

## 문서 운영

- active 루트는 현재 진행 내용과 parked 후속 트랙만 남긴다.
- `reference/`, `evidence/`, 테스트 하네스 기반 기록은 제거했다.
- 이 문서는 `Phase 6` 직접 판단 사실과 후속 phase 인계 정보만 남긴다.
- 메인 맵 로딩 문제는 사용자 지시로 차후 과제로 남기고, 이번 작업에서는 `폐광촌` 외 다른 맵 로딩을 시도하지 않는다.

## 현재 상태

- `Phase 6` closeout 선언은 현재 유효하지 않다.
- `Phase 7`도 false closeout을 되돌리고 다시 open 상태로 유지한다.
- `Phase 7` task는 묶음형 트리 구조로 재정리했다.
  - `7-1`: 캐릭터 상태이상 표시 복구
  - `7-2`: 던전 하강 통로 이펙트 parity 복구
  - `7-3`: `폐광촌` 창고/상점 NPC 흑백 표시 문제 정리
  - `7-4`: NPC 행동 규약 재정의 및 parity 복구
  - `7-5`: UI 재작성 및 사이즈 조절 계획 수립
  - `7-5` 안에는 `O` 패널(diablo inventory) 레퍼런스 재작성도 다시 열린 상태로 포함한다.
  - 다만 latest discrepancy 기준으로 `7-1`, `7-2`, `7-6`은 다시 open 상태다.
- 후속 parked 트랙 번호는 다시 정리했다.
  - `Phase 7`: 미적용 이펙트 / UI 재작성
  - `Phase 8`: 전투 로직 수정 / 몬스터 이펙트
  - `Phase 9`: 리팩토링(엔진 분리, 느슨한 결합 등)
  - `Phase 10`: 임시 공간
  - `Phase 11`: verification gates
  - `Phase 12`: resource pipeline / selective prebake
- 메인 맵 로딩 parity는 사용자 지시로 별도 차후 과제로 남겨두고, 현재 closeout 범위에서 제외한다.
- 2026-03-12 모바일 export 부팅 정지 직접 원인을 런타임 로더 경로에서 다시 고정했다.
  - `DataRegistry` warmup은 더 이상 `ProjectSettings.GlobalizePath("res://...") + Directory/File` 절대경로 열거를 쓰지 않고, `DirAccess` 재귀 열거와 `Godot.FileAccess` JSON 읽기로 generated resource를 인덱싱한다.
  - `DataManager.LoadAllDataAsync()`도 `Task.Run + System.IO` 절대경로 읽기를 제거하고, boot-critical 로딩을 메인 스레드 `Godot.FileAccess/DirAccess` 경로로 다시 묶었다.
  - `GodotRuntimeBootstrap/GameApp/LoadingScene`에는 마지막 부팅 실패 원인을 보존하고 로딩 씬에 고정 표시하는 상태 경로를 추가했다.
  - Android 릴리스 preset 암호화(`encrypt_pck/encrypt_directory`)는 유지하고, 비교용 비암호화 debug preset을 별도 추가한다.
  - 추가로 실제 Android export 산출물에는 generated spec/resource가 `map_300.tres`가 아니라 `map_300.tres.remap` 형태로 들어간다는 점을 확인했고, `DataRegistry` 인덱서는 이제 `.tres.remap`를 읽기용 엔트리로 허용하되 런타임 로드는 base `.tres` 경로로 등록한다.
- 사용자 요청으로 world follow camera를 전역 `hero always center` 규칙으로 바꿨다.
  - town/dungeon 구분 없이 follow camera는 맵 경계 clamp를 두지 않고, 항상 히어로 월드 좌표가 viewport 정중앙에 오도록 배치한다.
  - 따라서 화면 가장자리에서는 overscan/빈 공간이 생길 수 있지만, 카메라 기준은 항상 히어로 중심 고정이다.
- 테스트 API와 `scripts/tests`, `scenes/tests`, smoke/pipeline 결과물 의존은 이번 정리에서 제거했다.
- 상단 `Rewrite Status` 오버레이도 제거해서 미니맵과 HUD를 가리는 테스트 잔재를 없앴다.
- HUD의 `플레이 상태` summary card도 제거해서 미니맵 위를 덮는 상태 요약 패널을 없앴다.
- HUD 상점에 `랜덤 장비/재료`, `HP 포션`, `EXP` 특수 구매 메뉴와 실행 액션을 연결했다.
- `ShopCatalogSnapshot` 가격값을 실제 런타임 값으로 채워 상점/재감정 비용이 `0`으로 보이던 문제를 정리했다.
- HUD 패널 상단 메시지는 이제 `buy: ok`, `quickslot_item_bound:*` 같은 내부 코드 대신 한국어 사용자 메시지로 변환된다.
- HUD 빠른 메뉴에 미니맵 토글을 추가해서 현재 상태(`지도 OFF/소/대`)를 볼 수 있고, `ui_minimap` 핫키로 바꾼 상태도 HUD에 즉시 반영된다.
- 상단 top bar는 이제 `docs/tbar.png` 기준으로 전용 렌더러/전용 버튼 스킨으로 다시 작성했고, 기존 공용 `StyleBoxFlat` 기반 빠른 메뉴 구현은 제거했다.
- 상단 top bar에서 `추격섬멸` / `표시 HQ`는 제거했고, 전투 토글은 `수동전투` / `근접대응` 2상태만 남겼다.
- `레거시/고품질`은 월드 필터가 아니라 `DungeonSprite2D` 런타임 합성 품질 의미로 다시 고정했고, 상단 UI 상태(`팝업/시야/탐색/전투/프리뷰`)는 전역 로컬 설정으로 복원한다.
- 상단 top bar의 실제 버튼 폭은 `BGM` 기준으로 통일했고, 안티 설정은 단일 `안티 ON/OFF` 토글 버튼, 우측 가이드는 실제 `인벤토리` 버튼으로 교체했다.
- 안티얼레이싱 ON에서는 ground tile layer만 추가로 `Linear`를 적용하고, 타일셋 생성은 `UseTexturePadding = true`로 바꿔 seam을 막는다.
- HUD 좌상단 status card는 compact layout으로 다시 줄여 HP/MP/EXP 영역이 미니맵을 덮지 않도록 정리했다.
- 미니맵 시작 위치도 이제 고정 Y가 아니라 HUD status card 실제 하단 + 여백을 따라가도록 바꿔, 폰트/최소크기 변화에서도 다시 겹치지 않게 정리했다.
- status card 폭/높이/게이지 폭과 내부 폰트도 한 번 더 줄여 좌상단 점유면적 자체를 추가로 줄였다.
- `DungeonMapRenderer2D` depth는 이제 `band + row stride + tileX tie-break` 기반으로 계산해서 맵/오브젝트/엔티티 레이어가 row ordering에 눌리지 않도록 정리했다.
- 이전까지 빠져 있던 `ActiveNpcObject` / `ActiveMonsterObject`도 다시 렌더러에 연결해서 `active_obj_cnt/dir` 기반 top-layer 순환 이동/프레임 애니메이션이 보이도록 복구했다.
- 미스테리 던전 몬스터 규칙도 임시 2종/15~30마리 규칙에서 네코웹 `mysteryDungeonRules.ts` 기준 pool/type-count/총 등장 수로 다시 맞췄다.
- 미스테리 던전 몬스터 배치는 중앙 고정 패턴 대신 맵 전역 walkable tile shuffle 기반으로 분산 배치되도록 정리했다.
- 미스테리 던전 generator/runtime에도 남아 있던 `gate=2`, `gateIndex==0 귀환` 임시 규칙은 제거했고, web처럼 `단일 하강 게이트`만 남기도록 맞췄다.
- `mystery_sacred_stone`은 이제 `MapData -> runtime MapSpec -> world runtime overlay preview`까지 전달되고, hero pickup 시 제거/동기화되도록 정리했다.
- `guide_data`의 web compat 필드(`x/y/px/py/dir`)도 runtime spec 변환까지 유지되도록 복구했다.
- standalone effect sprite(`commonspr:*`, `atbeffspr:*`, `maspr:*`)는 기존 owner binding 생성 구조에서 빠져 있었고, 이것이 level-up / 상태이상 / gate guide preview가 함께 보이지 않던 직접 blocker였다.
- 이번 세션에서는 `DataRegistry` + `SpriteRuntimeBindingRegistry` synthetic binding fallback을 추가해 `commonspr:0/7/10/13/14/15/16`, `atbeffspr:3`, `maspr:0`이 rendered manifest 기반으로 runtime에서 해석되도록 보강했다.
- 로컬 sprite index에 `HSPR_1_spr_5`가 없어서 성석 preview가 비더라도, pickup tile/state는 유지되고 가용한 근접 sprite key로 fallback 하도록 보강했다.
- mystery down gate preview 미표시의 실제 직접 원인도 다시 확인했다.
  - 기존 구현이 `COMMONSPR_spr_0`, `HSPR_1_spr_5` 같은 web 표기 문자열을 Godot `DataRegistry` key로 그대로 써서 lookup에 실패했고, previous runtime summary 기준 `guide=0 sacred=0`으로 끝나고 있었다.
  - 이번 세션에서 key 정규화 외에 synthetic binding fallback과 `guide_data 우선 / gate tile,pixel fallback` 해석까지 반영했다.
  - 다만 이번 턴에서는 실제 in-engine 수동 재검증을 아직 하지 않았으므로 spawn/visibility parity는 open 상태로 유지한다.
- `Phase 7` 구현은 현재 작업면 기준으로 다시 open 상태다.
  - `7-1`: `HudStatusSnapshot`과 HUD / CharacterInventoryOverlay / hero follow effect wiring은 반영됐고, 이번 세션에서 standalone effect sprite synthetic binding fallback까지 추가했다. 실제 mystery runtime 시각 확인은 아직 남아 있다.
  - `7-2`: mystery down gate의 `COMMONSPR_spr_0` pulse wiring, `guide_data` 우선 좌표 해석, synthetic binding fallback까지 반영했다. same-floor force reconfigure에서도 미니맵 reveal state는 유지되도록 정리했다.
  - `7-3`: `폐광촌` 창고/상점 NPC의 gray-only direction과 single-frame stop 방향을 회피해서 기본 상태가 컬러 idle로 유지되도록 맞췄다.
  - `7-4`: NPC는 `상/하/좌/우` idle cycle을 기본 규약으로 사용하고, 히어로가 `3타일(Chebyshev)` 안에 있을 때만 히어로를 바라보며, 대화 중에는 히어로 방향으로 고정되고 종료 후 즉시 일반 규약으로 복귀한다.
  - `7-5`: HUD status/minimap safe area 재조정, dialogue content-only scroll, CharacterInventoryOverlay inventory parity 재구성을 반영했다.
    - `CharacterInventoryOverlay`는 이번 턴에 웹 `InventoryPanel.tsx` 정본 기준으로 다시 구성했고, 좌측 `6x5 슬롯 그리드`, 우측 `DETAIL 패널`, 하단 `장비 액션 + 선택 요약 + GOLD` 바 구조로 고정했다.
    - CharacterInventoryOverlay는 `UiMetricScale = 2.0` 실치수 계산을 유지하면서도, viewport가 작아질 때는 외곽 padding만 줄이고 부족한 높이는 `_contentScroll`이 흡수한다.
    - 구조는 `상단 타이틀/닫기 -> 상단 소지수/필터 -> 좌측 6x5 슬롯 그리드 -> 우측 DETAIL 패널 -> 하단 장착 액션/선택 요약`으로 고정한다.
    - 필터(`전체/장비/소모/퀘스트/기타`)와 선택 아이템 상세 표현은 `GameScene` item catalog 해석을 통해 web 분류/옵션 라인 규칙을 재사용한다.
    - follow-up으로 `docs/opanel.png` 기준 `O` 패널은 별도 레퍼런스 재작성 대상으로 다시 열었다.
      - 진입 경로는 그대로 `ui_diablo_inventory -> GameUiManager -> GameUiCharacterPanel`을 유지한다.
      - 구조는 `상단 CHARACTER/SPECIALIZATIONS/ABILITIES 탭`, 좌측 프로필, 우측 상단 hero preview + 장비 슬롯 프레임, 우측 하단 inventory로 교체한다.
      - `SPECIALIZATIONS`는 새 특성 시스템이 아니라 `HeroCombatStatCalculator` 기반 전투 프로필 뷰로 정의한다.
      - `ABILITIES`는 기존 popup skills panel을 흡수해 같은 `O` 패널 안에서 스킬/퀵슬롯 상태를 보여준다.
      - 이번 턴에서는 위 follow-up 구현을 `GameUiDiabloCharacterPanel` 신설 + 구형 `GameUiCharacterPanel` 제거 방식으로 반영했고, 정적 검증으로 `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`를 다시 통과시켰다.
      - 후속으로 character panel의 남은 3개 이슈도 정리했다.
        - hero preview는 이제 `GameUiHeroPreviewState`를 통해 runtime hero visual swap/action/direction을 받아 실제 장비 탈착 외형을 반영한다.
        - preview renderer framing을 키워 배경 박스 점유율을 올렸고, shell 크기도 함께 키웠다.
        - panel은 full-width가 아니라 우측 도킹 + 고정 shell 기준으로 줄였고, 하단 selection summary strip은 제거했다.
        - `CHARACTER` 탭 inventory는 더 이상 panel 전폭 하단 deck이 아니라 hero preview 아래 우측 컬럼으로 재배치했고, `6x5` grid, slot `72px`, icon `16px`(warehouse 기준 `18`에 가장 가까운 8배수), shell `1040x880`, actual capacity `30` 기준으로 다시 줄였다.
        - `I` 패널은 이제 viewport 안으로 clamp되고, header drag로 위치를 옮길 수 있다.
        - 2026-03-11 추가 보정으로 좌측 profile/stat 패널 폭은 `192` design px, 높이는 우측 stage+inventory 하단에 맞춘 `820` design px로 다시 고정했고, 우측 컬럼은 `6슬롯 + gap/padding/margin` 기준 `472` design px 폭으로 고정했다. character stage는 `368` design px 기준 3열 레이아웃(좌 슬롯열 / 중앙 preview / 우 슬롯열)로 재구성해 빈 gutter를 없앴다.
        - window base height는 `908`로 다시 줄였고, window outer margin top/bottom은 `8`, frame separation은 `2`, character content top inset은 `1`로 줄여 header 아래 죽는 공간을 회수했다.
        - inventory 하단 row는 `GOLD`만 남기고 `30/30` badge는 제거했다. 장착/해제/버리기 액션은 선택 슬롯 기준 고정 tooltip 하단 버튼으로 옮겼고, `버리기`는 tooltip 내부 `예/아니오` 확인 후 실제 inventory에서 삭제한다. tooltip은 바깥 클릭이나 우상단 `X`로 닫을 수 있다.
        - 기본 인벤토리 capacity는 `30`을 단일 기준값으로 사용한다.
        - inventory filter는 `전체/장비/소모/퀘스트/기타` 5탭으로 확장했고, 상단 `캐릭터/전투속성/스킬` 헤더와 inventory filter 모두 active red / inactive stone attached tab으로 다시 렌더링해 선택 상태를 즉시 구분할 수 있게 했다.
        - `전투속성`은 `배너 + 핵심 전투 수치 + 장비/유틸 보정 + 속성 공격 프로필` 4단 구성으로, `스킬`은 `목록 + 선택 스킬 요약 + 메트릭 + 설명 + 퀵슬롯 바인딩` 구성으로 다시 절개했다.
      - 이번 작업에서는 merchant/quest/dialogue도 같은 계열 시각 언어로 확장했다.
        - `ui_inventory/ui_equipment/ui_skills` 입력 경로와 generic popup 진입은 제거하고, `ui_diablo_inventory`만 `I` 키로 유지한다.
        - `shop/warehouse/blacksmith/quests`는 녹색 generic popup 대신 diablo-style 중앙 모달 shell로 다시 렌더링한다.
        - NPC dialogue는 기존 하단 위치를 유지하면서 좌측 portrait + 이름, 우측 본문/선택지 구조의 JRPG형 카드로 다시 정리한다.
        - popup/dialogue 외곽 크기는 내용이나 viewport 비율에 따라 자라지 않도록 fixed shell 기준으로 다시 고정한다.
        - 후속 보정으로 dialogue card는 `header -> content row -> footer` 3단 구조로 재편했고, NPC 이름은 header 한 곳에만 두도록 정리했다.
        - portrait는 세로로 늘어나는 큰 카드 대신 작은 정사각형 preview slot으로 줄였고, preview는 transparent background + fallback glyph로 바꿔 회색 빈 배경을 제거했다.
        - choice는 footer 전폭 세로 스택으로 내리고, guide label도 footer 하단에 고정했다. scroll height는 header/footer 실제 높이를 뺀 본문 영역 기준으로 다시 계산한다.
  - 2026-03-11 아이템/스탯 parity 후속 보정:
    - `ItemSaveState`는 이제 `Stat`, `StatType`, `EquipOptions[6]`, `Identity`, `EquipOptionCnt`를 직접 저장하고, `ItemSnapshot`도 icon/type/stat/equipOption/identity/costume/price/stackable 필드를 함께 노출한다.
    - `LocalProgressAdapter`는 generated item의 equip option/identity/option count를 rank나 catalog 값으로 재추정하지 않고 저장값 그대로 왕복한다. 구형 세이브는 encoded option 휴리스틱으로 base options와 equip options를 분리 복원한다.
    - `ItemCatalogService`는 web `buildBaseEquipOptions()` 기준으로 `equip_options`/`equipOptions`/`opt1..6`까지 읽는다.
    - `ItemUiFactory`를 item presentation 단일 정본으로 추가해 이름 색상, base stat line, encoded equip option 라인, palette-only icon 후보, detail text를 web `OverlayPrimitives.tsx` 규칙으로 공통화했다.
    - `GameScene` item resolver와 `GameUiManager`/`GameUiDiabloCharacterPanel` tooltip/detail은 위 helper를 사용하도록 정리했다.
    - `HeroCombatStatCalculator`는 synthetic equipment budget 경로를 제거하고, 실제 장착 아이템의 `stat/statType/options/equipOptions/plus/socket`을 입력으로 쓰는 web `HeroCombatProfileBuilder` 계열 계산으로 교체했다.
    - `GameScene.PlayerState`는 이전 `PlayerSnapshot`을 같이 넘겨 자원 보존을 조정한다. `INT` 증가 시 현재 MP도 web처럼 증가량만큼 함께 올리고, reset 계열은 HP/MP를 새 최대치로 재정렬한다.
    - `I` 패널 캐릭터 탭 기본 능력치는 `스탯명 ... [+] ... 값` 배치로 재작성했고, `statPoint > 0`일 때만 `+` 버튼을 노출한다. `PNT` 강조 행과 `스탯 초기화` 버튼도 같은 블록에 붙였다.
    - `addstat_not_enough_stat_point`는 이제 한국어 사용자 메시지로 매핑된다.
    - 정적 검증 기준은 `dotnet build DungeonNeko-Godot/DungeonNeko.csproj` PASS (`경고 0 / 오류 0`)다.
  - 2026-03-11 전투속성/스킬 탭 안정화 후속 보정:
    - `GameUiDiabloCharacterPanel`의 tab viewport는 clip host로 유지하고, body scroll은 `SPECIALIZATIONS`/`ABILITIES` 내부 `ScrollContainer`에서만 처리한다. `CHARACTER` 탭은 스크롤을 허용하지 않고 panel shell clamp/uniform scale로만 맞춘다. compact breakpoint는 `viewport <= 1366` 또는 `viewport height <= 760`으로 고정했다.
    - `전투속성` 탭은 compact 여부에 따라 카드 수와 열 수를 재배치하는 metric tile dashboard로 다시 절개했고, `배너 / 핵심 전투 수치 / 장비·유틸 보정 / 속성 프로필` 4블록을 body scroll 안에 넣어 작은 해상도에서도 창 밖으로 밀려나지 않게 정리했다.
    - `스킬` 탭은 `목록 + 상세 + 페이지 1/2 quickslot 매트릭스` 구조로 재작성했고, panel 전용 전체 12칸 quickslot payload를 기준으로 다중 바인딩 슬롯을 모두 표시한다.
    - 스킬 바인딩/해제는 더 이상 visible `0..5` 인덱스를 직접 넘기지 않고, 절대 슬롯 인덱스 `0..11` 기준으로 이벤트를 발행한다.
    - quickslot 전달 경로는 `GameScene -> GameUiSnapshot(AllQuickSlots) -> GameUiSyncCoordinator -> GameUiManager -> GameUiDiabloCharacterPanel.SetAllQuickSlots()`로 확장했고, HUD는 기존 current-page 6칸 payload를 계속 사용한다.
    - 2026-03-12 후속 보정으로 `CHARACTER` 탭 스크롤이 다시 나타나는 문제를 막기 위해 `_tabViewport` 자체 `ScrollContainer`를 제거하고, `CHARACTER`는 clip-only host 위에 직접 렌더링하도록 되돌렸다.
    - 2026-03-12 UI scale 단일화 후속 보정으로 `GameUiDiabloCharacterPanel`은 더 이상 `LegacyPanelMetricBaseline` 보정 계층을 쓰지 않고, 정규화된 design px + `Ui()/UiFloat()/UiSpace()/ResolveFontSize()` 공용 경로만 사용한다.
    - `UiScaleMetrics`의 `LegacyFontScale`는 제거했고, 기존 디아블로 패널 폰트 체감은 `UiFontScale` 쪽에 흡수해 유지한다.
    - 이후 top-level UI는 디아블로 캐릭터 패널의 spacing/font/shell 기준을 공용 UI metric reference로 따른다.
    - 최종 정적 검증은 `dotnet build DungeonNeko-Godot/DungeonNeko.csproj` PASS (`경고 0 / 오류 0`)다.
  - 다만 latest discrepancy 확인으로 effect/combat closeout은 다시 열어 둔다.
- mystery dungeon 몬스터 runtime도 전투 parity 기준으로 한 번 더 올렸다.
  - 기존 Godot runtime은 `face -> optional 1tile move`만 있고 attack hold / visible attack effect / impact delay가 없어서, 사용자가 지적한 것처럼 web와 체감이 달랐다.
  - 현재는 `wander -> chase -> attack hold` 상태 전환, ranged/special main type의 짧은 impact delay, `atbeffspr:0/1`와 `commonspr:2` 기반 visible attack effect를 추가했다.
  - 일반 피격으로 `active hero skill`을 끊던 `InterruptHeroActionRuntimeOnIncomingHit()` 경로도 수정해서, skill은 명시적 reset/interrupt 경로가 아니면 끝까지 재생/해결된다.
  - 추가 보정으로 melee 몬스터는 사거리 안에 들어와도 실제 attack trigger 전에는 idle을 유지하고, ranged만 in-range 대기 시 attack action을 유지하도록 분기했다.
  - hero hit 적용 시점에는 `commonspr:2`가 hero 좌표에 즉시 붙도록 runtime effect 경로를 연결했다.
- dungeon floor 이동도 이제 web처럼 `던전 돌파 성공!` popup을 먼저 보여준 뒤 짧게 유지하고 다음 floor를 reload한다. popup에는 `EXP/GOLD/처치 몬스터/보상 아이템` 요약이 들어간다.
- `MoveDungeonDown`의 floor clear 보상도 이제 web `rollServerStyleReward` 기준으로 계산해 `EXP/GOLD/보상 장비`를 실제 인벤토리에 지급한다.
- 따라서 던전 돌파 popup의 보상 아이템 영역은 더 이상 비어 있지 않고, 인벤토리 만석 경고도 reward roll 시점과 동일한 규칙으로 붙는다.
- 몬스터 처치 시에도 web처럼 즉시 `EXP/GOLD`가 반영되고 15% 서버식 장비 드롭이 인벤토리에 들어가며, mystery dungeon에서는 그 층의 드롭 목록이 floor clear popup에 함께 합산된다.
- mystery dungeon 하강 보상 popup도 이번 작업면에서 web `PopupOverlay` 기준 P0 parity 대상으로 다시 고정한다.
  - 시각 기준: `docs/dpopup.png`와 `dungeon-neko-web/src/components/overlay/panels/PopupOverlay.tsx`를 정본으로 사용하고, Godot에서도 `DungeonRewardPopupView` 전용 노드 트리로 다시 작성했다. 기존 범용 `_popupCard` / `dungeonReward` 분기 / 구형 reward popup builder는 제거했다.
  - 크기 기준: outer popup은 web 실측 기준 `496x364` 디자인 값을 쓰고, viewport에는 uniform scale만 적용한다.
  - 정보 위계: `reward chip -> message -> 처치 몬스터 -> 획득 아이템 -> 확인` 순서를 유지하고, monster/item은 카드 내부 section scroll 없이 popup height 확장으로 수용한다.
  - 행동 기준: `popupMode=Off`면 popup만 숨기고 floor apply 후 바로 play로 복귀한다. `popupMode=ThreeSec`면 `AutoCloseMs=3000`, `ui_menu`는 항상 닫힘, `ui_ok/action_attack`은 `CloseOnPrimaryAction`일 때만 닫힘으로 맞춘다.
  - floor 이동 흐름은 `하강 -> 다음 층 apply/loading -> reward popup -> popup 닫힘 후 play`로 고정하고, `450ms` 최소 노출 지연은 제거한다.
  - 2026-03-11 추가 조정:
    - `GameUiRewardPanel`의 monster/item section 내부 `ScrollContainer`를 제거하고, 항목 수가 5개를 넘으면 popup 자체 높이를 늘리는 방식으로 바꿨다.
    - reward popup 몬스터 프리뷰는 `56px` 디자인 기준과 `TransparentBackground + spriteHost scale 2.0` 조합으로 다시 키웠다.
    - `InventoryFull` 경고는 중앙 message가 아니라 `획득 아이템` section 내부 notice로 이동했다. `EXP/GOLD`와 `처치 몬스터`는 계속 정상 노출된다.
- level-up gameplay message effect(`state=0`)는 이제 몬스터 처치 보상 경로와 mystery dungeon 층 이동 보상 경로 모두 `ShowHeroLevelUpPresentation()`을 호출하도록 맞췄다. 실제 시각 확인은 이번 턴에서 아직 하지 않았다.
- quest 진행/보상 경로에서도 `quest_turnin_*`, `quest_script:*` 같은 raw code 문자열이 직접 노출되지 않도록 정리했다.
- blacksmith/shop/quest reward warning에서도 `blacksmith_plus_*`, `blacksmith_repower_material_missing`, `shop_buy_item_not_in_catalog`, `quest_reward_item_*_inventory_full` 같은 raw code가 그대로 보이지 않도록 한국어 메시지로 정리했다.
- quest 패널은 전체 카탈로그를 그대로 노출하지 않고, 실제 활성/완료 퀘스트가 있을 때만 목록을 보여주도록 정리했다.
- quickslot 해제 메시지는 내부 절대 슬롯 인덱스가 아니라 플레이어가 보는 슬롯 번호 기준으로 보이도록 정리했다.
- 던전 상태이상 중 `Paralyze`는 이제 표시만 남는 것이 아니라 실제로 이동 입력과 공격/스킬 캐스트를 막는다.
- HUD status card, quickslot/potion bar, character inventory status에도 남아 있던 `PAGE/READY/EMPTY/TOWN`, `combat=*` 같은 영어/내부 요약 문자열을 한국어 사용자 문구로 정리했다.
- 영웅 공격/스킬 타깃은 더 이상 맵 전체 nearest monster fallback을 타지 않고, 전방/근거리 범위에서만 해석되도록 정리했다.
- 전방 타깃 탐색도 이제 벽/막힌 타일에서 끊기도록 정리해서 장애물 뒤 몬스터를 직선 타깃으로 잡지 않는다.
- 현재 NPC runtime은 `GreenfieldWorldRuntime`에서 generic `npc_res:*` runtime binding으로 직접 스폰되고, 근접 시 바라보기는 `3타일` 규칙으로 제한된 상태다.
- 이번 세션에서는 네코웹 parity와 별개로, Godot 전용 divergence로 던전 기본공격/몬스터 공격/NPC 상호작용 판정을 타일이 아니라 픽셀 기준으로 다시 묶었다.
  - `GreenfieldWorldRuntime`는 이제 `CollisionBoxes + Entry.Position + Rect2.Intersects` 기반 `TryResolveHeroAttackTarget`, `TryResolveHeroAttackDirection`, `CanMonsterAttackHeroNow`, `TryResolveNearestNpcInteractionTarget` public API를 제공한다.
  - `GameScene` 기본공격 방향 보정/히트 판정, NPC 상호작용 선택, monster pending impact 재검사도 이 API로 교체됐다.
  - monster AI 공격/추격과 NPC 근접/시선 판정도 Manhattan/Chebyshev 타일 거리 대신 world anchor 기준으로 바뀌었고, 이동만 계속 foot tile 규칙을 유지한다.
- mystery down gate는 관련 asset/wiring 보정에 더해 synthetic binding fallback과 `guide_data` 우선 좌표 해석까지 반영했다. 실제 guide spawn/pulse visibility는 수동 확인 대기 상태다.
- 현재 active 작업면 기준으로는 `폐광촌` mystery dungeon의 타일/오브젝트/레이어/몹 스폰/보상 흐름 중 일부 보정은 들어갔지만, guide와 일부 combat presentation parity blocker가 남아 있다.
- `폐광촌` mystery dungeon 전투 presentation도 이번 작업 단위에서 다시 정정했다.
  - `GreenfieldWorldRuntime.ApplyCombatTextFrame()`은 네코웹 `showCombatText()`의 숫자 frame value / alpha / scale / x,y offset / critical boost를 그대로 따르도록 맞췄다.
  - 몬스터 `MISS` 메시지, 몬스터 피해 숫자, 몬스터 hit/critical/attribute effect anchor는 더 이상 고정 `-10/-30`을 쓰지 않고 `MonsterData.top_pos` 기준(`damageY = y-topPos`, `effectY = y-topHalf`)으로 계산한다.
  - 몬스터 상태이상은 tint만 남지 않고, `Poison/Ice/Paralyze`에 대해 follow effect가 조건 지속 동안 유지되도록 바꿨다.
  - 몬스터 사망 연출은 `death action [5,4,8]`, `direction 0 우선`, `previewFrames(1..3)/10fps -> 80~280ms` 지연 규칙으로 다시 맞췄다.
- `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`와 rendered manifest/clip manifest 정적 검증은 통과했지만, 실제 in-engine 수동 확인이 남아 있어 guide와 일부 combat presentation parity blocker는 아직 닫지 않는다.
- hero 장비 sprite 7슬롯 parity 작업도 현재 세션에서 재개했다.
  - `HeroNativeClipSwap`, `HeroNativeVisualSwapSet`를 추가했고, `HeroVisualEquipmentState`는 이제 `HA_1`을 통짜 body swap만 보지 않고 `body clip 0..10 / glove clip 11..22` override 세트를 함께 만든다.
  - `EquipmentService.BuildHeroVisualEquipmentState()`는 웹과 같은 fallback 규칙(`body=slot1 ?? slot4`, `glove=slot4 ?? slot1`)으로 정리됐다.
  - `DungeonSprite2D`와 `DungeonRenderEntry2D`, `GreenfieldWorldRuntime`에는 hero clip swap bookkeeping / resolve 경로가 추가돼 `imageSourceIndex + clipIndex` 우선 소스 해석이 가능해졌다.
  - 다만 현재 작업면 기준으로 `GameScene.PlayerState`는 아직 track-only apply 경로(`ResolvePlayerHeroTrackSwaps` -> `ApplyHeroNativeTrackSwaps`)를 유지하고 있어, clip swap end-to-end wiring closeout은 아직 남아 있다.
  - 같은 시점의 build gate는 통과하지 못했다. 현재 워크트리에서는 `DungeonNeko-Godot/scripts/ui/GameUiCharacterPanel.cs`가 삭제된 상태여서 `GameUiManager.cs(127,13)`의 `GameUiCharacterPanel` 참조가 `CS0246`로 실패한다.

## 현재 작업면

- 실제 작업면은 `GameScene + HudController + CharacterInventoryOverlay + GreenfieldWorldRuntime + ApplicationLocalApiFacade`다.
- 최신 discrepancy 기준 핵심 재개방 범위는 `GameScene + GreenfieldWorldRuntime + HUD/minimap effect presentation`이다.
- 기본적으로는 추가 참조 문서 없이 `Classes/*`, `.server/*`, `res/*`, 현재 Godot 소스만 본다.
- 예외:
  - `Phase 9` 구조 리팩터링 작업은 반드시 `dev/active/godot-refactor/godot-refactor-plan.md`, `dev/active/godot-refactor/godot-refactor-context.md`, `dev/active/godot-refactor/godot-refactor-tasks.md`를 먼저 읽고 그 3문서를 정본으로 갱신한다.
  - `GameScene` 후속 분해는 `dev/active/godot-refactor-game-scene/godot-refactor-game-scene-plan.md`, `dev/active/godot-refactor-game-scene/godot-refactor-game-scene-context.md`, `dev/active/godot-refactor-game-scene/godot-refactor-game-scene-tasks.md`를 정본으로 사용한다.
  - `Phase 8` 전투/runtime 정리는 `dev/active/godot-phase8-combat/godot-phase8-combat-plan.md`, `dev/active/godot-phase8-combat/godot-phase8-combat-context.md`, `dev/active/godot-phase8-combat/godot-phase8-combat-tasks.md`를 정본으로 사용한다.
- UI 스케일은 `UiMetricScale = 2.0` 실치수 계산만 허용한다.
- 전투 presentation parity 기록은 `Phase 8` 섹션이 아니라 이 작업면 메모와 기존 `Phase 7` 관련 항목에만 남긴다.

## 확정 차이

- 이전 discrepancy log에서는 mystery dungeon down-gate guide가 `map=903 ... guide=0 sacred=0`으로 끝났고, 이번 세션에서 synthetic binding fallback과 `guide_data 우선 / gate tile,pixel fallback` 보정을 반영했다. 남은 것은 실제 runtime 노출 수동 확인이다.
- 웹은 gate trigger 좌표 기반 + overlap hide/show loop를 쓰고, 현재 Godot도 `guide_data 우선 / gate fallback`, `mystery down gate 강제 후보`, `hero overlap hide/show`까지 코드 반영을 마쳤다. 남은 것은 실제 runtime 노출 확인이다.
- hero -> monster hit effect는 이제 hero runtime sprite key에서 `:1/:2`를 파생해 web과 같은 `main hit + sub flare(style)` 구조를 우선 재생하고, spec을 못 찾는 경우에만 `maspr:0` fallback을 사용한다.
- monster death 때 사용자가 지적한 누락 이펙트는 death track이 아니라 hero-side hit presentation parity 문제였고, 현재는 `maspr:0` fallback 대신 web/Classes 기준 `commonspr:2` fallback을 우선 사용하도록 정리했다.
- hero incoming hit effect는 같은 계열 자산을 쓰더라도 현재 Godot 파이프라인이 raw transient + flash tween 구조라 parity가 다르다.
- 공격/상호작용 range도 이번 세션부터는 parity 복제가 아니라 Godot 전용 divergence로 분리했다.
  - 웹과 달리 Godot는 기본공격, monster attack validation, NPC interaction을 foot tile line scan/Manhattan이 아니라 sprite collision box와 world anchor rect overlap으로 계산한다.
- hero active skill 판정도 더 이상 `TryResolveFacingMonster(6)` 타일 스캔을 쓰지 않고, skill action state / hit event 순서별 rect + world line sample block 검사로 타깃을 고른다.
- level-up message effect(몬스터 처치 + mystery floor reward), hero/monster combat SFX 배선, expanded condition system, monster death reward delay, damage text frame/offset는 코드 반영을 마쳤고 실제 mystery runtime 체감 확인만 남아 있다.
- HUD popup/dialogue는 fullscreen blocker를 두고 열림 상태와 동기화하도록 정리했고, panel/button/quickslot/potion/inventory 계열은 `effect:0` UI 확인음을 공통 배선했다.
- CharacterInventoryOverlay는 더 이상 기존 `스탯/캐릭터/장비` 3분할 오버레이가 아니라, 웹 equipment reference와 같은 `좌측 장착 패널 + 우측 스탯 대시보드 + 하단 요약바` 레이아웃을 기본값으로 사용한다.
- inventory overlay의 판매/보관 액션은 시각 parity를 해치지 않도록 DETAIL 패널 하단 보조 액션으로 유지한다.
- `O` 패널은 inventory overlay의 단순 변형으로 두지 않고, `docs/opanel.png` 기준의 별도 character panel composition으로 다시 정렬한다.
  - hero preview는 paperdoll 대신 runtime hero visual swap/action/direction을 적용한 current hero preview를 사용한다.
  - 장비 슬롯은 실제 8개만 활성화하고 레퍼런스의 초과 프레임 2칸은 잠금 장식 슬롯으로 남긴다.
  - `I` 키가 이제 character/info/inventory 통합 패널의 단일 진입이고, 기존 `i/c/k` generic popup 경로는 제거한다.
  - `GameUiManager`는 현재 `SetQuickSlots()`를 새 패널로도 전달하고, ability tab bind/clear 요청도 기존 HUD quickslot mutation 이벤트로 다시 연결한다.
  - `GameUiManager` / `GameUiCommandContext`는 `GameUiHeroPreviewState`도 전달해 프리뷰 외형과 render mode를 동기화한다.
- 던전 보상 popup acceptance는 layout/behavior 모두 web 기준으로 재고정한다.
  - `1920x1080`, `1600x900`, `1280x720`에서 중앙 위치, 폭 `560px`, floor line 강조, section order, confirm/button close, `popupMode Off/ThreeSec`, `450ms 후 floor reload`를 기준 체크포인트로 사용한다.
- HUD/CharacterInventoryOverlay의 panel content layer와 passive layout control은 `MouseFilter.Ignore`로 정리되어, 시각 subtree가 버튼 hit test를 막지 않도록 수정했다.

## 잔여 범위

- 메인 맵 parity
  - `map 310 -> requested 151 -> resolved 300` fallback은 남아 있지만, 현재 세션 범위 밖으로 보류한다.
  - `폐광촌` 외 다른 맵 로딩 확장은 하지 않는다.

## 빠른 재개 가이드

1. 메인 맵 parity는 별도 차후 트랙으로 다룬다.
2. `폐광촌` 외 다른 맵 로딩 확장은 사용자 지시가 새로 있기 전까지 하지 않는다.
3. `Phase 7~10`은 새 parked 구현/정리 트랙이고, `Phase 11~12`는 기존 검증/자산 파이프라인 트랙이다.
4. UI 스케일/문서 운영 규칙은 그대로 유지한다.
5. `Phase 7` 구현 후속 검증은 `Phase 11`에서 시각/체감 parity 기준으로만 다룬다.

## 현재 검증 엔트리

- `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
- `python3 tools/pipeline/phase67_validation.py`

## 남은 핵심 리스크

- mystery dungeon guide / combat presentation parity가 남아 있어 현재 closeout 선언을 다시 무효화한다.
- 메인 맵 fallback은 차후 별도 트랙에서 다시 다뤄야 한다.
- `GameScene` 구조 리팩터링은 follow-up 트랙까지 완료됐고, 다음 구조 hotspot은 `GreenfieldWorldRuntime` 추가 분해다.
- hero 장비 sprite 7슬롯 작업은 clip override 모델과 runtime resolve는 들어왔지만, `GameScene` snapshot apply closeout과 build gate 복구가 남아 있어 아직 닫지 않는다.
