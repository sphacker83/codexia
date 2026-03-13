# TypeScript 표준

React 프론트엔드 코드에서 타입 안정성과 유지보수성을 높이기 위한 TypeScript 모범 사례입니다.

---

## Strict 모드

### 설정

이 프로젝트에서는 TypeScript strict 모드가 **활성화**되어 있습니다:

```json
// tsconfig.json
{
    "compilerOptions": {
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true
    }
}
```

**의미:**
- 암묵적 `any` 타입 금지
- null/undefined는 명시적으로 처리해야 함
- 타입 안정성 강제

---

## `any` 타입 금지

### 규칙

```typescript
// ❌ NEVER use any
function handleData(data: any) {
    return data.something;
}

// ✅ Use specific types
interface MyData {
    something: string;
}

function handleData(data: MyData) {
    return data.something;
}

// ✅ Or use unknown for truly unknown data
function handleUnknown(data: unknown) {
    if (typeof data === 'object' && data !== null && 'something' in data) {
        return (data as MyData).something;
    }
}
```

**정말로 타입을 모르는 경우:**
- `unknown` 사용(타입 체크를 강제)
- 타입 가드로 좁히기(narrow)
- 왜 타입이 unknown인지 문서화

---

## 명시적 반환 타입

### 함수 반환 타입

```typescript
// ✅ CORRECT - Explicit return type
function getUser(id: number): Promise<User> {
    return apiClient.get(`/users/${id}`);
}

function calculateTotal(items: Item[]): number {
    return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ AVOID - Implicit return type (less clear)
function getUser(id: number) {
    return apiClient.get(`/users/${id}`);
}
```

### 컴포넌트 반환 타입

```typescript
// React.FC는 이미 반환 타입(ReactElement)을 제공합니다
export const MyComponent: React.FC<Props> = ({ prop }) => {
    return <div>{prop}</div>;
};

// 커스텀 훅
function useMyData(id: number): { data: Data; isLoading: boolean } {
    const [data, setData] = useState<Data | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    return { data: data!, isLoading };
}
```

---

## 타입 import

### 'type' 키워드 사용

```typescript
// ✅ CORRECT - Explicitly mark as type import
import type { User } from '~types/user';
import type { Post } from '~types/post';
import type { SxProps, Theme } from '@mui/material';

// ❌ AVOID - Mixed value and type imports
import { User } from '~types/user';  // Unclear if type or value
```

**장점:**
- 타입과 값을 명확히 분리
- 더 나은 트리 셰이킹(tree-shaking)
- 순환 의존성 방지
- TypeScript 컴파일러 최적화

---

## 컴포넌트 props 인터페이스

### 인터페이스 패턴

```typescript
/**
 * Props for MyComponent
 */
interface MyComponentProps {
    /** The user ID to display */
    userId: number;

    /** Optional callback when action completes */
    onComplete?: () => void;

    /** Display mode for the component */
    mode?: 'view' | 'edit';

    /** Additional CSS classes */
    className?: string;
}

export const MyComponent: React.FC<MyComponentProps> = ({
    userId,
    onComplete,
    mode = 'view',  // Default value
    className,
}) => {
    return <div>...</div>;
};
```

**핵심 포인트:**
- props를 위한 인터페이스를 분리
- 각 prop에 JSDoc 주석 작성
- 선택 prop은 `?` 사용
- 구조 분해에서 기본값 제공

### children이 있는 props

```typescript
interface ContainerProps {
    children: React.ReactNode;
    title: string;
}

// React.FC는 children 타입을 자동 포함하지만, 가능하면 명시적으로 작성
export const Container: React.FC<ContainerProps> = ({ children, title }) => {
    return (
        <div>
            <h2>{title}</h2>
            {children}
        </div>
    );
};
```

---

## 유틸리티 타입

### Partial<T>

```typescript
// 모든 프로퍼티를 optional로 만들기
type UserUpdate = Partial<User>;

function updateUser(id: number, updates: Partial<User>) {
    // updates can have any subset of User properties
}
```

### Pick<T, K>

```typescript
// 특정 프로퍼티만 선택
type UserPreview = Pick<User, 'id' | 'name' | 'email'>;

const preview: UserPreview = {
    id: 1,
    name: 'John',
    email: 'john@example.com',
// 다른 User 프로퍼티는 허용되지 않음
};
```

### Omit<T, K>

```typescript
// 특정 프로퍼티 제외
type UserWithoutPassword = Omit<User, 'password' | 'passwordHash'>;

const publicUser: UserWithoutPassword = {
    id: 1,
    name: 'John',
    email: 'john@example.com',
// password와 passwordHash는 허용되지 않음
};
```

