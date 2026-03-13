# DungeonNeko Source Coverage Functions

Last Updated: 2026-03-06

## 목적

이 문서는 `source-coverage-matrix.md`의 파일 단위 분류를 runtime 책임 경계 기준으로 해설하는 함수/전역 상태 분해표다.

주의:

- 비서드파티 `Classes` 38개 파일 전체의 전수 ledger는 `source-coverage-symbol-ledger.md`를 기준으로 한다.
- 본 문서는 그 ledger를 바탕으로 큰 파일군의 책임 경계를 설명하는 해설 문서다.
- 즉, 100% 파일 전수는 ledger가 맡고, 함수/전역 상태 **해석**은 여기서 잠근다.

## P0 파일별 분해 요약

| 파일군 | 핵심 심볼 | 새 소유 모듈 |
|---|---|---|
| `CHSPRITE.*` | `SD_setSpriteDat`, `SD_DrawSpriteDat`, `SD_SetStyleSpr`, `SD_DrawStyleSpriteDat` | `SpriteSpecImporter`, `DungeonSprite2D`, `DungeonStyleSpritePlayer2D` |
| `CHFunction.*` | `CH_SetDrawGrpStyle`, `CH_SetDrawSpread`, `CH_DrawBmpImage`, blend kernel | `DungeonBlendKernel`, `DungeonClipRenderer`, `LegacyImageCodec` |
| `INIT_MAIN.*` | `Hero`, `Map`, `Npc`, `Mon`, UI/상점/던전 전역 상태, `set_*` 초기화 함수군 | `GameSessionState`, `ContentRegistry`, `UiStateStore`, `WorldBootstrap` |
| `GAME_FUNCTION.*` | 전투/이동/충돌/아이템/스탯 계산 함수군 | `CombatService`, `MovementService`, `InventoryRuleService`, `HeroStatService` |
| `UPDATE_MAIN.*` | `HeroUpdate`, `NpcUpdate`, `MonsterUpdate`, `Game_MainUpdate` | `GameLoopOrchestrator`, `HeroRuntime`, `NpcRuntime`, `MonsterRuntime` |
| `KEYEVENT_MAIN.*` | `Game_MainKey_P/R`, `Game_MainTouch_P/R/M`, 팝업 hit-test | `InputRouter`, `TouchUiController`, `PopupInputController` |
| `CHSCRIPT.*` | opcode/스크립트 데이터 로더 | `ScriptSpecImporter`, `ScriptCatalogResource` |
| `CHGAME_SCRIPT.*` | `gameScript_Set`, `gameScriptUpdate`, `gameScriptDraw` | `ScriptRuntime`, `DialogueRuntime`, `EventFlowRuntime` |
| `GAME_NET.*` | `PLAYERDATA`, `THINGDATA`, `request_*` 파서군 | `LegacyParityEnvelopeAssembler`, `LocalApiContracts` |
| `HelloWorldScene.*` | `net_*`, `callback_*`, 씬 진입/오디오/입력 | `GameScene`, `LocalApiFacade`, `AudioService` |

## `CHSPRITE.*`

## 데이터 구조

핵심 구조체:

- `SPRITEDAT`
- `FRAMEDRAWDAT`
- `CLIPDRAWDAT`
- `ACTIONDAT`
- `FRAMEDAT`
- `COLLISIONDAT`
- `STYLESPRITE`

핵심 읽기/해제 함수:

- `SD_setSpriteDat()`
- `SD_unSetSpriteDat()`

핵심 접근 함수:

- `SD_GetMaxFrame()`
- `SD_GetFrameMovePixel()`
- `SD_GetFrameParam1()`
- `SD_GetFrameParam2()`
- `SD_GetColBox*()`

핵심 렌더 함수:

- `CH_SetSprDrawGrpStyle()`
- `CH_SetSprDrawSpread()`
- `SD_DrawSpriteDat()`
- `SD_SetStyleSpr()`
- `SD_DrawStyleSpriteDat()`

