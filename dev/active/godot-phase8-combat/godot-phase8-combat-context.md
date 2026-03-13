# DungeonNeko Godot Phase 8 Combat Context

Last Updated: 2026-03-11

## Why This Track Exists

- 메인 `godot-porting` 문서의 `Phase 8`은 올바른 상위 범주를 잡고 있지만, 실제 구현은 `CombatSystem`, `GameScene`, `GreenfieldWorldRuntime`, HUD, dungeon reward flow에 분산돼 있다.
- 현재 코드 기준으로는 “전투 수식”, “히트 이벤트 타이밍”, “몬스터 공격 런타임”, “프레젠테이션/오디오/이펙트 생명주기”가 서로 다른 파일에서 끊겨 있어, 한 축만 수정해도 다른 축과 순서가 엇갈릴 위험이 있다.
- 따라서 이 트랙은 `Phase 8`을 실제 메서드/클러스터 기준으로 다시 잠가, 구현 전에 책임 경계와 검증 포인트를 고정하는 역할을 맡는다.

## Canonical Baseline

- 정본 source는 `dev/active/godot-porting/godot-porting-tasks.md`의 `Phase 8. 전투 로직 수정 / 몬스터 이펙트`다.
- 현재 baseline은 `dev/active/godot-porting/godot-porting-context.md`가 적고 있는 최신 전투 discrepancy를 따른다.
- 이미 반영된 사실:
  - mystery dungeon 몬스터는 `wander -> chase -> attack hold` 런타임을 사용한다.
  - hero active skill은 더 이상 incoming hit로 무조건 끊기지 않는다.
  - hero/monster combat text frame, monster condition follow effect, monster death presentation delay, level-up message effect, 일부 combat SFX 배선은 코드 반영이 끝난 상태다.
  - `GreenfieldMonsterCombatCatalog`가 추가되어 monster combat profile / attack effect request / fallback request / projectile timing 규칙을 코드 정본으로 분리했다.
  - `skill5` cast origin rect와 `skill6` centered AOE + multi-target collect path를 실제 코드로 반영했다.
- 아직 열린 문제:
  - combat presentation parity는 코드 반영 후 수동 fixture가 없다.

## Related Implementation Files

- 전투 수식 / 상태:
  - `DungeonNeko-Godot/scripts/gameplay/combat/CombatSystem.cs`
  - `DungeonNeko-Godot/scripts/gameplay/combat/HeroCombatStatCalculator.cs`
  - `DungeonNeko-Godot/scripts/gameplay/combat/HeroSkillCatalog.cs`
- 런타임 / 이펙트:
  - `DungeonNeko-Godot/scripts/gameplay/world/GreenfieldWorldRuntime.cs`
  - `DungeonNeko-Godot/scripts/gameplay/world/GreenfieldMonsterCatalogService.cs`
  - `DungeonNeko-Godot/scripts/data/models/MonsterData.cs`
- scene orchestration / reward:
  - `DungeonNeko-Godot/scripts/app/GameScene.cs`
  - `DungeonNeko-Godot/scripts/app/game_scene/GameScene.DungeonFlow.cs`
- HUD / 상태 노출:
  - `DungeonNeko-Godot/scripts/app/game_scene/GameUiSnapshotFactory.cs`
  - `DungeonNeko-Godot/scripts/ui/HudController.cs`
- 현행 검증:
  - `tools/pipeline/phase67_validation.py`

## Axis 1. Combat State Contract

### Current Owners

- `CombatSystem`은 순수 damage packet 계약을 가진다.
  - `CombatMonsterSnapshot`
  - `CombatDamageResult`
  - `ResolveHeroToMonsterDamage()`
  - `ResolveMonsterToHeroDamage()`