### Required<T>

```typescript
// 모든 프로퍼티를 required로 만들기
type RequiredConfig = Required<Config>;  // All optional props become required
```

### Record<K, V>

```typescript
// 타입 안전한 object/map
const userMap: Record<string, User> = {
    'user1': { id: 1, name: 'John' },
    'user2': { id: 2, name: 'Jane' },
};

// 스타일용
import type { SxProps, Theme } from '@mui/material';

const styles: Record<string, SxProps<Theme>> = {
    container: { p: 2 },
    header: { mb: 1 },
};
```

---

## 타입 가드(Type Guards)

### 기본 타입 가드

```typescript
function isUser(data: unknown): data is User {
    return (
        typeof data === 'object' &&
        data !== null &&
        'id' in data &&
        'name' in data
    );
}

// 사용 예시
if (isUser(response)) {
    console.log(response.name);  // TypeScript knows it's User
}
```

### 구분 가능한 유니온(Discriminated Unions)

```typescript
type LoadingState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: Data }
    | { status: 'error'; error: Error };

function Component({ state }: { state: LoadingState }) {
    // TypeScript는 status에 따라 타입을 좁힙니다
    if (state.status === 'success') {
        return <Display data={state.data} />;  // data available here
    }

    if (state.status === 'error') {
        return <Error error={state.error} />;  // error available here
    }

    return <Loading />;
}
```

---

## 제네릭 타입(Generic Types)

### 제네릭 함수

```typescript
function getById<T>(items: T[], id: number): T | undefined {
    return items.find(item => (item as any).id === id);
}

// 타입 추론과 함께 사용
const users: User[] = [...];
const user = getById(users, 123);  // Type: User | undefined
```

### 제네릭 컴포넌트

```typescript
interface ListProps<T> {
    items: T[];
    renderItem: (item: T) => React.ReactNode;
}

export function List<T>({ items, renderItem }: ListProps<T>): React.ReactElement {
    return (
        <div>
            {items.map((item, index) => (
                <div key={index}>{renderItem(item)}</div>
            ))}
        </div>
    );
}

// 사용 예시
<List<User>
    items={users}
    renderItem={(user) => <UserCard user={user} />}
/>
```

---

## 타입 단언(Type Assertions) (최소한으로 사용)

### 사용해도 되는 경우

```typescript
// ✅ OK - TypeScript보다 더 많은 정보를 알고 있을 때
const element = document.getElementById('my-element') as HTMLInputElement;
const value = element.value;

// ✅ OK - 이미 검증한 API 응답
const response = await api.getData();
const user = response.data as User;  // You know the shape
```

### 사용하면 안 되는 경우

```typescript
// ❌ 피하기 - 타입 안정성을 우회함
const data = getData() as any;  // WRONG - defeats TypeScript

// ❌ 피하기 - 안전하지 않은 단언
const value = unknownValue as string;  // Might not actually be string
```

---

## Null/Undefined 처리

### Optional Chaining

```typescript
// ✅ CORRECT
const name = user?.profile?.name;

// 아래와 동일:
const name = user && user.profile && user.profile.name;
```

### Nullish Coalescing

```typescript
// ✅ CORRECT
const displayName = user?.name ?? 'Anonymous';

// null 또는 undefined일 때만 기본값을 사용
// ('' , 0, false에서도 동작하는 || 와 다름)
```

### Non-Null 단언(주의해서 사용)

```typescript
// ✅ OK - 값이 반드시 존재한다고 확신할 때
const data = queryClient.getQueryData<Data>(['data'])!;

// ⚠️ 주의 - null이 아님을 확실히 아는 경우에만 사용
// 더 나은 방법: 명시적으로 체크
const data = queryClient.getQueryData<Data>(['data']);
if (data) {
    // Use data
}
```

---

## 요약

**TypeScript 체크리스트:**
- ✅ Strict mode enabled
- ✅ No `any` type (use `unknown` if needed)
- ✅ Explicit return types on functions
- ✅ Use `import type` for type imports
- ✅ JSDoc comments on prop interfaces
- ✅ Utility types (Partial, Pick, Omit, Required, Record)
- ✅ Type guards for narrowing
- ✅ Optional chaining and nullish coalescing
- ❌ Avoid type assertions unless necessary

**함께 보기:**
- [component-patterns.md](component-patterns.md) - Component typing
- [data-fetching.md](data-fetching.md) - API typing
