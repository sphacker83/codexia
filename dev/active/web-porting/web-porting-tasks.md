# DungeonNeko -> Web App 포팅 - Task Checklist

> [!IMPORTANT]
> **독립 트랙**: Godot 포팅과 무관.
> 참조 원천: 원본 C++ (`/Classes`), 원본 리소스 (`/Resources`), 공용 변환 도구(루트 `/tools/*.py`).
> 원본의 코드를 완벽히 구현하여, 동일한 결과값을 내는 것이 목적이다.

## Resource Tooling Externalization (2026-03-02)

- [x] 웹 스크립트 엔트리를 루트 `/tools` 기준으로 제공
  - `dungeon-neko-web/package.json`
  - `assets:convert`
  - `assets:monster-sprites`
  - `assets:npc-sprites`
  - `verify:assets`
- [x] `web/tools` 핵심 스크립트를 루트 `tools`로 통합
  - `tools/prepare-monster-sprites.py`
  - `tools/prepare-npc-sprites.py`
  - `tools/prepare-npc-scripts.py`
  - `tools/convert-npclist.py`
  - `tools/sync-assets.sh`
- [x] `render_sprites.py` 경로 하드코딩 완화
  - 우선순위 탐색: 환경변수 `DUNGEON_NEKO_RENDER_SPRITES` -> `tools/render_sprites.py` -> `DungeonNeko-Godot/tools/render_sprites.py`
  - 미발견 시 탐색 경로를 포함한 명확한 에러 메시지 출력
- [x] 자산 검증 스크립트 추가
  - `tools/verify_sprite_coverage.py`
  - `tools/verify_effect_keys.py`
- [x] 문서 갱신
  - `tools/README.md`
  - `dungeon-neko-web/README.md` (루트 툴 사용법 + `dungeon-neko-web/tools` 제거 안내)
- [x] `dungeon-neko-web/tools` 물리 삭제

## 전투 스프라이트/리소스 정합화 (2026-03-02)

- [x] Hero 공격/스킬 액션 유지시간을 프레임 기반으로 보정
  - 기존 고정 160ms -> `sprite_index` 기반 동적 hold(`260~900ms` clamp)
  - 증상(`ESC 팝업 시 정상처럼 보임`)의 근본 원인인 공격 애니 조기 덮어쓰기 완화
- [x] `GET_MONSUBHIT`를 원본 스타일 렌더(`SSPR_SMOOTHFLAREOUT`) 규칙으로 정합화
  - 기존: 단일 일반 이펙트 재생
  - 변경: 원본 파라미터(job별 count/spread/frameStride) 기반 다중 복제 + smooth flare 이동
- [x] `tools/render_sprites.py` 복구(원본 이력 기반)
  - `prepare-monster-sprites.py`가 루트 툴만으로 동작하도록 경로 일치
- [x] 몬스터 스프라이트 전수 재생성 실행
  - `python3 tools/prepare-monster-sprites.py --force`
  - 결과: 190건 렌더 성공
- [ ] 누락 리소스 12건 해결 (`MSPR_10/11` 계열)
  - `verify_sprite_coverage.py` unresolved 12건 잔존
  - 원인: `Resources/dat/MSPR_10.dat`, `Resources/dat/MSPR_11.dat` 원본 미존재(현재 저장소 기준)
  - 영향 몬스터: 80, 81, 89, 90, 93, 94, 95, 96, 97, 99, 174, 175

## 몬스터 투사체/공격 이펙트 정합화 (2026-03-03)

- [x] 몬스터 원거리 공격의 타격 판정을 투사체 도달 지연 기반으로 동기화
  - `BattleResourceController.playMonsterAttackEffect()` 반환 `impactDelayMs`를 사용
  - `MonsterCombatController.updateMonsters()`에서 지연 콜백으로 hit 처리
  - 즉시형 공격은 기존 즉시 판정 유지
- [x] 런타임 매니페스트 로딩 우선순위 조정
  - 신규 경로 우선: `rendered/{spriteName}/layer_manifest.json`
  - 구 경로는 하위호환 fallback 유지
- [x] `render_sprites.py` clip 메타 탐색 확장
  - `img_*_pltalpha*.png` 케이스에서도 대응 `.clips.json` 탐색
  - source asset 복사 시 `.clips.json` 동시 복사
- [x] effect/monster 관련 런타임 레이어 재생성
  - `prepare_hero_effect_sprites.py --force --emit-runtime-layers`
  - `prepare-monster-sprites.py --force --emit-runtime-layers`
- [ ] 잔여 `source_rect` 누락 케이스 추가 정밀화
  - 현재는 `_pltalpha` 계열 누락이 크게 감소했으나, 원본 clip 메타 미보유/슬롯 매핑 불일치 구간이 남아 있음

## Classes 클립/장비슬롯 정합화 (2026-03-03)

- [x] `source_rect` 누락 처리 규칙을 Classes 기준으로 정정
  - 규칙: `clip_num < 0`은 전체 이미지 사용, `clip_num >= 0`인데 clip rect 메타가 없으면 fallback 전체 PNG draw 금지
  - 파이프라인(`render_sprites.py`)에서 해당 레이어 스킵 처리
  - 런타임(`runtimeLayerComposer`)에서도 동일 조건 레이어 스킵 가드 추가
- [x] `COMMONSPR` 슬롯 매핑을 Classes 사용 규칙으로 확장
  - `prepare_hero_effect_sprites.py`에서 `spr_0..29` 주요 variant의 `GamePlayImg` 슬롯 매핑 보강
  - `set_gameEff`/`draw_mapItem`/`draw_mapWeather` 사용군 반영
- [x] 재생성 후 누락 집계 개선 확인
  - 지표(유효 manifest, `clip_num>=0 && source_rect 없음 && pre-clipped 아님`): `TOTAL_MISSING 92`
  - `COMMONSPR/HSPR/MASPR` 구간은 `0`으로 감소
- [x] Classes 장비 슬롯 시각 반영 범위 교차검증
  - 시각 반영 슬롯: `0(CAP)`, `1(BODY)`, `3(WEAPON)`, `6(BOOTS)`
  - 비시각(스탯 전용) 슬롯: `2(LEFT RING)`, `4(GLOVE)`, `5(RIGHT RING)`
- [x] 웹 인벤토리/세이브 모델에 장비 메타 보존 확장
  - `secondSubType/thirdSubType`, `costumeImage/costumePalette` 필드 보존
  - 카탈로그 로드/인벤 생성/로컬세이브 직렬화-복원 경로에 전파
- [x] 웹 장비 모델 7슬롯화(Classes `EquipItem[0..6]`) 및 영웅 런타임 재합성
  - 장비 UI를 7슬롯(투구/갑옷/좌반/무기/장갑/우반/신발)으로 확장하고 해제 동작을 실제 인벤 슬롯 토글로 연결
  - 영웅 합성에 `costumeImage/costumePalette` 기반 `HA_0/1/2`, `HW_{job}` 오버라이드를 연결
  - Classes 기준 시각 반영 슬롯(0/1/3/6)과 비시각 슬롯(2/4/5) 구분을 유지
- [x] Hero split 회귀 복구 및 합성 캐시 보정
  - 대상: Hero 초기 합성, 장비 재합성, `CLASS0_SKILL_SLOT1` effect-only 별칭
  - 조치: `splitEffectLayers`를 복구하고, 합성 캐시에 `split/filter` 시그니처를 포함
  - 이유: split 제거가 실제 알파 연출 소실로 이어졌고, 기존 캐시가 compose 옵션 변경을 반영하지 못했음

## 스킬 좌표/모션/오리진 정합화 (2026-03-02)

- [x] 클래스0 스킬 히트 판정을 원본 `colBox` 기준으로 재정렬
  - 단일 nearest 타깃 의존을 줄이고 스킬별 박스 충돌로 타깃 수집
  - 통과 불가 지형(`chk_AtbPntToPnt`) 경로는 히트 제외
