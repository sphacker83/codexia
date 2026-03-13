# DungeonNeko -> Web App 포팅 - Context

> [!IMPORTANT]
> ## 독립 트랙
> 웹 포팅은 Godot 포팅과 무관하게 독립 진행한다.
> - 로직 원천: `/Users/ethan/Workspace/dev/DungeonNeko/Classes/`
> - 리소스 원천: `/Users/ethan/Workspace/dev/DungeonNeko/Resources/`
> - 원본의 코드를 완벽히 구현하여, 동일한 결과값을 내는 것이 목적이다.

## SESSION PROGRESS (2026-03-02)

### ✅ COMPLETED
- Next.js + Phaser 3 기반 런타임 구축
- 맵/타일/오브젝트/NPC 배치 및 렌더 depth 정렬
- Hero 이동/애니메이션/카메라/맵 전환 구현
- ScriptDat 로딩 파이프라인 및 ScriptEngine 1차 구현
- QuestSystem(11종 타입) + React 오버레이 UI 골격 구축
- Monster/Combat 1차 루프(스폰/근접공격/처치보상) 구축
- `end_colosseum` 선택지(`지하로 내려간다`) 처리 및 로컬 미스테리 던전 진입 연결
- 로컬 미스테리 던전 사망 시 마을(폐광촌) 자동 복귀 처리
- `set_MysteryDungeon()` 규칙 기반 로컬 세션 초기화(stage/state/score/reward/HP/조건) 반영
- `set_MysteryDungeonMap()`/`set_MysteryDungeonMon()` 대응: 던전층 라벨, 303게이트, 층별 몬스터 스케일/수량 반영
- 원본 `set_MysteryDungeonMap()` 생성 알고리즘 이식
  - 12x12 경로 생성
  - 24x24 타일 변환
  - 120x120 확장 맵 생성
  - 게이트 생성(atb 60/61 + guide_data)
  - 던전 오브젝트/시작 좌표 배치
- `dungeonState` 전이(LOADING/PLAY/REWARDSHOW/RETURN/MENU/NETERROR/NOMONEY/FAIL/COMPLETE) 반영
- `NextMapNum == 303` 게이트 Down/Up 분기와 층 이동 동기화 반영
- 장비 효과/세트 효과/스킬/상태이상(8종) 전투 보정 반영
- 몬스터 실스프라이트(`MSPR_*`) 로딩/애니메이션 연결
- 몬스터 variant 스프라이트 파이프라인 추가(`tools/prepare-monster-sprites.py`)
- 몬스터 variant 스프라이트 전체 렌더 반영(187건)
  - 원본 `Resources/dat/MSPR_10/11` 일부 `spr_*.json` 부재 12건은 fallback 경로 유지
- 마을(폐광촌) 몬스터 스폰 차단 정합화
- 귀환 실패(`NO_MONEY/NET_ERROR`) 팝업 종료 후 입력 잠김 해소
- 초기 로딩 병목 1차 개선
  - 비전투 맵에서 몬스터 프리로드 스킵
  - NPC 스프라이트 프리로드/애니메이션 중복 제거
- 전투 핵심 공식 2차 정합화(원본 `GAME_FUNCTION.cpp` 기준)
  - `cal_HeroToMonDmg`의 141104 이후 공식 이식
    - `player.atk/pen/cri`, `Hero.HitRate/HighAtk/rage/luck/steal` 반영
    - `AtbState` 생성 및 추가 대미지/상태이상(6/7/8) 반영
  - `cal_MonToObjDmg` hero 분기 이식
    - `player.dodge`, `shieldBlockRate(+skillBlock)` 반영
    - 몬스터 crit/pen/def 스케일 대미지 반영
  - 원본 일반 근접공격 규칙에 맞춰 임의 랜덤 상태이상 부여 제거
- 전투 이펙트 스프라이트 1차 정합화
  - `MASPR`/`ATBEFFSPR` 프리로드 및 1회성 재생 루틴 추가
  - 타격/크리티컬/회피/가드/AtbState(6/7/8)/레벨업 이벤트에서 스프라이트 이펙트 호출
  - `getGameEffectDepth` 추가로 이펙트 depth를 drawType 기반으로 고정
  - 전투 텍스트 depth를 UI 대역으로 상향해 가림 현상 완화
  - 레벨업 팝업 문구에서 원본 무관 `localStorage` 안내 제거
- 리소스 툴 외부화(루트 `/tools` 단일 소스) 1차 반영
  - 웹 자산 스크립트 엔트리(`assets:*`, `verify:assets`)를 `dungeon-neko-web/package.json`에 추가
  - `prepare-monster-sprites.py`, `prepare-npc-sprites.py`, `prepare-npc-scripts.py`를 루트 `tools/`로 통합
  - `convert-npclist.py`, `sync-assets.sh` 루트 `tools/`에 통합
  - `render_sprites.py` 경로 탐색 우선순위(ENV -> `tools/render_sprites.py` -> 외부 fallback) 적용
  - 자산 검증 스크립트 추가
    - `tools/verify_sprite_coverage.py`
    - `tools/verify_effect_keys.py`
  - 문서 갱신
    - `tools/README.md`, `dungeon-neko-web/README.md` 루트 툴 사용법 반영
    - `dungeon-neko-web/tools/*` 제거 완료(루트 `/tools` 단일 경로)
- 전투 스프라이트 정합화(2차)
  - Hero 공격/스킬 액션 hold를 프레임 기반으로 조정(기존 160ms 고정 제거)
  - `GET_MONSUBHIT`를 원본 `SD_SetStyleSpr(... SSPR_SMOOTHFLAREOUT ...)` 규칙으로 근사 구현
    - job별 copyCount/spread/frameStride 반영
- 루트 툴 체인 보강
  - `tools/render_sprites.py` 복구(원본 이력 기반)
  - `python3 tools/prepare-monster-sprites.py --force`로 몬스터 variant 190건 재렌더 확인
