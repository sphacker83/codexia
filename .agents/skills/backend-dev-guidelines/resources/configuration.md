# 설정 관리 - @nestjs/config 패턴

NestJS 애플리케이션에서 환경 변수(Configuration)를 안전하게 관리하는 완전한 가이드입니다.

## 목차

- [NestJS Config 개요](#nestjs-config-overview)
- [process.env 직접 사용 금지](#never-use-processenv-directly)
- [환경 변수 로딩 및 유효성 검사](#environment-validation)
- [타입 안전한 커스텀 Config](#custom-configuration)
- [ConfigService 활용법](#using-configservice)

---

## NestJS Config 개요

### 왜 @nestjs/config 인가?

**process.env 직접 접근의 문제점:**
- ❌ No type safety (항상 `string | undefined`)
- ❌ No validation (누락되거나 오타가 나도 런타임에 가서야 터짐)
- ❌ Hard to test (전역 변수라 Mocking 까다로움)
- ❌ Scattered throughout code (코드 곳곳에 하드코딩)

**@nestjs/config + 유효성 검증의 장점:**
- ✅ Type-safe configuration
- ✅ Single source of truth
- ✅ Validated at startup (서버 구동 시점에 필수값 누락 바로 확인)
- ✅ DI(Testability) (Mock ConfigService로 쉽게 테스트)
- ✅ Clear namespace & structure

---

## process.env 직접 사용 금지

### 규칙

```typescript
// ❌ NEVER DO THIS
const timeout = parseInt(process.env.TIMEOUT_MS || '5000');
const dbHost = process.env.DB_HOST || 'localhost';

// ✅ ALWAYS DO THIS (NestJS DI 패턴)
constructor(private configService: ConfigService) {}

// 메서드 안에서
const timeout = this.configService.get<number>('TIMEOUT_MS', 5000);
const dbHost = this.configService.get<string>('database.host');
```

### 왜 중요한가

**문제가 되는 예시:**
```typescript
// Typo in environment variable name
const host = process.env.DB_HSOT; // undefined! TypeScript가 안 잡아줌!

// Type safety
const port = process.env.PORT; // string! Need parseInt
const timeout = parseInt(process.env.TIMEOUT); // NaN if not set!
```

**ConfigService를 사용하면:**
```typescript
const port = this.configService.get<number>('PORT'); // 제네릭 타입 반환
```

---

## 환경 변수 로딩 및 유효성 검사

### Joi 또는 class-validator 도입

가장 추천하는 방식은 시작 시점에 앱 환경을 강제 검증하는 것입니다.

**파일:** `src/config/env.validation.ts` (class-validator 예시)

```typescript
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    config,
    { enableImplicitConversion: true },
  );
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
```

### AppModule에 등록

**파일:** `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 어플리케이션 전역에서 ConfigService 주입 가능
      validate,       // 구동 시점에 검사 수행
      envFilePath: ['.env.local', '.env'], // 파일 우선순위 지정
    }),
  ],
})
export class AppModule {}
```

---

## 타입 안전한 커스텀 Config

복잡한 설정의 경우 네임스페이스를 나눈 커스텀 설정 객체를 만들어 반환합니다.

**파일:** `src/config/database.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
}));
```

모듈 등록 시 `load` 배열에 추가:
```typescript
ConfigModule.forRoot({
  load: [databaseConfig],
})
```

---

## ConfigService 활용법

생성자에서 주입받아 사용합니다.

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getDbHost(): string {
    // 커스텀 네임스페이스 접근
    return this.configService.get<string>('database.host');
  }

  getJwtSecret(): string {
    // 환경 변수 직접 접근
    return this.configService.get<string>('JWT_SECRET');
  }
}
```

### 주의할 점

- 테스트 코드 작성 시에는 인위적으로 값을 주입합니다.
  ```typescript
  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      return null;
    }),
  };
  ```

---

## 모범 사례 팁

1. **절대 시크릿을 소스에 커밋하지 마세요.** `.env`는 `.gitignore`에 추가하고 `.env.example`만 업로드.
2. NestJS의 `ConfigService`는 기본적으로 전역이 아니므로, `ConfigModule.forRoot({ isGlobal: true })` 설정을 잊지 마세요.
3. 데이터베이스 URL 같이 민감하고 중요한 환경변수는 **무조건 app module 진입 시점 Validation**으로 막아야 합니다. 배포 후 서비스가 돌다가 커넥션 에러를 뿜는 참사를 막습니다.

---

**관련 파일:**
- [SKILL.md](SKILL.md)
- [testing-guide.md](testing-guide.md)
