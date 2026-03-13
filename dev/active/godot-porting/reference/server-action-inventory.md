# DungeonNeko Local Server Action Inventory

Last Updated: 2026-03-06

## 목적

`.server/sdu_control.php`, `.server/neko_model.php`, `.server/setup.php`를 기준으로, 원래 HTTP로 처리하던 서버 액션을 **Godot 로컬 서비스 계약**으로 재정의하기 위한 문서다.

핵심 원칙:

- 서버 프로세스는 만들지 않는다.
- action 이름은 1차 이식에서 그대로 유지한다.
- `HelloWorldScene/GAME_NET`의 HTTP 콜백 체인은 로컬 서비스 호출 체인으로 치환한다.

## 공통 설정값

출처: `.server/setup.php`

| 키 | 값 | 의미 |
|---|---:|---|
| `statpoint` | `4` | 레벨업당 지급 스탯 포인트 |
| `basestat` | `4` | 기본 스탯 |
| `dungeon.value` | `100` | 던전 귀환 비용 배수 |
| `dungeon.type` | `gold` | 던전 귀환 비용 화폐 |
| `buybox.value` | `50` | 창고 확장 비용 |
| `buybox.type` | `crystal` | 창고 확장 화폐 |
| `buybox.size` | `30` | 창고 확장량 |
| `buybox.maxsize` | `60` | 창고 최대 크기 |
| `buymix.value` | `100` | 재료 랜덤 구매 비용 |
| `buymix.type` | `gold` | 재료 랜덤 구매 화폐 |
| `buyitem.value` | `50` | 장비 랜덤 구매 비용 |
| `buyitem.type` | `crystal` | 장비 랜덤 구매 화폐 |
| `buyitem.bonus` | `2` | 장비 랜덤 구매 랭크 보너스 |
| `buyopt.value` | `50` | 옵션 변경 비용 |
| `buyopt.type` | `crystal` | 옵션 변경 화폐 |
| `buyopt.bonus` | `2` | 옵션 변경 랭크 보너스 |
| `buyexp.value` | `100` | 경험치 구매 비용 |
| `buyexp.type` | `crystal` | 경험치 구매 화폐 |
| `buyexp.exp` | `70000` | 구매 경험치량 |

## 파생 능력치 규칙

출처: `.server/neko_model.php:get_user_data()`

| 필드 | 식 |
|---|---|
| `maxhp` | `vit * 12.8` |
| `maxmp` | `intg * 4.2` |
| `atk` | `str * 1.7 + intg * 0.5` |
| `def` | `vit * 0.8` |
| `pen` | `agi * 0.3` |
| `hit` | `agi * 1` |
| `dodge` | `(100 / (100 + vit)) * agi / 100 * 100` |
| `cri` | `(100 / (100 + str)) * agi / 100 * 100` |

로컬 포팅 원칙:

- DB 문자열/정수 혼합 상태를 그대로 흉내내지 않는다.
- 계산식 결과는 로컬 도메인 모델에서 명시 타입으로 보관한다.
- 단, 결과 수치는 원본과 동일해야 한다.

## 레벨/경험치 규칙

출처: `.server/sdu_control.php`, `.server/neko_model.php:get_reward()`

| 항목 | 규칙 |
|---|---|
| 다음 레벨 필요 경험치 | `level * level + 20` |
| 레벨업 시 | `level += 1`, `statpoint += 4`, `maxexp = level^2 + 20` |
| `buyexp` | `70000 exp` 지급 후 while-loop 레벨업 |
| `get_reward` | `expget = int((pos * (rand(50..100)/100 + 1)) * (huntcnt / 5))` |

## 인벤토리/창고 규칙

출처: `.server/neko_model.php`

| 항목 | 규칙 |
|---|---|
| 기본 페이지 크기 | `30` |
| 재료 stack 최대 | `99` |
| 인벤 full 판정 | `get_user_item_cnt(1) >= invensize` |
| 창고 full 판정 | `get_user_item_cnt(2) >= boxsize` |
| `get_reward` full 기준 | `30` 고정 |
| 창고 확장 | `+30`, 최대 `60` |

주의:

- `get_reward()`는 `user_item_cnt >= 30`을 기준으로 full 판정한다.
- 인벤 크기 필드(`invensize`)와 별개로 30 고정 기준이 남아 있다.
- greenfield 구현에서는 이 불일치를 **명시적 정책 결정 항목**으로 다뤄야 한다.

## 장비 슬롯 규칙

출처: `.server/neko_model.php:take_user_item()`, `Classes/GAME_NET.h`

서버 타입 -> equip 필드 매핑:

| item `type` | equip 필드 | 의미 |
|---:|---|---|
| `1` | `equip0` | 투구 |
| `2` | `equip1` | 벨트 |
| `5` | `equip2` | 목걸이 |
| `0` | `equip3` | 무기 |
| `3` | `equip4` | 장갑 |
| `6` | `equip5` | 반지 |
| `4` | `equip6` | 신발 |
| `7` | `equip7` | 펜던트 |

