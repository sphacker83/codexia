# 테스트 가이드 - NestJS 테스트 전략

NestJS와 Jest를 활용하여 유닛, 통합, e2e 테스트를 작성하는 모범 사례를 다루는 가이드입니다.

## 목차

- [유닛 테스트 (테스트 모듈 기반)](#unit-testing)
- [Mocking 전략 (DI 기반)](#mocking-strategies)
- [E2E 및 통합 테스트](#e2e-integration-testing)
- [테스트 데이터 관리](#test-data-management)
- [인증된 라우트 테스트](#testing-authenticated-routes)
- [커버리지 목표](#coverage-targets)

---

## 유닛 테스트(Unit Testing)

NestJS는 고유의 IoC 컨테이너를 가볍게 로드할 수 있는 `@nestjs/testing` 패키지를 제공합니다.
이를 사용하면 의존성을 안전하게 주입받거나 Mock으로 바꿔치기할 수 있습니다.

### 테스트 구조

```typescript
// users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../database/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  // PrismaService Mock 객체
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    // TestingModule을 초기화하여 의존성 주입 컨텍스트 생성
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService, // 원래 클래스 토큰
          useValue: mockPrismaService, // 대체할 Mock 데이터
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: '123', email: 'test@test.com' });

      const result = await service.create({ email: 'test@test.com', name: 'John' });

      expect(result.id).toBe('123');
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });
});
```

---

---

## Mocking 전략 (DI 기반)

NestJS에서는 `jest.mock()`을 쓰기보다 DI 컨테이너를 조작하는 방식을 선호합니다.

### ConfigService 강제 추입

환경변수가 필요한 경우 테스트 빌드 시 넣어서 해결합니다.

```typescript
import { ConfigService } from '@nestjs/config';

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'JWT_SECRET') return 'test-secret';
    return null;
  }),
};

// ... providers 배열 안
{
  provide: ConfigService,
  useValue: mockConfigService,
}
```

---

## E2E 및 통합 테스트

NestJS 앱 전체를 띄우고 `supertest` 라이브러리를 사용해 HTTP 엔드포인트부터 데이터베이스까지 관통하는 테스트를 작성합니다. 보통 `test/app.e2e-spec.ts` 내에 위치합니다.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // 실제 전체 모듈을 빌드합니다.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/users (POST) should return 201', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'test@test.com', name: 'John E2E' })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.user.email).toBe('test@test.com');
      });
  });
});
```

---

## 테스트 데이터 관리

E2E나 DB 연결이 필요한 통합 테스트에서는 고립(Isolation)이 가장 중요합니다.

```typescript
describe('Permissions E2E', () => {
    let prisma: PrismaService;

    beforeAll(async () => {
        // moduleFixture 로드 이후
        prisma = app.get<PrismaService>(PrismaService);
    });

    beforeEach(async () => {
        // 각 테스트 전 DB를 비우거나 트랜잭션을 엽니다.
        // 테스트 스키마를 떨어트리고 재생성하는 것이 낫습니다.
        await prisma.user.deleteMany();
        
        await prisma.user.create({
            data: { id: 'test-user', email: 'test@test.com' },
        });
    });

    // ... testcases ...
});
```

---

## 인증된 라우트 테스트

Guard를 오버라이딩하여 우회하는 것이 권장 패턴입니다.

### 테스트용 가드 오버라이딩

```typescript
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

const mockAuthGuard = {
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    // 가짜 로그인 데이터 주입
    req.user = { id: 'test-user-id', username: 'testuser' }; 
    return true; // 강제 통과
  },
};

const moduleFixture = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideGuard(JwtAuthGuard) // 컨트롤러에 선언된 Guard를
  .useValue(mockAuthGuard)     // Mock 가드로 변경
  .compile();

app = moduleFixture.createNestApplication();
```

---

## 커버리지 목표

### 권장 커버리지

- **Unit Tests**: 70%+ coverage
- **Integration Tests**: Critical paths covered
- **E2E Tests**: Happy paths covered

### 커버리지 실행

```bash
npm test -- --coverage
```

---

**관련 파일:**
- [SKILL.md](SKILL.md)
- [services-and-repositories.md](services-and-repositories.md)
- [complete-examples.md](complete-examples.md)