- [x] 클래스0 스킬 프레임 이동(`SD_GetFrameMovePixel`) 반영
  - 액션별 프레임 이동량 테이블 적용(스킬1/2/4/5/6)
  - 이동은 `Hero_MoveCHeck` 패턴으로 부분 이동 허용
- [x] 스킬 사용 중 이동 입력 잠금 처리
  - 스킬 프레임 이동과 일반 이동의 중복 적용 차단
- [x] 스킬5 이펙트 앵커를 시전 시점 좌표/방향으로 고정
  - 시전 중 캐릭터 좌표 변화와 이펙트 좌표 분리
- [x] 스킬 시전 시 자동 타깃 방향 회전 로직 복구
  - 스킬 시작 시 `tryFaceHeroToNearestTarget(40)` 재적용
- [x] 런타임 합성 스프라이트 프레임 오리진(`origin_x/y`) 반영
  - 텍스처 메타에 프레임별 `displayOrigin` 저장
  - Hero/Monster/NPC/전투 이펙트 렌더에 공통 적용
- [x] Hero 렌더 기준선 호환 보정 추가
  - 오리진 정합화 후 발생한 상시 상향 표시(1~2타일 체감) 완화
  - 기존 웹 기준선은 유지하면서 프레임별 튐만 제거
- [ ] 실기 검증 로그 고정(2/3/4/5/6번 스킬)
  - 벽 인접/경사/대각 입력 동시 조건에서 프레임 단위 좌표 로그 채집 필요

## 원본 플로우 정정 (2026-03-01)

- [x] 광산 관리자 NPC 식별 확인: instance `568`, script `804`, map key `314`  
  (`dungeon-neko-web/public/data/npcs.json`)
- [x] 스크립트 종료 상태 `SCS_ENDSCRIPT_COLOSSEUM(9)` -> `SLT_TALK_COLOSSEUM` 로딩 분기 확인  
  (`Classes/CHGAME_SCRIPT.cpp`)
- [x] `SLT_TALK_COLOSSEUM` -> `MS_COLOSSEUM` 상태 진입 확인  
  (`Classes/CHGAME_SCRIPT.cpp`)
- [x] 콜로세움 선택에서 `MS_MYSTERYDUNGEON` + `set_MysteryDungeon()` 진입 확인  
  (`Classes/KEYEVENT_MAIN.cpp`)
- [x] 던전 게이트(`NextMapNum == 303`)에서 `call_DungeonDown/Up()` 호출 확인  
  (`Classes/UPDATE_MAIN.cpp`)
- [x] 던전 네트워크 체인 확인: `request_DungeonInfo/Down/Up/ReturnTown/Dead`  
  (`Classes/GAME_NET.cpp`, `Classes/HelloWorldScene.cpp`)
- [x] W2 개발 운영 정책 재정의: `광산 관리자` 대화 이후에는 네트워크 무시 로컬 진행(localStorage 기반) 허용

## Phase W0: 프로젝트 셋업 ✅ COMPLETED
- [x] Next.js 프로젝트 생성 (App Router + TypeScript)
- [x] Phaser 3, Zustand, Lucide React 설치
- [x] `GameCanvas.tsx` 브릿지 구현
- [x] `sync-assets.sh` 실복사 동기화 스크립트 구현
- [x] `BootScene.ts` 초기 렌더링 검증
- [x] 공용 JSON(`monsters.json`, `items.json`) 복사

## Phase W1: 맵 & 캐릭터 ✅ COMPLETED
- [x] `MAP_10.dat` -> JSON 변환 및 배치
- [x] `MapSystem.ts` 맵 로딩/렌더링 구현
- [x] Tilemap + `mapImg_*` 타일셋 연동
- [x] 오브젝트 렌더(`ObjData.dat`, `OB_*`, draw_type depth) 반영
- [x] 주인공 이동/애니메이션/카메라/맵 전환 구현
- [x] NPC 배치 + 대화 트리거 구현

## Phase W2: 전투 & 던전 코어 ✅ COMPLETED
- [x] `Monster.ts` 1차 AI(배회/추격/근접) 구현
- [x] `CombatSystem.ts` 1차 수식 이식
- [x] 처치 보상(경험치/골드/드롭) 1차 구현
- [x] `광산 관리자(804)` 대화 -> `end_colosseum` 선택지 -> 로컬 미스테리 던전 진입(개발 모드) 연결
- [x] 로컬 미스테리 던전에서 사망 시 마을(폐광촌) 복귀 처리
- [x] `set_MysteryDungeon()` 초기화 규칙 정밀 이식
- [x] `set_MysteryDungeonMap()`/`set_MysteryDungeonMon()` 규칙 이식
- [x] `dungeonState` 전이(LOADING/PLAY/REWARDSHOW/RETURN/MENU/NETERROR/NOMONEY/FAIL/COMPLETE) 반영
- [x] `NextMapNum == 303` 게이트 처리와 Down/Up 분기 동기화
- [x] 장비 효과/세트 효과/스킬/상태이상(8종) 정밀 이식
- [x] 몬스터 실스프라이트(`MON_*`, `MSPR_*`) 적용
- [x] 원본 `set_MysteryDungeonMap()` 핵심 알고리즘 이식
  - 12x12 `makeDungeonPath`
  - 24x24 `convertDungeonMap`
  - 120x120 `resizeDungeonMap`
  - `createMysteryDungeonGate`(atb 60/61, `NextMapNum=303`, guide 좌표)
  - `setDungeonObject`, `set_HeroPositionInDungeon`
- [x] 던전 게이트 트리거를 목적지 좌표가 아닌 `guide_data`/타일 atb(60~79) 기준으로 정합화
- [x] 마을(폐광촌)에서 몬스터 스폰 차단
- [x] 던전 사망 시 마을(폐광촌) 복귀 고정
- [x] 귀환 실패(`NO_MONEY/NET_ERROR`) 팝업 종료 후 입력 잠김 해소
- [x] 몬스터 variant 스프라이트 파이프라인 추가
  - `tools/prepare-monster-sprites.py` (루트 단일 소스로 이관)
  - 런타임 키 우선순위: `MSPR_{group}_spr_{variant}_mon_{id}` -> `MSPR_{group}_spr_{variant}` -> `MSPR_{group}`
  - 전체 몬스터 variant 렌더 반영(187건), 원본 sprite json 누락 12건은 fallback 유지
- [x] 초기 로딩 병목 1차 개선
  - 비전투 맵에서 몬스터 후보/스프라이트 프리로드 스킵
  - NPC 스프라이트 프리로드/애니메이션 생성 시 중복 키 제거
- [x] 원본 전투 핵심 수식 정밀 이식(2차)
  - `cal_HeroToMonDmg`(141104 이후 공식) 반영:
    - `player.pen`/`player.atk` 기반 baseDmg
    - `Hero.HitRate - Mon.Agi` 명중 판정
    - `player.cri(0~10000)` 크리 판정
    - `rageRate`, `luck`, `stealHpRate`, `stealSpRate` 반영
    - `AtbState`(1~8) 생성 및 추가 대미지 규칙 반영
  - `cal_MonToObjDmg`(hero 대상 분기) 반영:
    - `player.dodge` 회피
    - `shieldBlockRate(+skillBlock)` 가드
    - 몬스터 crit/pen/def 스케일 기반 대미지 산출
  - 임의 랜덤 상태이상 부여 제거:
    - 일반 근접공격에서는 원본과 동일하게 임의 상태이상 미부여
    - Hero 공격 `AtbState==6/7/8`일 때만 몬스터 상태이상 적용
