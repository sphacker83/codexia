# 컴포넌트 패턴

타입 안정성, 지연 로딩(lazy loading), Suspense 경계를 강조하는 애플리케이션용 현대적 React 컴포넌트 아키텍처입니다.

---

## React.FC 패턴(권장)

### React.FC를 쓰는 이유

모든 컴포넌트는 다음 이유로 `React.FC<Props>` 패턴을 사용합니다:
- props에 대한 명시적 타입 안정성
- 일관된 컴포넌트 시그니처
- 명확한 props 인터페이스 문서화
- 더 나은 IDE 자동완성

### 기본 패턴

```typescript
import React from 'react';

interface MyComponentProps {
    /** User ID to display */
    userId: number;
    /** Optional callback when action occurs */
    onAction?: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ userId, onAction }) => {
    return (
        <div>
            User: {userId}
        </div>
    );
};

export default MyComponent;
```

**핵심 포인트:**
- JSDoc 주석과 함께 props 인터페이스를 별도로 정의
- `React.FC<Props>`가 타입 안정성을 제공
- 파라미터에서 props를 구조 분해
- 기본 export는 파일 하단에 위치

---

## 지연 로딩 패턴

### 지연 로딩이 필요한 경우

다음과 같은 컴포넌트는 지연 로딩하세요:
- 무거운 컴포넌트(DataGrid, 차트, 리치 텍스트 에디터)
- 라우트 레벨 컴포넌트
- 모달/다이얼로그 콘텐츠(초기에는 보이지 않음)
- 첫 화면 아래(below-the-fold) 콘텐츠

### 지연 로딩 방법

```typescript
import React from 'react';

// Lazy load heavy component
const PostDataGrid = React.lazy(() =>
    import('./grids/PostDataGrid')
);

// For named exports
const MyComponent = React.lazy(() =>
    import('./MyComponent').then(module => ({
        default: module.MyComponent
    }))
);
```

**PostTable.tsx 예시:**

```typescript
/**
 * Main post table container component
 */
import React, { useState, useCallback } from 'react';
import { Box, Paper } from '@mui/material';

// Lazy load PostDataGrid to optimize bundle size
const PostDataGrid = React.lazy(() => import('./grids/PostDataGrid'));

import { SuspenseLoader } from '~components/SuspenseLoader';

export const PostTable: React.FC<PostTableProps> = ({ formId }) => {
    return (
        <Box>
            <SuspenseLoader>
                <PostDataGrid formId={formId} />
            </SuspenseLoader>
        </Box>
    );
};

export default PostTable;
```

---

## Suspense 경계(Boundaries)

### SuspenseLoader 컴포넌트

**Import:**
```typescript
import { SuspenseLoader } from '~components/SuspenseLoader';
// Or
import { SuspenseLoader } from '@/components/SuspenseLoader';
```

**사용법:**
```typescript
<SuspenseLoader>
    <LazyLoadedComponent />
</SuspenseLoader>
```

**하는 일:**
- 지연 로딩 컴포넌트가 로드되는 동안 로딩 인디케이터 표시
- 부드러운 fade-in 애니메이션
- 일관된 로딩 경험
- 레이아웃 시프트 방지

### Suspense 경계를 둘 위치

**라우트 레벨:**
```typescript
'use client';

// app/my-route/page.tsx (App Router)
import dynamic from 'next/dynamic';

const MyPage = dynamic(() => import('@/features/my-feature/components/MyPage'), {
    loading: () => null,
});

export default function Page() {
    return (
        <SuspenseLoader>
            <MyPage />
        </SuspenseLoader>
    );
}
```

**컴포넌트 레벨:**
```typescript
function ParentComponent() {
    return (
        <Box>
            <Header />
            <SuspenseLoader>
                <HeavyDataGrid />
            </SuspenseLoader>
        </Box>
    );
}
```

**여러 경계:**
```typescript
function Page() {
    return (
        <Box>
            <SuspenseLoader>
                <HeaderSection />
            </SuspenseLoader>

            <SuspenseLoader>
                <MainContent />
            </SuspenseLoader>

            <SuspenseLoader>
                <Sidebar />
            </SuspenseLoader>
        </Box>
    );
}
```

각 섹션이 독립적으로 로드되어 UX가 더 좋아집니다.

---

## 컴포넌트 구조 템플릿

### 권장 순서

```typescript
/**
 * Component description
 * What it does, when to use it
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Paper, Button } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';

// Feature imports
import { myFeatureApi } from '../api/myFeatureApi';
import type { MyData } from '~types/myData';

// Component imports
import { SuspenseLoader } from '~components/SuspenseLoader';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useMuiSnackbar } from '@/hooks/useMuiSnackbar';

// 1. PROPS INTERFACE (with JSDoc)
interface MyComponentProps {
    /** The ID of the entity to display */
    entityId: number;
    /** Optional callback when action completes */
    onComplete?: () => void;
    /** Display mode */
    mode?: 'view' | 'edit';
}

// 2. STYLES (if inline and <100 lines)
const componentStyles: Record<string, SxProps<Theme>> = {
    container: {
        p: 2,
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        mb: 2,
        display: 'flex',
        justifyContent: 'space-between',
    },
};

// 3. COMPONENT DEFINITION
export const MyComponent: React.FC<MyComponentProps> = ({
    entityId,
    onComplete,
    mode = 'view',
}) => {
    // 4. HOOKS (in this order)
    // - Context hooks first
    const { user } = useAuth();
    const { showSuccess, showError } = useMuiSnackbar();

    // - Data fetching
    const { data } = useSuspenseQuery({
        queryKey: ['myEntity', entityId],
        queryFn: () => myFeatureApi.getEntity(entityId),
    });

    // - Local state
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(mode === 'edit');

    // - Memoized values
    const filteredData = useMemo(() => {
        return data.filter(item => item.active);
    }, [data]);

    // - Effects
    useEffect(() => {
        // Setup
        return () => {
            // Cleanup
        };
    }, []);

    // 5. EVENT HANDLERS (with useCallback)
    const handleItemSelect = useCallback((itemId: string) => {
        setSelectedItem(itemId);
    }, []);

    const handleSave = useCallback(async () => {
        try {
            await myFeatureApi.updateEntity(entityId, { /* data */ });
            showSuccess('Entity updated successfully');
            onComplete?.();
        } catch (error) {
            showError('Failed to update entity');
        }
    }, [entityId, onComplete, showSuccess, showError]);

    // 6. RENDER
    return (
        <Box sx={componentStyles.container}>
            <Box sx={componentStyles.header}>
                <h2>My Component</h2>
                <Button onClick={handleSave}>Save</Button>
            </Box>

            <Paper sx={{ p: 2 }}>
                {filteredData.map(item => (
                    <div key={item.id}>{item.name}</div>
                ))}
            </Paper>
        </Box>
    );
};

// 7. EXPORT (default export at bottom)
export default MyComponent;
```

