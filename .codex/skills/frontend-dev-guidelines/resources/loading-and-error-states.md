# 로딩 & 에러 상태

**중요(CRITICAL)**: 로딩/에러 상태를 올바르게 처리하면 레이아웃 시프트를 방지하고 더 나은 사용자 경험을 제공합니다.

---

## ⚠️ 핵심 규칙: 조기 return(early return) 금지

### 문제

```typescript
// ❌ NEVER DO THIS - Early return with loading spinner
const Component = () => {
    const { data, isLoading } = useQuery();

    // WRONG: This causes layout shift and poor UX
    if (isLoading) {
        return <LoadingSpinner />;
    }

    return <Content data={data} />;
};
```

**왜 나쁜가:**
1. **레이아웃 시프트(Layout Shift)**: 로딩이 끝날 때 콘텐츠 위치가 점프함
2. **CLS (Cumulative Layout Shift)**: Core Web Vitals 점수가 나빠짐
3. **불쾌한 UX**: 페이지 구조가 갑자기 바뀜
4. **스크롤 위치 손실**: 사용자가 보던 위치를 잃음

### 해결책

**옵션 1: SuspenseLoader(새 컴포넌트에 권장)**

```typescript
import { SuspenseLoader } from '~components/SuspenseLoader';

const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

export const MyComponent: React.FC = () => {
    return (
        <SuspenseLoader>
            <HeavyComponent />
        </SuspenseLoader>
    );
};
```

**옵션 2: LoadingOverlay(레거시 useQuery 패턴용)**

```typescript
import { LoadingOverlay } from '~components/LoadingOverlay';

export const MyComponent: React.FC = () => {
    const { data, isLoading } = useQuery({ ... });

    return (
        <LoadingOverlay loading={isLoading}>
            <Content data={data} />
        </LoadingOverlay>
    );
};
```

---

## SuspenseLoader 컴포넌트

### 하는 일

- 지연 로딩 컴포넌트가 로드되는 동안 로딩 인디케이터 표시
- 부드러운 fade-in 애니메이션
- 레이아웃 시프트 방지
- 앱 전반에서 일관된 로딩 경험

### Import

```typescript
import { SuspenseLoader } from '~components/SuspenseLoader';
// Or
import { SuspenseLoader } from '@/components/SuspenseLoader';
```

### 기본 사용법

```typescript
<SuspenseLoader>
    <LazyLoadedComponent />
</SuspenseLoader>
```

### useSuspenseQuery와 함께 사용

```typescript
import { useSuspenseQuery } from '@tanstack/react-query';
import { SuspenseLoader } from '~components/SuspenseLoader';

const Inner: React.FC = () => {
    // No isLoading needed!
    const { data } = useSuspenseQuery({
        queryKey: ['data'],
        queryFn: () => api.getData(),
    });

    return <Display data={data} />;
};

// Outer component wraps in Suspense
export const Outer: React.FC = () => {
    return (
        <SuspenseLoader>
            <Inner />
        </SuspenseLoader>
    );
};
```

### 여러 Suspense 경계

**패턴**: 서로 독립적인 섹션별로 로딩을 분리

```typescript
export const Dashboard: React.FC = () => {
    return (
        <Box>
            <SuspenseLoader>
                <Header />
            </SuspenseLoader>

            <SuspenseLoader>
                <MainContent />
            </SuspenseLoader>

            <SuspenseLoader>
                <Sidebar />
            </SuspenseLoader>
        </Box>
    );
};
```

**장점:**
- 각 섹션이 독립적으로 로드됨
- 사용자가 일부 콘텐츠를 더 빨리 볼 수 있음
- 체감 성능 향상

### 중첩 Suspense

```typescript
export const ParentComponent: React.FC = () => {
    return (
        <SuspenseLoader>
            {/* Parent suspends while loading */}
            <ParentContent>
                <SuspenseLoader>
                    {/* Nested suspense for child */}
                    <ChildComponent />
                </SuspenseLoader>
            </ParentContent>
        </SuspenseLoader>
    );
};
```

---

## LoadingOverlay 컴포넌트

### 사용 시점

