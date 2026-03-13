---
name: flutter-dev-guidelines
description: Flutter 기본 개발 + 스킬 라우터입니다. Flutter/플러터 단독 언급이나 신규 개발 요청에서 우선 활성화되며, 세부 작업은 architecture/testing/debugging/validation 하위 스킬로 연결합니다.
---

# Flutter 기본 개발 가이드 + 스킬 라우터

## 목적

Flutter 신규 개발의 기본 진입점으로 사용하고, 요청을 분류해 필요한 하위 스킬을 함께 적용하도록 안내합니다.

- 아키텍처/모델/DI 설계는 `flutter-architecture-guidelines`
- 테스트 전략/패턴은 `flutter-testing-guidelines`
- 장애 분석/성능 병목은 `flutter-debugging-guidelines`
- 완료 판정/증빙은 `flutter-validation-gates`

---

## Decision Guide

| 요청 신호 | 선택할 스킬 |
| --- | --- |
| MVVM, Clean Architecture, Entity/DTO/Mapper, Composition Root, 패키지 선정 | `flutter-architecture-guidelines` |
| Unit/Widget/Integration 테스트, ViewModel 상태 전이 테스트 | `flutter-testing-guidelines` |
| Flutter Inspector, DevTools, lifecycle 에러, 플랫폼 이슈, 성능 저하 | `flutter-debugging-guidelines` |
| G1~G5, G4b, 증빙 파일, CI 품질 게이트, PASS/FAIL 판정 | `flutter-validation-gates` |
| “어떤 Flutter 스킬을 써야 하나?” 같은 분류 요청 | 현재 라우터(`flutter-dev-guidelines`) |

---

## 권장 적용 순서

### 신규 기능 구현

1. `flutter-architecture-guidelines`
2. `flutter-testing-guidelines`
3. `flutter-validation-gates`
4. 실패 원인 분석이 필요하면 `flutter-debugging-guidelines`

### 버그 수정

1. `flutter-debugging-guidelines`
2. 원인 수정 후 `flutter-testing-guidelines`
3. 마무리로 `flutter-validation-gates`

### 배포 전 점검

1. `flutter-testing-guidelines`
2. `flutter-validation-gates`
3. 성능 이슈 발견 시 `flutter-debugging-guidelines`

---

## 공통 강제 원칙 (모든 하위 스킬에 적용)

1. 최신 stable Flutter/Dart만 사용
2. MVVM + Clean Architecture 경계 준수
3. Entity/DTO/Model/Mapper/Value Object 분리 + immutable 우선
4. 단일 Composition Root(`lib/app/di/composition_root.dart`) + Constructor Injection
5. Flutter/Dart 공식 + Flutter Favorite 패키지 정책 준수

---

## 하위 스킬 인덱스

- [flutter-architecture-guidelines](../flutter-architecture-guidelines/SKILL.md)
- [flutter-testing-guidelines](../flutter-testing-guidelines/SKILL.md)
- [flutter-debugging-guidelines](../flutter-debugging-guidelines/SKILL.md)
- [flutter-validation-gates](../flutter-validation-gates/SKILL.md)

## 기존 상세 리소스

- [위젯 패턴 가이드](resources/widget-patterns.md)
- [상태 관리 패턴](resources/state-management.md)
- [모델 설계 가이드](resources/modeling.md)
- [DI 가이드](resources/dependency-injection.md)
- [성능 최적화 체크리스트](resources/performance.md)
- [테스트 가이드](resources/testing.md)
- [빌드/배포 런북](resources/build-and-release.md)
- [디버깅 플레이북](resources/debugging.md)
