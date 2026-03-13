# DungeonNeko Godot Phase 8 Combat Plan

Last Updated: 2026-03-11

## Executive Summary

- 이 문서는 `dev/active/godot-porting/godot-porting-tasks.md`의 `Phase 8. 전투 로직 수정 / 몬스터 이펙트`를 실제 구현 파일 기준으로 재구성한 전용 실행 계획이다.
- 목표는 `CombatSystem -> GameScene -> GreenfieldWorldRuntime -> HUD`로 흩어진 전투 책임을 메서드 단위로 잠그고, parity 작업이 바로 가능한 체크리스트를 확보하는 것이다.
- 이번 세션의 첫 우선순위는 `monster combat runtime / attack effect table`이다.

## Canonical Sources

- 정본 source:
  - `dev/active/godot-porting/godot-porting-tasks.md`
  - `dev/active/godot-porting/godot-porting-context.md`
- 주요 구현 파일:
  - `DungeonNeko-Godot/scripts/gameplay/combat/CombatSystem.cs`
  - `DungeonNeko-Godot/scripts/gameplay/combat/HeroCombatStatCalculator.cs`
  - `DungeonNeko-Godot/scripts/gameplay/combat/HeroSkillCatalog.cs`
  - `DungeonNeko-Godot/scripts/gameplay/world/GreenfieldWorldRuntime.cs`
  - `DungeonNeko-Godot/scripts/gameplay/world/GreenfieldMonsterCatalogService.cs`
  - `DungeonNeko-Godot/scripts/app/GameScene.cs`
  - `DungeonNeko-Godot/scripts/app/game_scene/GameScene.DungeonFlow.cs`
  - `DungeonNeko-Godot/scripts/app/game_scene/GameUiSnapshotFactory.cs`
  - `DungeonNeko-Godot/scripts/ui/HudController.cs`
  - `DungeonNeko-Godot/scripts/data/models/MonsterData.cs`

## Scope

### 1. combat state contract

- 소유 클러스터:
  - `CombatSystem.ResolveHeroToMonsterDamage()`
  - `CombatSystem.ResolveMonsterToHeroDamage()`
  - `HeroCombatStatCalculator.Build()`
  - `GameScene.UpdateDungeonCombat()`
  - `GameScene.TryResolveHeroDamageOnTarget()`
  - `GameScene.TryUseHeroSkill()`
  - `GameScene.TickHeroSkillTimers()`
  - `GameScene.SyncHeroConditionPresentation()`
  - `GameScene.BuildHudStatusSnapshot()`
- 산출물:
  - hero/monster damage resolution 입력 계약
  - hit state 적용 순서
  - invincible / block / action lock 계약
  - cooldown / MP / potion / quickslot 차단 규약

### 2. active skill hit timeline

- 소유 클러스터:
  - `HeroSkillCatalog.TryGetJob0Skill()`
  - `GameScene.UpdateHeroSkillRuntime()`
  - `GameScene.ProcessHeroSkillFrames()`
  - `GameScene.ResolveActiveHeroSkillFrameEvent()`
  - `GameScene.TrySpawnHeroSkillTransientEffect()`
  - `GreenfieldWorldRuntime.TryResolveHeroSkillTarget()`
  - `GreenfieldWorldRuntime.TryResolveHeroSkillRect()`
- 산출물:
  - `skill1/2/4/5/6` hit event table
  - skill rect / line block / target collection 규약
  - multi-hit / multi-target 현재 구현과 parity 목표 분리
  - `skill5 cast origin`, `skill6 centered AOE` acceptance

### 3. monster combat runtime / attack effect table

