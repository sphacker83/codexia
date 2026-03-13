---
name: flutter-debugging-guidelines
description: Flutter 디버깅 전용 가이드입니다. Flutter Inspector/DevTools 사용법, lifecycle/플랫폼 이슈 추적, 성능 병목 조사 흐름을 다룹니다.
---

# Flutter 디버깅 가이드라인

## 목적

재현 -> 계측 -> 원인 분리 -> 수정 -> 재검증 순서로 디버깅 시간을 단축합니다.

## 이 스킬을 사용해야 하는 경우

- 화면 깨짐/레이아웃 오작동 원인을 찾을 때
- `setState() called after dispose()` 같은 lifecycle 오류를 추적할 때
- Android/iOS 플랫폼 설정 문제를 디버깅할 때
- jank, 프레임 드랍, 메모리 증가 등 성능 병목을 분석할 때

---

## 기본 트리아지

1. 재현 조건 고정: 기기/OS/빌드 모드/데이터 상태 기록
2. 로그 수집: Flutter 로그 + 플랫폼 로그 동시 확보
3. 최근 변경 축소: 의심 커밋/파일 범위를 빠르게 좁힘
4. 계측 도구 연결: Inspector/DevTools 프로파일 활성화
5. 가설 1개씩 검증: 한 번에 하나의 원인만 배제/확정

---

## 도구별 사용 포인트

### Flutter Inspector

- 위젯 트리와 제약(Constraints) 확인
- 과도한 중첩, 잘못된 Expanded/Flexible 배치 탐지
- `Repaint Rainbow`로 과도한 리페인트 후보 파악

### Dart DevTools

- CPU Profiler: 느린 프레임 구간의 함수 호출 파악
- Memory: 객체 증가 추세(누수 의심) 확인
- Network: 과도한 요청/중복 호출 확인
- Timeline: 프레임 드랍 구간과 비동기 이벤트 상관관계 파악

### 로그/예외 캡처

- `FlutterError.onError`와 Zone 에러 캡처 구성 확인
- `debugPrint` 남용 대신 재현 구간에 한정된 구조화 로그 사용
- 로그에는 시각, 사용자 동작, 화면명, 상태 전이를 함께 기록

---

## Lifecycle 이슈 디버깅

`setState() called after dispose()`가 발생하면 아래 순서로 확인합니다.

1. 비동기 작업 완료 시점이 `mounted` 이후인지 확인
2. `StreamSubscription`, `Timer`, `AnimationController` 해제 누락 점검
3. ViewModel/dispose 순서와 listener 해제 타이밍 점검
4. 취소 가능 토큰(예: cancellable operation)으로 작업 중단 경로 확보

### 방어 패턴

```dart
if (!mounted) return;
setState(() {
  // state update
});
```

---

## 플랫폼 이슈 디버깅

### Android

- `AndroidManifest.xml` 권한/intent-filter 확인
- `build.gradle` minSdk/targetSdk/멀티덱스 설정 확인
- 플러그인 버전과 Gradle/AGP 호환성 확인
- 필요 시 `adb logcat`으로 네이티브 오류 추적

### iOS

- `Info.plist` 권한 키/설명 누락 확인
- Signing, Capability, Bundle Identifier 확인
- CocoaPods 설치 상태와 Pod 버전 충돌 점검
- 필요 시 시뮬레이터/디바이스 로그 확인

### 플랫폼별 빠른 명령

```bash
adb logcat
xcrun simctl spawn booted log stream --level debug
flutter clean && flutter pub get
```

---

## 성능 병목 조사 흐름

1. 측정: profile 모드에서 느린 구간 캡처
2. 분류: build/layout/paint/network 중 병목 축 분류
3. 가설: 가장 큰 비용 유발 지점 1~2개만 선정
4. 수정: `const` 적용, rebuild 범위 축소, 리스트 가상화, 불필요 I/O 제거
5. 재측정: 동일 시나리오에서 프레임/CPU/메모리 개선 확인

### 대표 개선 체크

- [ ] 정적 위젯 `const` 적용
- [ ] 긴 목록 `ListView.builder` 또는 Sliver 사용
- [ ] `build()` 내 무거운 계산/동기 I/O 제거
- [ ] ViewModel 이벤트 중복 호출 제거
- [ ] 이미지 디코딩/리사이즈 비용 분리 검토
- [ ] 느린 구간 재현 영상을 이슈에 첨부

---

## 디버깅 결과 기록 템플릿

- 증상: 어떤 화면/동작에서 어떤 실패가 발생했는가?
- 재현 조건: 기기, OS, 빌드 모드, 데이터 상태
- 원인: 확정된 root cause 1문장
- 수정: 코드 변경 지점과 이유
- 재검증: 어떤 테스트/프로파일로 개선을 확인했는가?

---

## 권장 명령

```bash
flutter run --debug
flutter run --profile
flutter attach
adb logcat
```

---

## 관련 스킬

- 아키텍처/DI 정합성: [flutter-architecture-guidelines](../flutter-architecture-guidelines/SKILL.md)
- 테스트 보강: [flutter-testing-guidelines](../flutter-testing-guidelines/SKILL.md)
- 게이트 증빙: [flutter-validation-gates](../flutter-validation-gates/SKILL.md)

## 상세 리소스

- [디버깅 플레이북](../flutter-dev-guidelines/resources/debugging.md)
- [성능 최적화 체크리스트](../flutter-dev-guidelines/resources/performance.md)
- [빌드/배포 런북](../flutter-dev-guidelines/resources/build-and-release.md)
