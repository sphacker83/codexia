# Sentry 통합 및 모니터링

Sentry v8을 사용한 에러 트래킹과 성능 모니터링의 완전한 가이드입니다.

## 목차

- [핵심 원칙](#core-principles)
- [Sentry 초기화](#sentry-initialization)
- [에러 캡처 패턴](#error-capture-patterns)
- [성능 모니터링](#performance-monitoring)
- [크론 잡 모니터링](#cron-job-monitoring)
- [에러 컨텍스트 모범 사례](#error-context-best-practices)
- [흔한 실수](#common-mistakes)

---

## 핵심 원칙

**필수(MANDATORY)**: 모든 에러는 예외 없이 Sentry로 캡처해야 합니다.

**모든 에러는 반드시 캡처되어야 합니다** - 모든 서비스에서 Sentry v8을 사용해 포괄적으로 에러를 트래킹하세요.

---

## Sentry 초기화

### NestJS 통합 방식 (Sentry 모듈 활용)

**위치:** `src/main.ts` (앱 부트스트랩)

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/node';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Sentry 초기화
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
    integrations: [
      Sentry.extraErrorDataIntegration({ depth: 5 }),
    ],
    beforeSend(event, hint) {
      if (event.request?.url?.includes('/healthcheck')) {
        return null; // 헬스체크 필터링
      }
      return event;
    },
  });

  await app.listen(3000);
}
bootstrap();
```

---

## 에러 캡처 패턴

### 1. 전역 Exception Filter 사용 (권장)

수동으로 `Sentry.captureException`을 찍는 대신, 모든 예외를 잡는 글로벌 필터를 만들어 NestJS에 등록합니다.

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    // 예상 가능한 HTTP 에러가 아닌 Unhandled Error(500)인 경우에만 Sentry로 전송
    if (!(exception instanceof HttpException)) {
      Sentry.withScope((scope) => {
        // 컨텍스트 주입
        scope.setTag('route', request.path);
        scope.setUser({ id: request.user?.id });
        Sentry.captureException(exception);
      });
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception instanceof HttpException ? exception.message : 'Internal server error',
    });
  }
}
```

등록 방법 (`main.ts`):
```typescript
app.useGlobalFilters(new SentryExceptionFilter());
```

### 2. 비즈니스 로직(Service 계층) 내 수동 캡처

전역 예외로 던지기 전에 에러 원인을 상세히 추적하고 싶을 때 사용합니다.

```typescript
@Injectable()
export class ReportService {
  async generateReport() {
    try {
      await this.complexCalculation();
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'report', operation: 'generateReport' },
        extra: { stepId: 123 },
      });
      throw new InternalServerErrorException('리포트 생성 중 오류가 발생했습니다.');
    }
  }
}
```

### 2. 워크플로 에러 처리

```typescript
import { SentryHelper } from '../utils/sentryHelper';

try {
    await businessOperation();
} catch (error) {
    SentryHelper.captureOperationError(error, {
        operationType: 'POST_CREATION',
        entityId: 123,
        userId: 'user-123',
        operation: 'createPost',
    });
    throw error;
}
```

### 3. 서비스 레이어 에러 처리

```typescript
try {
    await someOperation();
} catch (error) {
    Sentry.captureException(error, {
        tags: {
            service: 'form',
            operation: 'someOperation'
        },
        extra: {
            userId: currentUser.id,
            entityId: 123
        }
    });
    throw error;
}
```

---

## 성능 모니터링 (NestJS Interceptor 활용)

### SentryTraced Interceptor

요청의 트랜잭션 스팬(Span)을 열고 닫는 NestJS 인터셉터를 구성하여 모든 라우트에 적용할 수 있습니다.

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryTracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const transaction = Sentry.startTransaction({
      op: 'http.server',
      name: `${request.method} ${request.url}`,
    });

    Sentry.getCurrentHub().configureScope(scope => {
      scope.setSpan(transaction);
    });

    return next.handle().pipe(
      tap({
        next: () => transaction.finish(),
        error: () => transaction.finish(),
      }),
    );
  }
}
```

---

## 크론 잡 모니터링

### 필수 패턴

```typescript
#!/usr/bin/env node
import '../instrument'; // FIRST LINE after shebang
import * as Sentry from '@sentry/node';

async function main() {
    return await Sentry.startSpan({
        name: 'cron.job-name',
        op: 'cron',
        attributes: {
            'cron.job': 'job-name',
            'cron.startTime': new Date().toISOString(),
        }
    }, async () => {
        try {
            // Cron job logic here
        } catch (error) {
            Sentry.captureException(error, {
                tags: {
                    'cron.job': 'job-name',
                    'error.type': 'execution_error'
                }
            });
            console.error('[Cron] Error:', error);
            process.exit(1);
        }
    });
}

main().then(() => {
    console.log('[Cron] Completed successfully');
    process.exit(0);
}).catch((error) => {
    console.error('[Cron] Fatal error:', error);
    process.exit(1);
});
```

---

## 에러 컨텍스트 모범 사례

### 풍부한 컨텍스트 예시

```typescript
Sentry.withScope((scope) => {
    // User context
    scope.setUser({
        id: user.id,
        email: user.email,
        username: user.username
    });

    // Tags for filtering
    scope.setTag('service', 'form');
    scope.setTag('endpoint', req.path);
    scope.setTag('method', req.method);

    // Structured context
    scope.setContext('operation', {
        type: 'workflow.complete',
        workflowId: 123,
        stepId: 456
    });

    // Breadcrumbs for timeline
    scope.addBreadcrumb({
        category: 'workflow',
        message: 'Starting step completion',
        level: 'info',
        data: { stepId: 456 }
    });

    Sentry.captureException(error);
});
```

---

## 흔한 실수

```typescript
// ❌ Swallowing errors
try {
    await riskyOperation();
} catch (error) {
    // Silent failure
}

// ❌ Generic error messages
throw new Error('Error occurred');

// ❌ Exposing sensitive data
Sentry.captureException(error, {
    extra: { password: user.password } // NEVER
});

// ❌ Missing async error handling
async function bad() {
    fetchData().then(data => processResult(data)); // Unhandled
}

// ✅ Proper async handling
async function good() {
    try {
        const data = await fetchData();
        processResult(data);
    } catch (error) {
        Sentry.captureException(error);
        throw error;
    }
}
```

---

**관련 파일:**
- [SKILL.md](SKILL.md)
- [routing-and-controllers.md](routing-and-controllers.md)
- [async-and-errors.md](async-and-errors.md)
