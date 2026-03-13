---
name: flutter-architecture-guidelines
description: Flutter + Dart 아키텍처 전용 가이드입니다. 최신 stable Flutter/Dart, MVVM + Clean Architecture, Entity/DTO/Model/Mapper/Value Object, 단일 Composition Root DI, Flutter Favorite 패키지 정책, 개발 체크리스트를 다룹니다.
---

# Flutter 아키텍처 가이드라인

## 목적

Flutter 기능 개발 시 아키텍처/모델/DI 품질을 먼저 고정해 구조 붕괴를 방지합니다.

## 이 스킬을 사용해야 하는 경우

- 신규 feature를 설계/구현할 때
- MVVM + Clean Architecture 레이어를 적용/리팩터링할 때
- Entity/DTO/Model/Mapper/Value Object 모델 경계를 설계할 때
- Composition Root 기반 DI를 구성하거나 재정렬할 때
- 패키지 도입 전 아키텍처 영향도를 검토할 때

---

## 비타협 원칙

1. 최신 stable Flutter/Dart만 사용합니다.
2. `app`, `core`, `features/<feature_name>/{presentation/viewmodel,domain,data}` 경계를 지킵니다.
3. 모델은 Entity/DTO/Model/Mapper/Value Object를 분리하고 immutable 우선으로 설계합니다.
4. DI는 `lib/app/di/composition_root.dart` 단일 Composition Root에서만 조립합니다.
5. 패키지는 Flutter/Dart 공식 우선 + pub.dev Flutter Favorite 배지 패키지만 허용합니다.

---

## 표준 구조

```text
lib/
  app/
    di/
      composition_root.dart
  core/
    constants/
    errors/
    network/
    utils/
  features/
    <feature_name>/
      presentation/
        pages/
        widgets/
        viewmodel/
      domain/
        entities/
        value_objects/
        repositories/
        usecases/
      data/
        datasources/
        dtos/
        models/
        mappers/
        repositories/
```

## 레이어 책임

- `presentation/pages|widgets`: UI 렌더링과 사용자 상호작용
- `presentation/viewmodel`: 상태 전이, 이벤트 처리, usecase 호출 오케스트레이션
- `domain`: 도메인 규칙, usecase, repository interface
- `data`: DTO/Model/Mapper, datasource, repository 구현체
- `app`: 의존성 조립(Composition Root)
- `core`: 공통 인프라(에러/유틸/네트워크)

## 의존성 규칙

- `presentation/pages|widgets -> presentation/viewmodel`만 허용
- `presentation/viewmodel -> domain`만 허용 (`data` 직접 의존 금지)
- `domain -> data|presentation` 금지
- `data -> presentation` 금지
- `core -> features` 금지
- `app -> features`는 조립 목적에서만 허용

---

## 모델 설계 규칙

- Entity/Value Object는 도메인 의미와 불변 규칙만 포함
- DTO/Model은 외부 계약(API/DB) 표현만 담당
- Mapper가 DTO/Model <-> Entity 변환 책임을 단일화
- `fromJson`/`toJson`은 data 레이어에서만 처리
- 모델 변경 시 버전/기본값/필드 폐기 전략을 변경 노트에 기록

### 모델 품질 체크

- [ ] Entity가 프레임워크/직렬화 구현에 오염되지 않았는가?
- [ ] DTO/Model이 domain으로 유입되지 않는가?
- [ ] Mapper 단위 테스트가 존재하는가?
- [ ] Value Object에 불변식 검증이 있는가?

---

## DI 규칙

- 등록/바인딩은 `lib/app/di/composition_root.dart`에서만 수행
- `features/**` 내부에서 별도 composition root 생성 금지
- Constructor Injection 기본 적용
- `domain/repositories` 인터페이스에 `data/repositories` 구현체 바인딩
- 테스트에서 fake/mock으로 교체 가능한 주입 구조 유지

### DI 체크

- [ ] 등록 위치가 단일 composition root로 수렴하는가?
- [ ] 전역 singleton 남용이 없는가?
- [ ] DI 교체 경로(override/reset)가 테스트에서 재현 가능한가?

---

## 패키지 정책 (Flutter Favorite)

### 허용 기준

- Flutter/Dart 공식 패키지 우선
- Flutter Favorite 배지 패키지
- stable 호환 + Null Safety 지원
- 유지보수 활동(최근 릴리스/이슈 대응) 확인

### 비허용 기준

- Flutter Favorite 배지 없음
- stable 미호환 또는 Null Safety 미지원
- 장기 방치/치명 이슈 미해결
- 아키텍처 경계를 깨는 의존성

---

## 개발 체크리스트

- [ ] feature 디렉터리가 표준 구조를 따르는가?
- [ ] `presentation/pages|widgets -> domain` 직접 import가 없는가?
- [ ] ViewModel이 usecase를 통해서만 도메인을 호출하는가?
- [ ] 모델/매퍼/DI 변경에 대응하는 테스트가 포함됐는가?
- [ ] `flutter analyze`와 `flutter test`가 통과하는가?

---

## 관련 스킬

- 테스트 전략: [flutter-testing-guidelines](../flutter-testing-guidelines/SKILL.md)
- 장애 분석/성능 디버깅: [flutter-debugging-guidelines](../flutter-debugging-guidelines/SKILL.md)
- 완료 판정/증빙: [flutter-validation-gates](../flutter-validation-gates/SKILL.md)

## 상세 리소스

- [모델 설계 가이드](../flutter-dev-guidelines/resources/modeling.md)
- [DI 가이드](../flutter-dev-guidelines/resources/dependency-injection.md)
- [상태 관리 패턴](../flutter-dev-guidelines/resources/state-management.md)
- [위젯 패턴 가이드](../flutter-dev-guidelines/resources/widget-patterns.md)