- UI 정책 단순화
  - 원본 UI/CHFONT 경로를 제거하고 Phaser(Web) UI 단일 모드로 복귀
  - `LegacyGameUiRenderer`/`ctxResource`/`legacyBitmapFont` 삭제
  - UI presentation 상태/토글(F1/F2)/`localProgress.ui` 저장 구조 제거
  - 단, HUD 시각 요소는 사용자 선호에 맞춰 원본 백플레이트(`INTERFACEIMG/img_1.png`)만 부분 유지
- 클래스0 스킬 좌표/이동/피격 판정 정합화(2차)
  - 스킬 히트 판정을 `colBox` 중심으로 재구성하고 지형 통과 불가 경로(`chk_AtbPntToPnt`) 제외
  - 스킬 프레임 이동(`SD_GetFrameMovePixel`)을 액션별 프레임 이동량으로 반영
  - 스킬 사용 중 입력 이동을 잠금해 스킬 이동과 일반 이동 중복 제거
  - 스킬5 이펙트 좌표를 시전 시점 좌표/방향으로 고정
  - 스킬 시전 자동 타깃 방향 회전(`tryFaceHeroToNearestTarget`) 복구
- 런타임 합성 프레임 오리진 정합화(3차)
  - 런타임 텍스처에 프레임 `origin_x/y` 메타 저장
  - Hero/Monster/NPC/전투 이펙트가 프레임 오리진을 사용하도록 공통 적용
  - Hero 기준선 호환 보정 추가로 상시 상향 렌더 체감(1~2타일) 완화
- 모바일 터치 컨트롤 W3 UI 프로토타입 반영(1차)
  - 캔버스 입력 정책 보강: `touchAction: none`
  - 입력 파이프라인 추가: `touch_move`(up/down/left/right), `touch_attack`(1~6)
  - 좌측 8방향 조이스틱 적용(원본 `TOUCHIMG/img_2` 베이스/노브 사용)
  - 우측 공격 버튼 원본 스타일 반영(`TOUCHIMG/img_1` 반쪽 미러링)
  - 모바일에서 기존 하단 6개 퀵슬롯 숨김 + 원본 좌표 기반 6슬롯 배치
  - 모바일 6개 슬롯에 스킬 아이콘 삽입(`SKILLICON/img_6~img_11`)
- 캔버스 하단 프로토타입 문구(`DungeonNeko Web Porting · Phase W3 UI Prototype`) 제거
- 웹 런타임 캔버스 가변 해상도 적용(브라우저 뷰포트 기반)
  - `visualViewport/resize` 기반으로 Phaser 캔버스 크기 동기화
  - 캔버스 클램프 정책 적용: 기본 `1280x720`, 권장 범위 `960x540 ~ 1920x1080`
  - 소형 뷰포트(모바일) fallback 최소치 `320x240` 허용
  - 터치 컨트롤 좌표를 캔버스 동적 너비/높이 기준으로 재계산
  - 패널/대화창 UI를 캔버스 크기 기반 브레이크포인트(스케일/폭)로 보정
- BootScene 타이틀/로딩 레이아웃 정합화
  - 타이틀 배경(`title_bg`)을 현재 캔버스 전체로 표시
  - 타이틀 로고/시작 문구를 현재 뷰포트 중앙/하단 기준으로 재배치
  - 해상도 리사이즈 이벤트에서 타이틀 요소 재정렬
  - 부트 로딩 패널을 뷰포트 중심 기준으로 유지
- HUD/패널 UI 확대 및 가변 스케일 조정
  - HUD/퀵슬롯 스케일을 캔버스 기준으로 확대(데스크톱 최대 약 2배 근접)
  - 패널/대화/팝업 크기를 캔버스 크기 기반으로 확대/가변화
- 미스터리던전 통로 폭 보정 패스 조정
  - 과도한 통로 확장(최소 3칸 강제) 로직 제거
  - 직선 협로만 통로 폭 `+1칸` 확장하는 보수적 패스로 교체
  - 신규 개방 타일의 `img`는 기본 바닥 타일(`51`)로 고정해 맵 규칙/게이트 조건과 충돌하지 않도록 복구
- 미스터리던전 생성 개성 강화(프로필 기반)
  - 아키타입 프로필 4종(`linear`/`branchy`/`open`/`maze`) 적용
  - 프로필별 경로 길이/방향 성향(직진/굴절) 제어값 반영
  - 완전 트리 구조 고정을 완화하는 제한적 루프 허용
  - 룸 스탬프 배치 패턴(`2x2`/`3x2`/`2x3`) 반영
  - 프로필별 매크로 지형 차별화 적용
    - `branchy`: 사이드 브랜치 버스트 확장
    - `open`: 4~6 타일 허브 공간 확장
    - `maze`: 브랜치 확장 + 인접 2면 기반 위빙 카브
- 미스터리던전 `maze` 프로필 실미로 생성 분기 추가
  - 랜덤워크 기반 경로와 분리해 DFS(2-step carving) 기반 격자 미로 생성
  - 제한적 루프 카브 + 외곽 내부 라인 확장으로 단조로운 막힘 구간 완화
- 원본 미니맵 대응 구현
  - `MainScene` 오버레이 그래픽으로 미니맵 렌더(벽/길/게이트/NPC/영웅 포인트)
  - `miniMapDat` 방식 탐색 reveal(영웅/NPC 주변 3x3) 반영
- 공격/스킬 중 벽 끼임 완화
  - 히어로 위치가 충돌 불가 상태로 판정될 때 최근접 안전 타일 중심으로 자동 복구
  - 스킬 프레임 이동/일반 이동 이후 모두 복구 루틴 적용
- 타일 벽 돌출부 이슈 원인 분석
  - `setDungeonObject()`에서 `atb` 충돌값을 추가로 심지만 시각 타일(`img`)은 부분적으로만 갱신
  - 결과적으로 “보이는 길”과 “실제 충돌” 불일치 구간이 자주 발생