- [x] 전투 이펙트 스프라이트 파이프라인 1차 정합화
  - `MASPR`/`ATBEFFSPR` 프리로드 + 1회성 애니메이션 런타임 재생 루틴 추가
  - 전투 타격/크리티컬/회피/가드/속성상태(AtbState 6/7/8)/레벨업 시점 이펙트 연결
  - `game effect depth` 계산 추가로 이펙트 렌더 순서 고정
  - 전투 텍스트 depth를 UI 대역으로 상향하여 가림 이슈 차단
  - 레벨업 팝업 문구에서 원본과 무관한 `localStorage` 안내문 제거
- [x] 전투 이펙트 원본 `set_gameEff` 기준 2차 정합화(스프라이트 오연결 수정)
  - 원인: 기존 `COMMONSPR` 키가 여러 `spr_*`가 섞인 렌더 결과라 `GamePlaySpr[2]/[7]/[29]` 1:1 대응 불가
  - 조치: 원본 `spr_N` 전용 키 재생성/분리
    - `COMMONSPR_spr_0`(gate guide), `COMMONSPR_spr_2`(GET_HEROHIT), `COMMONSPR_spr_7`(GET_LEVELUP/GUARD/MISS), `COMMONSPR_spr_29`(GET_CRITICAL)
    - `ATBEFFSPR_spr_0..3`(GET_HEROATBEFF0..3)
    - `HSPR_{job}_spr_1/2`(GET_MONHIT/GET_MONSUBHIT)
  - 런타임 호출도 원본 규칙으로 교체
    - Hero normal hit: `GET_MONHIT + GET_MONSUBHIT` 동시 호출
    - Hero critical: `GET_CRITICAL`(dir random 0..3)
    - miss/guard/levelup: `GET_MISS_*`/`GET_GUARD`/`GET_LEVELUP` state 고정
    - `AtbState 1..8` 전체 이펙트 매핑 + 상태이상 적용은 원본과 동일하게 6/7/8만 유지

## Phase W3: UI & 퀘스트 🟡 IN PROGRESS
- [x] HUD/인벤토리/장비/스킬/퀘스트/대화 UI 1차 구현
- [x] Hero 전투 프로필 계산식 공용화(`HeroCombatProfileBuilder`)
  - `MonsterCombatController`와 장비 UI가 동일 수식 사용
- [x] 장비창 능력치 패널 확장
  - 명중/치명타/관통/회피/가드/분노/흡혈/흡마
  - 속성 발동/속성 크리/상태저항을 스크롤 목록으로 전부 노출
- [x] `QuestSystem.ts` 11종 타입 모델 구현
- [x] `ScriptEngine.ts` 대화/종료 액션 파싱 기반 구현
- [x] UI 정책 단순화(원본 UI/CHFONT 폐기)
  - Phaser(Web) UI 단일 모드로 고정
  - `LegacyGameUiRenderer`/CHFONT/토글(F1/F2)/presentation 상태 제거
  - localProgress의 `ui` 저장 구조 제거
- [x] HUD 원본 스타일 부분 복원
  - 전체 원본 UI는 유지하지 않고, 좌상단 HUD 백플레이트만 원본 리소스(`INTERFACEIMG/img_1.png`) 사용
- [x] 모바일 터치 UI 1차 구현(원본 좌표 기준)
  - 좌측 8방향 조이스틱 + `touch_move` 명령 연결
  - 우측 공격 버튼(원본 `TOUCHIMG/img_1` 반쪽 미러) + `touch_attack` 연결
  - 모바일에서 하단 6개 퀵슬롯 숨김 처리
  - 모바일 6개 슬롯을 원본 좌표로 배치
  - 캔버스 하단 프로토타입 문구 제거
- [x] 모바일 6개 슬롯 스킬 아이콘 삽입
  - 원본 리소스 복사: `public/assets/ui/original/SKILLICON/img_6~img_11.png`
  - 슬롯 렌더에 `SKILLICON` 아이콘 매핑 반영
- [x] 아이템 아이콘 공개 경로 정렬
  - `ITEMIMG` export 경로를 `public/assets/sprites/source/ITEMIMG`로 고정
  - `ItemIcon` 참조 경로를 `/assets/sprites/source/ITEMIMG/img_*.png`로 변경
- [x] 클래스0 모바일 슬롯1 스킬 몸체 분리 수정
  - `CLASS0_SKILL_SLOT1`의 히어로 본체 override 제거
  - `HSPR_1 action_10`의 비-히어로 레이어만 effect-only 별칭(`__skillslot1fx`)으로 분리 생성
  - 슬롯1 입력 시 effect-only 별칭을 히어로 위치를 따라가는 외부 오버레이로 1회 재생
- [x] 알파 블렌딩 적용 범위 확장
  - Hero 외 `MSPR_*`, `NSPR_*`, `COMMONSPR`, `ATBEFFSPR`, 맵 가이드/성석 compose 경로에도 `splitEffectLayers`를 적용
  - Monster/NPC/맵 오브젝트/전투 이펙트 sprite가 companion layer를 자동 동기화하도록 공통 controller를 사용
  - `SKILLICON`/`ITEMIMG`/`TOUCHIMG`/`INTERFACEIMG` 직접 렌더 경로를 공통 픽셀 자산 컴포넌트로 통합
  - 모바일 터치 UI에 원본 `DGS_ALPHA 178` opacity를 적용
- [x] assetmng 고품질 기준으로 split 호출처 축소
  - 기준: Hero는 frame blend mode 메타를 직접 쓰지 않고 effect layer sprite에 의존하므로, broad `splitEffectLayers`가 assetmng 고품질 합성과 충돌함
  - 조치: `MainScene`, `BattleResourceController`, `MainSceneLifecycleWiring`에서 Hero/전투 이펙트/맵 가이드/성석 compose 호출의 `splitEffectLayers: true`를 제거
  - 예외: `CLASS0_SKILL_SLOT1`의 `layerFilterMode: 'non_hero'` alias는 유지하되 split companion 레이어는 사용하지 않음
- [x] assetmng 고품질/레거시 런타임 토글 도입
  - `GameOverlay` 상단 버튼 열에 `레거시 / 고품질` 토글 추가
  - `GameUiState`, `GameUiCommand`, `localProgress`에 render mode 상태 저장
  - `MainScene`에 `spriteRenderMode` 상태와 `setSpriteRenderModeFromUi()`를 추가하고, Hero/맵 오브젝트 재합성 및 runtime cache reset을 연결
- [x] selective effect layer 복원
  - Hero/전투 이펙트/맵 가이드/성석은 primary 이후 destination-aware style segment만 companion effect layer로 복원
  - mixed frame underlay는 base canvas에 유지해 기존 darkening 회귀를 막음
  - mixed-style frame은 `baseCanvas + companion segment effectLayers`로 정리하고, 필요 시 `NORMAL` segment도 companion layer로 남겨 레이어 순서를 보존
- [x] 맵 오브젝트 render mode 정렬
  - `MapSystem`에 legacy/high-quality quantization 분기 추가
  - source-only style은 캔버스 precompose, destination-aware style은 sprite blend mode 사용
  - `_pltalpha`/palette 후보 탐색과 rendered texture cache key에 render mode 포함
  - `refreshMapObjectSprites()`로 토글 시 오브젝트 재렌더 엔트리 추가
- [x] 런타임 후보 URL/워밍업 최적화
  - `runtimeLayerComposer`의 source 후보를 `assetmng` 기준으로 축소해 exact 우선, alpha/indexed는 필요한 경우만 fallback으로 탐색
  - `MapSystem` 오브젝트 후보도 `_pltalpha.png`/exact를 `_pltalpha_0`/`_0_pltalpha`보다 우선하게 정리
  - NPC 선행 스캔은 no-op으로 비우고, 공용 전투 이펙트 warmup은 `delayedCall(1200ms)`로 늦춰 첫 진입 프레임 드랍을 완화