greenfield 분해:

- binary DAT 파싱은 `SpriteSpecImporter`로 이동
- frame/action/collision spec은 generated resource로 고정
- runtime은 `DungeonSprite2D`와 `DungeonStyleSpritePlayer2D`만 남긴다

## `CHFunction.*`

## 외부 API로 유지해야 할 최소 집합

렌더 상태:

- `CH_SetDrawGrpStyle()`
- `CH_GetDrawGrpStyle()`
- `CH_SetDrawSpread()`
- `CH_GetDrawSpread()`

이미지 draw 진입점:

- `CH_DrawImage()`
- `CH_DrawBmpImage()`
- `CH_CopyScreenBuff()`

도형/화면 보조:

- `CH_FillScreen()`
- `CH_FillRect()`
- `CH_GradientRect()`
- `CH_DrawRect()`
- `CH_DrawRoundRect()`
- `CH_FillRoundRect()`
- `CH_FillArc()`
- `CH_DrawArc()`
- `CH_DrawLine()`

리소스/이미지 로딩:

- `CH_GetResUncompress()`
- `CH_GetMixResUncompress()`
- `CH_SetBmpImg()`
- `CH_CreateBmpImage()`
- `CH_CreateMixBmpImage()`
- `CH_FreeBmpImage()`
- `CH_FreeMixBmpImage()`

## 내부 상태

확인된 내부 렌더 상태:

- `grpStyle`
- `AlphaDepth`
- `IAlphaDepth`
- `clrAlphaDepth`
- `IclrAlphaDepth`
- `AlpahColor`
- `ScreenColor`
- `SpreadDepth`

이 상태는 Godot 구현에서 다음으로 분해한다.

- `BlendState`
- `ClipTransformState`
- `PaletteAlphaState`
- `ScreenColorState`

## blend kernel 클러스터

확인된 픽셀 커널:

- `CH_Alpha_565`
- `CH_clrAlpha_565`
- `CH_SAlpha_565`
- `CH_Lighten_565`
- `CH_Gray_565`
- `CH_Screen_565`
- `CH_ColorDodge_565`
- `CH_LinearDodge_565`
- `CH_ScreenDodge_565`
- `CH_Different_565`
- `CH_DodgeBurn_565`
- `CH_Multiply_565`
- `CH_ColorScreen_565`

greenfield 분해:

- 위 커널은 `DungeonBlendKernel`의 기준식이 된다
- 565 정수 연산의 결과까지 재현해야 하는 스타일은 shader보다 CPU prevalidation을 먼저 둔다

## `INIT_MAIN.*`

`INIT_MAIN.h`는 사실상 전체 게임의 전역 상태 저장소다. greenfield에서는 이 파일을 그대로 옮기지 않고 아래 스토어로 쪼갠다.

## 1. 앱/디스플레이/메인 상태

대표 전역:

- `GAME_WIDTH`, `GAME_HEIGHT`
- `IFBoxPosX`, `IFBoxPosY`
- `Width_plusX`, `Height_plusY`
- `GM_STATE`
- `map_paintX`, `map_paintY`
- `InvenMaxPage`, `InvenPage`

새 소유:

- `AppViewportState`
- `FlowStateStore`
- `UiLayoutState`

## 2. 공용 UI/텍스트/이미지 캐시

대표 전역:

- `gameMenuTxt`
- `T_UI`
- `GameUIImg`
- `MenuNameImg`
- `GameUISpr`
- `titleImg`
- `GameHelpTxt`
- `SkillTxt`
- `SkillIcon`

새 소유:

- `UiContentRegistry`
- `LocalizedTextCatalog`

## 3. 월드/엔티티 레지스트리

대표 전역:

- `Hero`
- `NpcResCnt`, `NpcRes`
- `NpcCnt`, `Npc`
- `MonResCnt`, `MonRes`
- `MonCnt`, `Mon`
- `Map`
- `MapBack`
- `itemResCnt`, `ItemRes`

