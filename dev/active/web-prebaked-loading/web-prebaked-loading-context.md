# Web Prebaked Loading Context

## 현재 병목

- 웹은 `MapLoadingController.loadLevel()`에서 Hero/NPC/Monster 리소스 준비를 메인 전환 중 `await`로 대기한다.
- `RuntimeLayerComposer.composeSpriteFrames()`는 매니페스트 fetch 후 프레임별 캔버스 합성을 수행한다.
- 이 합성은 브라우저 JS 메인 스레드에서 픽셀 배열을 직접 섞고 텍스처를 생성한다.

## 현재 사용 가능한 재료

- Godot 파이프라인에는 `tools/pipeline/bake-layer-manifests.py`가 이미 존재한다.
- 이 스크립트는 `*_layer_manifest.json`에서 `*_baked_manifest.json` + `*_atlas.png`를 생성한다.
- baked manifest는 `layer_mode: "baked_atlas"`이며, 각 프레임은 atlas crop 1레이어만 참조한다.
- Godot는 추가로 `SpriteFrames(.tres)` prebake까지 사용한다.
- 현재 bake 스크립트의 기본 합성은 `render_sprites.py`의 RGB565 경로를 재사용하므로, 웹의 `legacy` 모드와 정합성이 높고 `high-quality`와는 다를 수 있다.

## 웹에 필요한 차이

- 웹은 `.tres`를 직접 쓸 수 없으므로 `baked_manifest + atlas png`까지만 우선 사용한다.
- hero equipment override, monster effect variant처럼 동적인 레이어 오버라이드는 prebake 대상에서 제외하고 fallback한다.
- 기존 `runtime_image_asset_index.json`에는 baked 경로가 없다. 웹 로더가 baked atlas 존재 여부를 정적으로 판정할 수 있게 확장해야 한다.

## 적용 원칙

- 정적/불변 스프라이트는 baked 우선
- 동적 layer override가 있으면 runtime compose fallback
- local cache는 최종 합성 결과 또는 baked atlas crop 기반 결과를 저장
- render mode는 cache key와 baked 재사용 정책에 반드시 반영
- baked manifest 사용 조건은 `legacy + filter=all + override 없음 + spriteStyleOverride 없음`으로 제한한다.

## 2026-03-08 반영 상태

- `tools/rendering_all.py`가 `res/sprites/baked`와 `res/data/runtime_image_asset_index.json`을 생성한다.
- `tools/export.py`가 웹 공개 경로로 `public/assets/sprites/baked`를 동기화한다.
- 웹 런타임은 baked manifest를 우선 시도하되, 안전 조건을 벗어나면 즉시 기존 `_layer_manifest.json` 합성으로 fallback한다.
- `RuntimeLayerComposer`는 `spriteAnimationMap` 시그니처를 포함하도록 보강되어 partial/full compose 충돌을 피한다.
- `RuntimeLayerComposer`는 local cache miss 후 `spriteAnimationMap` 전체를 훑어 필요한 source ref를 먼저 수집하고, prepass로 선로딩한 다음 프레임 합성에 들어간다.
- `RuntimeLayerLocalCache`가 IndexedDB 기반 atlas bundle 캐시를 저장/복원한다.
- `RuntimeLayerComposer`는 local bundle miss 후 manifest를 읽으면, 요청된 `spriteAnimationMap` 전체를 한 번 스캔해 필요한 source/baked ref를 unique하게 수집하고 선로딩한 뒤 프레임 합성에 들어간다.
- prebake 산출 검증 결과:
  - `res/sprites/baked/*.png` 416개 생성
  - `runtime_image_asset_index.json`의 `spriteBakedPaths` 416개
  - `public/assets/sprites/baked/*.png` 416개 export
- degenerate baked 16건은 파이프라인 실패로 승격하지 않고, 런타임에서 baked unusable 판정 후 raw manifest로 fallback한다.

## 1차 대상

- `HSPR_*` 기본형
- `MSPR_*`
- `NSPR_*`
- `COMMONSPR`
- `ATBEFFSPR`

## fallback 유지 대상

- hero 장비 외형 오버라이드
- monster attack effect variant
- NPC/hero 특정 clip override
- future dynamic palette override

## 2026-03-08 던전 진입 속도 보완

- 이펙트(`ATBEFFSPR`/`MASPR`) 경로는 그대로 두고, 비이펙트 본체 로딩 대기만 줄이도록 조정했다.
- hero 본체는 맵 진입 시 `action_0/1(+현재 action)`만 우선 compose하고, 나머지 action은 기존 장비 refresh 파이프라인으로 백그라운드 backfill한다.
- monster 본체는 스폰 전 `idle/move + 주요 attack 일부 + death 1종`만 우선 compose하고, 전체 action은 background backfill로 넘긴다.
- 로컬 미스터리던전의 동일 맵 id/subMap 재진입(층 이동)에서는 monster body cache를 즉시 폐기하지 않고 보존해 같은 세션 재사용률을 높인다.
- 일반 맵 전환/마을 복귀는 기존 cache 정리 정책을 유지한다.

## 이번 prepass 적용 메모

- 선로딩 대상 ref 수집은 `filterFrameLayers()`와 `buildLayerImageDescriptor()`를 그대로 재사용해 baked/raw, layer filter, source override, clip override 기준을 맞춘다.
- `spriteStyleOverride`는 source path를 바꾸지 않으므로 preload 대상 계산에는 직접 쓰지 않지만, 이후 합성 경로의 style/blend 처리에는 기존처럼 영향을 준다.
- 실제 프레임 합성 함수 내부의 `ensureTextureRefs()` 호출은 남아 있지만, sprite-level prepass 뒤에는 대부분 메모리 hit만 발생하도록 의도했다.