- [x] 합성용 이미지 직접 참조 전환
  - `runtime_image_asset_index.json` 생성(`sprites/source`, `objects`, `sprites/rendered png`)
  - `runtimeImageSourceStore` 도입: exact 존재 여부는 정적 인덱스로 판정하고, 실제 합성은 Phaser texture cache의 source image 직접 참조로 처리
  - `runtimeLayerComposer`는 `new Image().src` 경로를 제거하고, `onTextureKey`로 `__fx_` companion texture까지 map-scoped cleanup 대상에 포함
  - `MapSystem`도 object source를 direct reference로 prewarm한 뒤 `mapobj_runtime_*`를 생성하도록 전환
- [x] JSON 캐시 우선 로딩/반복 fetch 축소
  - `BootScene`에 `obj_data`, `map_10/*`, `runtime_image_asset_index` preload 추가
  - `MapSystem.loadMap()`/`ensureObjDataLoaded()`/`DungeonFlowController.ensureMysteryDungeonTemplateMap()`는 cache 우선으로 전환
  - `ShopScriptBridgeController`는 shop list JSON 메모이제이션, `npcScript`는 `no-store` 제거
- [x] dead preload 및 텍스처 정리 경로 정리
  - `queueSpriteFrames()`와 Hero/NPC/Monster preload helper 제거
  - `MainScene.preload()`의 no-op sprite preload 제거
  - `MapSystem`은 active object texture key를 추적해 맵 전환/모드 토글 시 안전 제거
- [x] 몬스터 본체 lazy ensure + refcount/TTL cache
  - `BattleResourceController`에 몬스터 본체 `resolve/ensure/retain/release/clearMonsterBodySpriteCache`를 추가
  - `preloadMonsterSprites()`는 공격/변형 이펙트만 map-scoped로 유지하고, 본체는 `MonsterSpawnGateController.spawnMonsters()` 직전에 `spriteName` 단위로 ensure
  - 같은 `spriteName` 여러 마리는 본체 프레임/애니메이션을 공유하고, refcount가 0이 되면 30초 TTL 뒤 texture/anims/runtime cache를 정리
  - 사망 시 `disableBody(true, true)` 경로도 release가 되도록 래핑하고, 맵 전환/씬 종료는 TTL을 기다리지 않고 강제 eviction
- [x] same-tab reset 런타임 캐시 보존
  - `SceneLifecycleController`의 shutdown 경로에서 `runtimeLayerComposer.clearAllCaches()` 호출 제거
  - `BattleResourceController.preserveMonsterBodySpriteCacheForSceneReset()`를 추가해 shutdown 시 몬스터 본체 cache는 eviction 대신 보존 상태로 전환
  - 보존 상태는 TTL timer 제거 + refcount/compose promise 리셋만 수행하고, texture/anims/runtimeLayer cache는 그대로 유지
  - 맵 전환 cleanup의 `clearMonsterBodySpriteCache()`와 render mode 변경 시 `clearAllCaches()`는 유지
- [x] mixed frame underlay blend 보정
  - 기준 케이스: `HSPR_0 action_14`
  - primary 이전 세그먼트는 이미 로컬 프레임에서 style 계산이 끝난 underlay로 간주하고 Phaser scene-level blend를 `NORMAL`로 고정
  - primary 이후 세그먼트만 기존 blend mode를 유지해 overlay effect를 계속 표현
- [x] Monster/NPC body split 회귀 보정
  - 기준 케이스: 카를(`MSPR_7_spr_5_mon_140/186`, source `MON_6`)
  - `MON_/NPC_` body sprite compose에서 `splitEffectLayers`를 제거해 assetmng와 같은 단일 캔버스 픽셀 합성 경로로 복귀
  - dedicated battle/common effect sprite만 split companion 경로를 유지
- [x] 웹 캔버스 가변 해상도/클램프 정책 적용
  - 브라우저 `resize/visualViewport` 이벤트 기반 `Phaser.ScaleManager.resize()`
  - 캔버스 범위: 기본 `1280x720`, 권장 `960x540 ~ 1920x1080` (모바일 fallback `320x240`)
  - 타일/스프라이트 배율 고정(`zoom=1`) 유지
  - 터치 컨트롤/패널/대화창을 캔버스 크기 기준 앵커/브레이크포인트로 보정
- [x] BootScene 타이틀/로딩 배치 HD/가변 캔버스 정렬
  - 타이틀 배경 풀스크린 표시(`title_bg` display size = viewport)
  - 타이틀 로고/시작 문구를 viewport 중심/하단 기준으로 배치
  - `Phaser.Scale.Events.RESIZE` 시 타이틀 화면 재배치
  - 부트 로딩 UI 중심 정렬 유지
- [x] HUD/창 UI 확대
  - HUD/퀵슬롯 확대 스케일 적용(데스크톱 기준 대폭 확대)
  - 패널/대화/팝업 창 크기 가변 확대
- [x] 미스터리던전 통로 폭 +1칸 보정
  - 과도한 최소폭 3칸 강제 로직 제거
  - 직선 협로에 한해 통로 폭을 1칸만 넓히는 보정 패스 적용
  - 신규 개방 타일은 기본 바닥 타일(`img=51`)로 고정해 맵 규칙 충돌/누락 이슈 복구
- [x] 미스터리던전 생성 개성 강화(프로필 기반)
  - 아키타입 프로필 4종(`linear`/`branchy`/`open`/`maze`) 적용
  - 프로필별 경로 길이/방향 성향(직진/굴절) 제어값 반영
  - 완전 트리 구조 고정을 완화하는 제한적 루프 허용
  - 룸 스탬프 배치 패턴(`2x2`/`3x2`/`2x3`) 반영
  - 프로필별 매크로 지형 차별화(`branch burst`/`open hub`/`maze weave`) 반영
- [x] 미스터리던전 실미로(`maze`) 생성 분기 구현
  - DFS 기반 격자 카빙(2-step)으로 랜덤워크와 다른 미로 구조 생성
  - 제한적 루프 카브 + 외곽 내부 확장으로 연결성 보정
- [x] 원본 미니맵 대응 구현
  - `MainScene` 그래픽 오버레이 미니맵 렌더(벽/길/게이트/NPC/영웅)
  - 영웅/NPC 주변 타일 reveal(`miniMapDat` 방식) 반영
- [x] 공격/스킬 후 벽 끼임 완화
  - 불법 충돌 위치 감지 시 최근접 안전 타일 중심 복구(`recoverHeroFromBlockedPosition`)
- [x] 타일 벽 돌출부/보이는 길-충돌 불일치 원인 분석
  - 원인 규명 완료(수정은 별도 요청 대기)
- [ ] `ENDSCRIPT_COLOSSEUM` 처리 후 콜로세움/미스터리던전 상태머신 완전 연결
- [ ] `SCS_CREATEQUEST(109)`/`SCS_RENEWALQUEST(110)`/`SCS_DELETEQUEST(111)` 정밀 반영
- [ ] UI 더미값 제거 및 실제 플레이 데이터 완전 연결

## Phase W4: 네트워크 & 폴리싱 🔺 PRIORITY UP
- [ ] `ApiClient.ts` + 인증 세션 기반 기본 클라이언트
- [ ] 던전 핵심 API 연동: `DungeonInfo`, `Down`, `Up`, `ReturnTown`, `Dead`
- [ ] 응답 매핑: 능력치/장비/보상/pos 동기화 (원본 `request_Dungeon*` 기준)
- [ ] 네트워크 대기(`MS_NETWAIT`) 및 오류(`SS_DUNGEONNETERROR`) UX 처리
- [ ] 상점/창고/대장간/랭킹 등 비던전 API 연동
- [ ] 반응형/PWA/배포/크로스브라우저 최적화

## Phase W4-L: 서버 액션 로컬 이식 (2026-03-03)
- [x] 로컬 저장 모델 확장 (`localStorage`)
  - `localProgress.playerSave`에 `hero/progression/inventory/warehouse/equipmentSlots` 저장
  - 기존 `hero` 필드와 호환 유지(마이그레이션 없이 읽기 가능)