주의:

- `Classes/GAME_NET.h`의 `PLAYERDATA.equip[7]` 주석은 7슬롯처럼 보이지만, 서버는 `equip0..equip7` 8개 필드를 사용한다.
- greenfield 설계에서 **실제 장비 슬롯 수와 UI 슬롯 수를 먼저 잠가야 한다**.

## action 인벤토리

| action | resCode | 클라이언트 진입점 | 핵심 동작 | 로컬 서비스 타깃 |
|---|---:|---|---|---|
| `info` | `900002` | `callback_Info` | 현재 유저 스냅샷 반환 | `PlayerInfoService.GetSnapshot()` |
| `resetstat` | `900004` | `callback_ResetStat` | 1000000 gold 차감, 스탯/HP/MP 초기화 | `StatDistributionService.ResetStats()` |
| `addstat` | `900003` | `callback_StatAdd` | statpoint 차감 후 stat 증가 | `StatDistributionService.AddStat()` |
| `dungeon` | `100000` | `callback_DungeonInfo` | status에 따라 던전 입장/점프, town=0 설정 | `DungeonEntryService.Enter()` |
| `levelup` | `100004` | 직접/보상 루프 | 강제 레벨업 | `ProgressionService.LevelUp()` |
| `dead` | `100005` | `callback_DungeonDead` | 층수 하향, town=1, 포션 차감 | `DungeonResolutionService.ResolveDeath()` |
| `down` | `100001` | `callback_DungeonDown` | 층수 +1, 보상 지급, maxpos 갱신 | `DungeonProgressService.MoveDown()` |
| `up` | `100002/100003` | `callback_DungeonUp` | 층수 -1, 0 이하면 town 복귀 | `DungeonProgressService.MoveUp()` |
| `town` | `100003` | `callback_DungeonReturn` | `pos * 100 gold` 차감 후 마을 복귀 | `DungeonExitService.ReturnTown()` |
| `inventory` | `300000` | `callback_InvenInfo` | 인벤 목록/페이지 반환 | `InventoryQueryService.ListInventory()` |
| `delete` | `300001` | 미사용 | 삭제 | 제거 후보 |
| `sell` | `300002` | `callback_InvenSell` | 아이템 삭제 + gold 환급 | `InventoryMutationService.SellItem()` |
| `save` | `300003` | `callback_InvenKeep` | 인벤 -> 창고 이동 | `WarehouseService.StoreItem()` |
| `buylist` | `400000` | 미사용 | 상점 목록 | 제거 후보 |
| `buy` | `400001` | `callback_ShopBuy` | 직접 구매(현재 비권장) | `ShopService.BuyFixedItem()` |
| `buyr` | `400002/400003` | `callback_ShopBuyItem`, `callback_ChangeItemOption` | 랜덤 장비/재료 구매, 옵션 재굴림 | `ShopService.BuyRandom()`, `EquipmentOptionService.Reroll()` |
| `shoplist` | `400005` | `callback_ShopInfo` | 상점 코드 목록 반환 | `ShopCatalogService.GetLegacyShopCodes()` |
| `mixlist` | `500000` | `callback_ForgeInfo` | 조합식 목록 조회 | `BlacksmithService.ListRecipes()` |
| `mix` | `500001` | `callback_ForgeMix` | 조합 재료 차감 + 결과 생성 | `BlacksmithService.Craft()` |
| `safebox` | `600000` | `callback_WarehouseInfo` | 창고 목록 조회 | `WarehouseService.ListItems()` |
| `load` | `600001` | `callback_WarehouseOutItem` | 창고 -> 인벤 이동 | `WarehouseService.LoadItem()` |
| `takeon` | `700001` | `callback_InvenEquip` / `callback_GetEquipItem` | 장착 | `EquipmentService.Equip()` |
| `takeoff` | `700002` | 대응 해제 흐름 | 해제 | `EquipmentService.Unequip()` |
| `potionbuy` | `800001` | `callback_BuyPotion` | 포션 구매 | `ConsumableService.BuyPotion()` |
| `potionuse` | `800002` | 런타임 포션 사용 | 포션 사용 | `ConsumableService.UsePotion()` |
| `addbox` | `990003` | `callback_WarehouseExpand` | 창고 확장 | `WarehouseService.Expand()` |
| `buyexp` | `990004` | `callback_BuyExp` | crystal 차감 후 exp 지급 | `ProgressionService.BuyExp()` |

## action별 핵심 규칙

### `resetstat`
- 실패 코드:
  - `3`: 이미 초기 상태
  - `2`: 골드 부족
