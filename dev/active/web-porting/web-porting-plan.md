# DungeonNeko -> Web App 포팅 계획 (독립 트랙)

## 핵심 원칙

> [!IMPORTANT]
> 이 트랙은 Godot 포팅과 무관한 독립 프로젝트다.  
> 로직 원천: `/Classes/*.cpp, *.h`  
> 리소스 원천: `/Resources/*`
> 원본의 코드를 완벽히 구현하여, 동일한 결과값을 내는 것이 목적이다.

## Executive Summary

원본 Cocos2d-x C++ 게임을 Next.js + Phaser 3 + TypeScript로 포팅한다.  

## 원본 핵심 시나리오 (검증 완료, 2026-03-01)

1. 광산 관리자 NPC
- `instances["568"] = "광산 관리자"`, `scr_num = 804`
- `map_configs["314"].npc_list`에 `568` 포함
- 근거: `dungeon-neko-web/public/data/npcs.json`

2. 스크립트 종료 분기
- `SCS_ENDSCRIPT_COLOSSEUM(9)` 발생 시 `scriptLoadingType = SLT_TALK_COLOSSEUM`
- 근거: `Classes/CHGAME_SCRIPT.cpp`, `Classes/CHSCRIPT.h`

3. 콜로세움 -> 미스터리던전
- `SLT_TALK_COLOSSEUM`에서 `MS_COLOSSEUM` 진입
- 콜로세움 선택에서 `set_MainState(MS_MYSTERYDUNGEON)`, `set_MysteryDungeon()`
- 근거: `Classes/CHGAME_SCRIPT.cpp`, `Classes/KEYEVENT_MAIN.cpp`

4. 던전 게이트와 층 이동
- 게이트 `NextMapNum == 303`일 때 `call_DungeonDown()`/`call_DungeonUp()` 호출
- 근거: `Classes/UPDATE_MAIN.cpp`

5. 네트워크 요청 체인
- `request_DungeonInfo`, `request_DungeonDown`, `request_DungeonUp`, `request_ReturnTown`, `request_DungeonDead`
- 응답으로 `player/Hero`, 장비, 보상, `pos` 갱신
- 근거: `Classes/GAME_NET.cpp`, `Classes/HelloWorldScene.cpp`

## 기술 스택

| 계층 | 기술 |
|---|---|
| 프레임워크 | Next.js (App Router) |
| 게임 엔진 | Phaser 3 |
| 상태 관리 | Zustand |
| 네트워크 | fetch/axios |
| 배포 | Vercel |

## 단계별 실행 계획

### Phase W0: 프로젝트 셋업 ✅ 완료
- 프로젝트 골격/런타임/기본 에셋 파이프라인

### Phase W1: 맵 & 캐릭터 ✅ 완료
- 맵 렌더, 이동, NPC 배치/대화, 맵 전환

### Phase W2: 전투 & 던전 코어 (완료)

목표: 전투 + 미스터리던전 상태머신/맵 루프를 원본과 구조적으로 일치

- `광산 관리자` 대화(`end_colosseum`)에서 로컬 콜로세움 선택 UI를 거쳐 미스테리 던전으로 진입하는 개발 모드 경로 구현
- `set_MysteryDungeon()` 초기화(HP/조건/stage/state/bgm) 정합화
- `set_MysteryDungeonMap()`/`set_MysteryDungeonMon()` 흐름 이식
  - `makeDungeonPath`/`convertDungeonMap`/`resizeDungeonMap`
  - `createMysteryDungeonGate`(guide gate, atb 60/61)
  - `setDungeonObject`/`set_HeroPositionInDungeon`
- `dungeonState` 전이(LOADING/PLAY/REWARD/FAIL/RETURN/MENU/ERROR) 이식
- `NextMapNum == 303` 게이트 분기와 씬 상태 전환 동기화
  - 트리거는 gate 목적지 좌표가 아닌 `guide_data` + 타일 atb index 기준으로 처리
- 장비/세트/스킬/상태이상 수식 정밀 이식
- 원본 전투 핵심 공식 2차 정합화
  - `cal_HeroToMonDmg`(141104 이후) / `cal_MonToObjDmg`(hero 분기) 이식
  - 임의 상태이상 부여 제거, `AtbState` 기반 상태이상 적용
- 몬스터 실스프라이트(`MSPR_*`) 로딩/애니메이션 적용
  - variant 파이프라인(`MSPR_{group}_spr_{variant}_mon_{id}`) 추가
- 전투 이펙트 스프라이트/렌더 순서 1차 정합화
  - `MASPR`/`ATBEFFSPR` 실스프라이트 재생 루틴 추가
  - `getGameEffectDepth` 기반 drawType depth 정렬 반영
  - 전투 텍스트 depth를 UI 대역으로 상향
