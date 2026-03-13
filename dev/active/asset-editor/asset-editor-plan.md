# Asset Editor - Plan

## 요약
`assetmng`를 단순 뷰어에서 "뷰어/에디터" 모드가 공존하는 리소스 IDE로 확장한다.
에디터 최소 범위는 다음 5개 도메인이다.
- 플레이어
- 몬스터
- NPC
- 아이템
- 맵

핵심 원칙:
- 기존 뷰어 UX는 유지
- 저장은 원본 `res/dat/*.json`에 반영
- 스프라이트 확인은 기존 runtime manifest(`assets/sprites/rendered/*_layer_manifest.json`)를 우선 활용

## 현재 상태
- 컨테이너 탭(`뷰어/에디터`)이 존재함
- 에디터 도메인 탭(플레이어/몬스터/NPC/아이템/맵) + 저장 API가 구현됨
- JSON 직접 편집은 모달 버튼 방식으로 분리됨
- 중앙 에디터는 액션/시퀀스/프레임/레이어 기반 스프라이트 워크벤치로 동작함
- 레이어 편집(`img_num/clip_num/pos/rtype/spread`, 순서 이동/복제/삭제, 팔레트 추가) 가능
- map 도메인은 맵 에디터로 확장됨
  - `img_dat` 타일 팔레트 선택 + 캔버스 페인팅
  - 맵 생성(`map_*.json` 신규 파일)
  - 맵 리사이즈(크기 변경 + grid 재정규화)
  - 편집 레이아웃 재정렬(상단 통합바, 우측 팔레트, 캔버스 줌)

## 목표 상태
1. 에디터 모드에서 5개 도메인 전환 가능
2. 도메인별 엔티티 탐색 + 스프라이트 워크벤치 편집 + 저장
3. 저장 후 엔티티/이미지/manifest 참조 즉시 갱신
4. viewer/editor 모두 동일 엔티티 모델을 공유

## 단계

### Phase 1: 에디터 컨테이너/탭/레이아웃
- 컨테이너 탭을 좌측 소형으로 정리
- 에디터 서브탭(플레이어/몬스터/NPC/아이템/맵) 추가
- 도메인별 엔티티 필터링 목록 제공

AC:
- 뷰어 모드 기존 기능 유지
- 에디터 모드 진입 시 도메인 탭과 목록 표시

### Phase 2: 저장 파이프라인
- `PUT /api/resources/editor/entity` 추가
- `resource-fs.ts`에 category별 저장 함수 추가
  - player: `dat/HSPR_*/spr_*.json`, `dat/BUSTSPR/spr_*.json`
  - monster: `dat/MONLIST.json#resource_section.resources[*]`
  - npc: `dat/NPCLIST.json#npc_section.instances[*]`
  - item: `dat/ItemDat.json#items[*]`
  - map: `dat/MAP_10/map_*.json`
- 저장 후 캐시 무효화 및 재조회

AC:
- 저장 성공 시 응답으로 최신 entity/matches 반환
- 저장 실패 시 명확한 에러 메시지 제공

### Phase 3: 도메인별 편집 UX 강화
- JSON 모달 편집 + 스프라이트 워크벤치(클립 팔레트/레이어 배치) 기반으로 확장
- map 탭은 JSON draft 중심이 아니라 타일 기반 맵 편집기로 분리
- 변경 diff/dirty 상태 시각화
- 스키마/필드 검증(범위, enum, 배열 길이)

AC:
- JSON 직접 편집을 모달로 분리하고, 메인 화면은 스프라이트 편집 중심
- action/sequence/frame 단위로 레이어 배치 편집 가능
- 잘못된 입력은 저장 전 차단

### Phase 4: Manifest 연동 고도화
- manifest 후보 체인/적용 경로를 에디터 우측에서 명시
- `spr_type/spr_num` 변경 시 파생 영향(키, prefix, fallback) 실시간 검증
- 필요 시 재렌더 가이드/자동화 훅 추가

AC:
- sprite 누락 가능성 사전 감지
- 재렌더 필요 여부를 에디터에서 즉시 확인

## 리스크
- JSON 구조 변형 시 원본 포맷 훼손 위험
- map category에 `MAPITEM`과 `MAP_10`이 함께 존재해 저장 대상 혼동 가능
- 대용량 `res` 스캔으로 dev/build 성능 이슈(Turbopack 경고 존재)

## 성공 지표
- 5개 도메인에서 최소 1개 엔티티 저장 E2E 성공
- 저장 후 viewer와 editor 모두 동일 데이터 반영
- sprite coverage 검증/빌드 실패 없음