- 성공 시:
  - `gold -= 1000000`
  - `statpoint = (level - 1) * 4`
  - `str/vit/intg/agi = 4`
  - `maxhp/hp = 51.2`
  - `maxmp/mp = 16.8`

### `addstat`
- `svalue` 기본값 `1`
- `vit` 증가 시 `maxhp += 12.8 * svalue`
- `intg` 증가 시 `maxmp += 4.2 * svalue`, `mp += 4.2 * svalue`

### `dungeon`
- `status = 0`: `pos = 1`
- `status = 1`: `gold >= pos * 100`이면 입장, 아니면 `errCode = 2`
- `status = 2`: `crystal >= 1`이면 `pos = maxpos - 3`, 아니면 `errCode = 2`
- 성공 시 `town = 0`

### `down` / `up` / `town`
- 전부 `hppotion -= hpuse`, `mppotion -= mpuse`를 수행한다.
- `down`:
  - `pos += 1`
  - `maxpos` 갱신 가능
  - `reward = get_reward(huntcnt)`
- `up`:
  - `pos -= 1`
  - `pos <= 0`이면 `town = 1`, resCode는 `100003`
- `town`:
  - 비용은 `pos * setup['dungeon']['value']`
  - 현재 설정상 `gold * 100`

### `get_reward(huntcnt)`
- `huntcnt == 0`이면 보상 없음
- gold:
  - `base = int(pos * (rand(1..100)/100 + 1))`
  - `gold = base + base * capped_huntcnt`
- exp:
  - `expget = int((pos * (rand(50..100)/100 + 1)) * (huntcnt / 5))`
- item:
  - 대상 테이블은 `type != 99` and `level <= pos + 10`
  - 지급 개수는 `int(huntcnt / 5 + 1)`
- full:
  - 인벤 30칸 기준으로 강제 제한

### `buyr`

모드별 분기:

- `mode = 0`: 장비 랜덤 구매
- `mode = 2`: 기존 장비 옵션 재굴림
- 그 외: 재료 랜덤 구매

비용 화폐:

- 장비 랜덤 구매: `crystal 50`
- 옵션 재굴림: `crystal 50`
- 재료 랜덤 구매: `gold 100`

### `mix`
- 조합 비용(gold) 확인
- 인벤 여유 확인
- 재료 수량 확인
- 결과 아이템 생성
- 재료 삭제
- gold 차감

### `potion`
- 구매:
  - `gold >= cnt * 100`
- 사용:
  - 구현상 `cnt`를 무시하고 1개만 차감한다

## 클라이언트 콜백 대응

출처: `Classes/HelloWorldScene.h`, `Classes/GAME_NET.cpp`

| 클라이언트 함수 | 대응 action |
|---|---|
| `request_PlayerInfo` | `info` |
| `request_PlayerStatAdd` | `addstat` |
| `request_InvenEquipItem` | `takeon` / `takeoff` |
| `request_InvenSellItem` | `sell` |
| `request_InvenKeepItem` | `save` |
| `request_WarehouseInfo` | `safebox` |
| `request_WarehouseOutItem` | `load` |
| `request_WarehouseExpand` | `addbox` |
| `request_ShopInfo` | `shoplist` |
| `request_ShopBuyItem` | `buyr` 또는 `buy` |
| `request_GetEquipItem` | `takeon` |
| `request_BuyPotion` | `potionbuy` |
| `request_ResetStat` | `resetstat` |
| `request_ChangeItemOption` | `buyr(mode=2)` |
| `request_BuyExp` | `buyexp` |
| `request_ForgeInfo` | `mixlist` |
| `request_ForgeMix` | `mix` |
| `request_DungeonInfo` | `dungeon` |
| `request_DungeonDown` | `down` |
| `request_DungeonUp` | `up` |
| `request_ReturnTown` | `town` |
| `request_DungeonDead` | `dead` |

## greenfield 설계 결정 필요 항목

1. `equip0..equip7` 8슬롯과 클라이언트 7슬롯 모델의 불일치 처리
2. `get_reward()`의 인벤 30칸 고정 full 판정을 보존할지, `invensize` 기준으로 교정할지
3. `potionuse`의 `cnt` 무시 동작을 버그 호환으로 유지할지
4. `dungeon.get_dungeon()`이 빈 구현인 점을 감안해, 실제 던전 payload SoT를 `Classes` 쪽에서 확정할지
5. `buy`/`buylist`/`delete`처럼 사실상 죽은 action을 제거할지 보존할지

## 결론

- `.server`는 단순 저장소가 아니라 성장/경제/던전 보상 규칙의 핵심 SoT다.
- greenfield rewrite에서는 action을 HTTP endpoint가 아니라 **로컬 command contract**로 재정의해야 한다.
- 다음 구현 문서는 각 action에 대한 입력 DTO, 출력 DTO, 에러코드 enum, 상태 변경 규칙을 타입 수준으로 잠그는 것이다.
