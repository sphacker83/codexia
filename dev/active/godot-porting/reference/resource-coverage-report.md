# DungeonNeko Resource Coverage Report

Last Updated: 2026-03-06

## 목적

이 문서는 greenfield Godot 포팅에서 `res/*`를 어떤 우선순위와 책임으로 사용할지 고정하는 리소스 커버리지 보고서다.

핵심 원칙:

- 런타임 SoT는 `Classes`의 해석 규칙과 `res/*` 원본 산출물이다.
- 기존 Godot 프로젝트 내부 `assets/*` 복사본은 SoT가 아니다.
- `res/sprites/source`, `res/sprites/rendered`는 검증 보조물이지 런타임 입력이 아니다.
- `res/data`는 편의용 정규화 산출물로 취급하며, 범위가 더 넓은 `res/dat`를 덮어쓰지 않는다.

## 전수 요약

전체 파일 수: `5124`

| 경로 | 파일 수 | 하위 그룹 수 | 역할 |
|---|---:|---:|---|
| `res/img` | `2581` | `53` | 스프라이트/클립/플트알파 원본 이미지 |
| `res/sprites/source` | `860` | `34` | 일부 스프라이트 그룹의 source mirror |
| `res/sprites/rendered` | `480` | `34` | 레이어 매니페스트 기반 렌더 검증 산출물 |
| `res/dat` | `584` | `43` | 구조화된 legacy spec 데이터 |
| `res/dat_eng` | `179` | `4` | 부분 영문 spec 데이터 |
| `res/objects` | `360` | `14` | 오브젝트 PNG 전용 산출물 |
| `res/data` | `25` | `2` | 일부 정규화 JSON 데이터 |
| `res/txt` | `10` | - | 한글 텍스트 |
| `res/txt_eng` | `10` | - | 영문 텍스트 |
| `res/snd` | `24` | - | 오디오 |
| `res/fonts` | `1` | - | 폰트 |

확장자 분포:

| 확장자 | 개수 |
|---|---:|
| `png` | `3072` |
| `json` | `2007` |
| `ctx` | `20` |
| `ogg` | `13` |
| `wav` | `11` |
| `ttf` | `1` |

추가 관찰:

- `res/img` 안에는 `*.clips.json`이 `400`개 있다.
- `res/img` 안에는 `*_pltalpha.png`가 `847`개 있다.
- `res/objects`는 `360`개 전부 PNG이며, 메타데이터 JSON이 없다.

## 사용 우선순위

## P0. 런타임/빌드 파이프라인의 직접 SoT

### `res/dat`

- 범위가 가장 넓은 구조 데이터다.
- 스프라이트, 월드맵, 퀘스트, 스크립트, 오브젝트 스프라이트 그룹을 포함한다.
- full rewrite 기준의 spec importer는 우선 `res/dat`를 읽어야 한다.

주요 그룹:

- `COMMONSPR`
- `HSPR_*`
- `MSPR_*`
- `NSPR_*`
- `OBJECT_SPR`
- `QUESTDAT`
- `ScriptDat_16`
- `WORLDMAP`

### `res/img`

- 실제 이미지 원본은 여기서 읽는다.
- clip 메타는 `*.clips.json`, 알파 합성 보조는 `*_pltalpha.png`로 제공된다.
- `CHSPRITE`/`CHFunction` 기준의 clip, style, palette alpha 재현은 이 폴더를 기준으로 importer를 만든다.

### `res/objects`

- 맵 오브젝트 전용 PNG 산출물이다.
- 자체 메타데이터가 없으므로 `Classes`와 `res/dat`의 해석 규칙으로 연결해야 한다.
- 오브젝트는 이미지 파일만으로는 의미를 복원할 수 없다.

### `res/txt`, `res/txt_eng`

- 로컬라이즈된 문구 SoT다.
- 10개 파일이 한/영 쌍으로 정합한다.
- UI와 스크립트 텍스트는 이 폴더를 기준으로 importer를 만든다.

### `res/snd`, `res/fonts`

- 오디오와 폰트의 직접 SoT다.
- `res/snd`: `ogg 13`, `wav 11`
- `res/fonts`: `Marker Felt.ttf`

## P1. 부분 정규화/보조 SoT

### `res/data`

포함 범위:

- 루트 데이터 5개
  - `items.json`
  - `monsters.json`
  - `npcs.json`
  - `obj_data.json`
  - `quests.json`
- `maps/10/map_0..14.json` 15개
- `scripts/ScriptDat_16/script_0..4.json` 5개

해석:

- importer 프로토타입과 비교 검증에는 유용하다.
- 하지만 맵이 `10` 한 묶음만 있고, 스크립트도 `ScriptDat_16` 일부만 있어 전체 SoT가 아니다.
- `res/data`와 `res/dat`가 겹치면 `res/dat`를 우선한다.

### `res/dat_eng`

- `ENG_MAP_10`, `ENG_QUESTDAT`, `ENG_ScriptDat_16`, `ENG_WORLDMAP`만 존재한다.
- 영문 구조 데이터는 부분 커버리지에 그친다.
- 전체 영문화 SoT로 쓰면 안 되고, localized override 정도로만 사용해야 한다.

## P2. 검증/비교 전용

### `res/sprites/source`

- `res/img`의 부분 집합이다.
- `res/sprites/source`에는 `res/img`에 없는 그룹이 0개다.
- 반대로 `res/img`에는 있는데 `res/sprites/source`에 없는 그룹이 19개다.