---

## 컴포넌트 분리

### 컴포넌트를 분리해야 하는 경우

**다음이라면 여러 컴포넌트로 분리하세요:**
- 컴포넌트가 300줄을 초과함
- 서로 다른 책임이 여러 개 존재함
- 재사용 가능한 섹션이 있음
- 중첩 JSX가 복잡함

**예시:**

```typescript
// ❌ AVOID - Monolithic
function MassiveComponent() {
    // 500+ lines
    // Search logic
    // Filter logic
    // Grid logic
    // Action panel logic
}

// ✅ PREFERRED - Modular
function ParentContainer() {
    return (
        <Box>
            <SearchAndFilter onFilter={handleFilter} />
            <DataGrid data={filteredData} />
            <ActionPanel onAction={handleAction} />
        </Box>
    );
}
```

### 함께 두어도 되는 경우

**다음이라면 같은 파일에 두어도 됩니다:**
- 컴포넌트가 200줄 미만
- 로직이 강하게 결합되어 있음
- 다른 곳에서 재사용되지 않음
- 단순한 프레젠테이션 컴포넌트

---

## Export 패턴

### 이름 있는 const + default export(권장)

```typescript
export const MyComponent: React.FC<Props> = ({ ... }) => {
    // Component logic
};

export default MyComponent;
```

**이유:**
- 테스트/리팩터링을 위한 named export
- 지연 로딩 편의를 위한 default export
- 소비자(사용처)에서 두 옵션을 모두 선택 가능

### 이름 있는 export 지연 로딩

```typescript
const MyComponent = React.lazy(() =>
    import('./MyComponent').then(module => ({
        default: module.MyComponent
    }))
);
```

---

## 컴포넌트 간 통신

### Props는 아래로, 이벤트는 위로

```typescript
// Parent
function Parent() {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    return (
        <Child
            data={data}                    // Props down
            onSelect={setSelectedId}       // Events up
        />
    );
}

// Child
interface ChildProps {
    data: Data[];
    onSelect: (id: string) => void;
}

export const Child: React.FC<ChildProps> = ({ data, onSelect }) => {
    return (
        <div onClick={() => onSelect(data[0].id)}>
            {/* Content */}
        </div>
    );
};
```

### Prop Drilling 피하기

**깊은 중첩에는 context를 사용하세요:**
```typescript
// ❌ AVOID - Prop drilling 5+ levels
<A prop={x}>
  <B prop={x}>
    <C prop={x}>
      <D prop={x}>
        <E prop={x} />  // Finally uses it here
      </D>
    </C>
  </B>
</A>

// ✅ PREFERRED - Context or TanStack Query
const MyContext = createContext<MyData | null>(null);

function Provider({ children }) {
    const { data } = useSuspenseQuery({ ... });
    return <MyContext.Provider value={data}>{children}</MyContext.Provider>;
}

function DeepChild() {
    const data = useContext(MyContext);
    // Use data directly
}
```

---

## 고급 패턴

### 컴파운드 컴포넌트(Compound Components)

```typescript
// Card.tsx
export const Card: React.FC<CardProps> & {
    Header: typeof CardHeader;
    Body: typeof CardBody;
    Footer: typeof CardFooter;
} = ({ children }) => {
    return <Paper>{children}</Paper>;
};

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

// Usage
<Card>
    <Card.Header>Title</Card.Header>
    <Card.Body>Content</Card.Body>
    <Card.Footer>Actions</Card.Footer>
</Card>
```

### 렌더 프롭스(Render Props) (드물지만 유용)

```typescript
interface DataProviderProps {
    children: (data: Data) => React.ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
    const { data } = useSuspenseQuery({ ... });
    return <>{children(data)}</>;
};

// Usage
<DataProvider>
    {(data) => <Display data={data} />}
</DataProvider>
```

---

## 요약

**현대적 컴포넌트 레시피:**
1. `React.FC<Props>` with TypeScript
2. Lazy load if heavy: `React.lazy(() => import())`
3. Wrap in `<SuspenseLoader>` for loading
4. Use `useSuspenseQuery` for data
5. Import aliases (@/, ~types, ~components)
6. Event handlers with `useCallback`
7. Default export at bottom
8. No early returns for loading states

**함께 보기:**
- [data-fetching.md](data-fetching.md) - useSuspenseQuery details
- [loading-and-error-states.md](loading-and-error-states.md) - Suspense best practices
- [complete-examples.md](complete-examples.md) - Full working examples
