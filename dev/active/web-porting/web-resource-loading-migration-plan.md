# Web 리소스 로딩/적용 마이그레이션 계획

작성일: 2026-03-02  
트랙: `dev/active/web-porting`

## 목표

변경된 리소스 규칙(알파 보존 사전합성 + 런타임 레이어 합성)을 웹 코드에 정식 반영한다.

- 사전합성 출력: `rendered/*/action_*/seq_*/frame_*.png`
- 런타임 레이어 출력: `rendered/*/layer_manifest.json(v2)`, `rendered/*/_layers/*`
- 적용 정책: 기본은 사전합성 프레임 사용, 일부 이펙트(`MASPR_*`, `ATBEFFSPR_*`)는 런타임 레이어 합성 적용

## 범위

1. 리소스 계약(Contract) 타입/키 규칙 고정  
2. 로더 계층 분리(`ResourceLoader`, `RuntimeLayerComposer`)  
3. 런타임 합성 적용 정책 구현(프리픽스 기반)  
4. 애니메이션 생성 경로를 `frame_refs` 기반으로 통합  
5. 폴백/예외 처리(매니페스트/레이어 누락 시 기존 PNG 경로 유지)  
6. 캐시/메모리 정책 정리(맵 전환 시 캐시 정리, 중복 합성 방지)  
7. 검증 게이트 정착(파이프라인/런타임 스모크 테스트)

## 단계별 실행

### P0. 계약 고정

- `sprite_index.json`, `layer_manifest.json(v2)` 타입 정의 파일 추가
- `action_x_seq_y` 파싱 규칙/`frame_refs` 우선 규칙 문서화
- 변경 파일(예정)
  - `dungeon-neko-web/src/game/resources/runtimeLayerTypes.ts` (신규)
  - `dungeon-neko-web/src/game/scenes/MainScene.ts`

완료 기준:
- 타입 강제 하에서 `manifest` 파싱 `any` 미사용

### P1. 로더/컴포저 분리

- `MainScene` 내부 로딩/합성 로직을 모듈로 분리
- 변경 파일(예정)
  - `dungeon-neko-web/src/game/resources/resourceLoader.ts` (신규)
  - `dungeon-neko-web/src/game/resources/runtimeLayerComposer.ts` (신규)
  - `dungeon-neko-web/src/game/scenes/MainScene.ts`

완료 기준:
- 씬은 오케스트레이션만 수행하고 실제 로딩/합성 구현은 모듈로 이동

### P2. 적용 정책/애니메이션 통합

- 런타임 합성 대상: `MASPR_*`, `ATBEFFSPR_*` (1차)
- 비대상: 기존 frame PNG 그대로 유지
- `frame_refs` 기반 프레임 매핑으로 애니메이션 생성
- 변경 파일(예정)
  - `dungeon-neko-web/src/game/scenes/MainScene.ts`
  - `dungeon-neko-web/src/game/entities/Monster.ts`
  - `dungeon-neko-web/src/game/entities/Hero.ts`
  - `dungeon-neko-web/src/game/entities/NPC.ts`

완료 기준:
- 전투 이펙트에서 런타임 합성 프레임이 실제 재생됨
- 기존 스프라이트 로딩 경로와 충돌 없음

### P3. 폴백/캐시/메모리

- 매니페스트/레이어 로딩 실패 시 자동 폴백
- 맵 전환 시 텍스처/이미지 캐시 정리
- 중복 합성 재사용 캐시 키 정의

완료 기준:
- 런타임 에러 0
- 장시간 플레이 시 메모리 증가율 안정

### P4. 검증 게이트

- 파이프라인:
  - `python3 tools/rendering_all.py --with-runtime-layers --force`
  - `python3 tools/pipeline/verify_render_integrity.py`
- 런타임:
  - 전투 이펙트 스모크(히트/스킬/상태이상)
  - 런타임 합성 on/off A/B 캡처 비교

완료 기준:
- 무결성 B 섹션(프레임 파일) PASS
- 런타임 합성 대상 이펙트의 시각/재생 회귀 없음
- 리소스 원본 부재(현재 `MSPR_10/11`)는 known issue로 분리 보고

## 리스크

- `layer_manifest`와 `sprite_index` 키 불일치 시 프레임 누락 발생 가능
- 브라우저 canvas 합성 비용 증가(저사양 환경)
- 프로젝트 기존 타입/린트 이슈가 신규 검증 신뢰도를 낮출 수 있음

## 우선순위

- P0/P1/P2: P0 (즉시)
- P3: P1
- P4: P0

## 산출물

- 리소스 로더/합성기 모듈화된 코드
- 운영 가능한 합성 정책 테이블
- 검증 체크리스트 + known issue 목록