- [x] 초기화 시 로컬 세이브 복원
  - `MainScene.initializeUiState()`에서 저장된 인벤/창고/장착/성장 수치 복원
  - 저장 데이터가 없으면 기존 스타터 인벤토리 생성
- [x] 장착/해제 로컬 액션 구현
  - 인벤토리 패널에서 장착/해제 버튼 추가
  - 장비 패널에서 슬롯 클릭 해제 명령 추가
  - 장착 상태에 따라 장비 스탯 재계산 및 저장 동기화
- [x] 성장/보상 로컬 정합화 1차
  - 몬스터 처치 및 던전 층 이동 레벨업 시 `statPoint(+4)` 누적
  - 레벨업 요구치 `level^2 + 20` 규칙으로 통일
  - 레벨업 시 고정 HP/MP 증가 제거(서버식: 레벨업은 statPoint 중심)
- [x] 아이템 옵션/소켓 로컬 유지
  - 아이템 생성 시 `options[6]`/`socket`/`plus` 필드 보존
  - 재감정 시 옵션 배열 갱신(`options[3]`)
  - 아이템 상세 UI에 강화/소켓/옵션 표시
- [x] 던전 보상 원본 `get_reward(huntcnt)` 로컬 이식
  - `huntcnt` cap(100), `exp/gold` 롤식, 레벨업(+4), `full` 플래그 반영
  - 보상 아이템 추첨(`rand_item`) + 로컬 인벤 실제 지급 + 팝업 표시 반영
  - 참고: 서버 DB의 `type!=99` 조건은 웹 데이터셋 기준 `main_type!=2`로 근사 매핑
- [x] 창고 입출고/스탯 분배 UI를 로컬 도메인과 연결
  - UI 커맨드에 `addstat/resetstat/save/load/takeon/takeoff` 로컬 라우트 추가
  - 장비 패널에서 스탯 분배(+1)와 초기화(100만 골드) 직접 실행 가능
- [x] 성장/보상/스탯 분배 서버 정합화 2차 (2026-03-04)
  - 기준 소스: `.server/sdu_control.php`, `.server/neko_model.php`, `.server/setup.php`
  - `calculateNextExp = level^2 + 20`, 레벨업 시 `statPoint +4` 규칙 재검증
  - `addstat`: 부족 `errCode=2`, 성공 `errCode=1`, `vit => maxHp += 12.8*svalue`, `intg => maxMp/mp += 4.2*svalue`
  - `resetstat`: 초기상태 `errCode=3`, 골드부족 `errCode=2`, 성공 `errCode=1`, 비용 `1,000,000G`, `str/vit/intg/agi=4`, `statPoint=(level-1)*4`
  - `get_reward(huntcnt)`: cap=100, gold/exp 수식과 int cast 위치, full(인벤 30 기준), item roll 처리 정렬
  - 후속 정합화 완료: `HeroCombatProfileBuilder` Classes 정렬 + 치명타 UI 표기 정렬 반영

---

## Quick Resume

현재 상태: **W2 완료 / W3 진행 중 / W4 던전 API 우선순위 상향**

### 최근 갱신
- 2026-03-03: 서버 액션 로컬 이식 W4-L 착수(네트워크 서버 구현 대신 로컬 도메인 구현으로 방향 확정)
- 2026-03-03: `localProgress.playerSave` 추가로 인벤/장착/성장/창고 상태를 localStorage에 통합 저장
- 2026-03-03: 인벤토리 장착/해제 명령(`inventory_toggle_equip`, `equipment_unequip`) 및 UI 버튼 연결
- 2026-03-03: 장착 상태 기반 장비 스탯 자동 재계산(무기/갑옷/장신구) + 저장 동기화
- 2026-03-03: 레벨업 시 `statPoint +4` 누적, 다음 필요 경험치 `level^2 + 20` 규칙 반영
- 2026-03-03: 아이템 옵션/소켓 필드 저장 안정화 + 상세 UI 표시(강화/소켓/옵션)
- 2026-03-03: 이상한 던전 몬스터 풀을 지정 ID 세트로 교체하고, 층별 5~10종 랜덤 선택 + 총 100마리 스폰(타일 부족 시 재사용) 규칙 반영
- 2026-03-03: 원거리 `main_type(1,2,16~22,45,50)` 사거리/추적/공격 판정 로직 반영
- 2026-03-03: 맵 전환 시 몬스터 본체 스프라이트 프레임/애니메이션을 map-scoped 정리 대상에서 제외해 세션 캐시 재사용으로 전환
- 2026-03-03: 몬스터 공격 이펙트 fallback 경로 추가(`sub_spr_list` 비어도 `ATBEFFSPR/COMMONSPR` 공통 투사체·타격 이펙트 출력)
- 2026-03-03: 몬스터 처치 보상/드롭 처리 타이밍을 즉시 처리에서 death 애니 시작 후 지연 처리로 조정(중복 보상 방지 게이트 포함)
- 2026-03-03: 플레이어 몬스터 피격 이펙트 리소스 참조에서 CLASS_0 하드코딩 제거, 초기 클래스 기준 참조로 정리
- 2026-03-03: 장비 정규화 로직을 Classes 7슬롯(0:투구,1:갑옷,2:좌반지,3:무기,4:장갑,5:우반지,6:신발) 내부 기준으로 확장하고 UI 3슬롯(weapon/armor/accessory) 호환 유지
- 2026-03-03: 장비 패널 UI를 Classes 7슬롯 실표시로 확장(투구/갑옷/좌반/무기/장갑/우반/신발), 슬롯 클릭 해제는 `inventory_toggle_equip` 기반으로 실제 장착 아이템 슬롯 토글 처리
- 2026-03-04: 장착 장비 코스튬(`costumeImage/costumePalette`)을 히어로 런타임 합성(`HSPR`)에 반영
  - `img_num 0/1/2/3` 레이어를 `HA_0/HA_1/HA_2/HW_{job}`의 장착 인덱스로 오버라이드
  - 장착/해제 및 UI 초기화 시 히어로 프레임 재합성 트리거 연결
  - 웹 런타임 참조용 `HA_0/1/2`, `HW_0~3` 원본 `img_*.png/.clips.json`을 public source 경로로 동기화
- 2026-03-04: 장착 직후 `glTexture/sourceSize` null 크래시 방지 패치
  - 장비 재합성 후 `Hero.createAnimations()`을 다시 호출해 stale animation frame 참조를 제거
  - 재합성 구간에서 히어로 렌더를 잠시 숨기고(`visible=false`, `anims.stop()`), `try/finally`로 visibility 복구 보장
- 2026-03-04: 장착 후 히어로 애니메이션(걷기/공격/스킬) 정지 회귀 복구
  - `Hero.playAnimation()`에서 대상 애니메이션 키/프레임이 누락되면 런타임 재생성(`Hero.createAnimations`) 후 재시도
  - `sprite_index` 기준 기대 프레임 수와 실제 애니메이션 프레임 수를 비교해 비정상 축소(1프레임 고정)도 복구
  - 재생성 쿨다운(250ms)을 두어 프레임 전환 중 과도한 재생성 반복을 방지
- 2026-03-04: 스탯/성장 로컬 공식을 서버식으로 정렬
  - `nextExp = level^2 + 20`, 레벨업 시 `statPoint +4`, 고정 HP/MP 레벨업 보너스 제거
  - `addstat/resetstat` 로컬 구현(`reset=100만 골드`, 기본스탯 4, `vit/intg` 파생 HP/MP 반영)
  - 장비 패널에 `str/vit/agi/intg/wis/statPoint` 표시 및 분배 버튼 연결
- 2026-03-04: 로컬 액션 alias 라우트 추가
  - `takeon/takeoff` -> 인벤 장착/해제 토글
  - `save/load` -> 인벤↔창고 직접 이동 명령으로 연결
