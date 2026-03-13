# 성능 최적화

React 컴포넌트 성능을 최적화하고, 불필요한 리렌더를 줄이며, 메모리 누수를 방지하는 패턴 모음입니다.

---

## 메모이제이션 패턴

### 비용이 큰 계산에는 useMemo

```typescript
import { useMemo } from 'react';

export const DataDisplay: React.FC<{ items: Item[], searchTerm: string }> = ({
    items,
    searchTerm,
}) => {
    // ❌ AVOID - Runs on every render
    const filteredItems = items
        .filter(item => item.name.includes(searchTerm))
        .sort((a, b) => a.name.localeCompare(b.name));

    // ✅ CORRECT - Memoized, only recalculates when dependencies change
    const filteredItems = useMemo(() => {
        return items
            .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [items, searchTerm]);

    return <List items={filteredItems} />;
};
```

**useMemo를 써야 하는 경우:**
- 큰 배열의 필터/정렬
- 복잡한 계산
- 데이터 구조 변환
- 비용이 큰 연산(루프, 재귀)

**useMemo를 쓰지 말아야 하는 경우:**
- 단순 문자열 결합
- 기본 사칙연산
- 성급한 최적화(먼저 프로파일링하세요!)

---

## 이벤트 핸들러에는 useCallback

### 문제

```typescript
// ❌ AVOID - Creates new function on every render
export const Parent: React.FC = () => {
    const handleClick = (id: string) => {
        console.log('Clicked:', id);
    };

    // Child re-renders every time Parent renders
    // because handleClick is a new function reference each time
    return <Child onClick={handleClick} />;
};
```

### 해결

```typescript
import { useCallback } from 'react';

export const Parent: React.FC = () => {
    // ✅ CORRECT - Stable function reference
    const handleClick = useCallback((id: string) => {
        console.log('Clicked:', id);
    }, []); // Empty deps = function never changes

    // Child only re-renders when props actually change
    return <Child onClick={handleClick} />;
};
```

**useCallback을 써야 하는 경우:**
- 자식에게 props로 전달하는 함수
- useEffect 의존성으로 쓰이는 함수
- 메모이제이션된 컴포넌트에 전달하는 함수
- 리스트 안의 이벤트 핸들러

**useCallback을 쓰지 말아야 하는 경우:**
- 자식에게 전달하지 않는 이벤트 핸들러
- 단순 인라인 핸들러: `onClick={() => doSomething()}`

---

## 컴포넌트 메모이제이션을 위한 React.memo

### 기본 사용법

```typescript
import React from 'react';

interface ExpensiveComponentProps {
    data: ComplexData;
    onAction: () => void;
}

// ✅ Wrap expensive components in React.memo
export const ExpensiveComponent = React.memo<ExpensiveComponentProps>(
    function ExpensiveComponent({ data, onAction }) {
        // Complex rendering logic
        return <ComplexVisualization data={data} />;
    }
);
```

**React.memo를 써야 하는 경우:**
- 컴포넌트가 자주 렌더됨
- 렌더 비용이 큼
- props가 자주 바뀌지 않음
- 컴포넌트가 리스트 아이템임
- DataGrid 셀/렌더러

**React.memo를 쓰지 말아야 하는 경우:**
- props가 어차피 자주 바뀜
- 렌더링이 이미 충분히 빠름
- 성급한 최적화

---

## 디바운스 검색

### use-debounce 훅 사용

```typescript
import { useState } from 'react';
import { useDebounce } from 'use-debounce';
import { useSuspenseQuery } from '@tanstack/react-query';

export const SearchComponent: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');

    // Debounce for 300ms
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

    // Query uses debounced value
    const { data } = useSuspenseQuery({
        queryKey: ['search', debouncedSearchTerm],
        queryFn: () => api.search(debouncedSearchTerm),
        enabled: debouncedSearchTerm.length > 0,
    });

    return (
        <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='Search...'
        />
    );
};
```

**권장 디바운스 타이밍:**
- **300-500ms**: 검색/필터링
- **1000ms**: 자동 저장
- **100-200ms**: 실시간 검증

---

## 메모리 누수 방지

### timeout/interval 정리(cleanup)

```typescript
import { useEffect, useState } from 'react';

export const MyComponent: React.FC = () => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        // ✅ CORRECT - Cleanup interval
        const intervalId = setInterval(() => {
            setCount(c => c + 1);
        }, 1000);

        return () => {
            clearInterval(intervalId);  // Cleanup!
        };
    }, []);

    useEffect(() => {
        // ✅ CORRECT - Cleanup timeout
        const timeoutId = setTimeout(() => {
            console.log('Delayed action');
        }, 5000);

        return () => {
            clearTimeout(timeoutId);  // Cleanup!
        };
    }, []);

    return <div>{count}</div>;
};
```