- 서버 액션 로컬 이식(W4-L) 1차 반영
  - `localProgress`에 `playerSave` 구조 추가(영웅/성장/인벤/창고/장착슬롯 저장)
  - `MainScene.initializeUiState()`에서 저장된 로컬 세이브를 복원하도록 연결
  - 인벤토리/장비 패널에 장착/해제 명령 추가(`inventory_toggle_equip`, `equipment_unequip`)
  - 장착 상태 기반 장비 스탯 자동 재계산(무기/갑옷/장신구) 및 로컬 저장 동기화
  - 레벨업 시 `statPoint +4` 누적, 요구 경험치 `level^2 + 20` 규칙 반영
  - 아이템 `options/socket/plus` 필드 로컬 저장 유지 및 아이템 상세 UI 표시 반영
- MainScene 분리 사이드 트랙 계획 문서화(2026-03-03)
  - `dev/active/mainscene-modularization/` 3파일(plan/context/tasks) 생성
  - 기능 묶음(Bundle A~H) 기준 분해 순서와 게이트 정의

### 🟡 IN PROGRESS
- W3 ScriptEngine/QuestSystem 고도화
- W4 던전 네트워크 API 연동 준비
- 광산 관리자 경유 로컬 미스테리던전 경로를 서버 API 경로로 전환

### 🔧 이번 세션 문서 정정
- 원본 C++ 재검증 결과를 바탕으로 W2 구현 상태를 문서 3종(plan/context/tasks)에 반영
- 던전 생성/게이트/몬스터 스프라이트 정합화 작업 내역 추가
- 광산 관리자 기반 로컬 던전 진행 정책(localStorage)으로 운영 정책 정렬
- 리소스 규칙 변경 대응용 웹 로딩/적용 마이그레이션 계획 문서 추가
  - `dev/active/web-porting/web-resource-loading-migration-plan.md`
- 리소스 로딩/적용 마이그레이션 P0~P3 코드 반영
  - 계약 타입 추가: `src/game/resources/runtimeLayerTypes.ts`
  - 로더 분리: `src/game/resources/resourceLoader.ts`
  - 런타임 합성기 분리: `src/game/resources/runtimeLayerComposer.ts`
  - `MainScene` 인라인 런타임 합성 로직 제거 후 모듈 기반 재구성
  - 적용 정책 고정: `MASPR_*`, `ATBEFFSPR_*`만 런타임 합성
  - 맵 전환 시 map-scoped 텍스처/애니메이션/합성 캐시 정리 루틴 추가
- 모바일 UI 수정분 문서 반영
  - 터치 조이스틱/공격 버튼/6슬롯 좌표 고정 + 모바일 하단 퀵슬롯 숨김
  - 모바일 6개 슬롯 스킬 아이콘(`SKILLICON`) 리소스 반영
- 몬스터 공격 이펙트 정합화(2026-03-03)
  - `BattleResourceController`의 투사체형 공격이 반환하는 `impactDelayMs`를 `MonsterCombatController` hit 타이밍에 연결
  - 즉시형 이펙트와 투사체형 이펙트를 동일 루프에서 공존 처리
  - 런타임 레이어 매니페스트 로더를 신규 경로 우선으로 변경
  - `render_sprites.py` clip 메타 탐색 규칙 보강(`_pltalpha`/palette suffix)
  - source asset 복사 시 `.clips.json` 동시 복사
  - 관련 리소스 재생성 실행:
    - `python3 tools/pipeline/prepare_hero_effect_sprites.py --force --emit-runtime-layers`
    - `python3 tools/pipeline/prepare-monster-sprites.py --force --emit-runtime-layers`
- 장비/아이템 리소스 정합화(2026-03-03)
  - 장비 장착 정규화 로직을 Classes 7슬롯 내부 규칙으로 확장(0/1/2/3/4/5/6), UI는 기존 3슬롯 표시를 유지
  - accessory 계열 장착 토글 시 ring/glove 포함 타입이 동일 내부 슬롯 기준으로 교체/해제되도록 정리
  - 아이템 아이콘 로딩 구조 확인: Classes는 `ITEMIMG.cmb` 엔트리 기반 + 기본 `clip=-1` full draw, 웹은 추출된 `ITEMIMG/img_*.png`를 `public/assets/sprites/source/ITEMIMG` 경로로 공개해 직접 사용
- 장비 UI 7슬롯 확장(2026-03-03)
  - 오버레이 장비 패널 표시를 Classes 슬롯 단위(투구/갑옷/좌반/무기/장갑/우반/신발)로 재구성
  - 슬롯 클릭 시 카테고리 기반 해제(`equipment_unequip`) 대신 실제 장착 인벤 슬롯 기반 토글(`inventory_toggle_equip`)로 변경