- `HeroCombatStatCalculator.Build()`는 `PlayerSnapshot -> HeroData` 파생 수치를 만든다.
- `GameScene`은 runtime state 적용과 차단 규약을 소유한다.
  - `TryUseHeroSkill()`
  - `TickHeroSkillTimers()`
  - `UpdateDungeonCombat()`
  - `TryResolveHeroConditionBlockedSummary()`
  - `ApplyHeroSkillBlockState()`
  - `ForceRecoverHeroActionRuntime()`

### Observed Contract

- hero -> monster:
  - `ResolveHeroToMonsterDamage()`는 miss 판정 이후 `rage`, `critical`, `attribute`, `steal hp/mp`를 `CombatDamageResult`로 묶는다.
  - 실제 HP/MP 적용, 몬스터 상태이상 적용, death/reward 후속은 `GameScene.TryResolveHeroDamageOnTarget()`이 맡는다.
- monster -> hero:
  - `ResolveMonsterToHeroDamage()`는 `InvincibleFrames -> Dodge -> Guard -> Damage` 순으로 조기 반환한다.
  - 실제 hero HP 감소, invincible 갱신, message/effect/audio, active action interrupt, hero death는 `GameScene.UpdateDungeonCombat()`가 맡는다.
- 조건 차단:
  - `CombatSystem.IsMoveLockedCondition()`, `IsAttackLockedCondition()`, `IsSkillLockedCondition()`, `IsPotionLockedCondition()`가 canonical predicate다.
  - `GameScene.TryResolveHeroConditionBlockedSummary()`와 `BuildHudStatusSnapshot()`가 이를 사용자 문구/HUD 상태로 변환한다.

### Open Risks

- `CombatDamageResult`가 순수 계산 packet인데, 실제 적용 순서는 `GameScene`에 흩어져 있어 hit ordering regression이 나기 쉽다.
- hero skill buff block bonus와 hero incoming hit interrupt 복구가 둘 다 `GameScene`에 있어서 action lock 회복 경계가 문서화돼야 한다.

## Axis 2. Active Skill Hit Timeline

### Current Owners

- `HeroSkillCatalog.TryGetJob0Skill()`은 job0 skill slot 1~6의 `ActionStateIndex`, `CombatAtkState`, `CostMp`, `CooldownMs`, buff/CC 수치를 고정한다.
- `GameScene.UpdateHeroSkillRuntime()`는 현재 재생 중인 스킬 action 상태를 추적한다.
- `GameScene.ProcessHeroSkillFrames()`는 `frameMovePixel`과 `frameParam1 == 1` hit event를 처리한다.
- `GameScene.ResolveActiveHeroSkillFrameEvent()`는 실제 hit event 1회분을 해석한다.
- `GreenfieldWorldRuntime.TryResolveHeroSkillTarget()` / `TryResolveHeroSkillRect()`가 skill별 hit rect와 target collection을 소유한다.

### Observed Timeline

- skill timeline은 sprite frame 기반이다.
  - 이동: `TryGetFrameMovePixel(...)`
  - 타격 이벤트: `TryGetFrameParams(..., out frameParam1, ...) && frameParam1 == 1`
- 현재 rect contract:
  - `Skill1`: 전방 60 x 40
  - `Skill2`: 첫 event 40 x 50, 이후 50 x 50
  - `Skill4`: 초반 50 x 50, 후반 70 x 70
  - `Skill5`: 전방 112 x 48, `forwardOffsetPixels: 24` cast origin
  - `Skill6`: 중심 144 x 144 AOE
  - `Skill3`: damage rect가 아니라 guard buff path
- target resolution은 기본적으로 방향 고정 + nearest target 우선이다.
- `skill6`은 `CollectHeroSkillTargets(...)`를 사용해 rect 안 target 전부를 거리순으로 수집한다.
- `TryResolveHeroSkillTargetInDirection()`는 `Rect2.Intersects + IsWorldPathBlocked()` 조합을 쓰고, `skill6` multi-target collect만 line block 예외를 가진다.

### Open Risks