### 이벤트 리스너 정리(cleanup)

```typescript
useEffect(() => {
    const handleResize = () => {
        console.log('Resized');
    };

    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);  // Cleanup!
    };
}, []);
```

### fetch를 위한 AbortController

```typescript
useEffect(() => {
    const abortController = new AbortController();

    fetch('/api/data', { signal: abortController.signal })
        .then(response => response.json())
        .then(data => setState(data))
        .catch(error => {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
            }
        });

    return () => {
        abortController.abort();  // Cleanup!
    };
}, []);
```

**참고**: TanStack Query를 쓰면 이 부분은 자동으로 처리됩니다.

---

## 폼 성능

### 특정 필드만 watch(전체 watch 금지)

```typescript
import { useForm } from 'react-hook-form';

export const MyForm: React.FC = () => {
    const { register, watch, handleSubmit } = useForm();

    // ❌ AVOID - Watches all fields, re-renders on any change
    const formValues = watch();

    // ✅ CORRECT - Watch only what you need
    const username = watch('username');
    const email = watch('email');

    // Or multiple specific fields
    const [username, email] = watch(['username', 'email']);

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <input {...register('username')} />
            <input {...register('email')} />
            <input {...register('password')} />

            {/* Only re-renders when username/email change */}
            <p>Username: {username}, Email: {email}</p>
        </form>
    );
};
```

---

## 리스트 렌더링 최적화

### key prop 사용

```typescript
// ✅ CORRECT - Stable unique keys
{items.map(item => (
    <ListItem key={item.id}>
        {item.name}
    </ListItem>
))}

// ❌ AVOID - Index as key (unstable if list changes)
{items.map((item, index) => (
    <ListItem key={index}>  // WRONG if list reorders
        {item.name}
    </ListItem>
))}
```

### 리스트 아이템 메모이제이션

```typescript
const ListItem = React.memo<ListItemProps>(({ item, onAction }) => {
    return (
        <Box onClick={() => onAction(item.id)}>
            {item.name}
        </Box>
    );
});

export const List: React.FC<{ items: Item[] }> = ({ items }) => {
    const handleAction = useCallback((id: string) => {
        console.log('Action:', id);
    }, []);

    return (
        <Box>
            {items.map(item => (
                <ListItem
                    key={item.id}
                    item={item}
                    onAction={handleAction}
                />
            ))}
        </Box>
    );
};
```

---

## 컴포넌트 재초기화 방지

### 문제

```typescript
// ❌ AVOID - Component recreated on every render
export const Parent: React.FC = () => {
    // New component definition each render!
    const ChildComponent = () => <div>Child</div>;

    return <ChildComponent />;  // Unmounts and remounts every render
};
```

### 해결

```typescript
// ✅ CORRECT - Define outside or use useMemo
const ChildComponent: React.FC = () => <div>Child</div>;

export const Parent: React.FC = () => {
    return <ChildComponent />;  // Stable component
};

// ✅ OR if dynamic, use useMemo
export const Parent: React.FC<{ config: Config }> = ({ config }) => {
    const DynamicComponent = useMemo(() => {
        return () => <div>{config.title}</div>;
    }, [config.title]);

    return <DynamicComponent />;
};
```

---

## 무거운 의존성 지연 로딩

### 코드 스플리팅(Code Splitting)

```typescript
// ❌ AVOID - Import heavy libraries at top level
import jsPDF from 'jspdf';  // Large library loaded immediately
import * as XLSX from 'xlsx';  // Large library loaded immediately

// ✅ CORRECT - Dynamic import when needed
const handleExportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    // Use it
};

const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    // Use it
};
```

---

## 요약

**성능 체크리스트:**
- ✅ `useMemo` for expensive computations (filter, sort, map)
- ✅ `useCallback` for functions passed to children
- ✅ `React.memo` for expensive components
- ✅ Debounce search/filter (300-500ms)
- ✅ Cleanup timeouts/intervals in useEffect
- ✅ Watch specific form fields (not all)
- ✅ Stable keys in lists
- ✅ Lazy load heavy libraries
- ✅ Code splitting with React.lazy

**함께 보기:**
- [component-patterns.md](component-patterns.md) - Lazy loading
- [data-fetching.md](data-fetching.md) - TanStack Query optimization
- [complete-examples.md](complete-examples.md) - Performance patterns in context