- 클래스0 스킬 좌표/모션/히트 2차 정합화
  - `colBox` 기반 스킬 타깃 판정 + 통과 불가 경로(`chk_AtbPntToPnt`) 제외
  - 프레임 이동(`SD_GetFrameMovePixel`) 반영 + 스킬 중 입력 이동 잠금
  - 스킬5 이펙트 앵커를 시전 시점 좌표/방향으로 고정
  - 스킬 시전 자동 타깃 방향 회전(`tryFaceHeroToNearestTarget`) 유지
- 런타임 프레임 오리진(`origin_x/y`) 정합화
  - 합성 프레임별 `displayOrigin` 메타 저장/사용
  - Hero/Monster/NPC/전투 이펙트 공통 적용
  - Hero 기준선 호환 보정으로 상시 상향 렌더 체감 완화

### Phase W3: UI & 퀘스트 (진행 중)

목표: ScriptEngine/QuestSystem과 씬 상태머신의 실제 연결 완성

- UI 정책 고정
  - Phaser(Web) UI를 단일 기본값으로 유지
  - 원본 UI/CHFONT 경로는 유지하지 않음(레거시 렌더러 제거)
- 모바일 터치 UI 1차 반영 완료
  - 좌측 8방향 조이스틱 + `touch_move` 입력 연결
  - 우측 공격 버튼(원본 `TOUCHIMG/img_1` 반쪽 미러) + `touch_attack` 연결
  - 모바일에서 하단 6개 퀵슬롯 숨김, 원본 좌표 기반 6슬롯 배치
  - 모바일 6개 슬롯 스킬 아이콘 반영(`SKILLICON/img_6~img_11`)
  - 캔버스 하단 프로토타입 문구 제거
- `ENDSCRIPT_COLOSSEUM` 이후 콜로세움/던전 UI 플로우 연결
- `SCS_CREATEQUEST/RENEWALQUEST/DELETEQUEST` 반영
- HUD/패널을 실제 데이터와 완전 연동
- 스킬 2/3/4/5/6 좌표/오프셋 실기 검증 로그 고정(장애물/밀집 몬스터 조건)

### Phase W4: 네트워크 & 폴리싱 (우선순위 상향)

목표: 미스터리던전 네트워크 루프를 먼저 완성하고 그 위에서 폴리싱

- 던전 API 5종 우선 연동: `DungeonInfo/Down/Up/ReturnTown/Dead`
- 응답 매핑: `player`, `Hero`, 장비, 보상, 층(`pos`) 동기화
- `MS_NETWAIT`, `SS_DUNGEONNETERROR`, `SS_DUNGEONNOMONEY` UX 반영
- 이후 상점/창고/대장간/기타 API, 반응형/PWA/배포 진행

### Phase W4-L: 서버 액션 로컬 이식 (병행 트랙, 2026-03-03 시작)

목표: 서버를 새로 구현하지 않고, 기존 서버 액션에서 수행하던 경제/성장/인벤 도메인을 웹 런타임 로컬 상태로 이식

- 기대 결과 1: 던전 전투 이후 실제 보상 루프
  - 전투/층 이동 보상이 `EXP/GOLD/아이템`으로 로컬 인벤토리 및 저장 데이터에 반영
- 기대 결과 2: 캐릭터 실제 성장
  - 레벨업, 다음 레벨 요구치, 스탯포인트 누적, HP/MP 성장 반영
- 기대 결과 3: 아이템 라이프사이클 로컬 완결
  - 장착/해제, 구매/판매, 합성/제작, 강화/소켓/재감정을 네트워크 없이 로컬 상태머신으로 처리
- 기대 결과 4: 아이템 옵션/슬롯 데이터 유지
  - 아이템별 옵션 배열/소켓 수/강화 수치가 런타임 UI와 localStorage 저장에 일관되게 유지

## 운영 정책 (정정본)

1. 광산 관리자 경로는 원본 시나리오(`SCS_ENDSCRIPT_COLOSSEUM -> MS_MYSTERYDUNGEON`)를 기준으로 진입시킨다.
2. W2 범위에서는 광산 관리자 대화 후 네트워크를 무시하고 로컬 상태머신으로 던전을 진행한다(localStorage 기반).
3. localStorage 키(`bypassNetworkFromMineManager`)를 통해 로컬 던전 진행 상태를 유지한다.
4. W4에서 던전 API(`DungeonInfo/Down/Up/ReturnTown/Dead`)를 병행/전환한다.

## 일정(재정렬)

| Phase | 내용 | 상태 |
|---|---|---|
| W0 | 프로젝트 셋업 | 완료 |
| W1 | 맵 & 캐릭터 | 완료 |
| W2 | 전투 & 던전 코어 | 완료 |
| W3 | UI & 퀘스트 | 진행 중 |
| W4 | 네트워크 & 폴리싱 | 우선순위 상향 |
