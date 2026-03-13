---
name: backend-dev-guidelines
description: Nest.js (최신 버전) 기반의 마이크로서비스를 위한 포괄적인 백엔드 개발 가이드입니다. 컨트롤러/서비스/모듈/파이프/가드/인터셉터를 만들거나, Nest CLI, DTO(class-validator), Prisma DB 접근, Sentry 에러 트래킹, 의존성 주입(DI), 예외 필터를 다룰 때 사용하세요. 모듈형 아키텍처(Module → Controller → Service), 에러 처리, 성능 모니터링, 테스트 전략(Jest/Supertest)을 다룹니다.
---

# 백엔드 개발 가이드라인

## 목적

현대적인 Nest.js(최신) 패턴을 사용해 백엔드 애플리케이션(단일 모놀리스 혹은 마이크로서비스) 전반의 일관성과 구조적 모범 사례를 확립합니다.

## 이 스킬을 사용해야 하는 경우

다음 작업을 할 때 자동으로 활성화됩니다:
- 모듈(Module)/컨트롤러(Controller)/프로바이더(Service)를 생성하거나 수정할 때
- DTO(Data Transfer Object)와 파이프(Validation Pipe)로 입력을 검증할 때
- 인터셉터, 미들웨어, 가드(Auth/Roles Guard) 등 라이프사이클 훅을 구현할 때
- NestJS + Prisma로 DB 작업을 할 때
- Sentry 예외 필터(Exception Filter)를 통해 에러 트래킹을 할 때
- @nestjs/config를 사용해 환경 변수(Config)를 관리할 때
- 커스텀 데코레이터를 만들거나 백엔드를 테스트/리팩터링할 때

---

## 빠른 시작

### 새 API 기능 체크리스트 (Nest CLI 활용 권장 `nest g res ...`)

- [ ] **DTO**: `class-validator` 와 `class-transformer`를 통한 입력 데이터 스펙 정의
- [ ] **컨트롤러(Controller)**: `@Controller` 엔드포인트 라우팅 및 요청 위임 (비즈니스 로직 제외)
- [ ] **서비스(Service)**: `@Injectable` 수명주기가 적용된 DI 기반의 비즈니스 로직
- [ ] **모듈(Module)**: 기능 별 캡슐화 및 관련 컨트롤러/서비스 등록
- [ ] **검증(Validation/Pipe)**: Nest 전역 `ValidationPipe` 사용
- [ ] **예외 필터(Exception Filter)**: Sentry 및 표준 에러 응답 처리
- [ ] **테스트(Tests)**: `*.spec.ts` (유닛) 및 `*.e2e-spec.ts` 테스트 작성

### 새 프로젝트/서비스 체크리스트

- [ ] `nest new` 로 기본 구조 생성 및 CLI 지원 확인
- [ ] Sentry 통합을 위한 글로벌 Exception Filter 및 Interceptor 구성
- [ ] `@nestjs/config` 모듈 전역 등록 (유효성 검증 포함)
- [ ] `ValidationPipe` 글로벌 설정
- [ ] 단위/e2e 테스트 실행 환경 (Jest) 점검

---

## 아키텍처 개요

### 모듈형 아키텍처 (Layered + Modular)

```
HTTP 요청 -> 미들웨어 -> 가드 -> 인터셉터(Before) -> 파이프
    ↓
컨트롤러 (엔드포인트 라우팅 & DTO 바인딩)
    ↓
서비스 (데이터 가공 & 비즈니스 로직) - DI 컨테이너에 의해 주입
    ↓
리포지토리 / Prisma Service (데이터 접근 계층)
    ↓
데이터베이스
    ↓
(응답 반환) -> 인터셉터(After) -> 예외 필터
```

**핵심 원칙:** 각 레이어는 책임이 하나(ONE)입니다.

자세한 내용은 [architecture-overview.md](architecture-overview.md)를 참고하세요.

---

## 디렉터리 구조 (Nest.js 기본 스캐폴딩 스펙 확장)

```
src/
├── app.module.ts        # 루트 모듈 (모든 기능 모듈 import)
├── main.ts              # 부트스트랩 (NestFactory, 글로벌 파이프/필터 등록)
├── common/              # 공통 유틸, 가드, 데코레이터, 인터셉터 등
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── utils/
├── config/              # 환경 설정 관련 모듈 및 유효성 검사 파일
├── database/            # PrismaService 등 데이터베이스 코어
└── modules/             # [기능 단위 도메인]
    └── users/
        ├── users.module.ts
        ├── users.controller.ts
        ├── users.service.ts
        ├── users.repository.ts (선택적 분리 시)
        ├── dto/
        │   ├── create-user.dto.ts
        │   └── update-user.dto.ts
        └── ...
```

**네이밍 규칙:**
- 파일명은 `기능명.종류.ts` 로 작성합니다. (예: `users.controller.ts`)
- 클래스명은 `PascalCase` 로 작성합니다. (예: `UsersController`)
- DTO 필드 검증을 위해 `class-validator`를 사용합니다.

---

## 핵심 원칙(7가지 규칙)

### 1. 컨트롤러는 제어를, 서비스는 비즈니스 로직을 담당

```typescript
// ❌ 절대 금지: 컨트롤러에 비즈니스 로직 작성
@Post('submit')
async submit(@Body() body: any) {
  // DB 접근 및 200줄 계산 로직...
}

// ✅ 항상: 서비스로 위임
@Post('submit')
async submit(@Body() submitDto: SubmitDto) {
  return this.appService.handleSubmission(submitDto);
}
```

### 2. 모든 의존성은 반드시 의존성 주입(DI) 사용

```typescript
@Injectable()
export class UsersService {
  // 모듈 프로바이더로 등록된 의존성을 생성자로 주입받음
  constructor(private readonly prisma: PrismaService) {}
}
```