- 히어로 장비 외형 반영(2026-03-04)
  - Classes `set_HeroArmorImg`/`set_HeroWeaponImg` 대응으로 `HSPR` 레이어 `img_num(0/1/2/3)`에 장착 코스튬 인덱스 오버라이드를 추가
  - 오버라이드 소스: `HA_0`(투구), `HA_1`(몸통), `HA_2`(신발), `HW_{job}`(무기)
  - 장착/해제(`inventory_toggle_equip`)와 UI 초기화 복원 직후 히어로 프레임 재합성 큐를 실행해 즉시 시각 반영
  - `res/img/HA_*`, `res/img/HW_*`의 원본 이미지/클립을 `public/assets/sprites/source`로 동기화해 런타임 오버라이드 소스를 확보
  - 장착 시 런타임 크래시(`glTexture/sourceSize` null) 대응: 재합성 직후 `Hero.createAnimations()`으로 애니메이션 프레임 참조를 재생성하고, 재합성 동안 히어로를 숨긴 뒤 `try/finally`로 가시성 복구를 보장
  - 장착 후 히어로 애니메이션 정지(걷기/공격/스킬) 회귀 대응: `Hero.playAnimation()`에서 애니메이션 키/프레임 비정상 감지 시 런타임 재생성 후 재시도, `sprite_index` 기대 프레임 수와 비교해 1프레임 고정 상태도 자동 복구
  - 클래스0 모바일 슬롯1 스킬 몸체 분리 회귀 수정(2026-03-06)
    - 원인: `CLASS0_SKILL_SLOT1`을 히어로 본체 override로 처리하면서 `HSPR_1_spr_0 action_10`의 타 직업 body pose가 클래스0 장비 레이어와 직접 섞였음
    - 수정: 슬롯1은 히어로 본체 override를 중단하고, `HSPR_1 action_10`에서 비-히어로 레이어만 effect-only 별칭으로 분리 생성해 히어로 위치를 따라가는 외부 오버레이로 재생
    - 합성기 확장: `RuntimeLayerComposer.composeSpriteFrames()`에 `layerFilterMode('all'|'hero_body'|'non_hero')` 추가
  - 알파 블렌딩 적용 범위 확장(2026-03-06)
    - `splitEffectLayers`를 Hero 외 `MSPR_*`, `NSPR_*`, `COMMONSPR`, `ATBEFFSPR`, 맵 가이드/성석 경로까지 적용
    - Monster/NPC/맵 오브젝트/전투 이펙트 companion sprite 동기화를 공통 `RuntimeEffectLayerController` 경로로 확장
    - 직접 이미지 자원(`SKILLICON`, `ITEMIMG`, `TOUCHIMG`, `INTERFACEIMG`)은 raw CSS background / raw `<img>` 대신 공통 픽셀 자산 렌더러로 통합
    - 모바일 터치 조작 UI는 원본 `DGS_ALPHA 178`에 맞춰 opacity를 반영
  - mixed frame 알파 누락 보정(2026-03-06)
    - 기준 케이스: `HSPR_0 action_14`
    - 원인: Hero mixed frame를 companion sprite로 분리하면서 primary 이전 세그먼트(`MULTIPLY/SCREEN` underlay)에 scene-level blend를 다시 적용해 assetmng 대비 레이어가 약화/소실됨
    - 수정: primary 이전 세그먼트는 로컬 프레임에서 이미 계산된 결과로 보고 Phaser render blend를 `NORMAL`로 고정, primary 이후 세그먼트만 기존 blend 유지
  - Hero split 회귀 복구(2026-03-06)
    - 원인: Hero 경로에서 `splitEffectLayers`를 전면 제거하면서 scene-level blend가 필요한 알파 연출까지 같이 사라졌음
    - 수정: Hero 초기 합성, 장비 재합성, 슬롯1 effect-only 별칭 합성은 다시 `splitEffectLayers`를 사용하고, 대신 mixed frame underlay render mode 보정만 유지
    - 추가 수정: 런타임 합성 캐시가 `split/filter` 옵션을 무시하던 문제를 수정해 dev/hot reload에서도 새 경로로 재합성되도록 보정
  - Monster/NPC body split 회귀 보정(2026-03-06)
    - 기준 케이스: 카를(`MSPR_7_spr_5_mon_140/186`, source `MON_6`)
    - 원인: `MON_6` body 내부의 `style 12(MULTIPLY)` shadow 레이어까지 companion sprite로 분리되며 Phaser scene-level `MULTIPLY`가 assetmng의 픽셀 합성과 다르게 작동해 본체가 과도하게 검게 보였음
    - 수정: Monster/NPC 본체는 다시 단일 캔버스 런타임 합성으로 유지하고, split companion 경로는 전투/부가 effect sprite에만 사용
  - assetmng 고품질 합성 기준 런타임 정렬(2026-03-06)
    - 기준: `assetmng`의 `CompositeSpriteCanvas renderMode="high-quality"`는 RGB565 절삭 없이 full-color 픽셀 합성을 수행하며, 배경 on/off 프리뷰에서도 알파 결과가 안정적임
    - 정책 전환: Hero/전투 이펙트/맵 가이드/성석의 compose 호출처에서 `splitEffectLayers` 기본 사용을 중단하고, assetmng와 같은 단일 캔버스 합성을 우선 적용
    - 예외: `CLASS0_SKILL_SLOT1`의 `layerFilterMode: 'non_hero'` alias는 유지하되, alias 합성 자체는 split companion 레이어 없이 단일 캔버스로 생성
  - assetmng 고품질 기준 재정렬 2차(2026-03-06)
    - 재확인 결과: `assetmng`는 `renderMode(legacy/high-quality)`와 `backgroundTileMatch`를 함께 사용해 source-only 스타일과 destination-aware 스타일을 구분해 미리보기한다
    - 구현 결과:
      - `GameOverlay` 상단 HUD에 `레거시 / 고품질` 토글을 추가했고, `GameUiState.display.spriteRenderMode` + `localProgress.spriteRenderMode` + `MainScene.spriteRenderMode`로 상태를 유지한다
      - `MainScene`은 render mode 변경 시 `runtimeLayerComposer` 캐시를 비우고 Hero 장비 스프라이트와 맵 오브젝트를 재합성한다
      - `MapSystem`은 render mode를 texture cache key에 포함하고, `refreshMapObjectSprites()` 엔트리로 토글 시 오브젝트만 다시 그릴 수 있게 정리했다
      - `runtimeLayerComposer`는 `legacy/high-quality`를 지원하고, mixed-style frame을 `baseCanvas + companion segment effectLayers`로 분해해 destination-aware 스타일이 실제 장면 배경 위에서 다시 blend되도록 보정했다
      - source-only 스타일은 연속 구간 단위 `NORMAL` 세그먼트로 유지하고, destination-aware 스타일은 companion segment로 분리해 레이어 순서를 보존한다
      - 후속 최적화: source/object 후보 URL 생성을 `assetmng` 기준(`exact -> 필요한 alpha/indexed fallback`)으로 축소해 `img_*_0`, `_pltalpha_0`, `_0_pltalpha` 선행 404를 줄였다
      - 후속 최적화: 초기 맵 진입 시 무의미했던 NPC 선행 스캔을 비우고, 공용 전투 이펙트 warmup은 `delayedCall(1200ms)`로 늦춰 첫 진입 직후 멈춤 체감을 줄이도록 조정했다
      - 3차 최적화: `runtime_image_asset_index.json` + `runtimeImageSourceStore`를 추가해 source/object PNG 후보 존재 여부를 정적 인덱스로 판정하고, 합성은 `scene.textures.get(...).getSourceImage()` 기반 직접 참조로 전환했다
      - 3차 최적화: `BootScene`은 `obj_data`, `map_10/*`, `runtime_image_asset_index`를 JSON cache에 선적재하고, `MapSystem`/`DungeonFlowController`는 cache 우선 + fetch fallback으로 바꿨다
      - 3차 최적화: `MapSystem`은 `mapobj_runtime_*` active key를 추적해 맵 전환/렌더 모드 토글 시 안전 제거하고, `runtimeLayerComposer`는 `onTextureKey`로 `__fx_` companion texture까지 map-scoped cleanup 대상에 포함한다
      - 3차 최적화: dead preload였던 `queueSpriteFrames()` 경로와 부트 시점 no-op preload 호출을 제거했고, 상점/맵/NPC script JSON은 불필요한 `no-store` fetch를 줄였다
      - 3차 최적화: `CreateFlowController`는 타이틀 직후 hero compose/map guide compose를 더 이상 선행 `await`하지 않고, `MapLoadingController`가 `new Hero(...)` 직전 hero frame/animation을 보장한다
      - 3차 최적화: 맵 가이드/성석은 현재 맵의 `runtimeGates.guide` 또는 `mystery_sacred_stone`가 있을 때만 `ensureMapGuideResourcesReady()`를 호출해 준비한다
      - 후속 버그 수정: `initializeUiState()`의 선행 장비 합성과 `MapLoadingController.ensureHeroSpriteResourcesReady()`의 기본 스프라이트 합성이 서로 덮어쓰던 레이스를 제거했다. 초기 히어로 보장 경로도 현재 `inventory`의 `buildHeroLayerSourceOverrides()`를 사용해 장비 상태 그대로 합성한다
  - render mode 체감 미반영 보정(2026-03-06)
    - 원인 1: `dungeon-neko-web`의 `renderMode`는 런타임 합성 캐시와 RGB565 양자화까지는 연결돼 있었지만, 최종 Phaser 표시층은 `pixelArt` 경로로 고정돼 있어 `assetmng`처럼 표시 품질 차이가 눈에 띄게 드러나지 않았다
    - 원인 2: `MainSceneDomainWiring.ensureHeroSpriteResourcesReady()`가 기본 Hero 경로에서 텍스처 존재만 보고 조기 종료해, render mode 전환 뒤에도 이전 mode Hero 텍스처를 재사용할 수 있었다
    - 수정: Hero 기본 ensure 경로는 `layerClipSourceOverrides`까지 포함한 실제 시그니처 기준으로만 재사용하고, 조기 종료 분기를 제거해 stale Hero 텍스처를 막았다
    - 수정: `MainScene`에 `highQualityDisplayEnabled`를 추가하고, 상단 HUD의 별도 `표시 HQ` 옵션으로 Phaser texture filter(`LINEAR/NEAREST`), camera `roundPixels`, canvas `image-rendering`을 제어하게 분리했다
    - 수정: `runtimeLayerComposer`와 `MapSystem`은 새로 추가/갱신하는 canvas texture마다 scene의 display filter를 다시 적용해 토글 이후 생성되는 Hero/NPC/몬스터/맵 오브젝트도 즉시 같은 표시 정책을 따른다
    - 수정: `NpcPipelineController.ensureCameraFollowHero()`의 `startFollow(..., true, ...)` 고정을 제거하고 현재 display 옵션에 맞는 `roundPixels` 설정을 사용한다
    - 정책: `레거시 / 고품질` 토글은 계속 합성 모드만 담당하고, `표시 HQ`는 최종 출력층 보정 옵션으로 독립 유지한다
    - 후속 버그 수정: `VisionFogController`가 카메라 초기화 이전 토글/업데이트 시 `camera.width`를 바로 읽어 runtime crash가 나던 문제를 nullable-safe 가드로 막았다. 카메라가 없으면 game size 기준 viewport와 중앙 fallback을 사용한다
    - 잔여 리스크/검증 공백:
      - `MainScene.ts`, `MainSceneFeatureWiring.ts`, `MainSceneLifecycleWiring.ts`는 기존 파일 고유 eslint 오류(`no-this-alias`, `no-explicit-any`) 때문에 전체 녹색이 아님
      - 전체 `tsc -p tsconfig.json --noEmit`는 현재 기존 `Monster.ts` 타입 오류 1건 때문에 계속 실패함
      - 브라우저 실기동 기준의 Hero/전투 이펙트/맵 오브젝트 스모크, 그리고 source/object 정확 경로 prewarm 이후의 first-load frame time은 아직 별도 로그로 고정하지 못함
