## 비동기 패턴과 에러 처리

Nest.js 프레임워크 내에서의 예외 처리와 비동기(`async/await`) 처리의 완전한 가이드입니다.

## 목차

- [Nest.js 기본 예외 처리](#nestjs-default-exceptions)
- [Async/Await 모범 사례](#asyncawait-best-practices)
- [Promise 처리 및 병렬 작업](#promise-error-handling)
- [커스텀 예외 던지기](#custom-exceptions)
- [전역 Exception Filter 구현](#global-exception-filter)
- [흔한 비동기 함정](#common-async-pitfalls)

---

## Nest.js 기본 예외 처리

Nest.js는 어플리케이션 전반에서 발생하는 모든 확인되지 않은 예외(Unhandled Exception)를 전담하는 "내장 예외 레이어(Exception Layer)"를 제공합니다.

따라서 Nest.js에서는 컨트롤러나 서비스에서 매번 `try-catch`를 씌우지 않아도 로직에서 `HttpException`을 던지면 알아서 처리됩니다.

```typescript
// ❌ 불필요한 Try-Catch 블록 (Express 스타일)
@Get()
async findAll(@Res() res: Response) {
  try {
    const result = await this.userService.findAll();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error }); // 직접 응답
  }
}

// ✅ Nest.js 스타일 권장 (예외 발생 시 자동으로 필터 층으로 위임됨)
@Get()
async findAll() {
  // Prisma 내부 에러나 외부 API 오류 등이 발생하면 자동으로 예외 필터가 캐치합니다.
  return this.userService.findAll(); 
}
```

---

## Async/Await 모범 사례

### .then() 체인 피하기

```typescript
// ❌ AVOID: Promise chains
function processData() {
    return this.fetchData()
        .then(data => this.transform(data))
        .then(transformed => this.save(transformed))
        .catch(error => {
            console.error(error); // 에러를 삼키게 됨
            throw new InternalServerErrorException();
        });
}

// ✅ PREFER: Async/await
async function processData() {
    // try-catch 없이도 Nest의 예외 필터가 캡처합니다
    const data = await this.fetchData();
    const transformed = await this.transform(data);
    return this.save(transformed);
}
```

---

## Promise 처리 및 병렬 작업

### Promise.all vs Promise.allSettled

```typescript
// ✅ 하나라도 실패하면 관련된 모두를 롤백/실패 처리해야 할 때
const [users, profiles, settings] = await Promise.all([
    this.userService.getAll(),
    this.profileService.getAll(),
    this.settingsService.getAll(),
]);
// 에러 시 자동으로 상위로 전파(Exception Filter가 캐치)

// ✅ 개별 실패를 허용하고 성공한 것만 취할 때
const results = await Promise.allSettled([
    this.userService.getAll(),
    this.profileService.getAll(),
    this.settingsService.getAll(),
]);

results.forEach((result, index) => {
    if (result.status === 'rejected') {
        Sentry.captureException(result.reason, {
            tags: { operation: ['users', 'profiles', 'settings'][index] }
        });
    }
});
```

---

## 커스텀 예외 던지기 (Custom Exceptions)

Nest.js는 가장 기본적인 `HttpException`과 파생된 수많은 편의성 클래스들을 제공합니다. 가급적 이 내장 예외를 상속하거나 바로 사용하세요.

### 내장 확장 예외 예시

```typescript
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';

// throw를 던지면 프레임워크가 응답합니다.
if (!user) {
    throw new NotFoundException('User not found');
}

if (user.age < 18) {
    throw new BadRequestException('User must be 18+');
}

if (existingEmail) {
    throw new ConflictException('Email already exists');
}
```

### 도메인 특화 커스텀 에러 타입

```typescript
// 특정 비즈니스 도메인 규칙 어김의 경우
export class InsufficientBalanceException extends BadRequestException {
  constructor(currentBalance: number) {
    super(`잔액이 부족합니다. 현재 잔액: ${currentBalance}`);
  }
}
```

## 전역 Exception Filter 구현

Express의 `errorBoundary` 나 `asyncErrorWrapper`가 하던 역할을 대체합니다.
NestJS 애플리케이션의 엔트리 포인트(`main.ts`)에 바인딩합니다.

### Sentry 통합 Exception Filter

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import * as Sentry from '@sentry/node';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    // Sentry 캡처 (HttpException이 아닌 경우 500 내부 서버 에러이므로 중요 트래킹 대상)
    if (!(exception instanceof HttpException)) {
      Sentry.captureException(exception);
    }

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 표준 에러 포맷팅
    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message: exception instanceof HttpException ? exception.message : 'Internal server error',
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
```

### 필터 등록 (`main.ts`)

```typescript
// main.ts
const httpAdapterHost = app.get(HttpAdapterHost);
app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
```

---

## 흔한 비동기 함정

### Fire and Forget (비동기 처리 누락은 치명적)

```typescript
// ❌ NEVER: 응답은 빨리 나가지만, 작업 중 발생하는 예외를 상위에서 못 잡음
@Post()
async processRequest() {
    this.sendEmail(user.email); // await 없음, 예외 발생 시 프로세스 레벨에서 Unhandled Promise Rejection
    return { success: true };
}

// ✅ ALWAYS: Await 하거나 명시적 예외 처리 달아주기
@Post()
async processRequest() {
    await this.sendEmail(user.email);
    return { success: true };
}

// ✅ OR: 명시적 백그라운드 태스크 및 에러 캐치 (큐를 권장하지만 단순할 경우)
@Post()
async processRequest() {
    this.sendEmail(user.email).catch(error => {
        Sentry.captureException(error);
    });
    return { success: true };
}
```

### 처리되지 않은 Rejection

```typescript
// ✅ Global handler for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    Sentry.captureException(reason, {
        tags: { type: 'unhandled_rejection' }
    });
    console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    Sentry.captureException(error, {
        tags: { type: 'uncaught_exception' }
    });
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
```

---

**관련 파일:**
- [SKILL.md](SKILL.md)
- [sentry-and-monitoring.md](sentry-and-monitoring.md)
- [complete-examples.md](complete-examples.md)