- 2026-03-03: 아이템 아이콘 경로 검증 완료(Classes는 `ITEMIMG.cmb` 엔트리 로드 + 기본 full draw `clip=-1`, 웹은 이를 추출한 `ITEMIMG/img_*.png`를 `/assets/sprites/source/ITEMIMG` 공개 경로로 직접 참조)
- 2026-03-02: 모바일 터치 UI 1차 반영(8방향 조이스틱/우측 공격/모바일 6슬롯 원본 좌표)
- 2026-03-02: 모바일 6개 슬롯 스킬 아이콘 삽입(`SKILLICON/img_6~img_11`) 및 하단 프로토타입 문구 제거
- 2026-03-02: 클래스0 스킬(2/3/4/5/6) 좌표/히트박스/프레임 이동 정합화 및 이동 입력 잠금 정리
- 2026-03-02: 스킬 시전 자동 타깃 방향 회전 로직 복구
- 2026-03-02: 런타임 프레임 `origin_x/y` 반영 + Hero 기준선 호환 보정으로 스킬 시점 렌더 점프 완화
- 2026-03-01: 원본 C++ 던전 생성 함수군 재검증 후 W2 구현 정합화
- 2026-03-01: `set_MysteryDungeonMap` 계열(경로/타일변환/확장/게이트/오브젝트/시작좌표) 웹 이식 완료
- 2026-03-01: 게이트 트리거를 `guide_data`+atb gate index 기준으로 수정
- 2026-03-01: 마을 몬스터 스폰 차단 + 던전 사망 시 마을 복귀 유지
- 2026-03-01: 몬스터 variant 스프라이트 렌더 스크립트 추가 및 던전 몬스터(0/22/45) 반영
- 2026-03-02: `cal_HeroToMonDmg`/`cal_MonToObjDmg` 원본 수식 기준으로 `CombatSystem.ts` 재구현
- 2026-03-02: 기존 임의 상태이상 로직 제거, `AtbState` 기반 상태이상 적용으로 정합화
- 2026-03-02: 전투 이펙트 스프라이트(`MASPR`/`ATBEFFSPR`)와 depth 정렬 1차 정합화
- 2026-03-02: 전투 이펙트 스프라이트를 원본 `spr_N` 단위로 재구성(`COMMONSPR_spr_2/7/29`, `ATBEFFSPR_spr_0..3`, `HSPR_{job}_spr_1/2`)하고 호출 규칙을 `set_gameEff` 기준으로 정합화
- 2026-03-02: 원본 UI/CHFONT 경로 제거, Phaser(Web) UI 단일 모드로 복귀
- 2026-03-02: HUD만 원본 스타일 백플레이트로 부분 유지(나머지 UI는 웹 UI 유지)
- 2026-03-03: 브라우저 뷰포트 기반 가변 캔버스 리사이즈 + 해상도 클램프(`960x540 ~ 1920x1080`) 적용
- 2026-03-03: 모바일 fallback(`320x240`)과 터치/패널 UI 브레이크포인트 보정 반영
- 2026-03-03: BootScene 타이틀 배경 풀스크린/중앙 정렬 + 로딩창 중앙 배치 정합화
- 2026-03-03: HUD/패널/대화/팝업 UI 확대 및 가변 스케일 적용
- 2026-03-03: 미스터리던전 통로 최소 폭 보정 패스 추가(3칸 기준)
- 2026-03-03: 통로 보정 로직을 보수적으로 재조정(과확장 복구, 협로 +1칸 확장)
- 2026-03-03: 통로 확장 타일 이미지를 기본 바닥(`51`)으로 고정해 맵 누락/비정상 렌더 회귀 복구
- 2026-03-03: 미스터리던전 생성 아키타입 프로필(`linear/branchy/open/maze`) 적용
- 2026-03-03: 프로필 기반 경로 길이/방향 성향 제어, 제한적 루프 허용, 룸 스탬프(`2x2/3x2/2x3`) 반영
- 2026-03-03: 체감 강화를 위해 프로필별 매크로 지형(`branch burst`/`open hub`/`maze weave`) 추가
- 2026-03-03: `maze` 프로필을 DFS 기반 실미로 생성 루트로 분리
- 2026-03-03: 원본 `miniMapDat` 방식 기반 미니맵 오버레이 구현(탐색 reveal + 포인트 표시)
- 2026-03-03: 공격/스킬 후 벽 끼임 자동 복구 루틴 추가
- 2026-03-03: 돌출부 충돌 불일치 원인 분석 완료(`setDungeonObject`의 atb/img 비동기 갱신)
- 2026-03-06: 스킬 1/6 알파블렌딩 정합화
  - `runtimeLayerComposer`에서 primary 이전 blend segment를 effect sprite로 분리하지 않고 base canvas에 포함
  - `CLASS0_SKILL_SLOT1`, `CLASS0_SKILL6`의 pre-primary blend frame 기준으로 수정
  - `npm run build`, `npx tsc -p tsconfig.json --noEmit` 통과
- 2026-03-06: assetmng 고품질 합성 기준으로 split 호출처 축소
  - Hero/전투 이펙트/맵 가이드/성석의 compose 호출에서 broad `splitEffectLayers` 사용 제거
  - `non_hero` alias는 유지하되 단일 캔버스 합성으로 정렬
- 2026-03-06: assetmng 기준 재정렬 2차 시작
  - 원인 재확인: 네코웹에는 `renderMode` 상태/UI가 없고, mixed-style frame을 단일 캔버스로만 닫아 destination-aware effect가 실제 배경 위에서 다시 blend되지 못함
  - 구현 트랙: 상단 `레거시 / 고품질` 토글 + runtime/map compositor renderMode 도입 + selective effect layer 복원
- 2026-03-06: assetmng 고품질 기준 런타임 정렬 구현 완료
  - `GameOverlay` 상단에 `레거시 / 고품질` 토글 추가, `GameUiState.display`/`localProgress`/`MainScene`에 `spriteRenderMode` 상태 도입
  - `runtimeLayerComposer`는 `legacy/high-quality` render mode와 companion segment effect layer를 지원하도록 정리
  - `MapSystem`은 render mode별 texture cache key와 `refreshMapObjectSprites()` 엔트리를 지원
  - 검증: `runtimeLayerComposer.ts`, `MapSystem.ts`, UI 상태/오버레이/입력 라우터 묶음 eslint 통과
  - 검증 공백: 전체 `tsc -p tsconfig.json --noEmit`는 기존 타입 오류 3건(`Monster.ts`, `BattleResourceController.ts`)으로 실패, `MainScene` 계열 전체 eslint도 기존 파일 고유 오류 때문에 완전 녹색은 아님
- 2026-03-06: render mode stale Hero 경로 제거 + 표시 HQ 옵션 분리
  - `MainSceneDomainWiring.ensureHeroSpriteResourcesReady()`의 기본 Hero 조기 종료를 제거하고, `layerClipSourceOverrides`까지 포함한 실제 Hero 시그니처가 준비된 경우에만 재사용
  - `GameUiState.display`/`localProgress`/`MainScene`에 `highQualityDisplayEnabled` 상태와 `toggle_high_quality_display` 커맨드를 추가
  - 상단 HUD에 `표시 HQ` 버튼을 추가하고, `GameCanvas`는 내부 Phaser canvas의 `image-rendering`을 옵션에 따라 `pixelated/auto`로 전환
  - `MainScene.applyDisplayQualityPresentation()`은 전체 texture filter(`LINEAR/NEAREST`)와 camera `roundPixels`를 옵션에 맞춰 동기화
  - `runtimeLayerComposer.upsertFrameTexture()`와 `MapSystem` map object runtime texture 생성 경로는 새 canvas texture마다 display filter를 다시 적용
  - `NpcPipelineController.ensureCameraFollowHero()`는 더 이상 `roundPixels=true`를 하드코딩하지 않고 현재 display 옵션을 따른다
  - 검증: `npm run -s build` 통과, 변경 파일 묶음 eslint 통과(`MainScene.ts` 제외)