- `useQuery`를 쓰는 레거시 컴포넌트(아직 Suspense로 리팩터링하지 않음)
- 오버레이 형태의 로딩 상태가 필요함
- Suspense 경계를 사용할 수 없음

### 사용법

```typescript
import { LoadingOverlay } from '~components/LoadingOverlay';

export const MyComponent: React.FC = () => {
    const { data, isLoading } = useQuery({
        queryKey: ['data'],
        queryFn: () => api.getData(),
    });

    return (
        <LoadingOverlay loading={isLoading}>
            <Box sx={{ p: 2 }}>
                {data && <Content data={data} />}
            </Box>
        </LoadingOverlay>
    );
};
```

**하는 일:**
- 스피너가 있는 반투명 오버레이 표시
- 콘텐츠 영역을 미리 확보(레이아웃 시프트 없음)
- 로딩 중 상호작용 방지

---

## 에러 처리

### useMuiSnackbar 훅(필수)

**react-toastify는 절대 사용하지 마세요** - 프로젝트 표준은 MUI Snackbar입니다.

```typescript
import { useMuiSnackbar } from '@/hooks/useMuiSnackbar';

export const MyComponent: React.FC = () => {
    const { showSuccess, showError, showInfo, showWarning } = useMuiSnackbar();

    const handleAction = async () => {
        try {
            await api.doSomething();
            showSuccess('Operation completed successfully');
        } catch (error) {
            showError('Operation failed');
        }
    };

    return <Button onClick={handleAction}>Do Action</Button>;
};
```

**사용 가능한 메서드:**
- `showSuccess(message)` - 초록색 성공 메시지
- `showError(message)` - 빨간색 에러 메시지
- `showWarning(message)` - 주황색 경고 메시지
- `showInfo(message)` - 파란색 정보 메시지

### TanStack Query 에러 콜백

```typescript
import { useSuspenseQuery } from '@tanstack/react-query';
import { useMuiSnackbar } from '@/hooks/useMuiSnackbar';

export const MyComponent: React.FC = () => {
    const { showError } = useMuiSnackbar();

    const { data } = useSuspenseQuery({
        queryKey: ['data'],
        queryFn: () => api.getData(),

        // Handle errors
        onError: (error) => {
            showError('Failed to load data');
            console.error('Query error:', error);
        },
    });

    return <Content data={data} />;
};
```

### 에러 바운더리(Error Boundaries)

```typescript
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
    return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant='h5' color='error'>
                Something went wrong
            </Typography>
            <Typography>{error.message}</Typography>
            <Button onClick={resetErrorBoundary}>Try Again</Button>
        </Box>
    );
}

export const MyPage: React.FC = () => {
    return (
        <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onError={(error) => console.error('Boundary caught:', error)}
        >
            <SuspenseLoader>
                <ComponentThatMightError />
            </SuspenseLoader>
        </ErrorBoundary>
    );
};
```

---

## 완성 예제

### 예제 1: Suspense를 사용하는 현대적 컴포넌트

```typescript
import React from 'react';
import { Box, Paper } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SuspenseLoader } from '~components/SuspenseLoader';
import { myFeatureApi } from '../api/myFeatureApi';

// Inner component uses useSuspenseQuery
const InnerComponent: React.FC<{ id: number }> = ({ id }) => {
    const { data } = useSuspenseQuery({
        queryKey: ['entity', id],
        queryFn: () => myFeatureApi.getEntity(id),
    });

    // data is always defined - no isLoading needed!
    return (
        <Paper sx={{ p: 2 }}>
            <h2>{data.title}</h2>
            <p>{data.description}</p>
        </Paper>
    );
};

// Outer component provides Suspense boundary
export const OuterComponent: React.FC<{ id: number }> = ({ id }) => {
    return (
        <Box>
            <SuspenseLoader>
                <InnerComponent id={id} />
            </SuspenseLoader>
        </Box>
    );
};

export default OuterComponent;
```

### 예제 2: LoadingOverlay를 사용하는 레거시 패턴

