# 모델 설계 가이드

## 목적과 범위

이 문서는 **Clean Architecture**에서 모델 경계를 정의합니다.  
대상은 `Entity / DTO / Model / Mapper / Value Object`이며, ViewModel이나 UI 코드는 다루지 않습니다.

## 경계 규칙

- `Entity`: 도메인 의미와 불변 규칙
- `Value Object`: 유효성/동등성 규칙을 캡슐화
- `DTO`: 외부 API 계약 표현(직렬화 담당)
- `Model`: 로컬 저장소/캐시 표현(필요 시)
- `Mapper`: 계층 간 변환 단일 책임

## DTO vs Model 결정표

| 상황 | DTO 사용 | Model 사용 | 결정 |
| --- | --- | --- | --- |
| 외부 API 응답/요청을 그대로 수신/전송 | 필요 | 불필요 | DTO만 사용 |
| 로컬 DB/캐시 스키마를 직접 다룸 | 불필요 | 필요 | Model만 사용 |
| API 계약과 로컬 저장 스키마가 다름(offline-first 포함) | 필요 | 필요 | DTO + Model 동시 사용, Mapper 이원화 |
| 도메인 규칙 검증이 핵심이고 외부 포맷은 부수적 | 필요 시 최소화 | 필요 시 최소화 | Entity/VO 중심, DTO/Model은 인프라 경계에만 배치 |

## 실무 체크리스트

- [ ] Entity는 `fromJson/toJson` 의존 없이 순수 도메인 타입이다.
- [ ] DTO는 네트워크 필드명을 그대로 반영하고 기본값 정책을 가진다.
- [ ] Model은 저장소 스키마 변경에 대응 가능한 형태로 분리했다.
- [ ] Mapper가 DTO/Model <-> Entity 변환을 전담한다.
- [ ] DTO Mapper와 Model Mapper를 분리해 책임을 섞지 않았다.
- [ ] Value Object 생성 시점에 유효성 검증을 수행한다.
- [ ] 필드 추가/삭제 시 호환성(기본값/폐기 계획)을 기록했다.
- [ ] `MVVM` 화면 상태 모델과 도메인 Entity를 혼합하지 않았다.

## 금지사항

- DTO를 domain 레이어로 직접 노출하는 패턴 금지
- Entity에 인프라 의존(HTTP, DB, JSON) 넣는 패턴 금지
- Mapper 없이 `dynamic` 캐스팅으로 계층 변환 처리 금지
- nullable 남용으로 도메인 불변식 회피 금지

## 짧은 코드 예시

```dart
class Email {
  Email(String raw) : value = _validate(raw);
  final String value;

  static String _validate(String input) {
    if (!input.contains('@')) throw ArgumentError('invalid email');
    return input;
  }
}

class UserEntity {
  const UserEntity({required this.id, required this.email});
  final String id;
  final Email email;
}

class UserDto {
  const UserDto({required this.id, required this.email});
  final String id;
  final String email;

  factory UserDto.fromJson(Map<String, dynamic> json) =>
      UserDto(id: json['id'] as String, email: json['email'] as String);
}

class UserModel {
  const UserModel({required this.id, required this.email, required this.cachedAt});
  final String id;
  final String email;
  final int cachedAt;
}

class UserDtoMapper {
  UserEntity toEntity(UserDto dto) => UserEntity(
        id: dto.id,
        email: Email(dto.email),
      );

  UserDto fromEntity(UserEntity entity) => UserDto(
        id: entity.id,
        email: entity.email.value,
      );
}

class UserModelMapper {
  UserEntity toEntity(UserModel model) => UserEntity(
        id: model.id,
        email: Email(model.email),
      );

  UserModel fromEntity(UserEntity entity) => UserModel(
        id: entity.id,
        email: entity.email.value,
        cachedAt: DateTime.now().millisecondsSinceEpoch,
      );
}
```
