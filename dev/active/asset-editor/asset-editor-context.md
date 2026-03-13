# Asset Editor - Context

## SESSION PROGRESS (2026-03-04)

### ✅ 완료
- 컨테이너 탭(뷰어/에디터) 추가 및 좌측 소형 탭 스타일 적용
- 에디터 모드 기본 구조 구현
  - 도메인 탭: 플레이어/몬스터/NPC/아이템/맵
  - 도메인별 엔티티 탐색 목록
  - JSON 편집 모달 버튼(`JSON 편집`) 방식
  - 저장/되돌리기 버튼
  - manifest 참조 경로 + 스프라이트 스냅샷 패널
- 스프라이트 워크벤치 구현
  - action/sequence/frame 선택
  - Clip Palette(기존 clip 조합 재사용)
  - Frame Canvas 레이어 합성 미리보기
  - Layer Stack 편집(`img_num/clip_num/pos_x/pos_y/rtype/spread`)
  - 레이어 위/아래 이동, 복제, 삭제, 팔레트에서 추가
- 맵 전용 에디터 구현
  - 타일 팔레트(0~99) 선택
  - `img_dat` 캔버스 페인팅(클릭/드래그)
  - 맵 메타 필드 수정(name/type/img_num/bg_num)
  - 맵 리사이즈(`size_x/size_y` + `img_dat/atb_dat` 재구성)
  - 신규 맵 생성(`POST /api/resources/editor/entity` with `action=create-map`)
- 맵 에디터 UI 사용성 개선
  - 좌측 Explorer 폭 축소(기존 대비 절반 수준)
  - `Map Create` + `Map Settings` + 저장/되돌리기/JSON를 상단 통합 바로 재배치
  - 타일 팔레트를 우측 패널로 이동하고 캔버스 영역 확대
  - 캔버스 줌 컨트롤(`+ / o / -`, 원배율 복귀) 추가
- 비-액션 스프라이트 엔티티 Quick Editor 추가
  - `actions/frames`가 없어도 `spr_type/spr_num/img_*` 등 필드 자동 탐지
  - `img_list/sub_spr_list` 배열 값 UI 조절
  - 매칭된 스프라이트 프리뷰 선택/확인 가능
  - 필드 변경 시 `/api/resources/image-match` 재조회로 프리뷰 즉시 갱신
  - 몬스터/NPC에서 연결된 `MSPR/NSPR` 스프라이트를 직접 열어 액션/시퀀스/프레임 편집으로 이동 가능
  - 몬스터/NPC/아이템의 스탯/메타 primitive 필드(숫자/문자열/불리언)와 숫자 배열 필드 편집 UI 추가
- 엔티티 초기 로딩 최적화
  - `player/skill/other-ui/monster`는 이미지 존재 필터를 생략해 목록 생성 지연 최소화
- 저장 API 추가
  - `PUT /api/resources/editor/entity`
  - `POST /api/resources/editor/entity` (`create-map`)
- `resource-fs.ts` 저장 로직 추가
  - category별 JSON write 함수
  - 저장 후 entity 관련 캐시 무효화

### 🟡 진행 중
- 도메인별 전용 폼 편집 UI(현재는 플레이어=스프라이트, 맵=타일 에디터, 나머지=JSON 모달)
- map editor 범위 확장(`MAPITEM`, `ObjData` 연계)
- 저장 전 필드 검증 스키마화

### ⚠️ 확인 필요
- player category에 skill/equipment 편집 범위를 포함할지 별도 탭으로 분리할지
- 저장 후 재렌더 자동 트리거 정책(즉시 vs 수동)
- sprite가 아닌 엔티티(monster/npc/item/map)의 메인 편집 UX를 스프라이트 워크벤치와 어떻게 분리할지

## 핵심 파일

### `assetmng/src/app/page.tsx`
- 컨테이너 모드 상태(`viewer/editor`) 및 editor UI 구현
- editor 도메인 필터링, draft 상태, save handler 포함

### `assetmng/src/app/globals.css`
- 컨테이너 탭 소형 스타일
- editor toolbar/textarea/manifest list 스타일

### `assetmng/src/app/api/resources/editor/entity/route.ts`
- 에디터 저장 API 엔드포인트

### `assetmng/src/lib/resource-fs.ts`
- JSON write(`writeResJson`)
- 캐시 무효화(`invalidateEntityCaches`)
- category별 저장 함수 및 `updateResourceEntityData`

## 데이터/manifest 구조 메모
- Monster: `dat/MONLIST.json#resource_section.resources[*]`
- NPC: `dat/NPCLIST.json#npc_section.instances[*]`
- Item: `dat/ItemDat.json#items[*]`
- Map: `dat/MAP_10/map_*.json`
- Runtime manifest: `dungeon-neko-web/public/assets/sprites/rendered/*_layer_manifest.json`

## 빠른 재개
1. `asset-editor-tasks.md`에서 남은 Phase 확인
2. 도메인별 폼 컴포넌트 분리(`editor/player|monster|npc|item|map`)
3. 저장 전 검증 + 저장 후 재렌더 가이드 연결