새 소유:

- `HeroRuntimeState`
- `NpcRegistry`
- `MonsterRegistry`
- `MapRuntimeState`
- `ItemCatalog`

## 4. 인벤토리/드롭/UI 리스트

대표 전역:

- `InvenMaxCnt`
- `ItemIndexArr`
- `ItemIndexCnt`
- `InvenItem`
- `dropItem`
- `dropItemDraw`
- `questInfoDraw`
- `StoreItem`
- `tmpItem`

새 소유:

- `InventoryStateStore`
- `DropItemStateStore`
- `StoreStateStore`

## 5. 팝업/상점/브랜드샵/네트워크 화면 상태

대표 전역:

- `popupState`, `popupSubState`
- `popItem*`, `popEquip*`, `popSkill*`, `popQuest*`, `popSystem*`
- `StoreState`, `StoreSubState`, `StoreCur`
- `BrandShopState`, `BrandShopSubState`
- `NetworkState`, `NetworkSubState`

새 소유:

- `PopupStateStore`
- `ShopUiStateStore`
- `BrandShopStateStore`
- `NetworkUiStateStore`

## 6. 던전/자동전투/특수 모드 상태

대표 전역:

- `dungeonState`
- `dungeonStageNum`
- `dungeonFrm`
- `dungeonScore`
- `dungeonRewardNum`
- `dungeonRewardCnt`
- `dungeonType`
- `bDungeonOver`
- `bDungeonDown`
- `bAuto`

새 소유:

- `MysteryDungeonState`
- `AutoBattleState`

## 7. 핵심 초기화 함수군

대표 함수:

- `set_MainState()`
- `set_Npc()`, `unSet_Npc()`
- `set_Mon()`, `set_MysteryDungeonMon()`
- `set_ItemRes()`, `set_Item()`
- `set_Map()`, `set_MapData()`, `set_MapObjectData()`
- `set_WorldMap()`, `set_WorldMapDat()`
- `set_wareHouse()`
- `set_BlackSmith()`
- `set_Colosseum()`
- `set_Fighting()`
- `set_MysteryDungeon()`
- `set_MysteryDungeonMap()`

greenfield 분해:

- `WorldBootstrapService`
- `ContentBootstrapService`
- `ModeEntryService`
- `MysteryDungeonBootstrapService`

## `GAME_FUNCTION.*`

## 저장/퍼시스턴스

- `Save_option()`, `Load_option()`
- `SaveGAME()`, `LoadGAME()`
- `SaveWareHouseItem()`, `LoadWareHouseItem()`
- `SavePublicData()`, `LoadPublicData()`
- `set_SaveSlotInfo()`, `unSet_SaveSlotInfo()`

새 소유:

- `SaveRepository`
- `SaveSlotService`

## 맵/이동/충돌

- `get_mapTilepXpY()`
- `get_mapAtb()`
- `MoveCheck_CompareAtb()`
- `set_showPoint()`
- `HeroTurn()`
- `chk_AtbPntToPnt()`
- `CH_Collision()`
- `CH_PointCollision()`
- `CH_MephiCollision()`

새 소유:

- `MovementService`
- `CollisionService`
- `TileAttributeService`

## 히어로 전투/피격

- `chk_heroMove()`
- `set_HitBackPix()`
- `cal_HeroToMonDmg()`
- `chk_MonArray()`
- `chk_monHitState()`
- `chk_HeroAtkTarget()`
- `chk_HeroAtkHitCol()`
- `cal_HeroAtkjudge()`

새 소유:

- `HeroCombatService`
- `HitReactionService`

## NPC 로직

- `chk_npc*`
- `cal_NpcToMonDmg()`
- `chk_NpcMonTarget()`
- `get_npcResArrNum()`
- `cal_NpcAtkjudge()`

새 소유:

- `NpcRuntime`
- `NpcCombatService`

## Monster 로직

