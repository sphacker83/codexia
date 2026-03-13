---
name: error-tracking
description: 프로젝트 서비스에 Sentry v8 에러 트래킹과 성능 모니터링을 추가합니다. 에러 처리를 추가하거나, 새 컨트롤러를 만들거나, 크론 잡을 계측하거나, DB 성능을 추적할 때 이 스킬을 사용하세요. **모든 에러는 예외 없이 Sentry로 캡처해야 합니다** — 예외 없음.
---

# 프로젝트 Sentry 통합 스킬

## 목적
이 스킬은 Sentry v8 패턴을 따라 프로젝트의 모든 서비스에서 포괄적인 Sentry 에러 트래킹과 성능 모니터링을 강제합니다.

## 이 스킬을 사용해야 하는 경우
- 어떤 코드든 에러 처리를 추가할 때
- 새 컨트롤러나 라우트를 만들 때
- 크론 잡을 계측(instrument)할 때
- 데이터베이스 성능을 추적할 때
- 성능 스팬(span)을 추가할 때
- 워크플로 에러를 처리할 때

## 🚨 핵심 규칙

**모든 에러는 반드시 Sentry로 캡처해야 합니다** - 예외 없음. console.error만 사용하는 일은 절대 금지입니다.

## 현재 상태

### Form Service ✅ 완료
- Sentry v8 완전 통합
- 모든 워크플로 에러 추적
- SystemActionQueueProcessor 계측됨
- 테스트 엔드포인트 제공

### Email Service 🟡 진행 중
- Phase 1-2 완료(22개 작업 중 6개)
- ErrorLogger.log() 호출 189개 남음

## Sentry 통합 패턴

### 1. 컨트롤러 에러 처리

```typescript
// ✅ 올바름 - BaseController 사용
import { BaseController } from '../controllers/BaseController';

export class MyController extends BaseController {
    async myMethod() {
        try {
            // ... 코드
        } catch (error) {
            this.handleError(error, 'myMethod'); // 자동으로 Sentry로 전송됨
        }
    }
}
```

### 2. 라우트 에러 처리(BaseController 없이)

```typescript
import * as Sentry from '@sentry/node';

router.get('/route', async (req, res) => {
    try {
        // ... 코드
    } catch (error) {
        Sentry.captureException(error, {
            tags: { route: '/route', method: 'GET' },
            extra: { userId: req.user?.id }
        });
        res.status(500).json({ error: '내부 서버 오류' });
    }
});
```

### 3. 워크플로 에러 처리

```typescript
import { WorkflowSentryHelper } from '../workflow/utils/sentryHelper';

// ✅ 올바름 - WorkflowSentryHelper 사용
WorkflowSentryHelper.captureWorkflowError(error, {
    workflowCode: 'DHS_CLOSEOUT',
    instanceId: 123,
    stepId: 456,
    userId: 'user-123',
    operation: 'stepCompletion',
    metadata: { additionalInfo: 'value' }
});
```

### 4. 크론 잡(필수 패턴)

```typescript
#!/usr/bin/env node
// shebang 다음 첫 줄 - 매우 중요!
import '../instrument';
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
            // 크론 잡 로직
        } catch (error) {
            Sentry.captureException(error, {
                tags: {
                    'cron.job': 'job-name',
                    'error.type': 'execution_error'
                }
            });
            console.error('[Job] 오류:', error);
            process.exit(1);
        }
    });
}

main()
    .then(() => {
        console.log('[Job] 성공적으로 완료');
        process.exit(0);
    })
    .catch((error) => {
        console.error('[Job] 치명적 오류:', error);
        process.exit(1);
    });
```

### 5. 데이터베이스 성능 모니터링

```typescript
import { DatabasePerformanceMonitor } from '../utils/databasePerformance';

// ✅ 올바름 - DB 작업을 래핑
const result = await DatabasePerformanceMonitor.withPerformanceTracking(
    'findMany',
    'UserProfile',
    async () => {
        return await PrismaService.main.userProfile.findMany({
            take: 5,
        });
    }
);
```

### 6. 스팬을 사용한 비동기 작업

```typescript
import * as Sentry from '@sentry/node';

const result = await Sentry.startSpan({
    name: 'operation.name',
    op: 'operation.type',
    attributes: {
        'custom.attribute': 'value'
    }
}, async () => {
    // 비동기 작업
    return await someAsyncOperation();
});
```

## 에러 레벨

상황에 맞는 심각도(severity) 레벨을 사용하세요:

- **fatal**: 시스템 사용 불가(DB 다운, 핵심 서비스 장애)
- **error**: 작업 실패, 즉시 조치 필요
- **warning**: 복구 가능한 이슈, 성능 저하
- **info**: 정보성 메시지, 성공한 작업
- **debug**: 상세 디버깅 정보(개발 환경 전용)

## 필수 컨텍스트

```typescript
import * as Sentry from '@sentry/node';

Sentry.withScope((scope) => {
    // 가능하면 항상 포함
    scope.setUser({ id: userId });
    scope.setTag('service', 'form'); // 또는 'email', 'users' 등
    scope.setTag('environment', process.env.NODE_ENV);

    // 작업별 컨텍스트 추가
    scope.setContext('operation', {
        type: 'workflow.start',
        workflowCode: 'DHS_CLOSEOUT',
        entityId: 123
    });

    Sentry.captureException(error);
});
```

