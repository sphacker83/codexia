# 디버깅 플레이북

## 목적과 범위

이 문서는 Flutter 장애를 빠르게 분류하고 복구하기 위한 실무 절차입니다.  
구조 전제는 **MVVM + Clean Architecture**이며, 상태/DI/렌더링 문제를 분리 진단합니다.

## 우선 진단 순서

1. 재현 조건 고정: 기기/OS/빌드 타입/계정 상태 기록
2. 증상 분류: 크래시, UI 깨짐, 상태 불일치, 성능 저하
3. 호출 흐름(런타임) 추적: `presentation/pages|widgets -> presentation/viewmodel -> domain -> data` 역추적
4. 의존 방향(컴파일 타임) 점검: `import/export/part` 금지 규칙 위반 여부 확인
5. DI 확인: `lib/app/di/composition_root.dart` 등록 누락/중복 여부 점검
6. 로그/프로파일: Flutter Inspector, DevTools, 네트워크 로그 확인

## 의존 방향(컴파일 타임) 점검

- 컴파일 타임 의존 방향 규칙: `presentation/pages|widgets -> presentation/viewmodel -> domain`, `data -> domain`, `app -> core + features/**`.
- `presentation/pages|widgets`에서 `domain` 직접 의존은 즉시 차단한다.
- `domain`에서 `data/presentation` 의존은 즉시 차단한다.
- `data`에서 `presentation` 의존은 즉시 차단한다.
- `lib/app/di/composition_root.dart` 외 `app/**` 파일에서 feature 직접 조립 의존은 즉시 차단한다.

## 호출 흐름(런타임) 추적

- 런타임 호출 흐름 규칙: `presentation/pages|widgets -> presentation/viewmodel -> usecase(domain) -> repository interface(domain) -> repository impl(data) -> datasource`.
- 응답 반환: `datasource -> repository impl -> usecase -> presentation/viewmodel -> presentation/pages|widgets`
- 호출 흐름은 로그/브레이크포인트로 추적하고, import 방향과 혼동하지 않는다.

## 실무 체크리스트

- [ ] 예외 스택트레이스와 사용자 시나리오를 함께 저장했다.
- [ ] 동일 증상이 디버그/릴리스에서 모두 재현되는지 확인했다.
- [ ] 비동기 취소 누락(`dispose` 이후 업데이트)을 점검했다.
- [ ] Mapper 입력 데이터와 Value Object 검증 실패를 확인했다.
- [ ] 플랫폼 채널 이슈면 Android/iOS 설정 파일을 교차 점검했다.
- [ ] 수정 후 회귀 방지 테스트를 추가했다.
- [ ] 의존성 매트릭스 기준 금지 import가 0건인지 확인했다.
- [ ] `import/export/part` 기준 금지 의존이 0건인지 확인했다.
- [ ] ViewModel 생성 경로가 `Constructor Injection` 규칙을 지키는지 확인했다.
- [ ] DI 등록이 `lib/app/di/composition_root.dart` 단일 경로에서 수행되는지 확인했다.

## 금지사항

- 로그 없이 추측으로 핫픽스 배포 금지
- 디버깅 편의를 이유로 예외를 삼키는 코드 추가 금지
- 임시 `print`만 남기고 원인 분석 문서화 생략 금지
- 재현 조건이 다른 상태에서 해결로 판단하는 행위 금지

## 짧은 코드 예시

```dart
void main() {
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('FlutterError: ${details.exceptionAsString()}');
  };

  runZonedGuarded(
    () => runApp(const App()),
    (error, stackTrace) {
      debugPrint('Uncaught: $error');
      debugPrintStack(stackTrace: stackTrace);
    },
  );
}
```