- 2026-03-06: Vision fog 카메라 null 가드 보정
  - `VisionFogController`의 `getCamera()` 반환을 nullable-safe로 넓히고, overlay rebuild/center 계산에서 camera/worldView가 없으면 game size + 화면 중앙 fallback을 사용
  - 검증: `npm run -s build` 통과, `VisionFogController.ts` 단독 lint 통과
- 2026-03-06: 런타임 후보 URL/워밍업 최적화
  - `runtimeLayerComposer`는 `MON_/NPC_` indexed fallback을 exact 뒤로 미루고, `MONEFF_`처럼 indexed가 없는 계열에는 `_0/_1` 후보를 더 이상 붙이지 않게 정리
  - `MapSystem`은 `palette_num=0`일 때 `_pltalpha_0`/`_0_pltalpha`를 먼저 두드리지 않고 `img_x_pltalpha.png`/`img_x.png`를 우선 사용
  - `NpcPipelineController.preloadNpcSpritesForMap()`는 no-op으로 비우고, `MainScene.scheduleBattleEffectWarmup()`은 1.2초 지연 워밍업으로 변경
  - 검증: `runtimeLayerComposer.ts`, `MapSystem.ts`, `NpcPipelineController.ts` eslint 통과
- 2026-03-06: 합성용 이미지 직접 참조 + 메모리 정리
  - 신규 파일: `public/data/runtime_image_asset_index.json`, `runtimeImageSourceStore.ts`, `runtimeAssetCache.ts`
  - `runtimeLayerComposer`는 source/object PNG를 정적 인덱스로 exact resolve한 뒤 Phaser texture cache source image를 직접 참조해 합성
  - `MapSystem`은 object source prewarm + `mapobj_runtime_*` active key 정리 경로를 추가
  - `BootScene`은 `obj_data`, `map_10/*`, `runtime_image_asset_index`를 preload하고, `MapSystem`/`DungeonFlowController`는 cache 우선으로 변경
  - `ShopScriptBridgeController`는 shop list JSON 메모이제이션, `npcScript`는 `no-store` 제거
  - 검증: 이번 변경분 기준 `tsc --noEmit`는 기존 `Monster.ts` 타입 오류 1건만 남음
- 2026-03-06: 초기 메인 진입 hero/map guide 합성 지연
  - `CreateFlowController`는 hero sprite name만 결정하고, 타이틀 직후 hero compose / hero animation create / map guide compose를 더 이상 선행 `await`하지 않음
  - `MapLoadingController`는 맵 데이터 적용 후 `ensureHeroSpriteResourcesReady()`를 호출해 `new Hero(...)` 직전 프레임/애니메이션을 보장
  - `MapLoadingController`는 `runtimeGates.guide` 또는 `mystery_sacred_stone`가 있는 맵에서만 `ensureMapGuideResourcesReady()`를 호출
  - `MainSceneDomainWiring`은 hero base frame/animation 존재 여부를 확인하고 필요할 때만 compose/create를 재실행
  - 검증: `CreateFlowController.ts`, `MapLoadingController.ts` eslint 통과, 전체 `tsc --noEmit`는 기존 `Monster.ts` 타입 오류 1건만 남음
- 2026-03-06: 초기 장비 합성 레이스 수정
  - `initializeUiState()`의 선행 `queueHeroEquipmentSpriteRefresh()`를 제거해 create flow 초반의 비동기 장비 합성이 `loadLevel()` 기본 hero compose에 덮어써지지 않도록 정리
  - `MainSceneDomainWiring.ensureHeroSpriteResourcesReady()`는 현재 `inventory` 기준 `buildHeroLayerSourceOverrides()`를 적용해 초기 hero frame/animation도 장비 상태를 반영하도록 수정
  - 기대 결과: 게임 첫 진입 직후에도 무기/방어구 교체가 기본 캐릭터로 되돌아가지 않음
- 2026-03-06: 던전 층 전환 히어로 재합성 회귀 수정
  - `MainScene`에 `buildHeroEquipmentSpriteSignature()` / `resolveHeroBaseRuntimeResourceKeys()` / `isHeroEquipmentSpriteSignatureReady()` / `markHeroEquipmentSpriteSignatureReady()`를 추가해 Hero 장비 시그니처 계산과 재사용 판정을 한 곳으로 통일
  - `queueHeroEquipmentSpriteRefresh()`는 같은 시그니처의 준비 완료 상태를 재사용하고, in-flight 중복 요청은 `pendingHeroEquipmentSpriteSignature`로만 차단하도록 정리
  - `MainSceneDomainWiring.ensureHeroSpriteResourcesReady()`는 던전 층 전환 시 같은 시그니처 + 기존 base frame/animation이 있으면 재합성을 건너뛰고, 필요할 때만 compose/create 후 ready 상태를 기록
  - 기대 결과: `플레이어 스프라이트 재구성` 로딩은 Hero 장비/렌더 모드 변경 때만 발생하고, 단순 층 이동에서는 첫 로딩 히어로 리소스를 계속 재사용
- 2026-03-06: 좌상단 HUD 순수 웹 UI 교체
  - `GameOverlay`의 `INTERFACEIMG/img_6` + `PixelAtlasClip` 기반 상태 박스를 제거했다
  - 좌상단 HUD는 상단 우측 토글 바와 맞춘 CSS 카드로 재작성했고, `mapName`, `level`, `HP/MP/EXP`, `gold`, `next level exp`를 모두 웹 레이아웃으로 렌더한다
  - 모바일 세로 화면에서는 HUD를 우측 상단 바 아래로 내리고, 데스크톱/가로 화면에서는 좌상단 고정 카드로 유지한다
  - 후속 검증 포인트: 실제 브라우저에서 장시간 플레이 시 상단 바/HUD 겹침 여부와 숫자 업데이트 타이밍 확인
- 2026-03-06: Hero shared skill effect 분리
  - `queueHeroEquipmentSpriteRefresh()`에서 `CLASS0_SKILL_SLOT1` non-hero effect alias compose/createSpriteAnimations를 제거했다
  - `MainScene.ensureClass0SkillSlot1EffectResourcesReady()`를 추가해 slot1 effect alias를 장비와 무관한 shared resource로 준비한다
  - `MainSceneDomainWiring.ensureHeroSpriteResourcesReady()`와 render mode refresh는 Hero 본체 보장 뒤 이 shared effect helper를 호출한다
  - 기대 결과: Hero 스킬 액션 프리로딩 정책은 유지하면서, 장비 탈착 시 shared slot1 effect alias를 불필요하게 재합성하지 않는다
- 2026-03-06: 장비 해제 시 base compose 강제 복원 보정(임시)
  - `runtimeLayerComposer.composeSpriteFrames()`에서 override 합성이 성공하면 `runtimeLayerComposedSpriteSignatures(frameKeySpriteName)`를 삭제하도록 수정
  - 목적: 장비 해제(no override) 시 base compose가 시그니처 캐시 단축으로 스킵되지 않게 보장
  - 기대 결과: 장비 탈착 직후 Hero 프레임이 equipped 상태로 잔류하거나 검은 화면/오염 프레임이 나타나는 회귀 방지
  - 후속: 3차 수정에서 compose 시그니처에 `ovr=<layerOverrideSignature>`를 포함하는 방식으로 대체