- 소유 클러스터:
  - `GreenfieldMonsterRuntime.AdvanceCombatRuntime()`
  - `GreenfieldWorldRuntime.UpdateMonsterRuntimes()`
  - `GreenfieldWorldRuntime.TryResolveMonsterIntent()`
  - `GreenfieldWorldRuntime.TrySpawnMonsterAttackEffect()`
  - `GreenfieldWorldRuntime.TryPlayMonsterAttackEffectRequest()`
  - `GreenfieldWorldRuntime.TrySpawnMonsterProjectileAttackEffect()`
  - `GreenfieldWorldRuntime.ResolveMonsterAttackEffectRequests()`
  - `GreenfieldWorldRuntime.ResolveFallbackMonsterAttackEffectRequests()`
  - `GreenfieldWorldRuntime.ResolveMonsterAttackEffectSlots()`
  - `GreenfieldWorldRuntime.PlayMonsterAttackCommonFallback()`
  - `GreenfieldMonsterCatalogService.TryResolveMonsterAttackEffectSpriteKey()`
  - `GameScene.UpdateDungeonCombat()`
  - `GameScene.TryApplyMonsterCondition()`
  - `GreenfieldWorldRuntime.TryRemoveMonster()`
  - `GameScene.DungeonFlow.FinalizeMonsterDefeatAsync()` 계열
- 산출물:
  - monster attack wind-up / impact / cooldown 상태 머신
  - mainType 기준 attack effect request table
  - monster -> hero hit 후처리 파이프라인
  - death / reward delay / cleanup 순서 표

### 4. combat presentation / audio / effect lifecycle / validation fixtures

- 소유 클러스터:
  - `GameScene.BuildEffectCueId()`
  - `GameScene.TryPlayEffectSfx()`
  - `GameScene.TryPlayHeroSkillFrameSfx()`
  - `GameScene.TriggerMonsterHitFeedback()`
  - `GameScene.TriggerHeroIncomingHitPresentation()`
  - `GreenfieldWorldRuntime.ShowHeroCombatText()`
  - `GreenfieldWorldRuntime.ShowMonsterCombatText()`
  - `GreenfieldWorldRuntime.ApplyCombatTextFrame()`
  - `GreenfieldWorldRuntime.UpdateTransientEffects()`
  - `GreenfieldWorldRuntime.RemoveTransientEffect()`
  - `GreenfieldWorldRuntime.SyncMonsterConditionPresentation()`
  - `GameScene.SyncHeroConditionPresentation()`
  - `GameScene.DungeonFlow.ShowHeroLevelUpPresentation()`
  - `GameUiSnapshotFactory.BuildStatusSnapshot()`
  - `HudController.ResolveConditionDisplayText()`
  - `tools/pipeline/phase67_validation.py`
- 산출물:
  - hit/miss/guard/crit/condition presentation dispatch matrix
  - combat SFX cue table
  - effect lifecycle / follow / removeOnPlaybackEnd / death cleanup 규약
  - `폐광촌` 전투 fixture와 수동/자동 검증 초안

## First Session Goal

- P0는 `monster combat runtime / attack effect table`이다.
- 첫 구현 세션에서는 `GreenfieldWorldRuntime`의 `mainType -> effect request -> impact delay -> pending impact consume` 흐름을 정리하고, 그 결과를 `GameScene.UpdateDungeonCombat()`와 맞춘다.
- 같은 세션에서 `death presentation / reward delay / cleanup` 경계도 함께 잠가서 이후 presentation 작업이 런타임 순서 변경 없이 올라가도록 만든다.

## Non-Goals

- 메인 맵 parity와 `폐광촌` 외 맵 로딩 문제는 이 트랙 범위 밖이다.
- `UiMetricScale = 2.0` 규칙을 바꾸는 UI 스케일 조정은 하지 않는다.
- `GameScene` 구조 리팩터링 자체는 `godot-refactor*` 트랙에서만 다룬다.

## Validation Baseline

- `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
- `rg -n "ResolveHeroToMonsterDamage|ResolveMonsterToHeroDamage|TryResolveHeroSkillTarget|TryResolveHeroSkillRect|UpdateMonsterRuntimes|TryResolveMonsterIntent|TrySpawnMonsterAttackEffect|ResolveMonsterAttackEffectRequests|ApplyCombatTextFrame|TryPlayEffectSfx" DungeonNeko-Godot/scripts -S`
- `python3 tools/pipeline/phase67_validation.py`
