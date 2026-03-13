# 테스트 가이드

## 목적과 범위

이 문서는 Flutter 기능 검증 기준을 `Unit -> Widget -> Integration` 순서로 정리합니다.  
핵심은 **MVVM** 흐름을 깨지 않고, DI 교체 가능성을 활용해 안정적으로 테스트하는 것입니다.

## 테스트 전략

- Unit Test: UseCase, Mapper, Value Object, ViewModel 상태 전이
- Widget Test: 렌더링, 사용자 상호작용, 에러/로딩 표시
- Integration Test: 라우팅, 플러그인 연동, 실제 시나리오
- `G2(Unit)`와 `G2b(Integration)` 증빙은 모두 필수 게이트

## 책임 고정 문구

- ViewModel 상태 전이는 Unit Test 책임
- ViewModel 변경 시 대응 Unit Test + 상태 전이 assertion(`loading -> data` 또는 `loading -> error`)은 필수

## 실무 체크리스트

- [ ] 주요 UseCase마다 정상/실패/경계 케이스 Unit Test가 있다.
- [ ] ViewModel 상태 전이는 Unit Test 책임
- [ ] ViewModel 변경 시 대응 Unit Test와 상태 전이 assertion을 함께 추가했다.
- [ ] 핵심 화면 Widget Test에서 사용자 이벤트를 재현한다.
- [ ] 테스트 환경에서 **Composition Root**를 대체할 수 있다.
- [ ] fake/mock 주입은 **Constructor Injection** 경로로 수행한다.
- [ ] CI에서 `flutter analyze`, `flutter test`, `flutter test integration_test`를 필수 게이트로 둔다.
- [ ] 모델 경계 변경(`entities|dtos|models|mappers|value_objects`)은 변경 파일 추적 목록과 대응 테스트 참조를 남겼다.
- [ ] 모델 경계 변경이 있을 때 실행 테스트 0건(`+0`, `No tests ran`) 통과를 허용하지 않는다.
- [ ] 회귀 버그 발생 시 재현 테스트를 먼저 추가한다.

## 금지사항

- 네트워크/DB 의존을 그대로 둔 flaky 테스트 금지
- 골든 테스트만으로 동작 검증을 대체하는 패턴 금지
- private 구현 세부사항에 과도하게 결합된 테스트 금지
- 테스트 실패를 무시하고 `skip`으로 누적하는 관행 금지

## 짧은 코드 예시

```dart
class FakeTodoRepository implements TodoRepository {
  @override
  Future<List<TodoEntity>> fetchTodos() async => const [
        TodoEntity(id: '1', title: '문서 작성'),
      ];
}

void main() {
  test('LoadTodosUseCase returns todos from repository', () async {
    final useCase = LoadTodosUseCase(repository: FakeTodoRepository());
    final result = await useCase();
    expect(result.length, 1);
  });
}
```

## 권장 명령

```bash
flutter analyze
flutter test
flutter test integration_test
```
