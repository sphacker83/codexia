# 검증(Validation) 패턴 - NestJS DTO 및 class-validator

NestJS에서는 데코레이터 기반의 `class-validator`와 `class-transformer` 인스턴스를 활용해 입력값을 검증하는 것이 표준적이고 강력한 패턴입니다.

## 목차

- [왜 class-validator인가?](#why-class-validator)
- [기본 DTO 패턴](#basic-dto-patterns)
- [ValidationPipe 전역 설정](#global-validation-pipe)
- [중첩/배열 검증](#nested-and-array-validation)
- [데이터 변환 (Transform)](#data-transform)
- [커스텀 유효성 검증기](#custom-validators)
- [(선택옵션) Zod 사용 시 팁](#optional-using-zod-with-nestjs)

---

## 왜 class-validator인가?

NestJS의 생태계와 메타프로그래밍(TypeScript 데코레이터) 시너지가 가장 좋은 라이브러리입니다.

**주요 장점:**
- ✅ **IoC 컨테이너 완벽 호환**: 검증 파이프 안에서 전역으로 작동
- ✅ **런타임 + 인스턴스 변환**: 요청된 JSON을 곧바로 해당 클래스(DTO)의 인스턴스로 변환
- ✅ **Swagger/OpenAPI 자동 연동**: 데코레이터가 곧 스펙 문서가 됨 (`@nestjs/swagger`)
- ✅ **코드 응집력**: DTO 클래스 하나가 타입 정의와 검증 역할을 100% 한 곳에서 수행

---

---

## 기본 DTO 패턴

### 스칼라 타입 (기본 타입)

```typescript
import { IsEmail, IsString, IsInt, Min, Max, IsBoolean, IsOptional, Length, IsEnum, IsUrl } from 'class-validator';

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export class CreateUserDto {
  @IsEmail({}, { message: '유효한 이메일을 입력하세요' })
  email: string;

  @IsString()
  @Length(2, 50, { message: '이름은 2~50자 사이여야 합니다.' })
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  age?: number;

  @IsBoolean()
  isActive: boolean;

  @IsEnum(UserRole, { message: 'ADMIN 혹은 USER만 허용합니다.' })
  role: UserRole;
  
  @IsOptional()
  @IsUrl()
  website?: string;
}
```

---

## ValidationPipe 전역 설정

`main.ts`에서 글로벌 `ValidationPipe`를 켜두면, 별도의 조건문(if-throw) 없이도 유효하지 않은 요청은 자동으로 400 Bad Request 에러 코드와 함께 반려됩니다.

```typescript
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // DTO에 정의되지 않은 값은 쳐냄 (보안)
      forbidNonWhitelisted: true,   // DTO에 정의되지 않은 값이 들어오면 에러 던짐
      transform: true,              // 넘어온 페이로드를 DTO 인스턴스로 자동 변환
      transformOptions: {
        enableImplicitConversion: true, // @Type() 데코레이터 없이도 기본 타입 추론시 자동 변환 허용
      },
      disableErrorMessages: process.env.NODE_ENV === 'production', // 프러덕션에서 상세 메세지 감춤 (선택)
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

---

## 중첩/배열 검증

배열 및 중첩된 객체를 검증할 때는 `@ValidateNested()`와 `class-transformer`의 `@Type()`을 반드시 함께 써야 합니다. 이를 통해 제네릭한 배열/객체가 어떤 클래스로 생성되어야 하는지 프레임워크에 알려줄 수 있습니다.

```typescript
import { ValidateNested, IsString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;
}

export class CreateUserDto {
  // ...
  @ValidateNested()
  @Type(() => AddressDto) // 하위 객체가 AddressDto 인스턴스임을 명시
  address: AddressDto;
  
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto) // 배열인 경우 each 옵션 추가
  previousAddresses: AddressDto[];
}
```

---

## 데이터 변환 (Transform)

`class-transformer`의 데코레이터를 이용하면 컨트롤러 진입 전 데이터를 변환할 수 있습니다.

```typescript
import { Transform } from 'class-transformer';
import { IsString, IsBoolean } from 'class-validator';

export class FilterDto {
  @IsString()
  @Transform(({ value }) => value?.trim().toLowerCase()) // 공백 제거 및 소문자
  keyword: string;

  @IsBoolean()
  @Transform(({ value }) => value === 'true') // Query Parameter로 들어온 'true' 문자열 처리
  isActive: boolean;
}
```

## 커스텀 유효성 검증기

더 복잡한 비즈니스 형태의 유효성 검사가 필요하다면 Custom 데코레이터를 등록합니다. (예: 시작 날짜보다 종료 날짜가 커야 한다)

```typescript
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, registerDecorator, ValidationOptions } from 'class-validator';

@ValidatorConstraint({ name: 'IsAfter', async: false })
export class IsAfterConstraint implements ValidatorConstraintInterface {
  validate(propertyValue: string, args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as any)[relatedPropertyName];
    
    // 둘 중에 하나라도 없으면 다른 규칙인 IsNotEmpty 등으로 대응함
    if (!propertyValue || !relatedValue) return true; 

    return new Date(propertyValue).getTime() > new Date(relatedValue).getTime();
  }

  defaultMessage(args: ValidationArguments) {
    return `"${args.property}" must be after "${args.constraints[0]}"`;
  }
}

export function IsAfter(property: string, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: IsAfterConstraint,
    });
  };
}

// 사용방법
export class EventDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsAfter('startDate') // Custom 데코레이터
  endDate: string;
}
```

---

## (선택옵션) Zod 사용 시 팁

기존 레거시나 복잡한 스키마 구조로 인해 Zod를 사용할 수밖에 없다면, NestJS에서는 ZodValidationPipe를 만들어 씁니다. (`nestjs-zod` 패키지 활용 가능)

```typescript
// Zod를 통환 파이프 예시 
import { PipeTransform, ArgumentMetadata, BadRequestException, Injectable } from '@nestjs/common';
import { ZodSchema  } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      if (metadata.type !== 'body') return value;
      // Zod 파싱
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      throw new BadRequestException('Validation failed');
    }
  }
}
```

다만 이는 `class-validator`를 쓸 때 얻는 Swagger 자동 메타데이터 생성 등의 이점을 상당수 잃기 때문에 최우선 옵션은 아닙니다. (꼭 필요할 때만 사용)

---

**관련 파일:**
- [SKILL.md](SKILL.md) - 메인 가이드
- [routing-and-controllers.md](routing-and-controllers.md) - 컨트롤러에서 검증 사용
- [services-and-repositories.md](services-and-repositories.md) - 서비스에서 DTO 사용
- [async-and-errors.md](async-and-errors.md) - 에러 처리 패턴