### 3. 모든 에러(Uncaught Exception)는 전역 예외 필터를 거쳐 Sentry로 캡처

```typescript
// SentryExceptionFilter 예시
@Catch()
export class SentryFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    Sentry.captureException(exception);
    // ...표준 HTTP 응답 포맷팅 로직
  }
}
```

### 4. ConfigService 활용, process.env 직접 호출 금지

```typescript
// ❌ 절대 금지
const jwtSecret = process.env.JWT_SECRET;

// ✅ 항상 (의존성으로 받고 타입 시스템 연결)
constructor(private configService: ConfigService) {}
...
const jwtSecret = this.configService.get<string>('JWT_SECRET');
```

### 5. 모든 입력은 DTO + class-validator로 검증

```typescript
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

// 글로벌 ValidationPipe에 의해 자동으로 걸러짐
```

### 6. 데이터베이스 접근은 Prisma Service가 담당 (선택적으로 Repository 패턴 분리)

```typescript
// Prisma를 싱글톤 모듈로 만들어서 활용
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

### 7. 테스트 주도 유지어블 코드 지향 (`.spec.ts` 필수 동봉)

```typescript
// NestJS 기본 제공 테스트 테스팅 모듈 활용
const module: TestingModule = await Test.createTestingModule({
  providers: [UsersService],
}).compile();
```

---

## 자주 쓰는 import

```typescript
// NestJS Core & Common
import { Controller, Get, Post, Body, Param, Injectable, UseGuards, UseInterceptors } from '@nestjs/common';

// 검증 관련 (class-validator / class-transformer)
import { IsString, IsEmail, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

// 환경 설정
import { ConfigService } from '@nestjs/config';

// 데이터베이스 (Prisma)
import { PrismaClient, Prisma } from '@prisma/client';

// Sentry
import * as Sentry from '@sentry/node';
```

---

## 빠른 참조

### Nest CLI 주요 명령어

| 명령어 | 기능 설명 |
|------|----------|
| `nest new [name]` | 새 프로젝트 스캐폴드 생성 |
| `nest g res [name]` | CRUD 보일러플레이트 전부 생성 (권장) |
| `nest g module [name]` | 새 모듈 껍데기 파일 생성 |
| `nest g controller [name]` | 새 컨트롤러 뼈대 생성 및 자동 등록 |
| `nest g service [name]` | 새 서비스 생성 및 모듈에 DI 등록 |

---

## 피해야 할 안티패턴

❌ 컨트롤러에 비즈니스/계산 로직 작성
❌ `process.env` 직접 읽어 오기
❌ 글로벌/커스텀 예외 처리 누락 (Throw를 적절히 활용하지 않은 무응답)
❌ `any` 남용이나 DTO를 우회한 로우한 Request 파싱
❌ 의존성 주입(constructor inject)을 쓰지 않고 파일 밖에서 직접 객체 `new Class()` 생성
❌ 어디서나 자유롭게 Prisma Client 커넥션을 무한대로 생성

---

## 탐색 가이드

| 필요하다면... | 이 문서를 읽으세요 |
|------------|-----------|
| 아키텍처 이해 | [architecture-overview.md](architecture-overview.md) |
| 라우트/컨트롤러 만들기 | [routing-and-controllers.md](routing-and-controllers.md) |
| 비즈니스 로직 구성 | [services-and-repositories.md](services-and-repositories.md) |
| 입력 검증 | [validation-patterns.md](validation-patterns.md) |
| 에러 트래킹 추가 | [sentry-and-monitoring.md](sentry-and-monitoring.md) |
| 미들웨어 만들기 | [middleware-guide.md](middleware-guide.md) |
| DB 접근 | [database-patterns.md](database-patterns.md) |
| 설정 관리 | [configuration.md](configuration.md) |
| 비동기/에러 처리 | [async-and-errors.md](async-and-errors.md) |
| 테스트 작성 | [testing-guide.md](testing-guide.md) |
| 예제 보기 | [complete-examples.md](complete-examples.md) |

---

## 리소스 파일

### [architecture-overview.md](architecture-overview.md)
레이어드 아키텍처, 요청 라이프사이클, 관심사 분리

### [routing-and-controllers.md](routing-and-controllers.md)
라우트 정의, BaseController, 에러 처리, 예제

### [services-and-repositories.md](services-and-repositories.md)
서비스 패턴, DI, 리포지토리 패턴, 캐싱

### [validation-patterns.md](validation-patterns.md)
Zod 스키마, 검증, DTO 패턴

### [sentry-and-monitoring.md](sentry-and-monitoring.md)
Sentry 초기화, 에러 캡처, 성능 모니터링

### [middleware-guide.md](middleware-guide.md)
인증, 감사(audit), 에러 바운더리, AsyncLocalStorage

### [database-patterns.md](database-patterns.md)
PrismaService, 리포지토리, 트랜잭션, 최적화

### [configuration.md](configuration.md)
UnifiedConfig, 환경별 설정, 시크릿(secrets)

### [async-and-errors.md](async-and-errors.md)
비동기 패턴, 커스텀 에러, asyncErrorWrapper

### [testing-guide.md](testing-guide.md)
유닛/통합 테스트, mocking, 커버리지

### [complete-examples.md](complete-examples.md)
전체 예제, 리팩터링 가이드

---

## 관련 스킬

- **database-verification** - 컬럼명 및 스키마 일관성 검증
- **error-tracking** - Sentry 통합 패턴
- **skill-developer** - 스킬 생성/관리를 위한 메타 스킬

---

**스킬 상태**: COMPLETE ✅
**라인 수**: < 500 ✅
**점진적 공개(Progressive Disclosure)**: 리소스 파일 11개 ✅

