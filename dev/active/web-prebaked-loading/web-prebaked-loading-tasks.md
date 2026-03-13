# Web Prebaked Loading Tasks

## P0

- [x] 웹 export에 baked atlas / baked manifest 복사 추가
- [x] `runtime_image_asset_index.json` 생성 경로를 정식화하고 baked path를 포함
- [x] 웹 타입에 baked manifest / baked asset kind 추가

## P1

- [x] `RuntimeLayerComposer`에 baked manifest 우선 로딩 추가
- [x] atlas crop -> frame texture 생성 경로 추가
- [x] layer override 존재 시 baked 우회 규칙 추가
- [x] Hero/NPC/Monster/Effect 주요 호출부는 composer 공통 경로를 통해 baked 우선 정책을 공유
- [x] `spriteAnimationMap` 기준 unique texture ref preload prepass 추가

## P2

- [x] IndexedDB 기반 local prebake cache 스토어 추가
- [x] asset version / render mode / override signature 기반 cache key 정의
- [x] `spriteAnimationMap` 단위 source preload prepass 추가
- [x] hero 본체 초기 로딩을 core action 우선 + background backfill로 경량화
- [x] monster body 초기 로딩을 core action 우선 + background backfill로 경량화
- [x] 로컬 미스터리던전 층 이동 시 monster body cache 보존
- [ ] baked hit / local cache hit / runtime fallback 로깅 포인트 추가

## P3

- [x] export 후 baked file count 확인
- [x] `npm run lint` 실행
- [ ] 타이틀 -> 메인 로딩 시간 비교 로그 확인
- [ ] sprite-level preload prepass 적용 후 첫 진입/재진입 체감 비교
- [ ] blend/origin/depth 회귀 수동 점검