- 성장/보상 서버 정합화 2차(2026-03-04)
  - 기준: `.server/sdu_control.php`, `.server/neko_model.php`, `.server/setup.php`
  - `ProgressionService`를 서버 규칙으로 재정렬: `addstat/resetstat/get_reward` 수식/errCode/경계 처리
  - 정수 처리 보정: `vit/intg` 파생 HP/MP는 `12.8/4.2` 소수 증가를 유지하고(소수 1자리 정규화), `get_reward`의 `full` 판정은 서버와 동일한 인벤 30 고정으로 보수 정렬

- 2026-03-06: 몬스터 본체 lazy ensure + refcount/TTL eviction 적용
  - `BattleResourceController`에 몬스터 본체 `resolve/ensure/retain/release/clearMonsterBodySpriteCache` 경로를 추가해 `spriteName` 단위로 본체 프레임/애니메이션을 공유하도록 정리
  - `preloadMonsterSprites()`는 이제 몬스터 공격/변형 이펙트만 map-scoped로 준비하고, 본체 compose/createAnimations는 `MonsterSpawnGateController.spawnMonsters()` 직전에만 수행한다
  - active refcount가 0이 되면 30초 TTL 뒤 본체 frame texture / companion `__fx_` texture / animation key / runtime layer cache를 함께 정리한다
  - 몬스터 사망은 `destroy()`가 아니라 `disableBody(true, true)`로 끝나는 경로가 있어, spawn 시점에 `disableBody`를 래핑해 release를 보장하고 `DESTROY` 이벤트와의 중복 해제는 `releaseOnce`로 차단했다
  - 맵 전환과 씬 종료는 TTL을 기다리지 않고 `clearMonsterBodySpriteCache()`로 강제 eviction하며, 로딩 HUD 문구도 `몬스터 이펙트 준비`와 `몬스터 본체 준비` 단계로 분리했다
