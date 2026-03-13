# 성능 최적화 체크리스트

## 목적과 범위

이 문서는 Flutter 화면 렌더링/상태 갱신 성능 최적화 기준을 정리합니다.  
원칙은 추측이 아니라 측정 기반 개선이며, **MVVM + Clean Architecture** 경계를 유지한 채 병목을 줄이는 것입니다.

## 실무 체크리스트

- [ ] DevTools(Performance/CPU/Memory)로 병목을 먼저 측정했다.
- [ ] `build()`에서 무거운 계산을 제거하고 ViewModel/UseCase로 이동했다.
- [ ] 정적 위젯에 `const`를 적용했다.
- [ ] 긴 목록은 `ListView.builder`/`SliverList`를 사용했다.
- [ ] 상태 변경 범위를 좁혀 불필요한 rebuild를 줄였다.
- [ ] 이미지 캐시/해상도 정책을 기기 메모리에 맞게 조정했다.
- [ ] 애니메이션은 필요한 구간만 재빌드되도록 분리했다.
- [ ] startup 시간 측정을 통해 초기화 비용을 확인했다.

## 금지사항

- 프로파일링 없이 감으로 리팩터링하는 패턴 금지
- `build()` 내부 동기 I/O, JSON 파싱, 대량 정렬 수행 금지
- 한 화면에서 과도한 전역 상태 구독으로 전체 리빌드 유발 금지
- 비동기 작업 완료 후 dispose된 화면에 상태 반영 금지

## 짧은 코드 예시

```dart
class ProductList extends StatelessWidget {
  const ProductList({super.key, required this.items});
  final List<ProductItemVm> items;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) => ProductTile(item: items[index]),
    );
  }
}

class ProductTile extends StatelessWidget {
  const ProductTile({super.key, required this.item});
  final ProductItemVm item;

  @override
  Widget build(BuildContext context) => ListTile(title: Text(item.name));
}
```

## 패키지 선택 메모

성능 관련 의존성도 공식 패키지 또는 `Flutter Favorite` 후보를 우선 검토하고, 도입 전 벤치마크를 남깁니다.