## 서비스별 통합

### Form Service

**위치**: `./blog-api/src/instrument.ts`

```typescript
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
        nodeProfilingIntegration(),
    ],
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
});
```

**핵심 헬퍼**:
- `WorkflowSentryHelper` - 워크플로 전용 에러
- `DatabasePerformanceMonitor` - DB 쿼리 추적
- `BaseController` - 컨트롤러 에러 처리

### Email Service

**위치**: `./notifications/src/instrument.ts`

```typescript
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
        nodeProfilingIntegration(),
    ],
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
});
```

**핵심 헬퍼**:
- `EmailSentryHelper` - 이메일 전용 에러
- `BaseController` - 컨트롤러 에러 처리

## 설정(config.ini)

```ini
[sentry]
dsn = your-sentry-dsn
environment = development
tracesSampleRate = 0.1
profilesSampleRate = 0.1

[databaseMonitoring]
enableDbTracing = true
slowQueryThreshold = 100
logDbQueries = false
dbErrorCapture = true
enableN1Detection = true
```

## Sentry 통합 테스트

### Form Service 테스트 엔드포인트

```bash
# 기본 에러 캡처 테스트
curl http://localhost:3002/blog-api/api/sentry/test-error

# 워크플로 에러 테스트
curl http://localhost:3002/blog-api/api/sentry/test-workflow-error

# DB 성능 테스트
curl http://localhost:3002/blog-api/api/sentry/test-database-performance

# 에러 바운더리 테스트
curl http://localhost:3002/blog-api/api/sentry/test-error-boundary
```

### Email Service 테스트 엔드포인트

```bash
# 기본 에러 캡처 테스트
curl http://localhost:3003/notifications/api/sentry/test-error

# 이메일 전용 에러 테스트
curl http://localhost:3003/notifications/api/sentry/test-email-error

# 성능 추적 테스트
curl http://localhost:3003/notifications/api/sentry/test-performance
```

## 성능 모니터링

### 요구사항

1. **모든 API 엔드포인트**는 트랜잭션 추적이 있어야 함
2. **100ms 초과 DB 쿼리**는 자동으로 플래그됨
3. **N+1 쿼리**는 탐지되어 보고됨
4. **크론 잡**은 실행 시간을 반드시 추적해야 함

### 트랜잭션 추적

```typescript
import * as Sentry from '@sentry/node';

// Express 라우트에 대한 자동 트랜잭션 추적
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// 커스텀 작업을 위한 수동 트랜잭션
const transaction = Sentry.startTransaction({
    op: 'operation.type',
    name: 'Operation Name',
});

try {
    // 작업 수행
} finally {
    transaction.finish();
}
```

## 피해야 할 흔한 실수

❌ Sentry 없이 console.error 사용은 **절대 금지**
❌ 에러를 조용히 삼키는 것 **절대 금지**
❌ 에러 컨텍스트에 민감 정보 노출 **절대 금지**
❌ 컨텍스트 없는 일반적인 에러 메시지 **절대 금지**
❌ 비동기 작업에서 에러 처리를 건너뛰는 것 **절대 금지**
❌ 크론 잡에서 instrument.ts를 첫 줄로 import하지 않는 것 **절대 금지**

## 구현 체크리스트

새 코드에 Sentry를 추가할 때:

- [ ] Sentry 또는 적절한 헬퍼를 import 했는가
- [ ] 모든 try/catch 블록이 Sentry로 캡처하는가
- [ ] 에러에 의미 있는 컨텍스트를 추가했는가
- [ ] 적절한 에러 레벨을 사용했는가
- [ ] 에러 메시지에 민감 정보가 없는가
- [ ] 느린 작업에 대한 성능 추적을 추가했는가
- [ ] 에러 처리 경로를 테스트했는가
- [ ] 크론 잡의 경우: instrument.ts를 첫 줄로 import 했는가

## 핵심 파일

### Form Service
- `/blog-api/src/instrument.ts` - Sentry 초기화
- `/blog-api/src/workflow/utils/sentryHelper.ts` - 워크플로 에러
- `/blog-api/src/utils/databasePerformance.ts` - DB 모니터링
- `/blog-api/src/controllers/BaseController.ts` - 컨트롤러 베이스

### Email Service
- `/notifications/src/instrument.ts` - Sentry 초기화
- `/notifications/src/utils/EmailSentryHelper.ts` - 이메일 에러
- `/notifications/src/controllers/BaseController.ts` - 컨트롤러 베이스

### 설정
- `/blog-api/config.ini` - Form service 설정
- `/notifications/config.ini` - Email service 설정
- `/sentry.ini` - 공유 Sentry 설정

## 문서

- 전체 구현: `/dev/active/email-sentry-integration/`
- Form service 문서: `/blog-api/docs/sentry-integration.md`
- Email service 문서: `/notifications/docs/sentry-integration.md`

## 관련 스킬

- DB 작업 전에 **database-verification** 사용
- 워크플로 에러 컨텍스트는 **workflow-builder** 사용
- DB 에러 처리는 **database-scripts** 사용