- 2026-03-06: same-tab reset 캐시 보존 최적화
  - `SceneLifecycleController.handleSceneShutdown()`은 더 이상 `runtimeLayerComposer.clearAllCaches()`를 호출하지 않는다
  - 대신 `BattleResourceController.preserveMonsterBodySpriteCacheForSceneReset()`를 통해 몬스터 본체 cache를 보존 상태로 전환한다
  - 보존 상태에서는 본체 texture/anims/runtimeLayer cache와 `managedMonsterBodySprites`는 유지하고, shutdown 직전 TTL timer와 refcount/compose promise bookkeeping만 정리한다
  - 맵 전환 cleanup(`MapLoadingController.loadLevel`)의 `clearMonsterBodySpriteCache()`와 render mode 변경 시 `runtimeLayerComposer.clearAllCaches()`는 그대로 유지한다
- 2026-03-06: 던전 층 전환 히어로 재합성 회귀 수정
  - 원인: `queueHeroEquipmentSpriteRefresh()`와 `ensureHeroSpriteResourcesReady()`가 서로 다른 재사용 조건을 사용해, 같은 장비/같은 render mode 상태에서도 던전 층 전환마다 Hero를 다시 합성하고 있었다
  - 수정: Hero 장비/렌더 모드/slot1 effect 식별자를 `MainScene.buildHeroEquipmentSpriteSignature()`로 통일하고, 실제 적용 완료 상태는 `lastHeroEquipmentSpriteSignature`, 중복 요청 차단은 `pendingHeroEquipmentSpriteSignature`로 분리했다
  - 수정: `MainSceneDomainWiring.ensureHeroSpriteResourcesReady()`는 동일 시그니처 + base frame/animation 존재 시 즉시 return하고, compose/create 후에는 `markHeroEquipmentSpriteSignatureReady()`로 재사용 상태를 기록한다
  - 기대 결과: Hero는 첫 로딩에서 만든 프레임/애니메이션을 던전 층 전환 동안 계속 재활용하고, 장비 탈착이나 render mode 변경 때만 다시 합성한다
- 2026-03-06: 좌상단 HUD를 순수 웹 UI로 교체
  - 기존 `GameOverlay` 좌상단 상태 박스는 `INTERFACEIMG/img_6` atlas clip을 잘라 붙이는 방식이라 화면 스케일/브라우저 렌더링에 취약했고, 최근 HUD 깨짐 회귀도 이 경로에서 발생했다
  - `img_6` 기반 backplate/아이콘 clip 의존을 제거하고, 상단 우측 토글 바와 같은 녹청 계열 border/gradient/shadow를 쓰는 CSS 카드 HUD로 재작성했다
  - 새 HUD는 `mapName`, `level`, `hp/maxHp`, `mp/maxMp`, `exp/nextExp`, `gold`, `next level exp`를 직접 그리며, 모바일 세로 화면에서는 우측 상단 바 아래로 내려 겹침을 피한다
  - 정책 정리: HUD는 더 이상 원본 이미지 리소스에 기대지 않고 웹 UI 컴포넌트로 유지한다
- 2026-03-06: Hero shared skill effect를 장비 갱신 경로에서 분리
  - `CLASS0_SKILL_SLOT1`의 `HSPR_1 action_10 non_hero` alias는 장비 오버라이드와 무관한 shared runtime effect로 재분류했다
  - Hero 본체 `sprData` 전체 compose/createAnimations는 기존처럼 초기 hero ensure와 장비 갱신 경로에서 유지하고, slot1 effect alias는 `MainScene.ensureClass0SkillSlot1EffectResourcesReady()`가 별도로 보장한다
  - slot1 effect readiness는 `renderMode` 기준 시그니처로 관리하고, 같은 render mode에서 FX 애니메이션이 이미 존재하면 즉시 return한다
  - 결과적으로 장비 탈착 시 Hero 본체만 다시 합성하고, slot1 shared effect alias는 초기 hero resource ensure와 render mode refresh에서만 준비된다
- 2026-03-06: 장비 탈착 시 Hero 프레임 오염/검은 화면 회귀 보정
  - 원인: override 합성이 기본 프레임 키를 덮어쓰더라도 `runtimeLayerComposedSpriteSignatures`의 base 시그니처가 살아 있어, 장비 해제 시 base compose가 캐시 단축으로 스킵될 수 있었다
  - 수정: `RuntimeLayerComposer.composeSpriteFrames()`는 `hasLayerOverrides=true` 합성이 성공하면 해당 `frameKeySpriteName`의 base compose 시그니처를 즉시 삭제한다
  - 기대 결과: 장비 해제는 항상 base 프레임 재합성을 수행해, equipped frame 잔류/렌더 깨짐/검은 화면 회귀를 방지한다
  - 후속: 3차에서 compose 시그니처에 override 서명(`ovr=...`)을 포함하는 방식으로 전환하면서, 위 임시 invalidation 방식은 대체됨