- `chk_mon*`
- `cal_MonToObjDmg()`
- `cal_MonAtkJudge()`

새 소유:

- `MonsterRuntime`
- `MonsterCombatService`

## 아이템/인벤토리/드롭

- `set_MonDropItem()`
- `chk_AutoDropItem()`
- `chk_DropItem()`
- `chk_MapBoxItem()`
- `chk_ObjchkHeroCol()`
- `set_heroEquip()`
- `invGrp()`
- `use_Potion()`
- `use_Item()`
- `chk_UseItem()`
- `get_BuyAbleCount()`
- `compareEquipItem()`
- `searchInven()`
- `searchWarehouse()`

새 소유:

- `InventoryService`
- `EquipmentService`
- `DropItemService`
- `ConsumableService`

## 스탯/능력치 계산

- `set_HeroTmpEquipItem()`
- `set_HeroTmpStatus()`
- `set_condition()`
- `set_HeroAbillity()`
- `cal_ChkSetItemEff()`
- `cal_HeroStat()`
- `cal_HeroSkillLV()`
- `cal_HeroAtk()`
- `cal_HeroSkillAtk()`
- `cal_HeroDef()`
- `cal_HeroAtkRate()`
- `cal_HeroAgi()`
- `cal_HeroCri()`
- `cal_HeroPoints()`
- `cal_HeroPointsMax()`
- `cal_Heroregens()`
- `cal_HeroPotionGens()`
- `cal_HeroElementAtb()`
- `cal_heroShieldBlockRate()`
- `cal_heroSkillCoolRate()`
- `cal_heroSkillAtkRate()`
- `cal_heroStealRate()`
- `cal_heroGetTpRate()`
- `cal_heroIgnoreDefRate()`
- `cal_heroIgnoreConditionState()`
- `cal_heroRageRate()`
- `cal_heroGetRareItemRate()`
- `cal_heroGetMoneyRate()`
- `cal_heroGetExpRate()`
- `cal_heroLuck()`
- `cal_heroPotionAdd()`
- `cal_heroMaxExp()`
- `cal_HitRate()`
- `cal_HeroGetExp()`

새 소유:

- `HeroStatService`
- `HeroProgressionService`
- `ConditionService`

## `UPDATE_MAIN.*`

상태별 update 진입점:

- `logoUpdate()`
- `titleUpdate()`
- `gamemenuUpdate()`
- `newgameUpdate()`
- `continuegameUpdate()`
- `GamehelpUpdate()`
- `GameoptionUpdate()`
- `GameQuestionUpdate()`
- `GameLoadingUpdate()`
- `StoreUpdate()`
- `BrandShopUpdate()`
- `SelectJobUpdate()`
- `WorldMapUpdate()`
- `GameOverUpdate()`
- `BlackSmithUpdate()`
- `ColosseumUpdate()`
- `Game_MainUpdate()`

월드 루프 핵심:

- `Hero_MoveCHeck()`
- `Hero_MoveUpdate()`
- `hero_GameeffUpdate()`
- `HeroUpdate()`
- `Npc_MoveCHeck()`
- `Npc_setChaseDir()`
- `Npc_MoveUpdate()`
- `NpcUpdate()`
- `Mon_MoveCHeck()`
- `Mon_setChaseDir()`
- `Mon_MoveUpdate()`
- `Mon_GameeffUpdate()`
- `MonsterUpdate()`

확인된 내부 helper:

- `hero_chkColNpcUpdate()`
- `selectJob_HeroUpdate()`
- `AUTO_HeroUpdate()`

새 소유:

- `GameLoopOrchestrator`
- `GameplayModeUpdate`
- `HeroRuntime`
- `NpcRuntime`
- `MonsterRuntime`
- `ModeSpecificUpdateHandlers`

## `KEYEVENT_MAIN.*`

입력 보조:

- `T_Collision()`
- `CH_TouchTriangle()`
- `PopupBoxYesNoTouch()`
- `PopupBoxSellectTouch()`
- `PopupBoxMessageTouch()`
- `PopupBoxQuickTouch()`