```typescript
import React from 'react';
import { Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { LoadingOverlay } from '~components/LoadingOverlay';
import { myFeatureApi } from '../api/myFeatureApi';

export const LegacyComponent: React.FC<{ id: number }> = ({ id }) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['entity', id],
        queryFn: () => myFeatureApi.getEntity(id),
    });

    return (
        <LoadingOverlay loading={isLoading}>
            <Box sx={{ p: 2 }}>
                {error && <ErrorDisplay error={error} />}
                {data && <Content data={data} />}
            </Box>
        </LoadingOverlay>
    );
};
```

### 예제 3: Snackbar를 사용하는 에러 처리

```typescript
import React from 'react';
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@mui/material';
import { useMuiSnackbar } from '@/hooks/useMuiSnackbar';
import { myFeatureApi } from '../api/myFeatureApi';

export const EntityEditor: React.FC<{ id: number }> = ({ id }) => {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useMuiSnackbar();

    const { data } = useSuspenseQuery({
        queryKey: ['entity', id],
        queryFn: () => myFeatureApi.getEntity(id),
        onError: () => {
            showError('Failed to load entity');
        },
    });

    const updateMutation = useMutation({
        mutationFn: (updates) => myFeatureApi.update(id, updates),

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entity', id] });
            showSuccess('Entity updated successfully');
        },

        onError: () => {
            showError('Failed to update entity');
        },
    });

    return (
        <Button onClick={() => updateMutation.mutate({ name: 'New' })}>
            Update
        </Button>
    );
};
```

---

## 로딩 상태 안티패턴

### ❌ 하지 말아야 할 것

```typescript
// ❌ NEVER - Early return
if (isLoading) {
    return <CircularProgress />;
}

// ❌ NEVER - Conditional rendering
{isLoading ? <Spinner /> : <Content />}

// ❌ NEVER - Layout changes
if (isLoading) {
    return (
        <Box sx={{ height: 100 }}>
            <Spinner />
        </Box>
    );
}
return (
    <Box sx={{ height: 500 }}>  // Different height!
        <Content />
    </Box>
);
```

### ✅ 해야 할 것

```typescript
// ✅ BEST - useSuspenseQuery + SuspenseLoader
<SuspenseLoader>
    <ComponentWithSuspenseQuery />
</SuspenseLoader>

// ✅ ACCEPTABLE - LoadingOverlay
<LoadingOverlay loading={isLoading}>
    <Content />
</LoadingOverlay>

// ✅ OK - Inline skeleton with same layout
<Box sx={{ height: 500 }}>
    {isLoading ? <Skeleton variant='rectangular' height='100%' /> : <Content />}
</Box>
```

---

## 스켈레톤 로딩(대안)

### MUI Skeleton 컴포넌트

```typescript
import { Skeleton, Box } from '@mui/material';

export const MyComponent: React.FC = () => {
    const { data, isLoading } = useQuery({ ... });

    return (
        <Box sx={{ p: 2 }}>
            {isLoading ? (
                <>
                    <Skeleton variant='text' width={200} height={40} />
                    <Skeleton variant='rectangular' width='100%' height={200} />
                    <Skeleton variant='text' width='100%' />
                </>
            ) : (
                <>
                    <Typography variant='h5'>{data.title}</Typography>
                    <img src={data.image} />
                    <Typography>{data.description}</Typography>
                </>
            )}
        </Box>
    );
};
```

**핵심**: Skeleton은 실제 콘텐츠와 **같은 레이아웃**을 가져야 합니다(시프트 없음).

---

## 요약

**로딩 상태:**
- ✅ **PREFERRED**: SuspenseLoader + useSuspenseQuery (modern pattern)
- ✅ **ACCEPTABLE**: LoadingOverlay (legacy pattern)
- ✅ **OK**: Skeleton with same layout
- ❌ **NEVER**: Early returns or conditional layout

**에러 처리:**
- ✅ **ALWAYS**: useMuiSnackbar for user feedback
- ❌ **NEVER**: react-toastify
- ✅ Use onError callbacks in queries/mutations
- ✅ Error boundaries for component-level errors

**함께 보기:**
- [component-patterns.md](component-patterns.md) - Suspense integration
- [data-fetching.md](data-fetching.md) - useSuspenseQuery details
