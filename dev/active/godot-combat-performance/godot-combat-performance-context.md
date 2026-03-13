# DungeonNeko Godot Combat Performance Context

Last Updated: 2026-03-11

## Confirmed Root Causes

- `GreenfieldWorldRuntime`는 hero/npc/monster/effect를 모두 `SpawnEntityPreviewEntry -> DungeonRenderEntry2D -> DungeonSprite2D`로 생성한다.
- `DungeonSprite2D`의 composed frame cache는 인스턴스 로컬이며 `Configure()` 때 비워진다. transient effect는 spawn마다 새 entry를 만들므로 cold cache 상태에서 CPU 합성을 반복한다.
- hero basic hit의 sub effect는 `SsprSmoothFlareOut` + copy count 10을 써서 `DungeonStyleSpritePlayer2D`가 여러 `DungeonSprite2D`를 동시에 돌린다.
- floating combat text는 frame table 배열을 `ApplyCombatTextFrame()`에서 매 프레임 새로 만든다.
- HUD는 `_hudSyncPending`가 서면 status/quest/shop/hudLines/quick slot/potion slot 전체를 다시 빌드한다. skill cooldown 100ms tick도 이 경로를 타고 있다.

## Constraints

- hero action frame param / move pixel / timeout recovery는 그대로 유지해야 한다.
- skill hit ordering, monster pending impact, death reward delay는 바꾸지 않는다.
- current scene graph 구조를 전면 교체하지 않고 현재 runtime 위에서 적용 가능한 최적화부터 반영한다.

## Chosen Direction

- 렌더 경로 전체 교체 대신 `shared composite cache + transient effect pool + HUD dirty cache`를 먼저 적용한다.
- prebuilt `SpriteFrames`가 이미 있는 monster/common effect 경로는 후속 단계에서 통합하고, 이번 세션은 runtime cold-start 제거에 우선순위를 둔다.
- hero basic hit flare는 복제 수를 줄여 burst 순간의 `DungeonStyleSpritePlayer2D` 비용을 낮춘다.
