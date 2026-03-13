# 상태 관리 패턴

## 목적과 범위

이 문서는 **MVVM + Clean Architecture** 기준으로 ViewModel 상태 관리 방식만 정리합니다.  
핵심은 화면 상태를 일관되게 관리하고, 의존성은 **Composition Root**에서 주입하는 것입니다.

## 표준 선택 원칙

- 팀 기본 상태관리 도구는 한 가지(Riverpod 또는 Bloc 또는 Provider)로 통일
- 비즈니스 흐름은 `features/<feature_name>/presentation/viewmodel`의 ViewModel에서 조정하고 UseCase 호출은 도메인 경계를 유지
- ViewModel 생성 시 **Constructor Injection**으로 UseCase를 주입
- 새 패키지 도입은 공식 패키지/`Flutter Favorite` 우선 검토

## 실무 체크리스트

- [ ] ViewModel이 UI 상태 모델(`loading/error/data`)을 명시적으로 가진다.
- [ ] 페이지 진입 시 초기 로딩 트리거 위치가 명확하다.
- [ ] 비동기 에러는 사용자 메시지와 로깅 경로가 분리되어 있다.
- [ ] 화면 이벤트(탭/검색/새로고침)가 ViewModel 메서드로 단일화되어 있다.
- [ ] 취소 가능한 작업(검색 등)은 중복 요청 방지 로직이 있다.
- [ ] 상태관리 프레임워크 의존 코드는 `features/<feature_name>/presentation/viewmodel`에만 존재한다.
- [ ] 테스트에서 fake/mock UseCase 주입으로 상태 전이를 검증할 수 있다.
- [ ] ViewModel 변경 시 대응 Unit Test를 추가하고 상태 전이 assertion(`loading -> data` 또는 `loading -> error`)을 포함했다.

## 금지사항

- 화면 위젯에서 API 호출/비즈니스 분기 직접 처리 금지
- 글로벌 mutable 상태를 아무 위치에서나 수정하는 패턴 금지
- 상태 클래스를 동적으로 `Map`으로만 다뤄 타입 안정성을 깨는 패턴 금지
- 라이프사이클 종료 후 상태 업데이트(`setState after dispose`) 방치 금지

## 짧은 코드 예시

```dart
final ordersVmProvider =
    StateNotifierProvider<OrdersViewModel, OrdersState>((ref) {
  throw UnimplementedError('Composition Root에서 override 하세요.');
});

Widget bootstrapApp(LoadOrdersUseCase useCase) {
  return ProviderScope(
    overrides: [
      ordersVmProvider.overrideWith(
        (ref) => OrdersViewModel(useCase), // Constructor Injection
      ),
    ],
    child: const App(),
  );
}
```
