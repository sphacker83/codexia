# 컨트롤러와 라우팅 - NestJS 모범 사례

NestJS 프레임워크에서의 깔끔한 HTTP 라우트 정의와 컨트롤러 작성 방법을 다루는 가이드입니다.

## 목차

- [컨트롤러의 책임](#controller-responsibility)
- [데코레이터 라우팅 패턴](#decorator-routing-pattern)
- [DTO와 유효성 검사](#dto-and-validation)
- [응답 포맷팅과 인터셉터](#interceptors)
- [HTTP 상태 코드 제어](#http-status-codes)

---

## 컨트롤러의 책임

### 황금 규칙

**컨트롤러가 해야 하는 것(ONLY):**
- ✅ HTTP 라우트 명시 (`@Get`, `@Post()`)
- ✅ Guard 바인딩 (`@UseGuards()`)
- ✅ 요청 입력값 검증 지시 (DTO & `@Body()`)
- ✅ 서비스 호출 (비즈니스 로직 위임)
- ✅ 상태 코드 명시 (`@HttpCode()`)

**컨트롤러가 하면 안 되는 것(NEVER):**
- ❌ Express `req`, `res` 객체 직접 다루기 (프레임워크 종속 방지)
- ❌ 비즈니스 로직 포함
- ❌ DB 직접 접근 (`this.prisma.xxx()` 사용 금지)
- ❌ DTO가 아닌 곳에서 `any`로 바디 파싱

---

## 데코레이터 라우팅 패턴

### 깔끔한 컨트롤러 구조

```typescript
import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  // 생성자를 통한 서비스 DI
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard) // 미들웨어가 아닌 가드로 인가/인증
  async getUser(@Param('id') id: string) {
    // 반환값은 NestJS가 자동으로 JSON 응답 변환
    return this.usersService.findById(id); 
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Param('id') id: string, 
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(id, updateUserDto);
  }
}
```

**핵심 포인트:**
- 각 라우트는: 메서드, 경로, 미들웨어 체인, 컨트롤러 위임만 포함
**핵심 포인트:**
- 라우트 파일(`routes.ts`)이 사라지고 컨트롤러 데코레이터가 이를 대체.
- 의존성 주입(`constructor`)으로 결합도 저하.
- `req`, `res`가 없기 때문에 테스트(Unit Test) 작성이 극히 편해짐.

---

## DTO와 유효성 검사

Express의 수동 패치나 미들웨어 대신, `class-validator`와 내장 `ValidationPipe` 전역 설정을 이용합니다.

### 1. DTO 클래스 정의

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password: string;
}
```

### 2. ValidationPipe 전역 적용 (`main.ts`)

```typescript
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 속성 제거
      forbidNonWhitelisted: true, // DTO 밖의 필드가 오면 에러
      transform: true, // 요청 데이터를 DTO 클래스 인스턴스로 자동 변환
    }),
  );
  
  await app.listen(3000);
}
```

---

## 응답 포맷팅과 인터셉터

NestJS는 응답 데이터 구조의 통일성을 전역(Global) Interceptor를 활용해 구축할 권장합니다.
BaseController에서 수동 호출하던 `handleSuccess`를 완전히 제거합니다.

### TransformInterceptor 구현 예시

```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    );
  }
}
```

**등록 (`main.ts`):** `app.useGlobalInterceptors(new TransformInterceptor());`

이렇게 하면 컨트롤러는 그냥 엔티티나 결과를 `return`만 해도 `{ "success": true, "data": { ... } }` 형태로 나갑니다.

---

## HTTP 상태 코드

### 표준 코드

| 코드 | 사용 사례 | 예시 |
|------|----------|---------|
| 200 | 성공(GET, PUT) | 사용자 조회, 업데이트 |
| 201 | 생성됨(POST) | 사용자 생성 |
| 204 | 콘텐츠 없음(DELETE) | 사용자 삭제 |
| 400 | 잘못된 요청 | 유효하지 않은 입력 데이터 |
| 401 | 인증 필요 | 인증되지 않음 |
| 403 | 권한 없음 | 권한 부족 |
| 404 | 찾을 수 없음 | 리소스가 존재하지 않음 |
| 409 | 충돌 | 중복 리소스 |
| 422 | 처리할 수 없는 엔티티 | 검증 실패 |
| 500 | 내부 서버 오류 | 예기치 않은 오류 |

### 사용 예시

### 사용 예시 (HttpCode 데코레이터)

NestJS는 기본적으로 GET은 200, POST는 201을 자동으로 반환합니다. 
특별히 바꿔야 할 때만 데코레이터를 붙입니다.

```typescript
import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('items')
export class ItemsController {
  @Post('webhook')
  @HttpCode(HttpStatus.OK) // 201 대신 200 응답 강제
  receiveWebhook() {
    return { received: true };
  }
}
```

---

## 리팩터링 가이드

## 요약체크리스트

1. **라우팅이 깔끔한가?**: 컨트롤러 밖 `routes.ts` 에 로직 짰다면 구조를 잘못 잡은 것입니다.
2. **비즈니스 로직**: 모두 `@Injectable()`이 붙은 `Service` 클래스로 이동했습니까?
3. **입력 검증**: Controller의 로직 단에 `if(!body.email)` 등이 있나요? 지우고 DTO + `class-validator` 룰로 넘기세요.
4. **결과 응답**: `res.json()`을 제거하고 순수 객체를 반환한 뒤 전역 변환 필터에 위임했나요?

---

**관련 파일:**
- [SKILL.md](SKILL.md) - 메인 가이드
- [services-and-repositories.md](services-and-repositories.md) - 서비스 레이어 상세
- [complete-examples.md](complete-examples.md) - 전체 리팩터링 예시