- 2026-03-06: 장비 탈착 지연/메모리 급증 2차 보정
  - 원인 1: `queueHeroEquipmentSpriteRefresh()`는 844프레임 compose를 동기 루프로 수행해 장비 탈착 시 메인 스레드 점유가 컸다
  - 원인 2: Hero 장비 조합이 바뀔 때마다 `runtimeLayerComposedFrameCache`에 override 시그니처별 프레임 캐시가 누적되지만, Hero 경로에서는 해당 캐시를 정리하지 않아 세션 메모리 사용량이 증가했다
  - 원인 3: 장비를 연속으로 바꿀 때 이전 요청들이 직렬 큐에 그대로 남아, 최신 요청 전에 불필요한 재합성이 반복될 수 있었다
  - 수정:
    - `RuntimeLayerComposer.clearSpriteComposedCaches(spriteName)`를 추가해 compose 결과 캐시(`runtimeLayerComposedFrameCache`/`runtimeLayerComposedSpriteSignatures`/frame blend cache)만 선택적으로 정리
    - Hero 장비 재합성 시작 시 위 compose 캐시를 정리하고, frame 4개마다 `waitMs(0)`로 주기적 양보를 넣어 UI 멈춤을 완화
    - 장비 재합성 큐 실행 시작 시 `requestedSignature !== pendingSignature`면 구형 요청을 스킵해 최신 요청 우선으로 정리
  - 기대 결과: 장비 탈착 체감 지연 완화, 장기 플레이 중 Hero compose 캐시 누적 억제, 연속 탈착 시 엉뚱한 중간 상태 재합성 감소
- 2026-03-06: Hero 장비 갱신 체감 반응성 3.5차 보정
  - `queueHeroEquipmentSpriteRefresh()`를 2단계 compose로 재구성했다.
    - 1단계: `action_0/1 + 현재 재생 action`만 우선 compose 후 즉시 `refreshCurrentAnimationPose()` 적용
    - 2단계: 전체 action 백필 compose로 스킬/공격 프레임을 후속 정합
  - 연속 토글 중 최신 요청만 남기도록 stale 가드를 추가했다. compose 도중 `pendingHeroEquipmentSpriteSignature`가 바뀌면 `HERO_EQUIP_REFRESH_STALE`로 즉시 중단한다.
  - Classes/assetmng 기준 시각 오버라이드는 `HA_0/HA_1/HA_2/HW_{job}`만 유지한다(장갑 슬롯은 시각 오버라이드 비대상).
- 2026-03-06: 장갑/갑옷 분리 합성 회귀 수정
  - 원인: 런타임 레이어 오버라이드가 `img_num` 단위만 지원해서(`layerSourceOverrides[img_num]`), `HA_1`의 body/glove clip을 독립 소스로 지정할 수 없었다.
  - 수정:
    - `RuntimeLayerComposer`에 `layerClipSourceOverrides`(`img_num:clip_num`)를 추가하고, compose/cache 시그니처(`ovr`)에 clip override를 포함했다.
    - `MainScene` Hero 장비 합성에서 `HA_1`을 clip 그룹으로 분리했다.
      - body clip: `0~10` -> body(slot1, fallback glove)
      - glove clip: `11~22` -> glove(slot4, fallback body)
  - 효과: 장갑/갑옷 동시 장착 상태에서 장갑 교체가 갑옷 영역을 덮어쓰지 않고, 갑옷 교체가 장갑 영역을 침범하지 않도록 합성 경로를 분리했다.
- 2026-03-06: 스킬 연출 중 임시 이펙트 누적 가드
  - `BattleResourceController`/`CombatEffectController`의 one-shot 이펙트 sprite에 fail-safe destroy 타이머를 추가했다(약 1.6~1.8초)
  - 애니메이션 완료/중지 이벤트가 누락되더라도 임시 이펙트와 POST_UPDATE 리스너가 세션에 잔류하지 않도록 생명주기 보장을 강화했다
  - 기대 결과: 스킬 연타/장시간 전투에서 임시 이펙트 객체 누적에 따른 메모리 상승과 프레임 정체 완화
- 2026-03-06: 장비 탈착/스킬 프리즈 3차 원인 규명 및 수정
  - 원인 1(검은 화면/오염 프레임): `RuntimeLayerComposer.upsertFrameTexture()`에서 texture source canvas와 compose canvas가 동일한 경우(`sourceImage === canvas`) `clearRect + drawImage`를 수행해 자기 캔버스를 지우는 경로가 있었다.
  - 원인 2(메모리 급증): `runtimeLayerComposer` 내부 캐시(manifest/image/pixel/composedFrame/frameBlend/signature)와 `runtimeImageSourceStore.resolvedImageRefCache`가 상한 없이 누적되어, 스킬 연타/장시간 세션에서 메모리 사용량이 지속 상승했다.
  - 원인 3(장비 탈착 지연): override compose 시 시그니처가 override 정보를 포함하지 않아 캐시 재사용 판단이 약했고, Hero 장비 경로에서 매번 compose 캐시를 강제 비우며 재합성을 반복했다.
  - 수정:
    - `upsertFrameTexture()`에 `sourceImage===canvas` 보호 분기 추가(자기 캔버스 복사 금지).
    - compose 시그니처에 `ovr=<layerOverrideSignature>`를 포함하고 override/non-override 공통으로 시그니처 캐시를 사용.
    - Hero 장비 갱신에서 `clearSpriteComposedCaches(spriteName)` 강제 호출 제거.
    - `runtimeLayerComposer`/`runtimeImageSourceStore` 캐시에 LRU 상한을 도입하고, asset index 빈값 고착을 보정.
  - 기대 결과: 장비 탈착 시 검은 화면/엉뚱 스프라이트 재현률 감소, 탈착 체감 지연 완화, 스킬 연타 시 프리즈 발생 빈도 완화.

## 원본 재검증 결과 (핵심 근거)

