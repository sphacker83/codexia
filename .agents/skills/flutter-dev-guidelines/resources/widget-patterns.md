# 위젯 패턴 가이드

## 목적과 범위

이 문서는 **MVVM + Clean Architecture**에서 `presentation` 레이어 위젯 설계 패턴만 다룹니다.  
UI 표현은 위젯(`features/<feature_name>/presentation/pages|widgets`)에 두고, 상태 전이와 비즈니스 로직은 `features/<feature_name>/presentation/viewmodel`/UseCase로 분리합니다.

## 권장 패턴

- `Page` 위젯: 라우트 진입점, 레이아웃 뼈대(`Scaffold`) 구성
- `Section` 위젯: 화면 영역 단위 구성(헤더, 목록, 필터)
- `Item` 위젯: 재사용 가능한 최소 표시 단위
- `State` 위젯: `loading/error/empty/content` 상태를 명시적으로 분리

## 실무 체크리스트

- [ ] `build()`는 순수 렌더링에 집중하고 계산/네트워크 호출을 넣지 않았다.
- [ ] 정적 위젯/스타일에는 `const`를 적용했다.
- [ ] ViewModel은 상위에서 주입받고 하위 위젯은 콜백/값만 받는다.
- [ ] `presentation/pages|widgets -> domain` 직접 의존 없이 `features/<feature_name>/presentation/viewmodel`만 경유한다.
- [ ] 위젯은 도메인 규칙을 직접 판단하지 않고 ViewModel 결과만 표현한다.
- [ ] 화면 상태(`loading/error/empty`)를 분기 위젯으로 분리했다.
- [ ] 재사용 가능한 위젯은 파일을 분리하고 입력 파라미터를 명확히 했다.
- [ ] 접근성(semantic label, 터치 영역)을 기본 점검했다.

## 금지사항

- 위젯 내부에서 Repository/UseCase를 직접 생성하는 패턴 금지
- `setState`와 ViewModel 상태를 혼용해 단일 소스 오브 트루스를 깨는 패턴 금지
- `build()`마다 무거운 정렬/필터링/포맷팅 수행 금지
- 공통 컴포넌트를 페이지 내부 private 클래스로만 고정하는 패턴 금지

## 짧은 코드 예시

```dart
class OrdersRoute extends StatelessWidget {
  const OrdersRoute({super.key, required this.viewmodel});
  final OrdersViewModel viewmodel; // Composition Root에서 Constructor Injection

  @override
  Widget build(BuildContext context) {
    return OrdersPage(viewmodel: viewmodel);
  }
}

class OrdersPage extends StatelessWidget {
  const OrdersPage({super.key, required this.viewmodel});
  final OrdersViewModel viewmodel;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<OrdersState>(
      valueListenable: viewmodel.state,
      builder: (context, state, _) => Scaffold(
        appBar: AppBar(title: const Text('주문')),
        body: OrdersBody(state: state, onRefresh: viewmodel.refresh),
      ),
    );
  }
}
```