- multi-hit 스킬은 `ResolvedEventCount`로 여러 번 타격하되, same-target 반복 허용 여부와 event 간 dedupe 목표는 여전히 간소화 구현이다.
- `Skill6`는 multi-target collect가 들어갔지만, source parity 수준의 hit event table/fixture는 아직 없다.

## Axis 3. Monster Combat Runtime / Attack Effect Table

### Current Owners

- 상태 필드:
  - `GreenfieldMonsterRuntime.DecisionCooldownSec`
  - `GreenfieldMonsterRuntime.AttackCooldownSec`
  - `GreenfieldMonsterRuntime.HasPendingAttackImpact`
  - `GreenfieldMonsterRuntime.AttackImpactRemainingSec`
  - `GreenfieldMonsterRuntime.ForcedActionStateIndex`
  - `GreenfieldMonsterRuntime.ForcedActionRemainingSec`
  - `GreenfieldMonsterRuntime.ConditionState`
  - `GreenfieldMonsterRuntime.ConditionRemainingSec`
- 상태 전이:
  - `GreenfieldMonsterRuntime.AdvanceCombatRuntime()`
  - `GreenfieldWorldRuntime.UpdateMonsterRuntimes()`
  - `GreenfieldWorldRuntime.TryResolveMonsterIntent()`
  - `GreenfieldWorldRuntime.CanMonsterAttackHeroNow()`
- effect table:
  - `GreenfieldMonsterCombatCatalog.ResolveAttackEffectRequests()`
  - `ResolveAttackEffectSlots()`
  - `ResolveFallbackAttackEffectRequests()`
  - `ResolveAttackActionCandidates()`
  - `ResolveProfile()`
  - `TryPlayMonsterAttackEffectRequest()`
  - `TrySpawnMonsterProjectileAttackEffect()`
  - `PlayMonsterAttackCommonFallback()`
  - `GreenfieldMonsterCatalogService.TryResolveMonsterAttackEffectSpriteKey()`

### Observed Runtime

- `UpdateMonsterRuntimes()` 순서:
  1. `AdvanceCombatRuntime()`
  2. `SyncMonsterConditionPresentation()`
  3. forced action 유지
  4. `DecisionCooldownSec` 확인
  5. `TryResolveMonsterIntent()`
  6. 공격이면 `BeginForcedAction()` + `TrySpawnMonsterAttackEffect()` + `QueueAttackImpact()`
  7. 아니면 move/wander
- `TryResolveMonsterIntent()`는 world anchor 기반으로 hero를 바라보고,
  - 공격 가능하면 `triggerAttack`
  - 추적 가능하면 chase move
  - 아니면 wander 순서를 사용한다.
- ranged 판정은 `IsRangedAttackMainType()`에 있다.
- attack effect request는 이제 `GreenfieldMonsterCombatCatalog`가 정본이다.
  - hero anchor / monster anchor / direction-sequence / upper-lower-entity draw type / yOffset이 catalog로 분리됐다.
- sprite key 실제 조회는 `MonsterData.SubSprList`를 거쳐 `GreenfieldMonsterCatalogService.TryResolveMonsterAttackEffectSpriteKey()`가 담당한다.

### Downstream Ownership Split

- `GameScene.UpdateDungeonCombat()`는 pending impact를 consume해서 hero damage를 실제 적용한다.
- hero kill path는 `GameScene.TryResolveHeroDamageOnTarget()`에서 `_worldRuntime.TryRemoveMonster(target)`를 호출한다.
- `_worldRuntime.TryRemoveMonster()`는 `BeginMonsterDeathPresentation()`만 시작한다.
- reward delay와 보상 지급은 `GameScene.DungeonFlow.FinalizeMonsterDefeatAsync()`와 `ApplyMonsterDefeatRewardAsync()`가 맡는다.

### Open Risks

- `TrySpawnMonsterAttackEffect()`와 `PlayMonsterAttackCommonFallback()`가 서로 일부 의미를 중복한다.
- death presentation / reward delay / cleanup 분리는 이번 세션에서 다시 잠갔고, 남은 리스크는 실제 mystery runtime 체감 검증이다.

