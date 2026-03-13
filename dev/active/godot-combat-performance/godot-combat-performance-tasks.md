# DungeonNeko Godot Combat Performance Tasks

Last Updated: 2026-03-11

## Baseline

- [x] 전투 병목이 전투 수식보다 렌더/effect/HUD 경로에 있다는 코드 근거를 확인했다.
- [x] 저장소 안의 `RuntimeLayerSpriteFramesCache`/prebuilt `SpriteFrames` 경로와 현재 `GreenfieldWorldRuntime` preview 경로의 차이를 정리했다.

## Implementation

- [x] `DungeonSprite2D` shared composed frame cache 추가
- [x] transient effect entry pool 추가
- [x] hero hit flare copy burst 축소
- [x] combat text 정적 frame table화
- [x] HUD dirty section cache 추가

## Validation

- [x] `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
- [ ] 전투 scenario 수동 점검
