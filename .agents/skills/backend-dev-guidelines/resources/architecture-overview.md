# 아키텍처 개요 - 백엔드 서비스

백엔드 마이크로서비스에서 사용하는 레이어드 아키텍처 패턴의 완전한 가이드입니다.

## 목차

- [레이어드 아키텍처 패턴](#layered-architecture-pattern)
- [요청 라이프사이클](#request-lifecycle)
- [서비스 비교](#service-comparison)
- [디렉터리 구조의 근거](#directory-structure-rationale)
- [모듈 구성](#module-organization)
- [관심사 분리](#separation-of-concerns)

---

## 레이어드 아키텍처 패턴

### 5개 주요 레이어 (NestJS 의존성 주입 관점)

```
┌─────────────────────────────────────┐
│         HTTP Request                │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Layer 1: MODULES                   │
│  - DI 컨테이너 구성                   │
│  - 컨트롤러 및 프로바이더 캡슐화          │
│  - 다른 모듈 기능 import/export      │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Layer 2: CONTROLLERS               │
│  - 클래스 데코레이터 라우팅 (@Get 등)   │
│  - DTO + Pipe를 통한 입력 검증         │
│  - 서비스 계층 호출                    │
│  - 반환값 포맷팅 (Interceptor 등 활용)  │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Layer 3: SERVICES (Providers)      │
│  - 핵심 비즈니스 로직 단위             │
│  - 타 서비스와의 오케스트레이션          │
│  - HTTP/요청 컨텍스트와 독립적 (@Injectable)
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Layer 4: REPOSITORIES / PRISMA     │
│  - 데이터 접근 추상화                  │
│  - Prisma Client ORM 조작           │
│  - DB 종속적 쿼리 최적화               │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│         Database (MySQL, PostgreSQL)│
└─────────────────────────────────────┘
```

### 왜 이 아키텍처인가?

**테스트 용이성(Testability):**
- 각 레이어를 독립적으로 테스트 가능
- 의존성 mocking이 쉬움
- 테스트 경계가 명확함

**유지보수성(Maintainability):**
- 변경이 특정 레이어로 격리됨
- 비즈니스 로직이 HTTP 관심사와 분리됨
- 버그 위치를 찾기 쉬움

**재사용성(Reusability):**
- 서비스는 라우트/크론 잡/스크립트 등에서 재사용 가능
- 리포지토리가 DB 구현을 숨김
- 비즈니스 로직이 HTTP에 종속되지 않음

**확장성(Scalability):**
- 새 엔드포인트 추가가 쉬움
- 따라야 할 패턴이 명확함
- 구조가 일관됨

---

## 요청 라이프사이클 (The Request Lifecycle)

### NestJS 파이프라인 흐름 예시

```typescript
1. HTTP POST /api/users
   ↓
2. Middleware (전역 또는 모듈 수준 제한적 미들웨어 수행)
   ↓
3. Guards (인가/인증 검사)
   - e.g. RolesGuard, JwtAuthGuard 통과 여부 검사
   ↓
4. Interceptors (Before)
   - e.g. 로깅, 캐시, 요청 데이터 변환 등
   ↓
5. Pipes (검증 및 변환)
   - ValidationPipe가 Body 파싱, DTO 클래스로 변환 및 규칙 확인
   ↓
6. Controller (라우트 핸들러 매칭)
   - @Post() createUser(@Body() createUserDto: CreateUserDto)
   - 파싱되어 들어온 DTO를 Service로 토스
   ↓
7. Service 실행 (비즈니스 로직)
   - this.userService.create(createUserDto)
   - PrismaService(데이터베이스) 함수 호출 및 트랜잭션 관리
   ↓
8. Repository (데이터베이스 쿼리)
   - return this.prisma.user.create(...)
   ↓
9. Interceptors (After)
   - Service가 반환한 데이터를 변환하거나 모니터링
   - 응답 포맷을 통일하거나 반환
   ↓
10. Exception Filters (에러 시)
   - 실행 주기 내 Unhandled 예외가 발생하면 Exception Filter로 넘어가 정형화된 JSON 반환 및 Sentry 수집
   ↓
11. 응답 전송
```

### NestJS 라이프사이클 순서 (권한 제어 관점)

**중요:** NestJS는 각 구성 요소 간 실행 단계가 엄격하게 분리되어 있습니다.

```typescript
Incoming Request
  → 미들웨어(Middleware)
    → 가드(Guard)
      → 인터셉터 (Interceptor) - Pre-Controller
        → 파이프 (Pipe)
          → 핸들러 (Controller)
            → 서비스 로직 (Service)
          ← 인터셉터 (Interceptor) - Post-Request
← 예외 필터 (Exception Filter) (에러가 발생할 경우)
← Outgoing Response
```

**규칙:** 요청의 "차단"은 Guard에서, 객체의 필드 "검사"는 Pipe에서, 데이터 객체 "변형"은 Interceptor에서 담당하는 것이 모범 사례입니다.

---

## 구조적 베스트 프랙티스

### 모듈형 격리 (Feature Modules)

**강점:**
- 기능(Domin) 단위로 응집성이 높음
- 의존성 주입 체인이 명확함
- 타입 안전성 및 Nest 아키텍처 지원 풀 활용

**예시 계층 (템플릿):**
```
src/modules/users/
├── users.module.ts            ✅ 모듈 등록 (가장 중요)
├── users.controller.ts        ✅ HTTP 관심사 처리 및 인터셉터 바인딩
├── users.service.ts           ✅ DI 기반 비즈니스 로직
├── users.repository.ts        ✅ (선택) 데이터베이스 추상화 쿼리
├── dto/
│   ├── create-user.dto.ts     ✅ class-validator 데코레이터
│   └── update-user.dto.ts     ✅ PartialType 활용
└── tests/
    └── users.controller.spec.ts ✅ 단위 테스트 묶음
```

### 거대한 Monolith 서비스 피하기

**약점 (피해야 할 상황):**
- 모든 프로바이더를 `app.module.ts` 한 군데 몰아 쓰는 경우
- 컨트롤러 안에서 200줄 넘는 로직 작성
- 서비스에서 Request/Response 객체(예: `@Req() req: Request`)를 받아서 HTTP 컨텍스트를 침범하는 경우

**배울 점:** 모든 도메인은 개별 Module을 생성하여 다른 모듈에선 `exports` 한 서비스 프로바이더만 가져다 쓰게 만들어야 합니다.

---

## 디렉터리 구조의 근거

### modules 디렉터리 (도메인 분리)

**목적:** NestJS의 핵심 컨셉. 비즈니스 단위별로 컨트롤러/서비스를 그룹화.

**내용:**
- `{feature}.module.ts` - `imports`, `controllers`, `providers`, `exports` 선언 관리

### controllers 디렉터리 (핸들링 계층)

**목적:** HTTP 요청/응답 관심사 처리

**내용:**
- `{feature}.controller.ts`

**네이밍:** PascalCase + Controller (`UsersController`)

**책임:**
- 데코레이터 라우팅 명시 (`@Get`, `@Post`)
- 요청 인자 바인딩 (`@Param()`, `@Body()`)
- 파이프를 통한 DTO 검사
- 적절한 DI 주입된 서비스 반환

### services 디렉터리 (로직 계층)

**목적:** 비즈니스 로직 및 오케스트레이션

**내용:**
- `{feature}.service.ts`

**네이밍:** PascalCase + Service (`UsersService`)

**책임:**
- 핵심 비즈니스 로직 수행
- PrismaService 호출
- HTTP 관여 금지, 예외는 `throw new BadRequestException()` 등 범용 Exception 활용

### repositories 디렉터리 (선택적)

**목적:** 데이터 접근 추상화

**내용:**
- `{feature}.repository.ts` - 엔티티 DB 작업

**네이밍:** PascalCase + Repository

**책임:**
- 복잡도 높은 Prisma 쿼리 위임
- Prisma 구현 세부사항 숨김

*(NestJS에선 서비스가 충분히 가벼우면 `PrismaService`를 서비스 내에서 직접 호출하는 패턴도 무방합니다)*

### common 디렉터리 (기반 모듈 밖 영역)

**목적:** 횡단 관심사(Cross-cutting concerns)

**내용:**
- `decorators/`: 커스텀 파라미터 데코레이터 (예 `@CurrentUser()`)
- `guards/`: 접근 제어 (예 `JwtAuthGuard`)
- `interceptors/`: 직렬화, 로깅 (예 `TransformInterceptor`)
- `filters/`: 에러 필터 (예 `HttpExceptionFilter`)

**패턴:** 특정 도메인에 얽히지 않는 전역적인 동작 제어.

### config 디렉터리

**목적:** 설정(Configuration) 관리

**내용:**
- `configuration.ts` - 환경별 분기
- `env.validation.ts` - 환경 변수 필수 체크

**패턴:** Nest의 `@nestjs/config` 사용 (타입 안전성 보장).

### types 디렉터리

**목적:** TypeScript 타입 정의

**내용:**
- `{feature}.types.ts` - 기능(feature) 전용 타입
- DTO(데이터 전송 객체, Data Transfer Objects)
- Request/Response 타입
- 도메인 모델

---

## 모듈 구성

### 기능(Feature) 기반 구성

규모가 큰 기능(feature)은 하위 디렉터리를 사용하세요:

```
src/workflow/
├── core/              # Core engine
├── services/          # Workflow-specific services
├── actions/           # System actions
├── models/            # Domain models
├── validators/        # Workflow validation
└── utils/             # Workflow utilities
```

**사용 시점:**
- 기능에 파일이 5개 이상
- 명확한 하위 도메인이 존재
- 논리적 그룹화가 가독성을 개선

### 플랫(Flat) 구성

단순한 기능(feature)에는:

```
src/
├── controllers/UserController.ts
├── services/userService.ts
├── routes/userRoutes.ts
└── repositories/UserRepository.ts
```

**사용 시점:**
- 단순한 기능(파일 5개 미만)
- 명확한 하위 도메인이 없음
- 플랫 구조가 더 명확함

---

## 관심사 분리(Separation of Concerns)

### 무엇을 어디에 두나

**Controllers 계층:**
- ✅ 데코레이터를 통한 라우트 선언 (`@Get`, `@Post`)
- ✅ 미들웨어 대신 Guard/Interceptor 바인딩
- ✅ DTO를 입력 타입으로 명시 (`ValidationPipe` 체인 트리거)
- ✅ 적절한 HTTP 코드 선언 (`@HttpCode(200)`)
- ❌ Express `req`, `res` 객체 직접 주입 (프레임워크 종속 방지)
- ❌ DB 작업 직접 수행

**Services 계층:**
- ✅ 비즈니스 규칙 확인 (`if (balance < 0) throw new BadRequestException()`)
- ✅ 여러 데이터 소스/리포지토리 오케스트레이션
- ❌ HTTP Request/Response 상태 확인 (req.headers 등)

**Guards/Pipes:**
- ✅ JWT, 쿠키 변환 (Guard)
- ✅ 롤과 퍼미션 매핑 (Guard)
- ✅ 문자열 ID를 정수로 변환 (Pipe `ParseIntPipe`)

### 예시: 사용자 생성 (Nest.js 패턴)

**컨트롤러 (users.controller.ts):**
```typescript
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard) // Guard로 인증
  async create(@Body() createUserDto: CreateUserDto) {
    // Pipe가 자동으로 DTO 검증 후 주입됨
    const user = await this.usersService.create(createUserDto);
    return { success: true, user, message: 'User created' };
  }
}
```

**서비스 (users.service.ts):**
```typescript
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // 비즈니스 룰 검사
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    
    // NestJS 기본 제공 HTTP 예외 클래스 활용
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    // 객체 생성 반환
    return this.prisma.user.create({ data: createUserDto });
  }
}
```

**DTO (create-user.dto.ts):**
```typescript
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  name: string;
}
```

**포인트:** 각 레이어(제어/인가/검증/비즈니스)의 책임이 프레임워크 생명주기에 맞게 철저히 분리되어 있습니다!

---

**관련 파일:**
- [SKILL.md](SKILL.md) - 메인 가이드
- [routing-and-controllers.md](routing-and-controllers.md) - 라우트/컨트롤러 상세
- [services-and-repositories.md](services-and-repositories.md) - 서비스/리포지토리 패턴
