# 빌드/배포 런북

## 목적과 범위

이 문서는 최신 stable Flutter/Dart 기준 릴리스 절차를 정리합니다.  
코드 구조는 **Clean Architecture**를 유지하고, 릴리스 전에 의존성 정책(`Flutter Favorite` 우선)을 점검합니다.

## 사전 체크리스트

- [ ] Flutter/Dart stable 버전 고정 및 CI 캐시 설정 확인
- [ ] `pubspec.yaml` 버전(`version: x.y.z+build`) 업데이트
- [ ] 앱 아이콘/스플래시/권한 문구 최종 검수
- [ ] 서명 키(Android keystore, iOS signing) 유효성 확인
- [ ] 환경별 설정(dev/stage/prod)과 API endpoint 검증
- [ ] `flutter analyze`, `flutter test`, `flutter test integration_test` 게이트 통과
- [ ] 크래시 모니터링/로그 레벨을 릴리스 값으로 조정

## 플랫폼별 기본 명령

```bash
flutter build appbundle --release
flutter build apk --release
flutter build ipa --release
```

## 실무 체크리스트

- [ ] Android `applicationId`, `minSdk`, Proguard/R8 규칙 확인
- [ ] iOS Bundle Identifier, Signing, Export 옵션 확인
- [ ] 릴리스 노트에 모델 변경 및 마이그레이션 이력 기록
- [ ] 저장소 태그와 배포 산출물 버전 일치 확인
- [ ] 롤백 가능한 직전 버전 아티팩트 보관

## 금지사항

- analyze/test 미통과 상태에서 릴리스 빌드 진행 금지
- 수동 환경변수 변경으로 재현 불가능한 빌드 생성 금지
- 릴리스 직전에 대규모 리팩터링 병합 금지
- 서명 키/민감정보를 저장소에 평문 커밋 금지

## 짧은 코드 예시 (CI 게이트)

```yaml
name: mobile-release-gate
on: [push]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: subosito/flutter-action@v2
        with:
          channel: stable
      - run: flutter pub get
      - run: flutter analyze
      - run: flutter test
      - run: flutter test integration_test
      - run: flutter build appbundle --release
```
