# DungeonNeko Godot Combat Performance Plan

Last Updated: 2026-03-11

## Executive Summary

- 이 트랙은 mystery dungeon 전투, 특히 skill/hit effect burst에서 발생하는 Godot 포팅의 프레임 드랍을 줄이는 데 집중한다.
- 이번 구현은 전투 수식 parity를 바꾸지 않고, `DungeonSprite2D` 합성 캐시, transient effect lifecycle, combat text, HUD flush 경량화에만 손댄다.
- 저장소 안에 이미 있는 `RuntimeLayerSpriteFramesCache`/prebuilt `SpriteFrames` 경로를 참고하되, 현재 `GreenfieldWorldRuntime`가 직접 쓰는 preview renderer를 전면 교체하지는 않는다. 대신 공용 캐시와 pool로 같은 효과를 최대한 끌어낸다.

## Scope

- `DungeonNeko-Godot/scripts/gameplay/world/DungeonSprite2D.cs`
- `DungeonNeko-Godot/scripts/gameplay/world/DungeonStyleSpritePlayer2D.cs`
- `DungeonNeko-Godot/scripts/gameplay/world/DungeonRenderEntry2D.cs`
- `DungeonNeko-Godot/scripts/gameplay/world/GreenfieldWorldRuntime.cs`
- `DungeonNeko-Godot/scripts/app/GameScene.cs`

## Implementation Goals

- `DungeonSprite2D`의 composed texture cache를 전역 공유 LRU로 승격해 effect/monster/NPC가 같은 frame을 재합성하지 않게 한다.
- transient battle effect는 spawn마다 새 renderer를 cold-start하지 않도록 entry pool을 추가한다.
- hero hit flare copy burst를 줄여 basic attack/skill multi-hit 구간의 노드/프레임 합성 수를 낮춘다.
- combat text는 정적 frame table 기반으로 바꿔 per-frame 배열 할당을 제거한다.
- HUD는 dirty section 캐시를 도입해 cooldown/status 갱신이 shop/quest/panel 전체 rebuild로 번지지 않게 한다.

## Validation

- `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
- 던전 진입 후 basic attack spam, `skill1`, `skill5`, `skill6` 연속 사용
- monster ranged hit, hero condition tick, death reward popup parity 확인
