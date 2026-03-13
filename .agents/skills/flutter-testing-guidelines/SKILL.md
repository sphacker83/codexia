---
name: flutter-testing-guidelines
description: Flutter 테스트 전용 가이드입니다. unit/widget/integration 테스트 전략, ViewModel 테스트 책임(상태 전이 assertion), DI 교체 주입 규칙, 테스트 명령/패턴을 다룹니다.
---

# Flutter 테스트 가이드라인

## 목적

기능 변경이 회귀(regression) 없이 배포되도록 테스트 전략과 판정 기준을 표준화합니다.

## 이 스킬을 사용해야 하는 경우

- 신규 기능에 테스트를 추가할 때
- ViewModel/usecase/repository 테스트 책임을 분리할 때
- flaky 테스트를 줄이고 실행 신뢰도를 높일 때
- CI 테스트 명령/리포터를 정리할 때

---

## 테스트 계층 전략

### Unit Test

- 대상: usecase, mapper, value object, validation, ViewModel 상태 전이
- 목표: 도메인 규칙/변환 규칙의 빠른 피드백
- 원칙: 외부 I/O는 mock/fake로 격리

### Widget Test

- 대상: 화면 렌더링, 사용자 상호작용, 로컬 상태 변화
- 목표: UI 계약(텍스트/버튼/폼/상태 렌더링) 검증
- 원칙: 한 테스트는 한 사용자 시나리오에 집중

### Integration Test

- 대상: 라우팅, 플러그인, 실사용 플로우
- 목표: 앱 전체 연결성 검증
- 원칙: 핵심 happy-path + 치명 실패 시나리오만 엄선

---

## ViewModel 테스트 책임 (필수)

- ViewModel 변경 시 대응 Unit Test를 반드시 함께 변경
- 상태 전이 assertion 토큰을 명시적으로 포함
- 허용 토큰: `loading -> data` 또는 `loading -> error`
- ViewModel이 `data` 레이어 구현체를 직접 참조하면 테스트 설계부터 수정

### 최소 패턴

```dart
expect(transitions, contains('loading -> data'));
// 또는
expect(transitions, contains('loading -> error'));
```

---

## DI 관점 테스트 규칙

- Repository interface를 fake/mock 구현체로 교체해 검증
- 테스트 실행 전 DI 등록, 실행 후 teardown/reset 고정
- 하드코딩 인스턴스 생성으로 교체 경로를 막지 않음

### 테스트용 조립 예시

```dart
setUp(() {
  configureTestDependencies();
});

tearDown(() async {
  await resetTestDependencies();
});
```

---

## 권장 명령

```bash
flutter analyze
flutter test --reporter expanded
flutter test integration_test --reporter expanded
```

## 테스트 실행 기준

- `flutter test`는 실행 테스트 수가 1건 이상이어야 함
- `flutter test integration_test`도 실행 테스트 수가 1건 이상이어야 함
- `+0: All tests passed!`, `No tests found`는 성공으로 간주하지 않음

---

## 테스트 코드 패턴

### Unit (ViewModel)

```dart
test('emits loading -> data when fetch succeeds', () async {
  final vm = UserViewModel(useCase: fakeSuccessUseCase);
  await vm.load();
  expect(vm.stateTransitions, contains('loading -> data'));
});
```

### Widget

```dart
testWidgets('shows retry button on error state', (tester) async {
  await tester.pumpWidget(makeTestApp(child: const UserPage()));
  expect(find.text('다시 시도'), findsOneWidget);
});
```

### Integration

```dart
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('login flow works', (tester) async {
    app.main();
    await tester.pumpAndSettle();
    expect(find.text('홈'), findsOneWidget);
  });
}
```

---

## 실패 분석 순서

1. flaky 여부 확인: 동일 테스트 재실행 3회
2. 테스트 격리 확인: 공유 상태/싱글턴 누수 점검
3. 타이밍 이슈 확인: `pump`/`pumpAndSettle`/`fakeAsync` 사용 검토
4. ViewModel 상태 전이 로그로 실패 지점 고정
5. 필요한 경우 [flutter-debugging-guidelines](../flutter-debugging-guidelines/SKILL.md)로 전환

---

## 관련 스킬

- 구조/모델/DI: [flutter-architecture-guidelines](../flutter-architecture-guidelines/SKILL.md)
- 디버깅/병목: [flutter-debugging-guidelines](../flutter-debugging-guidelines/SKILL.md)
- 완료 판정/증빙: [flutter-validation-gates](../flutter-validation-gates/SKILL.md)

## 상세 리소스

- [테스트 가이드](../flutter-dev-guidelines/resources/testing.md)
- [위젯 패턴 가이드](../flutter-dev-guidelines/resources/widget-patterns.md)