1. 광산 관리자 데이터
- `instances["568"]`: name=`광산 관리자`, `scr_num=804`
- `map_configs["314"].npc_list`에 `568` 포함
- 파일: `dungeon-neko-web/public/data/npcs.json`

2. 스크립트 종료 상태
- `SCS_ENDSCRIPT_COLOSSEUM(9)` 정의
- 해당 종료 시 `scriptLoadingType = SLT_TALK_COLOSSEUM`
- 파일: `Classes/CHSCRIPT.h`, `Classes/CHGAME_SCRIPT.cpp`

3. 상태 전이
- `SLT_TALK_COLOSSEUM` -> `MS_COLOSSEUM`
- 콜로세움 선택에서 `MS_MYSTERYDUNGEON` + `set_MysteryDungeon()`
- 파일: `Classes/CHGAME_SCRIPT.cpp`, `Classes/KEYEVENT_MAIN.cpp`

4. 던전 층 이동
- 게이트 `NextMapNum == 303`에서 `call_DungeonDown()`/`call_DungeonUp()` 분기
- 파일: `Classes/UPDATE_MAIN.cpp`

5. 네트워크 의존 루프
- `request_DungeonInfo`, `request_DungeonDown`, `request_DungeonUp`, `request_ReturnTown`, `request_DungeonDead`
- 응답으로 능력치/장비/보상/층 정보 동기화
- 파일: `Classes/GAME_NET.cpp`, `Classes/HelloWorldScene.cpp`

## 현재 코드와 원본 사이 갭

- 던전 생성/게이트/사망복귀/로컬 진행은 W2 범위에서 원본 구조에 맞춰 정합화됐다.
- 서버 연동 이전에, 서버 액션 로컬 이식(W4-L)로 경제/성장/장착의 런타임 정합화를 우선 진행한다.
- 성장/보상/스탯 분배 공식(`get_reward`, `addstat`, `resetstat`)은 서버 기준 2차 정합화를 완료했고, 남은 핵심 갭은 W3 스크립트/퀘스트 세부 커맨드 반영이다.
- 남은 단기 갭은 스킬 2/3/4/5/6 실기 검증 로그 고정(벽/장애물/밀집 몬스터 조건)이다.
- 추가 갭: 몬스터 스킬 기반 상태이상/특수공격(`UPDATE_MAIN.cpp`의 몬스터 스킬 루프)은 아직 미이식이다.
- 추가 갭: 원본 리소스 부재로 `MSPR_10/11` 계열 12건은 생성 불가 상태다.
  - 현재 저장소에 `Resources/dat/MSPR_10.dat`, `Resources/dat/MSPR_11.dat`가 없음
  - `verify_sprite_coverage.py` unresolved: monster id `80,81,89,90,93,94,95,96,97,99,174,175`
- 치명타 정합화 완료: `HeroCombatProfileBuilder`를 Classes 기준으로 정렬했고, 치명타 UI 표기 정렬까지 반영했다.
- 스킬 1/6 알파블렌딩 정합화: 전투 런타임의 `splitEffectLayers`가 primary 이전 blend segment까지 effect sprite로 분리하면서 원본 합성 순서를 깨고 있었다.
  - `runtimeLayerComposer`에서 primary 이전 segment는 base canvas에 함께 합성하고, primary 이후 segment만 effect layer로 유지하도록 수정했다.
  - 영향 범위: `CLASS0_SKILL_SLOT1(HSPR_1 action_10 non_hero)`와 `CLASS0_SKILL6(HSPR_0 action_14)`의 pre-primary blend frame
- 최신 런타임 기준 정정: Hero는 frame blend mode 메타를 직접 쓰지 않고 companion effect layer sprite에 의존하므로, broad `splitEffectLayers`는 assetmng 고품질 기준과 어긋난다.
  - 현재 기준은 `splitEffectLayers`를 가능한 한 끄고, effect-only alias가 꼭 필요한 경우만 `layerFilterMode`를 유지하는 것이다.
- 최신 구현 정정(2026-03-06 2차): 위 정책만으로는 destination-aware 알파/스크린 계열 효과가 실제 맵 배경과 다시 섞이지 못한다.
  - 현재 기준은 `splitEffectLayers`의 broad 사용은 피하되, Hero/전투 이펙트/맵 가이드/성석처럼 assetmng 기준에서 배경 합성이 필요한 경로는 selective effect layer 복원을 허용하는 것이다.
  - 동시에 런타임 전체에 `renderMode=legacy/high-quality` 토글을 도입해 RGB565 재현과 RGBA 고품질을 명시적으로 전환한다.
- 다음 구현 세션 우선 처리:
1. 스킬 2/3/4/5/6 실기 검증 로그 고정(좌표/오프셋/이펙트 앵커)
2. `SCS_CREATEQUEST/RENEWALQUEST/DELETEQUEST` 반영
3. 몬스터 스킬 전투 루프 이식(상태이상/원거리 판정 포함)

## POLICY (정정본)

1. 광산 관리자 경로는 원본 시나리오(`SCS_ENDSCRIPT_COLOSSEUM -> MS_MYSTERYDUNGEON`)를 기준으로 진입시킨다.
2. W2 범위에서는 광산 관리자 대화 이후 네트워크를 무시하고 로컬 상태머신으로 던전을 진행한다.
3. W2 로컬 진행 데이터는 localStorage(`bypassNetworkFromMineManager`)로 유지한다.
4. W4에서 서버 API 경로(`DungeonInfo/Down/Up/ReturnTown/Dead`)를 병행/전환한다.

## Quick Resume

다음 세션 재개 순서:
1. 스킬 2/3/4/5/6 실기 검증 로그 고정(벽/장애물/밀집 몬스터 조건)
2. `web-porting-tasks.md`의 W3 상태머신 연결 항목(`ENDSCRIPT_COLOSSEUM`) 마무리
3. W4 던전 API 5종 클라이언트/DTO 구현
4. 서버응답 기반 던전 상태머신 병행/전환