누락 그룹:

- `CHFONT`
- `CHFONT_ENG`
- `INTERFACEIMG`
- `ITEMIMG`
- `MENUNAMEIMG`
- `MONEFF_2`
- `OB_0`
- `OB_11`
- `OB_2`
- `OB_3`
- `OB_5`
- `OB_6`
- `OB_7`
- `OB_8`
- `OB_9`
- `SKILLICON`
- `SUBCOMMON`
- `TITLE`
- `TOUCHIMG`

결론:

- `res/sprites/source`는 전체 입력 소스가 아니다.
- 빌드 결과와 원본 이미지 그룹을 비교하는 참조 자료로만 사용한다.

### `res/sprites/rendered`

- `res/dat`와 이름이 맞는 렌더 매니페스트 그룹은 많지만, 전체를 덮지 못한다.
- `res/dat`에는 있는데 `res/sprites/rendered`에 없는 그룹이 9개다.

누락 그룹:

- `COLOSSEUM`
- `GAMELISTDAT`
- `HSPR_A`
- `MAP_10`
- `NSPR_12`
- `QUESTDAT`
- `SKILLLISTDAT`
- `ScriptDat_16`
- `WORLDMAP`

결론:

- `res/sprites/rendered`는 parity evidence다.
- 이 그룹을 런타임에서 직접 읽는 설계는 금지한다.

## 자산군별 상세 해석

## 1. 이미지/스프라이트

파일 수가 큰 상위 그룹:

| 그룹 | 파일 수 |
|---|---:|
| `ITEMIMG` | `464` |
| `OB_5` | `73` |
| `OB_8` | `69` |
| `OB_3` | `69` |
| `OB_9` | `66` |
| `OB_11` | `66` |
| `OB_0` | `64` |
| `NPC_3` | `64` |
| `OB_6` | `63` |
| `HA_2` | `63` |
| `HA_1` | `63` |
| `HA_0` | `63` |

해석 포인트:

- `HA_*`, `HW_*`, `MON_*`, `NPC_*`, `HEFF_*`, `MONEFF_*`는 캐릭터/이펙트 계열이다.
- `ITEMIMG`, `SKILLICON`, `INTERFACEIMG`, `TOUCHIMG`, `TITLE`은 UI/아이콘/타이틀 자산군이다.
- `OB_*`는 월드 오브젝트 이미지군이며, `res/objects`와 함께 해석해야 한다.

## 2. DAT 구조 데이터

파일 수가 큰 상위 그룹:

| 그룹 | 파일 수 |
|---|---:|
| `QUESTDAT` | `135` |
| `MASPR` | `41` |
| `GAMELISTDAT` | `39` |
| `COMMONSPR` | `30` |
| `WORLDMAP` | `21` |
| `MAP_10` | `15` |

해석 포인트:

- `QUESTDAT`, `WORLDMAP`, `MAP_10`, `ScriptDat_16`은 gameplay/runtime importer에 직접 연결된다.
- `COMMONSPR`, `HSPR_*`, `MSPR_*`, `NSPR_*`, `OBJECT_SPR`은 render spec importer가 직접 소비한다.

## 3. 오브젝트 자산

파일 수:

| 그룹 | 파일 수 |
|---|---:|
| `OB_3` | `71` |
| `OB_9` | `61` |
| `OB_0` | `61` |
| `OB_5` | `50` |
| `OB_7` | `34` |
| `OB_2` | `30` |
| `OB_8` | `23` |
| `OB_11` | `22` |
| `OB_6` | `8` |

빈 디렉터리:

- `OB_1`
- `OB_4`
- `OB_10`
- `OB_12`
- `OB_14`

정책:

- 빈 디렉터리는 "사용 안 함"으로 섣불리 판단하지 않는다.
- `Classes`나 맵 데이터에서 참조되면 즉시 fail-fast 대상이다.

## greenfield 결정 사항

1. importer의 1차 입력은 `res/dat`, `res/img`, `res/objects`, `res/txt`, `res/snd`다.
2. `res/data`는 부분 정규화 자료로만 사용한다.
3. `res/sprites/source`, `res/sprites/rendered`는 검증용 비교 데이터로만 쓴다.
4. 기존 `DungeonNeko-Godot/assets/*`에 복사된 raw asset은 전부 disposable cache로 본다.
5. object metadata는 별도 복구 단계가 필요하며, PNG만으로 self-contained하지 않다.

## 빌드 파이프라인 요구사항

1. `dat -> spec` 단계
- 스프라이트, 맵, 월드맵, 퀘스트, 스크립트 spec을 생성한다.

2. `img/object -> texture registry` 단계
- clip region, pltalpha companion, object image registry를 생성한다.

3. `txt/snd/font -> content registry` 단계
- locale text, audio cue, font registry를 생성한다.

4. coverage gate 단계
- `dat`가 참조하는 이미지 그룹 누락
- `img` 그룹의 clip 메타 누락
- object group empty reference
- locale pair 누락

를 자동 실패로 잡아야 한다.

## 남은 리스크

- `res/objects`가 메타 없이 PNG만 제공하므로, object spec 연결 규칙을 잘못 해석할 위험
- `res/data`가 편해 보여도 부분 데이터라 전체 SoT처럼 오용될 위험
- `res/sprites/rendered`를 그대로 재사용하고 싶어지는 유혹 때문에 native renderer 설계가 흔들릴 위험
- 빈 object 디렉터리가 실제 미추출 자산일 가능성
