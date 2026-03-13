# 서비스와 리포지토리 - 비즈니스 로직 레이어

서비스로 비즈니스 로직을 구성하고, 리포지토리로 데이터 접근을 구성하는 방법에 대한 완전한 가이드입니다.

## 목차

- [서비스 레이어 개요](#service-layer-overview)
- [의존성 주입 패턴](#dependency-injection-pattern)
- [싱글턴 패턴](#singleton-pattern)
- [리포지토리 패턴](#repository-pattern)
- [서비스 설계 원칙](#service-design-principles)
- [캐싱 전략](#caching-strategies)
- [서비스 테스트](#testing-services)

---

## 서비스 레이어 개요

### 서비스의 목적

**서비스는 비즈니스 로직을 담습니다** - 애플리케이션에서 “무엇을/왜”에 해당하는 부분입니다:

```
컨트롤러의 질문: "이걸 해야 하나요?"
서비스의 답: "예/아니오. 이유는 이렇고, 이렇게 동작합니다"
리포지토리의 실행: "요청한 데이터는 여기 있습니다"
```

**서비스의 책임:**
- ✅ 비즈니스 규칙 강제
- ✅ 여러 리포지토리 오케스트레이션
- ✅ 트랜잭션 관리
- ✅ 복잡한 계산
- ✅ 외부 서비스 연동
- ✅ 비즈니스 검증

**서비스가 하면 안 되는 것:**
- ❌ HTTP(Request/Response)를 알아야 함
- ❌ Prisma를 직접 접근(리포지토리 사용)
- ❌ 라우트 전용 로직 처리
- ❌ HTTP 응답 포맷팅

---

## 의존성 주입(Dependency Injection)과 NestJS

NestJS는 강력한 IoC(Inversion of Control) 컨테이너를 내장하고 있습니다. 수동으로 의존성을 연결할 필요 없이, `@Injectable()` 데코레이터를 붙이고 생성자에 타입을 지정하면 됩니다.

### 왜 의존성 주입인가?

**장점:**
- 테스트가 쉬움 (Mocking)
- 생성 주기를 프레임워크가 보장함 (기본적으로 싱글턴)
- 유연한 모듈화

### 훌륭한 예시: NotificationService

**File:** `src/notifications/notification.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BatchingService } from '../batching/batching.service';
import { EmailComposer } from '../email/email-composer.service';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    // Dependencies injected via constructor automatically by NestJS
    constructor(
        private prisma: PrismaService,
        private batchingService: BatchingService,
        private emailComposer: EmailComposer,
    ) {}

    /**
     * Create a notification and route it appropriately
     */
    async createNotification(params: CreateNotificationParams) {
        // ... 비즈니스 로직
        try {
            const notification = await this.prisma.notification.create({ ... });
            
            // ... 라우팅 로직
            return notification;
        } catch (error) {
            this.logger.error('Failed to create notification', error.stack);
            throw error;
        }
    }
}
```

**컨트롤러에서 사용:**

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
    // Controller에도 동일하게 DI 패턴 사용
    constructor(private readonly notificationService: NotificationService) {}

    @Post()
    async create(@Body() params: CreateNotificationParams) {
        return this.notificationService.createNotification(params);
    }
}
```

**핵심 정리:**
- `@Injectable()`이 붙은 클래스는 NestJS 컴포넌트로 인식됨
- 의존성은 생성자(constructor)로 주입
- `new` 키워드로 수동 인스턴스화를 하지 않음

---

## 싱글턴(Singleton) 패턴

NestJS에서는 제공하는 `@Injectable()` 프로바이더가 기본적으로 싱글턴으로 인스턴스화됩니다. 따라서 수동으로 `static instance`를 다룰 필요가 전혀 없습니다.

### 모범 사례: PermissionService

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionService {
    // NestJS가 자동으로 하나의 인스턴스만 생성하여 컨테이너에 관리함
    constructor(private prisma: PrismaService) {}

    async canCompleteStep(userId: string, stepInstanceId: number): Promise<boolean> {
        // ...비즈니스 로직
        return true;
    }
}
```

**주의할 점:**
- NestJS에서는 `Scope.REQUEST`나 `Scope.TRANSIENT` 옵션을 주입할 때 지정하지 않는 이상 100% 싱글턴입니다. 따라서 싱글턴 클래스의 내부 전역 상태(state) 변경에는 각별한 주의가 필요합니다. 캐시 등은 Redis 같은 외부 스토리지나 공통 캐시 모듈을 사용하는 것을 권장합니다.

## 리포지토리 패턴

### 리포지토리의 목적

**리포지토리는 데이터 접근을 추상화합니다** - 데이터 작업에서 “어떻게”에 해당하는 부분입니다:

```
Service: "Get me all active users sorted by name"
Repository: "Here's the Prisma query that does that"
```

**리포지토리의 책임:**
- ✅ 모든 Prisma 작업
- ✅ 쿼리 구성
- ✅ 쿼리 최적화(select, include)
- ✅ DB 에러 처리
- ✅ DB 결과 캐싱

**리포지토리가 하면 안 되는 것:**
- ❌ 비즈니스 로직 포함
- ❌ HTTP를 앎
- ❌ 의사결정을 함(그건 서비스 레이어)

### 리포지토리 템플릿

```typescript
// repositories/UserRepository.ts
import { PrismaService } from '@project-lifecycle-portal/database';
import type { User, Prisma } from '@project-lifecycle-portal/database';

export class UserRepository {
    /**
     * Find user by ID with optimized query
     */
    async findById(userId: string): Promise<User | null> {
        try {
            return await PrismaService.main.user.findUnique({
                where: { userID: userId },
                select: {
                    userID: true,
                    email: true,
                    name: true,
                    isActive: true,
                    roles: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
        } catch (error) {
            console.error('[UserRepository] Error finding user by ID:', error);
            throw new Error(`Failed to find user: ${userId}`);
        }
    }

    /**
     * Find all active users
     */
    async findActive(options?: { orderBy?: Prisma.UserOrderByWithRelationInput }): Promise<User[]> {
        try {
            return await PrismaService.main.user.findMany({
                where: { isActive: true },
                orderBy: options?.orderBy || { name: 'asc' },
                select: {
                    userID: true,
                    email: true,
                    name: true,
                    roles: true,
                },
            });
        } catch (error) {
            console.error('[UserRepository] Error finding active users:', error);
            throw new Error('Failed to find active users');
        }
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<User | null> {
        try {
            return await PrismaService.main.user.findUnique({
                where: { email },
            });
        } catch (error) {
            console.error('[UserRepository] Error finding user by email:', error);
            throw new Error(`Failed to find user with email: ${email}`);
        }
    }

    /**
     * Create new user
     */
    async create(data: Prisma.UserCreateInput): Promise<User> {
        try {
            return await PrismaService.main.user.create({ data });
        } catch (error) {
            console.error('[UserRepository] Error creating user:', error);
            throw new Error('Failed to create user');
        }
    }

    /**
     * Update user
     */
    async update(userId: string, data: Prisma.UserUpdateInput): Promise<User> {
        try {
            return await PrismaService.main.user.update({
                where: { userID: userId },
                data,
            });
        } catch (error) {
            console.error('[UserRepository] Error updating user:', error);
            throw new Error(`Failed to update user: ${userId}`);
        }
    }

    /**
     * Delete user (soft delete by setting isActive = false)
     */
    async delete(userId: string): Promise<User> {
        try {
            return await PrismaService.main.user.update({
                where: { userID: userId },
                data: { isActive: false },
            });
        } catch (error) {
            console.error('[UserRepository] Error deleting user:', error);
            throw new Error(`Failed to delete user: ${userId}`);
        }
    }

    /**
     * Check if email exists
     */
    async emailExists(email: string): Promise<boolean> {
        try {
            const count = await PrismaService.main.user.count({
                where: { email },
            });
            return count > 0;
        } catch (error) {
            console.error('[UserRepository] Error checking email exists:', error);
            throw new Error('Failed to check if email exists');
        }
    }
}

// Export singleton instance
export const userRepository = new UserRepository();
```

**서비스에서 리포지토리 사용:**

```typescript
// services/userService.ts
import { userRepository } from '../repositories/UserRepository';
import { ConflictError, NotFoundError } from '../utils/errors';

export class UserService {
    /**
     * Create new user with business rules
     */
    async createUser(data: { email: string; name: string; roles: string[] }): Promise<User> {
        // Business rule: Check if email already exists
        const emailExists = await userRepository.emailExists(data.email);
        if (emailExists) {
            throw new ConflictError('Email already exists');
        }

        // Business rule: Validate roles
        const validRoles = ['admin', 'operations', 'user'];
        const invalidRoles = data.roles.filter((role) => !validRoles.includes(role));
        if (invalidRoles.length > 0) {
            throw new ValidationError(`Invalid roles: ${invalidRoles.join(', ')}`);
        }

        // Create user via repository
        return await userRepository.create({
            email: data.email,
            name: data.name,
            roles: data.roles,
            isActive: true,
        });
    }

    /**
     * Get user by ID
     */
    async getUser(userId: string): Promise<User> {
        const user = await userRepository.findById(userId);

        if (!user) {
            throw new NotFoundError(`User not found: ${userId}`);
        }

        return user;
    }
}
```

---

## 서비스 설계 원칙

### 1. 단일 책임(Single Responsibility)

각 서비스는 명확한 단 하나의 목적을 가져야 합니다:

```typescript
// ✅ GOOD - Single responsibility
class UserService {
    async createUser() {}
    async updateUser() {}
    async deleteUser() {}
}

class EmailService {
    async sendEmail() {}
    async sendBulkEmails() {}
}

// ❌ BAD - Too many responsibilities
class UserService {
    async createUser() {}
    async sendWelcomeEmail() {}  // Should be EmailService
    async logUserActivity() {}   // Should be AuditService
    async processPayment() {}    // Should be PaymentService
}
```

### 2. 명확한 메서드 이름

메서드 이름은 “무엇을 하는지”를 설명해야 합니다:

```typescript
// ✅ GOOD - Clear intent
async createNotification()
async getUserPreferences()
async shouldBatchEmail()
async routeNotification()

// ❌ BAD - Vague or misleading
async process()
async handle()
async doIt()
async execute()
```

### 3. 반환 타입

항상 명시적인 반환 타입을 사용하세요:

```typescript
// ✅ GOOD - Explicit types
async createUser(data: CreateUserDTO): Promise<User> {}
async findUsers(): Promise<User[]> {}
async deleteUser(id: string): Promise<void> {}

// ❌ BAD - Implicit any
async createUser(data) {}  // No types!
```

### 4. 에러 처리

서비스 단위에서 비즈니스적인 문제가 발견되면 즉시 NestJS 기본 내장 HttpException 파생 클래스를 던집니다:

```typescript
import { NotFoundException, ConflictException } from '@nestjs/common';

// ✅ GOOD - NestJS Exceptions
if (!user) {
    throw new NotFoundException(`User not found: ${userId}`);
}

if (emailExists) {
    throw new ConflictException('Email already exists');
}
```

### 5. God Service 피하기

모든 일을 다 하는 서비스를 만들지 마세요:

```typescript
// ❌ BAD - God service
class WorkflowService {
    async startWorkflow() {}
    async completeStep() {}
    async assignRoles() {}
    async sendNotifications() {}  // Should be NotificationService
    async validatePermissions() {}  // Should be PermissionService
    async logAuditTrail() {}  // Should be AuditService
    // ... 50 more methods
}

// ✅ GOOD - Focused services
class WorkflowService {
    constructor(
        private notificationService: NotificationService,
        private permissionService: PermissionService,
        private auditService: AuditService
    ) {}

    async startWorkflow() {
        // Orchestrate other services
        await this.permissionService.checkPermission();
        await this.workflowRepository.create();
        await this.notificationService.notify();
        await this.auditService.log();
    }
}
```

---

## 캐싱 전략

### 1. 인메모리 캐싱

```typescript
class UserService {
    private cache: Map<string, { user: User; timestamp: number }> = new Map();
    private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    async getUser(userId: string): Promise<User> {
        // Check cache
        const cached = this.cache.get(userId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.user;
        }

        // Fetch from database
        const user = await userRepository.findById(userId);

        // Update cache
        if (user) {
            this.cache.set(userId, { user, timestamp: Date.now() });
        }

        return user;
    }

    clearUserCache(userId: string): void {
        this.cache.delete(userId);
    }
}
```

### 2. 캐시 무효화

```typescript
class UserService {
    async updateUser(userId: string, data: UpdateUserDTO): Promise<User> {
        // Update in database
        const user = await userRepository.update(userId, data);

        // Invalidate cache
        this.clearUserCache(userId);

        return user;
    }
}
```

---

## 서비스 테스트

### 유닛 테스트

```typescript
// src/users/user.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserRepository } from './repositories/user.repository';
import { ConflictException } from '@nestjs/common';

describe('UserService', () => {
    let service: UserService;
    let repository: jest.Mocked<UserRepository>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: UserRepository,
                    useValue: {
                        emailExists: jest.fn(),
                        create: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
        repository = module.get(UserRepository);
    });

    describe('createUser', () => {
        it('should create user', async () => {
            repository.emailExists.mockResolvedValue(false);
            repository.create.mockResolvedValue({ id: '1', email: 'test@test.com' } as any);

            const result = await service.createUser({ email: 'test@test.com', name: 'Test' });
            expect(result).toBeDefined();
        });

        it('should throw ConflictException if email exists', async () => {
            repository.emailExists.mockResolvedValue(true);

            await expect(service.createUser({ email: 'existing@test.com', name: 'Test' }))
                .rejects.toThrow(ConflictException);
        });
    });
});
```

---

**관련 파일:**
- [SKILL.md](SKILL.md) - 메인 가이드
- [routing-and-controllers.md](routing-and-controllers.md) - 서비스를 사용하는 컨트롤러
- [database-patterns.md](database-patterns.md) - Prisma 및 리포지토리 패턴
- [complete-examples.md](complete-examples.md) - 서비스/리포지토리 전체 예제