메인 입력 진입점:

- `Game_MainKey_P()`
- `Game_MainKey_R()`
- `Game_MainTouch_P()`
- `Game_MainTouch_R()`
- `Game_MainTouch_M()`

확인된 상태 전이 성격:

- 타이틀/메뉴/옵션/질문/상점/창고/대장간/콜로세움/UI 팝업 전부가 한 파일에 엉켜 있다
- `set_MainState()` 호출이 광범위하게 섞여 있어 greenfield에서는 상태별 입력 핸들러로 분해해야 한다

새 소유:

- `InputRouter`
- `StateSpecificInputHandler`
- `PopupInputController`

## `CHSCRIPT.*` / `CHGAME_SCRIPT.*`

스크립트 포맷:

- `SCS_*` opcode군
- `SCRIPTDAT`
- `SCRLIST`
- `SCRLISTDAT`
- `SP_setScript()`
- `SP_unSetScript()`

스크립트 런타임:

- `gameScript_Set()`
- `gameScript_unSet()`
- `gameScriptUpdate()`
- `gameScriptDraw()`
- `gameScriptMainKey_p/r()`
- `gameScriptMaintouch_p/r()`

확인된 내부 helper:

- `scriptHeroUpdate()`
- `scriptNpcUpdate()`
- `scriptMonsterUpdate()`

새 소유:

- `ScriptCatalogResource`
- `ScriptRuntime`
- `DialogueRuntime`
- `EventOpcodeExecutor`

## `GAME_NET.*` / `HelloWorldScene.*`

핵심 DTO:

- `THINGOPTION`
- `THINGDATA`
- `MAKEDATA`
- `REWARDDATA`
- `PLAYERDATA`
- `SOUND`

핵심 request 파서:

- `request_PlayerInfo()`
- `request_PlayerStatAdd()`
- `set_InvenInfo()`
- `request_InvenEquipItem()`
- `request_WarehouseInfo()`
- `request_ShopInfo()`
- `request_ShopBuyItem()`
- `request_ChangeItemOption()`
- `request_ForgeInfo()`
- `request_ForgeMix()`
- `request_DungeonInfo()`
- `request_DungeonDown()`
- `request_DungeonUp()`
- `request_ReturnTown()`
- `request_DungeonDead()`

씬 브리지:

- `request_GameInit()`
- `net_*`
- `callback_*`
- `GameLogic()`
- `RenderScene()`

새 소유:

- `LocalApiContracts`
- `LegacyParityEnvelopeAssembler`
- `LocalApiFacade`
- `GameScene`
- `AudioService`

## greenfield 분해 순서

1. `CHSPRITE.*`와 `CHFunction.*`에서 render kernel을 분리한다.
2. `INIT_MAIN.*` 전역을 `GameSessionState` 계열 스토어로 분해한다.
3. `GAME_FUNCTION.*`를 hero/npc/monster/item/stat 서비스로 분리한다.
4. `UPDATE_MAIN.*`를 `GameLoopOrchestrator`와 runtime 별 update로 분리한다.
5. `KEYEVENT_MAIN.*`를 상태별 입력 핸들러로 분해한다.
6. `GAME_NET.*`와 `HelloWorldScene.*`를 `LocalApiFacade` 기반 로컬 호출로 치환한다.

## 연계 문서

- 파일 전수 ledger: `source-coverage-symbol-ledger.md`
- 거대 전역 상태 분해: `init-main-state-partition.md`
- 파일 단위 rewrite 분류: `source-coverage-matrix.md`

## 후속 구현 게이트

- `DRAW_MAIN.cpp`의 실제 Control/UI 치환 완료 여부는 Phase 2/6 검증으로 넘긴다.
- `GAME_FUNCTION.cpp`의 formula parity와 scenario replay diff는 Phase 4/7 검증 게이트에서 닫는다.
