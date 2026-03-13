# Web Prebaked Loading Plan

작성일: 2026-03-08
트랙: `dev/active/web-prebaked-loading`
우선순위: `P0`

## 목표

타이틀 -> 메인 전환 구간의 웹 리소스 로딩 병목을 줄이기 위해 다음을 도입한다.

1. 웹 prebaked atlas 로딩 경로
2. 브라우저 로컬 prebake cache
3. 기존 런타임 합성 경로는 fallback으로 유지

## 성공 조건

- 정적 스프라이트(`HSPR/MSPR/NSPR/COMMONSPR/ATBEFFSPR`)는 baked atlas가 있으면 런타임 픽셀 합성 없이 로드된다.
- hero 장비 오버라이드/variant 효과처럼 baked로 표현할 수 없는 경로는 기존 합성 경로로 안전하게 fallback된다.
- 브라우저 재방문 시 캐시된 prebaked 결과를 재사용해 동일 스프라이트 재합성을 피한다.
- 기존 `legacy/high-quality` 렌더 모드와 시각 차이가 허용 오차 내로 유지된다.

## 블렌딩 안전 조건

- baked atlas는 현재 웹 런타임과 동일한 합성 규칙을 쓰는 파이프라인에서 생성한다.
- source-only style과 destination-aware style을 임의로 단순화하지 않는다.
- 동적 layer override가 개입하는 경우 baked 결과를 강제 사용하지 않는다.
- baked 결과가 없거나 버전이 맞지 않으면 즉시 기존 합성기로 fallback한다.

## 구현 단계

### P0. 파이프라인/자산 계약 확장

- 웹 export에 baked atlas + baked manifest 산출 추가
- `runtime_image_asset_index.json`에 baked asset 목록 추가
- baked manifest 계약 타입 확장

### P1. 웹 런타임 baked 우선 경로

- `RuntimeLayerComposer`가 baked manifest를 우선 탐색
- baked frame이면 atlas crop만으로 texture를 생성
- 불일치/누락 시 기존 layer manifest 합성 경로 유지

### P2. 브라우저 local prebake cache

- IndexedDB 기반 atlas/frame metadata 캐시 추가
- 캐시 키: `spriteName + renderMode + overrideSignature + assetVersion`
- baked atlas 우선 -> local cache -> runtime compose fallback 순서 확립

### P3. 검증

- 산출: baked file count / index 생성 확인
- 런타임: 타이틀 -> 메인 진입 시간, Hero/NPC/Monster 준비 시간 비교
- 시각: 기존 합성 대비 blend/origin/depth 회귀 점검

## 리스크

- hero 장비 외형처럼 동적 오버라이드가 들어가는 경로는 baked hit율이 낮을 수 있다.
- local cache 버전 관리가 잘못되면 stale texture가 남을 수 있다.
- baked atlas와 기존 manifest가 어긋나면 시각 회귀가 즉시 발생한다.