## Axis 4. Combat Presentation / Audio / Effect Lifecycle / Validation Fixtures

### Current Owners

- combat SFX:
  - `GameScene.BuildEffectCueId()`
  - `GameScene.TryPlayEffectSfx()`
  - `GameScene.TryPlayHeroAttackResolutionSfx()`
  - `GameScene.TryPlayHeroAttackMissSfx()`
  - `GameScene.TryPlayHeroSkillFrameSfx()`
  - `GameScene.DungeonFlow.ShowHeroLevelUpPresentation()`
- combat text / message / hit effect:
  - `GreenfieldWorldRuntime.ShowHeroCombatText()`
  - `GreenfieldWorldRuntime.ShowMonsterCombatText()`
  - `GreenfieldWorldRuntime.TrySpawnHeroMessageEffect()`
  - `GreenfieldWorldRuntime.TrySpawnMonsterMessageEffect()`
  - `GreenfieldWorldRuntime.TrySpawnHeroIncomingHitEffect()`
  - `GreenfieldWorldRuntime.ApplyCombatTextFrame()`
- effect lifecycle:
  - `GreenfieldWorldRuntime.UpdateTransientEffects()`
  - `GreenfieldWorldRuntime.RemoveTransientEffect()`
  - `GreenfieldWorldRuntime.SyncMonsterConditionPresentation()`
  - `GameScene.SyncHeroConditionPresentation()`
  - `GreenfieldWorldRuntime.BeginMonsterDeathPresentation()`
- HUD:
  - `GameScene.BuildHudStatusSnapshot()`
  - `GameUiSnapshotFactory.BuildStatusSnapshot()`
  - `HudController.ResolveConditionDisplayText()`
  - `HudController.ResolveConditionDisplayColor()`

### Current SFX Use

- `effect:1`: hero level-up presentation
- `effect:2`: hero death path
- `effect:3`: basic attack hit / miss / empty swing base cue
- `effect:4`: skill1, skill2 early hit frame
- `effect:5`: skill2 late hit frame
- `effect:7`: skill4 hit frame
- `effect:8`: skill5 multi-hit frame
- `effect:9`: skill6 frame
- `effect:10`: critical basic attack cue

### Lifecycle Notes

- floating combat text는 `ApplyCombatTextFrame()`에 frame-by-frame alpha/scale/x/y offset table이 박혀 있다.
- hero/monster 상태이상 follow effect는 `removeOnPlaybackEnd: false` + `followEntity` 조합으로 유지된다.
- hero level-up / dodge / guard message effect는 hero runtime anchor를 따라가고, 상태이상 anchor Y는 웹 기준(hero=`y-40`, monster=`ICE/PARALYZE/SLOW -> y`, else `y-topPos`)으로 다시 맞췄다.
- monster death 시작 시 `BeginMonsterDeathPresentation()`가 pending impact와 condition effect를 먼저 정리한다.
- monster death는 exact death track `[5,4,8]` + direction `[0, current]`만 허용하고, reward delay는 `previewFrames(1..3)/10fps`, cleanup은 full death animation 길이로 분리했다.
- HUD status card는 전투 상태이상 자체를 표시하지만, combat log/assertion fixture는 아직 없다.

### Validation Baseline

- 현재 저장소에 있는 전투 관련 공용 검증 엔트리는 `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`와 `tools/pipeline/phase67_validation.py`뿐이다.
- `폐광촌` 전투 scenario용 phase8 전용 replay diff / frame fixture / combat log assertion 파일은 아직 없다.

## Session Priority

- 이번 세션과 다음 구현 세션의 공통 P0는 `monster combat runtime / attack effect table`이다.
- 이 축이 잠겨야 `active skill hit timeline`과 `combat presentation/audio` 보정이 런타임 순서 변경 없이 올라간다.
