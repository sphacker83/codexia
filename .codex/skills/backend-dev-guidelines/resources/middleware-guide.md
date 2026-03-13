# 미들웨어 및 요청 파이프라인 가이드

NestJS 환경에서 미들웨어, Guard, Interceptor의 역할 차이와 구현 방법에 대한 패턴 가이드입니다.

## 목차

- [NestJS 파이프라인 이해](#nestjs-pipeline)
- [미들웨어 (Middleware)](#middleware)
- [가드 (Guard) - 인가/인증](#guards-authentication)
- [인터셉터 (Interceptor) - 컨텍스트 및 변환](#interceptors-context)
- [필터 (Filter) - 에러 발생 이후](#exception-filters)

---

## NestJS 파이프라인 이해

NestJS는 Express의 단일 미들웨어 체인를 확장하여 생명주기를 엄격하게 구분합니다.

`Request -> Middleware -> Guard -> Interceptor -> Pipe -> Controller -> Interceptor -> Filter -> Response`

1. **Middleware**: 전역적인 요청/추적 등(로깅, IP 필터링)
2. **Guard**: 라우트 핸들러 수행 전 권한 검사 (JWT, Role)
3. **Interceptor**: 핸들러 전/후의 데이터 변환 및 시간 측정
4. **Pipe**: 입력 데이터 변환 및 유효성 검사 (Zod, class-validator)
5. **Filter**: 위 단계에서 발생한 에러를 낚아채 정형화하여 반환

## 미들웨어 (Middleware)

NestJS에서도 Express 미들웨어를 쓸 수 있으나, 일반적으로 어플리케이션 전역 설정이나 Logger 등에 한정하여 사용합니다.

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`[${req.method}] ${req.url}`);
    next();
  }
}
```

---

## 가드 (Guard) - 인가/인증

비즈니스 로직에 들어가기 전에 헤더나 쿠키의 토큰을 검증해 인가 여부를 결정할 때 사용합니다. NestJS는 리플렉션과 연동성이 좋으므로 Guard 사용을 적극 권장합니다.

**File:** `src/auth/guards/jwt-auth.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.user = payload; // 리퀘스트 객체에 담기 (커스텀 데코레이터로 뽑아 사용)
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

## 인터셉터 (Interceptor) - 컨텍스트 및 변환

### AsyncLocalStorage 대신 CLS(Continuation Local Storage) 패턴
요즘 NestJS 생태계에서는 Request 스코프나, `nestjs-cls` 패키지를 도입해 Express의 `AsyncLocalStorage`를 감싼 인젝션 패턴을 선호합니다.

**패키지:** `nestjs-cls` (권장 패턴)

```typescript
// app.module.ts
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true }, // 자동으로 매 요청마다 독립된 컨텍스트(AsyncLocalStorage) 생성
    }),
  ],
})
export class AppModule {}
```

**Guard나 Interceptor에서 값 세팅:**
```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    this.cls.set('userId', request.user?.id || 'anonymous');
    this.cls.set('requestId', request.headers['x-request-id']);
    
    return next.handle();
  }
}
```

**Service 깊은 곳에서 `Req` 파라미터 전달 없이 가져다 쓰기:**
```typescript
@Injectable()
export class SomeBusinessService {
  // CLS 서비스 의존성 주입
  constructor(private readonly cls: ClsService) {}

  async doSomething() {
    const userId = this.cls.get('userId');
    console.log(`Doing something as ${userId}`);
  }
}
```

**장점:**
- Req를 모든 함수 인자로 넘기지 않아도 됨.
- 의존성 주입 컨테이너에 완벽 호환.

---

## 필터 (Exception Filters)

모든 컨트롤러/서비스에서 나오는 에러를 중앙화합니다. Express의 Error Boundary 역할을 대체합니다.

**File:** `src/common/filters/all-exceptions.filter.ts`

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      Sentry.captureException(exception);
    }

    response.status(status).json({
      success: false,
      error: {
        message: exception instanceof HttpException ? exception.message : 'Internal server error',
        statusCode: status,
      },
    });
  }
}
```

---

## 데코레이터 커스텀 활용 방식

반복적으로 자주 불리는 Guard 집합이 있다면 커스텀 데코레이터 단위로 묶을 수 있습니다.

```typescript
import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

export function Auth(...roles: string[]) {
  return applyDecorators(
    Roles(...roles),
    UseGuards(JwtAuthGuard, RolesGuard),
  );
}

// 컨트롤러에서
@Auth('ADMIN')
@Get('dashboard')
async getDashboard() { ... }
```

---

**관련 파일:**
- [SKILL.md](SKILL.md)
- [routing-and-controllers.md](routing-and-controllers.md)
- [async-and-errors.md](async-and-errors.md)