- 2026-03-06: Hero 장비 합성 성능/메모리 보정
  - `RuntimeLayerComposer.clearSpriteComposedCaches(spriteName)` 추가
    - `runtimeLayerComposedFrameCache`, `runtimeLayerComposedSpriteSignatures`, Hero frame blend cache만 선택 정리
  - `MainScene.queueHeroEquipmentSpriteRefresh()` 보정
    - compose 시작 시 Hero compose 캐시를 정리해 override 시그니처 누적 메모리 증가를 억제
    - `onFrameComposed`에서 4프레임마다 `waitMs(0)` 수행해 장비 탈착 중 UI 멈춤 완화
    - 직렬 큐 진입 후 `requestedSignature !== pendingSignature`면 구형 요청 스킵
  - 기대 결과: 장비 연속 탈착 시 불필요한 중간 재합성 감소, 장시간 플레이 메모리 사용 안정화, 탈착 반응성 개선
- 2026-03-06: 장비 탈착 검은 화면/오염 프레임/메모리 급증 3차 원인 수정
  - 원인 1: `upsertFrameTexture()`가 동일 캔버스(sourceImage===compose canvas)를 자기 자신에게 `clearRect+drawImage`하며 투명 프레임으로 지워지는 경로가 있었음(검은 화면/오염 프레임).
  - 원인 2: `runtimeLayerPixelCache`/`runtimeLayerImageCache`/`runtimeLayerComposedFrameCache`/`runtimeLayerFrameBlendModeCache`/`resolvedImageRefCache`가 사실상 무한 성장해 스킬 연타/장시간 세션에서 메모리 상승 후 프리즈를 유발.
  - 원인 3: override compose 시 시그니처가 override 정보를 포함하지 않아(동일 spriteName 기준) 불필요한 재합성이 반복되고, 재사용 조건이 약했음.
  - 조치:
    - `RuntimeLayerComposer.upsertFrameTexture()`에 `sourceImage === canvas` 가드를 추가해 자기 캔버스 복사를 금지.
    - `RuntimeLayerComposer.composeSpriteFrames()` 시그니처에 `ovr=<layerOverrideSignature>`를 포함하고, override/non-override 모두 동일한 시그니처 캐시를 사용.
    - Hero 장비 갱신 경로의 `clearSpriteComposedCaches(spriteName)` 강제 호출을 제거해 기존 합성 캐시 재사용을 허용.
    - `RuntimeLayerComposer` 캐시에 LRU 상한을 도입(manifest/image/pixel/composedFrame/signature/frameBlend).
    - `runtimeImageSourceStore.resolvedImageRefCache`에도 LRU 상한을 도입하고, 부트 시점 인덱스 빈값 캐시 고착을 보정.
  - 기대 결과: 장비 탈착 시 검은 화면/엉뚱 스프라이트 회귀 감소, 장비 토글 지연 완화, 스킬 연타 시 메모리 상승 완화.
- 2026-03-06: 전투 one-shot 이펙트 생명주기 가드
  - `BattleResourceController.playBattleEffect()/playAttachedBattleEffectToHero()/playMovingBattleEffect()`에 fail-safe destroy timer를 추가
  - `CombatEffectController.playBattleEffect()`에도 동일 fail-safe timer를 추가
  - 기대 결과: 스킬/전투 이펙트 애니메이션 이벤트 누락 시 임시 sprite/리스너 누적 방지
- 2026-03-06: Hero 장비 탈착 반영 지연/중복 합성 정리
  - `MainScene.queueHeroEquipmentSpriteRefresh()`를 2단계로 분리
    - 1단계: `action_0/1 + 현재 action` 우선 합성 후 즉시 `refreshCurrentAnimationPose()`
    - 2단계: 전체 action 백필 합성으로 스킬/공격 프레임까지 완결
  - 장비 연속 토글 시 이전 요청이 남아 있으면 `HERO_EQUIP_REFRESH_STALE`로 조기 중단해 구형 합성 비용을 줄임
  - `HA_1` clip 단위 오버라이드 도입 전까지는 장갑/갑옷이 같은 `img_num=1` 경로로 합성되어 회귀가 남아 있었음
- 2026-03-06: 장갑/갑옷 clip 단위 분리 합성 도입
  - `RuntimeLayerComposer`에 `layerClipSourceOverrides(img_num:clip_num)`를 추가하고 compose/cache 시그니처(`ovr`)에 clip override를 포함
  - `MainScene` Hero 합성에서 `HA_1` clip을 분리 적용
    - body clip `0~10` -> body(slot1, fallback glove)
    - glove clip `11~22` -> glove(slot4, fallback body)
  - 기대 결과: 장갑 교체가 갑옷 영역을 덮어쓰지 않고, 갑옷 교체가 장갑 영역을 덮어쓰지 않는 독립 반영

### 운영 정책 (정정본)
1. `광산 관리자` 대화는 `SCS_ENDSCRIPT_COLOSSEUM -> SLT_TALK_COLOSSEUM -> MS_COLOSSEUM -> MS_MYSTERYDUNGEON` 체인의 시작점이다.
2. W2 범위에서는 `광산 관리자`를 통해 진입한 미스터리던전을 로컬 상태머신으로 진행한다.
3. W2 로컬 진행 데이터는 localStorage(`bypassNetworkFromMineManager`)로 유지한다.
4. W4에서 서버 API 경로(`DungeonInfo/Down/Up/ReturnTown/Dead`)와 병행/전환 계획을 유지한다.

### 다음 작업
1. W4-L-1: 던전 보상 공식을 `get_reward(huntcnt)` 기준으로 정밀 이식(아이템/full/exp/gold parity)
2. W4-L-2: `addstat/resetstat/save/load/takeon/takeoff` 로컬 액션을 UI와 1:1 연결
3. W3-2: `ENDSCRIPT_COLOSSEUM` 처리 + `SCS_CREATEQUEST/RENEWALQUEST/DELETEQUEST` 반영으로 스크립트/퀘스트 흐름 마무리
4. 리소스/검증: 잔여 `source_rect` 누락 정밀화 + P4 검증 게이트(파이프라인/런타임 스모크) 고정
5. 사이드 트랙: `MainScene.ts` 기능 묶음 분리 V3-B9/B10 + 스모크 게이트 완료
   - `dev/active/mainscene-modularization/mainscene-modularization-plan.md`
6. 정책 결정: W4 네트워크 API 병행 전환 범위 확정(로컬 우선 유지 vs 부분 API 전환)

## 리소스 로딩 마이그레이션 계획 (2026-03-02)

- [x] 계획 문서 작성: [web-resource-loading-migration-plan.md](/Users/ethan/Workspace/dev/DungeonNeko/dev/active/web-porting/web-resource-loading-migration-plan.md)
- [x] P0 계약 고정(`layer_manifest v2`, `frame_refs` 우선 규칙 타입화)
  - `dungeon-neko-web/src/game/resources/runtimeLayerTypes.ts`
- [x] P1 로더/컴포저 모듈 분리
  - `dungeon-neko-web/src/game/resources/resourceLoader.ts`
  - `dungeon-neko-web/src/game/resources/runtimeLayerComposer.ts`
  - `MainScene` 인라인 합성/로딩 로직 모듈 이관
- [x] P2 런타임 합성 적용 범위(`MASPR_*`, `ATBEFFSPR_*`) 정식 연결
  - `RuntimeLayerComposer(spritePrefixes=['MASPR_', 'ATBEFFSPR'])`
  - `MainScene.createBattleEffectAnimationsForSprite()`에서 합성 + `frame_refs` 적용
  - `Hero/Monster/NPC`를 공용 로더 기반으로 통일
- [x] P3 폴백/캐시/메모리 정리
  - 매니페스트/레이어 실패 시 사전합성 PNG 경로 자동 폴백 유지
  - 맵 전환 시 map-scoped 텍스처/애니메이션/합성 캐시 정리(`clearMapScopedResources`)
  - 스프라이트 단위 중복 합성 방지(`runtimeLayerComposedSprites` + frame cache)
- [ ] P4 검증 게이트 고정(파이프라인 + 런타임 스모크)
  - 코드 반영 완료, 파이프라인/런타임 스모크 실행은 미수행
