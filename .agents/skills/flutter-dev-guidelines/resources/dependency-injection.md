# DI 가이드

## 목적과 범위

이 문서는 DI 구성 원칙을 다룹니다. 핵심은 **Composition Root**에서 의존성 그래프를 조립하고, 기능 코드에는 **Constructor Injection**만 남기는 것입니다.

## 설계 원칙

- 등록/바인딩은 `lib/app/di/composition_root.dart` 단일 Composition Root에서만 수행
- domain은 인터페이스만 의존하고 data 구현체를 모름
- ViewModel/UseCase는 생성자 파라미터로 의존성 수신
- DI 프레임워크는 도구일 뿐, 설계 중심은 레이어 경계
- 패키지 선택은 공식 또는 `Flutter Favorite` 우선
- `features/**` 내부에서 별도 Composition Root를 만들지 않음

## Composition Root 위치/권한 규칙

- 기본 위치: `lib/app/di/composition_root.dart`
- `app` 레이어는 조립 전용이며 `core/**`, `features/**` import를 허용한다.
- **예외 허용 경로 (App Layer)**:
  - `lib/main.dart`, `lib/app/bootstrap.dart`: Composition Root 초기화 호출 목적의 import 허용
  - `lib/app/di/composition_root.dart`: 전체 feature 의존성 조립 권한 보유
- `core/**`는 Feature 독립 레이어이므로 `features/**` import를 금지한다.
- feature 내부(`features/<feature_name>/{presentation/viewmodel,domain,data}`)는 `Composition Root`를 import하지 않는다.
- `lib/app/di/composition_root.dart` 이외 `app/**` 파일에서 `features/**`를 직접 import하거나 조립하지 않는다.

## 의존 방향(컴파일 타임) vs 호출 흐름(런타임)

### 의존 방향(컴파일 타임)

- 컴파일 타임 의존 방향 규칙: `presentation/pages|widgets -> presentation/viewmodel -> domain`, `data -> domain`, `app -> core + features/**`.
- 규칙 검사는 `import/export/part`를 모두 포함한다.
- `presentation/pages|widgets`는 `domain`을 직접 의존하지 않는다.
- `domain`은 `data/presentation`를 import하지 않는다.
- `data`는 `presentation`를 import하지 않는다.

### 호출 흐름(런타임)

- 런타임 호출 흐름 규칙: `presentation/pages|widgets -> presentation/viewmodel -> usecase(domain) -> repository interface(domain) -> repository impl(data) -> datasource`.
- 응답 반환: `datasource -> repository impl -> usecase -> presentation/viewmodel -> presentation/pages|widgets`
- 런타임 호출 순서는 import 방향 검증과 분리해서 점검한다.

## 바인딩 스코프 규칙

| 스코프 | 등록 API 예시 (`get_it`) | 선택 기준 | 대표 대상 |
| --- | --- | --- | --- |
| Singleton | `registerSingleton<T>(instance)` | 앱 생명주기 전체에서 동일 인스턴스가 필요하고 초기화 비용이 큰 경우 | Logger, Config, Analytics |
| Lazy Singleton | `registerLazySingleton<T>(() => T())` | 기본값. 전역 공유가 필요하지만 실제 사용 시점까지 생성 지연이 필요한 경우 | API Client, Repository, DataSource |
| Factory | `registerFactory<T>(() => T())` | 요청마다 새 인스턴스가 필요하거나 상태가 짧게 살아야 하는 경우 | ViewModel, UseCase, FormController |

- 기본 권장: `Repository/DataSource=Lazy Singleton`, `UseCase/ViewModel=Factory`
- mutable 상태를 가진 객체를 전역 singleton으로 두지 않는다.

## 실무 체크리스트

- [ ] `lib/app/di/composition_root.dart` 단일 진입점이 있다.
- [ ] `features/**` 내부에 Composition Root 역할 파일이 추가되지 않았다.
- [ ] Repository interface와 구현체 바인딩이 명시되어 있다.
- [ ] ViewModel/UseCase 생성 시 필수 의존성이 생성자에 드러난다.
- [ ] 테스트에서 fake/mock으로 교체 가능한 등록 구조다.
- [ ] feature 단위 스코프가 필요한 경우 해제(dispose) 전략이 있다.
- [ ] 컴파일 타임 금지 import와 런타임 순환 호출을 분리해서 점검했다.
- [ ] `presentation/pages|widgets -> domain` 직접 의존 금지를 점검했다.
- [ ] `Clean Architecture` 경계가 DI 코드로 인해 흐려지지 않는다.

## 금지사항

- feature 코드 곳곳에서 service locator 직접 조회 금지
- ViewModel 내부에서 new 키워드로 인프라 객체 생성 금지
- 전역 singleton 남용으로 테스트 격리를 깨는 패턴 금지
- 등록 순서에만 의존하는 암묵적 DI 설정 금지
- `core/**`에서 `features/**`를 import해 조립 책임을 침범하는 패턴 금지
- `lib/app/di/composition_root.dart` 외 `app/**` 파일에서 feature 의존성을 직접 조립하는 패턴 금지

## 짧은 코드 예시

```dart
final sl = GetIt.instance;

Future<void> configureCompositionRoot() async {
  sl.registerLazySingleton<HttpClient>(() => HttpClient());
  sl.registerLazySingleton<AuthRemoteDataSource>(
    () => AuthRemoteDataSource(client: sl()),
  );
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(remote: sl()),
  );
  sl.registerFactory<LoginUseCase>(() => LoginUseCase(repository: sl()));
  sl.registerFactory<AuthViewModel>(() => AuthViewModel(loginUseCase: sl()));
}
```

## 테스트 오버라이드 절차

1. 등록: 기본 Composition Root를 먼저 등록한다.
2. override: 테스트 대상 의존성만 `unregister` 후 fake/mock으로 재등록한다.
3. 실행: 테스트를 수행하고 override 동작을 검증한다.
4. teardown/reset: `reset(dispose: true)`로 컨테이너를 초기화하고 기본 등록을 복원한다.

```dart
final sl = GetIt.instance;

setUpAll(() async {
  await sl.reset(dispose: true);
  await configureCompositionRoot(); // 1) 등록
});

setUp(() {
  if (sl.isRegistered<AuthRepository>()) {
    sl.unregister<AuthRepository>();
  }

  sl.registerLazySingleton<AuthRepository>(
    () => FakeAuthRepository(),
  ); // 2) override
});

tearDown(() async {
  await sl.reset(dispose: true); // 4) teardown/reset
  await configureCompositionRoot(); // 다음 테스트를 위한 기본 등록 복원
});
```
