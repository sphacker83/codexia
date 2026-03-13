# DungeonNeko Godot Phase 8 Combat Tasks

Last Updated: 2026-03-11

## Verified Baseline

- [x] `dev/active/godot-porting/godot-porting-tasks.md`의 `Phase 8`을 정본 source로 사용한다.
- [x] 실제 구현 소유 파일을 `CombatSystem`, `GameScene`, `GreenfieldWorldRuntime`, HUD 클러스터로 다시 매핑했다.
- [x] 이번 세션 우선순위였던 `monster combat runtime / attack effect table` 구현을 코드와 문서에 반영했다.

## 8-1. 전투 상태 계약 재잠금

- [x] `CombatSystem.ResolveHeroToMonsterDamage(...)` / `ResolveMonsterToHeroDamage(...)`를 damage resolution 정본으로 고정했다.
- [x] `CombatMonsterSnapshot`, `CombatDamageResult`, `HeroData`, `HeroSkillCatalog`의 역할과 소비 위치를 `godot-phase8-combat-context.md`에 잠갔다.
- [x] `miss -> guard -> critical -> damage -> condition -> death/reward` 순서를 hero hit / monster hit / skill hit 경로 기준으로 정리했다.
- [x] invincible / block / action lock / cooldown / resource 규약을 현재 코드 기준으로 고정했다.

## 8-2. active skill hit timeline 재구성

- [x] job0 active skill 1~6의 `ActionStateIndex`, `CombatAtkState`, `CostMp`, `CooldownMs`, buff/CC 수치를 정본 계약으로 고정했다.
- [x] skill frame 처리 경로 `UpdateHeroSkillRuntime() -> ProcessHeroSkillFrames() -> ResolveActiveHeroSkillFrameEvent()`를 기준 timeline으로 잠갔다.
- [x] `skill5`는 전방 offset 기반 cast origin rect로 실제 코드 보정했다.
- [x] `skill6`는 centered AOE + multi-target collect path로 실제 코드 보정했다.
- [x] `TryApplyHeroSkillCrowdControl(...)`와 area skill hit 처리로 skill event 후속 적용 순서를 분리했다.

## 8-3. monster combat runtime 정리

- [x] `DecisionCooldownSec`, `AttackCooldownSec`, `HasPendingAttackImpact`, `AttackImpactRemainingSec`, `ForcedActionRemainingSec` 의미를 상태 머신 기준으로 고정했다.
- [x] `UpdateMonsterRuntimes()`, `TryResolveMonsterIntent()`, `CanMonsterAttackHeroNow()`, `TryConsumePendingAttackImpact()` 축으로 monster runtime 상태 전이를 정리했다.
- [x] `GreenfieldMonsterCombatCatalog`를 추가해 melee/ranged combat profile, attack action candidate, attack effect request table, fallback request table, projectile timing을 runtime 밖 정본으로 옮겼다.
- [x] monster death / reward delay / cleanup 순서를 runtime + scene flow 경계 기준으로 정리했다.

## 8-4. combat presentation / audio 이벤트 파이프라인 정리

- [x] hero/monster hit 결과에 대해 text / flash / effect / audio dispatch 경로를 정리했다.
- [x] `effect:0~10` current use를 정리하고 level-up / reward / death / hero incoming hit / basic attack / skill frame SFX 경계를 잠갔다.
- [x] basic attack strike frame에서 타깃이 비어도 web과 같은 `effect:3` empty swing SFX가 빠지지 않도록 고정했다.
- [x] hero level-up message effect는 hero runtime anchor를 따라가도록 바꾸고, hero/monster condition effect anchor Y를 웹 기준으로 다시 맞췄다.
- [x] `ApplyCombatTextFrame(...)`를 floating combat text 정본 frame table로 고정했다.
- [x] progression/UI popup과 combat 종료 presentation 경계를 문서로 분리했다.

## 8-5. monster effect runtime 정리

- [x] main hit / critical / condition follow / projectile / target marker / fallback effect를 분류했다.
- [x] owner binding / synthetic binding fallback / raw sprite key 파생 규칙을 정리했다.
- [x] `UpdateTransientEffects(...)`, `RemoveTransientEffect(...)`, `SyncMonsterConditionPresentation(...)` 기준으로 spawn/update/cleanup lifecycle을 잠갔다.
- [x] draw type / z-bias / follow / world travel / removeOnPlaybackEnd 규약을 effect lifecycle 문서에 고정했다.
- [x] monster death는 exact death track `[5,4,8]` + direction `[0, current]`만 허용하고, reward delay / cleanup timer를 분리한 10fps one-shot parity로 다시 고정했다.

## 8-6. 검증 게이트 초안 작성

- [x] `폐광촌` 전투 시나리오 fixture 초안을 정의했다.
- [x] 수동 검증 체크리스트 초안을 정의했다.
- [x] 자동 검증 후보(replay diff / frame fixture / combat log assertion) 초안을 정의했다.

## Implementation Delta

- [x] `DungeonNeko-Godot/scripts/gameplay/combat/GreenfieldMonsterCombatCatalog.cs` 추가
- [x] `DungeonNeko-Godot/scripts/gameplay/world/GreenfieldWorldRuntime.cs`는 monster combat profile / attack effect table catalog를 사용하도록 갱신
- [x] `DungeonNeko-Godot/scripts/app/GameScene.cs`는 `skill6` multi-target AOE path와 skill crowd control 후속 helper를 사용하도록 갱신

## Validation

- [x] `dotnet build DungeonNeko-Godot/DungeonNeko.csproj`
- [x] `rg -n "ResolveHeroToMonsterDamage|ResolveMonsterToHeroDamage|CombatDamageResult|CombatMonsterSnapshot" DungeonNeko-Godot/scripts/gameplay/combat/CombatSystem.cs -S`
- [x] `rg -n "GreenfieldMonsterCombatCatalog|CollectHeroSkillTargets|ResolveActiveHeroAreaSkillFrameEvent|TryApplyHeroSkillCrowdControl" DungeonNeko-Godot/scripts/gameplay/combat/GreenfieldMonsterCombatCatalog.cs DungeonNeko-Godot/scripts/gameplay/world/GreenfieldWorldRuntime.cs DungeonNeko-Godot/scripts/app/GameScene.cs -S`
