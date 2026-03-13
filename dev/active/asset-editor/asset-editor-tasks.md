# Asset Editor - Tasks

## Phase 1: Editor Container/탐색 UI
- [x] 컨테이너 탭(뷰어/에디터) 추가
- [x] 탭 UI 소형/좌측 정렬 스타일 적용
- [x] 에디터 도메인 탭(플레이어/몬스터/NPC/아이템/맵) 추가
- [x] 도메인별 엔티티 목록 필터링

## Phase 2: 저장 API/데이터 반영
- [x] `PUT /api/resources/editor/entity` 구현
- [x] category별 저장 함수 구현(player/monster/npc/item/map)
- [x] 저장 후 캐시 무효화 + 최신 entity/matches 반환
- [x] 에디터 화면에서 저장/되돌리기 연결

## Phase 3: 도메인 전용 편집기
- [x] JSON 직접 편집을 모달 버튼 방식으로 전환
- [x] 스프라이트 워크벤치(액션/시퀀스/프레임/레이어 편집) 1차 구현
- [x] 맵 탭을 타일 기반 맵 에디터로 전환(`img_dat` 페인팅)
- [x] 맵 생성 기능(`map_*.json` 신규 작성 API + UI) 추가
- [x] 맵 리사이즈 기능(`size_x/size_y`, grid 재정규화) 추가
- [x] 맵 편집 레이아웃 최적화(상단 통합바/우측 팔레트/캔버스 줌/탐색기 폭 축소)
- [x] 비-액션 스프라이트용 Quick Editor(`spr/img` 필드 + 배열 + 프리뷰) 추가
- [x] 몬스터/NPC Quick Editor에서 연결 스프라이트(`MSPR/NSPR`) 액션 편집으로 이동 연결
- [x] 몬스터/NPC/아이템 스탯 필드(primitive + 숫자배열) 폼 편집 추가
- [ ] 플레이어 전용 폼 고도화(드래그 배치, 키프레임 복제, 일괄 정렬)
- [ ] 몬스터 전용 폼(스탯/spr_type/spr_num/img_list)
- [ ] NPC 전용 폼(res_num/scr_num/spr)
- [ ] 아이템 전용 폼(type/icon/costume/price/limit)
- [ ] 맵 전용 폼(size/gates/obj_list/atb_dat)

## Phase 4: Manifest 기반 검증/프리뷰 강화
- [ ] 저장 전 manifest 후보 체인 검증
- [ ] `spr_type/spr_num` 변경 시 prefix/key 영향 미리보기
- [ ] 재렌더 필요 여부 표시
- [ ] 재렌더 파이프라인 연결(수동/자동 정책 확정)

## Phase 5: 안정화
- [ ] 입력 스키마 검증(도메인별)
- [ ] 실패 롤백/에러 메시지 정교화
- [ ] 기본 E2E 체크(각 도메인 1회 저장)
- [ ] 문서/운영 가이드 업데이트
