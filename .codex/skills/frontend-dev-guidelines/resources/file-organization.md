# 파일 구성

유지보수 가능하고 확장 가능한 프론트엔드 코드를 위해, 애플리케이션의 파일/디렉터리 구조를 올바르게 구성하는 방법입니다.

---

## features/ vs components/ 구분

### features/ 디렉터리

**목적**: 자체 로직, API, 컴포넌트를 포함하는 도메인 중심 기능(feature) 단위

**사용 시점:**
- Feature has multiple related components
- Feature has its own API endpoints
- Feature has domain-specific logic
- Feature has custom hooks/utilities

**예시:**
- `features/posts/` - Project catalog/post management
- `features/blogs/` - Blog builder and rendering
- `features/auth/` - Authentication flows

**구조:**
```
features/
  my-feature/
    api/
      myFeatureApi.ts         # API service layer
    components/
      MyFeatureMain.tsx       # Main component
      SubComponents/          # Related components
    hooks/
      useMyFeature.ts         # Custom hooks
      useSuspenseMyFeature.ts # Suspense hooks
    helpers/
      myFeatureHelpers.ts     # Utility functions
    types/
      index.ts                # TypeScript types
    index.ts                  # Public exports
```

### components/ 디렉터리

**목적**: 여러 기능(feature)에서 공통으로 사용하는, 진짜 재사용 컴포넌트

**사용 시점:**
- Component is used in 3+ places
- Component is generic (no feature-specific logic)
- Component is a UI primitive or pattern

**예시:**
- `components/SuspenseLoader/` - Loading wrapper
- `components/CustomAppBar/` - Application header
- `components/ErrorBoundary/` - Error handling
- `components/LoadingOverlay/` - Loading overlay

**구조:**
```
components/
  SuspenseLoader/
    SuspenseLoader.tsx
    SuspenseLoader.test.tsx
  CustomAppBar/
    CustomAppBar.tsx
    CustomAppBar.test.tsx
```

---

## 기능(Feature) 디렉터리 구조(상세)

### 완전한 기능(Feature) 예시

`features/posts/` 구조를 기반으로 한 예시:

```
features/
  posts/
    api/
      postApi.ts              # API service layer (GET, POST, PUT, DELETE)

    components/
      PostTable.tsx           # Main container component
      grids/
        PostDataGrid/
          PostDataGrid.tsx
      drawers/
        ProjectPostDrawer/
          ProjectPostDrawer.tsx
      cells/
        editors/
          TextEditCell.tsx
        renderers/
          DateCell.tsx
      toolbar/
        CustomToolbar.tsx

    hooks/
      usePostQueries.ts       # Regular queries
      useSuspensePost.ts      # Suspense queries
      usePostMutations.ts     # Mutations
      useGridLayout.ts              # Feature-specific hooks

    helpers/
      postHelpers.ts          # Utility functions
      validation.ts                 # Validation logic

    types/
      index.ts                      # TypeScript types/interfaces

    queries/
      postQueries.ts          # Query key factories (optional)

    context/
      PostContext.tsx         # React context (if needed)

    index.ts                        # Public API exports
```

### 하위 디렉터리 가이드

#### api/ 디렉터리

**목적**: 기능(feature)별 API 호출을 중앙화

**파일:**
- `{feature}Api.ts` - Main API service

**패턴:**
```typescript
// features/my-feature/api/myFeatureApi.ts
import apiClient from '@/lib/apiClient';

export const myFeatureApi = {
    getItem: async (id: number) => {
        const { data } = await apiClient.get(`/blog/items/${id}`);
        return data;
    },
    createItem: async (payload) => {
        const { data } = await apiClient.post('/blog/items', payload);
        return data;
    },
};
```

#### components/ 디렉터리

**목적**: 기능(feature) 전용 컴포넌트

**구성:**
- Flat structure if <5 components
- Subdirectories by responsibility if >5 components

**예시:**
```
components/
  MyFeatureMain.tsx           # Main component
  MyFeatureHeader.tsx         # Supporting components
  MyFeatureFooter.tsx

  # OR with subdirectories:
  containers/
    MyFeatureContainer.tsx
  presentational/
    MyFeatureDisplay.tsx
  blogs/
    MyFeatureBlog.tsx
```

#### hooks/ 디렉터리

**목적**: 기능(feature)용 커스텀 훅

**네이밍:**
- `use` prefix (camelCase)
- Descriptive of what they do

**예시:**
```
hooks/
  useMyFeature.ts               # Main hook
  useSuspenseMyFeature.ts       # Suspense version
  useMyFeatureMutations.ts      # Mutations
  useMyFeatureFilters.ts        # Filters/search
```

#### helpers/ 디렉터리

**목적**: 기능(feature) 전용 유틸리티 함수

**예시:**
```
helpers/
  myFeatureHelpers.ts           # General utilities
  validation.ts                 # Validation logic
  transblogers.ts               # Data transblogations
  constants.ts                  # Constants
```

#### types/ 디렉터리

**목적**: TypeScript 타입과 인터페이스

**파일:**
```
types/
  index.ts                      # Main types, exported
  internal.ts                   # Internal types (not exported)
```

---

## Import 별칭(tsconfig paths)

### 사용 가능한 별칭

`tsconfig.json`(또는 `jsconfig.json`)의 `compilerOptions.baseUrl`/`paths`로 설정합니다.

예시:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "~types/*": ["src/types/*"],
      "~components/*": ["src/components/*"],
      "~features/*": ["src/features/*"]
    }
  }
}
```

| 별칭 | 해석 경로 | 용도 |
|-------|-------------|---------|
| `@/` | `src/` | src 루트 기준 절대 import |
| `~types` | `src/types` | 공용 TypeScript 타입 |
| `~components` | `src/components` | 재사용 컴포넌트 |
| `~features` | `src/features` | 기능(feature) import |

### 사용 예시

```typescript
// ✅ PREFERRED - Use aliases for absolute imports
import { apiClient } from '@/lib/apiClient';
import { SuspenseLoader } from '~components/SuspenseLoader';
import { postApi } from '~features/posts/api/postApi';
import type { User } from '~types/user';

// ❌ AVOID - Relative paths from deep nesting
import { apiClient } from '../../../lib/apiClient';
import { SuspenseLoader } from '../../../components/SuspenseLoader';
```

### 어떤 별칭을 언제 쓰나

**@/ (General)**:
- Lib utilities: `@/lib/apiClient`
- Hooks: `@/hooks/useAuth`
- Config: `@/config/theme`
- Shared services: `@/services/authService`

**~types (Type Imports)**:
```typescript
import type { Post } from '~types/post';
import type { User, UserRole } from '~types/user';
```

**~components (Reusable Components)**:
```typescript
import { SuspenseLoader } from '~components/SuspenseLoader';
import { CustomAppBar } from '~components/CustomAppBar';
import { ErrorBoundary } from '~components/ErrorBoundary';
```

**~features (Feature Imports)**:
```typescript
import { postApi } from '~features/posts/api/postApi';
import { useAuth } from '~features/auth/hooks/useAuth';
```

---

## 파일 네이밍 컨벤션

### 컴포넌트

**패턴**: PascalCase + `.tsx` 확장자

```
MyComponent.tsx
PostDataGrid.tsx
CustomAppBar.tsx
```

**피하기:**
- camelCase: `myComponent.tsx` ❌
- kebab-case: `my-component.tsx` ❌
- All caps: `MYCOMPONENT.tsx` ❌

### 훅(Hooks)

**패턴**: `use` 접두사 + camelCase + `.ts` 확장자

```
useMyFeature.ts
useSuspensePost.ts
useAuth.ts
useGridLayout.ts
```

### API 서비스

**패턴**: `Api` 접미사 + camelCase + `.ts` 확장자

```
myFeatureApi.ts
postApi.ts
userApi.ts
```

### 헬퍼/유틸리티

**패턴**: 설명적인 이름의 camelCase + `.ts` 확장자

```
myFeatureHelpers.ts
validation.ts
transblogers.ts
constants.ts
```

### 타입(Types)

**패턴**: camelCase, `index.ts` 또는 설명적인 파일명

```
types/index.ts
types/post.ts
types/user.ts
```

---

## 새 기능(Feature)을 만들어야 하는 경우

### 새 기능을 만들 때:

- Multiple related components (>3)
- Has own API endpoints
- Domain-specific logic
- Will grow over time
- Reused across multiple routes

**Example:** `features/posts/`
- 20+ components
- Own API service
- Complex state management
- Used in multiple routes

### 기존 기능에 추가할 때:

- Related to existing feature
- Shares same API
- Logically grouped
- Extends existing functionality

**Example:** Adding export dialog to posts feature

### 재사용 컴포넌트를 만들 때:

- Used across 3+ features
- Generic, no domain logic
- Pure presentation
- Shared pattern

**Example:** `components/SuspenseLoader/`

---

## Import 정리

### Import 순서(권장)

```typescript
// 1. React and React-related
import React, { useState, useCallback, useMemo } from 'react';

// 2. Next.js (Client Component에서만 사용)
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// 3. Third-party libraries (alphabetical)
import { Box, Paper, Button, Grid } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';

// 4. Alias imports (@ first, then ~)
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { useMuiSnackbar } from '@/hooks/useMuiSnackbar';
import { SuspenseLoader } from '~components/SuspenseLoader';
import { postApi } from '~features/posts/api/postApi';

// 5. Type imports (grouped)
import type { Post } from '~types/post';
import type { User } from '~types/user';

// 6. Relative imports (same feature)
import { MySubComponent } from './MySubComponent';
import { useMyFeature } from '../hooks/useMyFeature';
import { myFeatureHelpers } from '../helpers/myFeatureHelpers';
```

모든 import는 **싱글 쿼트**를 사용하세요(프로젝트 표준).

---

## Public API 패턴

### feature/index.ts

깔끔한 import를 위해 기능(feature)에서 public API를 export 하세요:

```typescript
// features/my-feature/index.ts

// Export main components
export { MyFeatureMain } from './components/MyFeatureMain';
export { MyFeatureHeader } from './components/MyFeatureHeader';

// Export hooks
export { useMyFeature } from './hooks/useMyFeature';
export { useSuspenseMyFeature } from './hooks/useSuspenseMyFeature';

// Export API
export { myFeatureApi } from './api/myFeatureApi';

// Export types
export type { MyFeatureData, MyFeatureConfig } from './types';
```

**사용법:**
```typescript
// ✅ Clean import from feature index
import { MyFeatureMain, useMyFeature } from '~features/my-feature';

// ❌ Avoid deep imports (but OK if needed)
import { MyFeatureMain } from '~features/my-feature/components/MyFeatureMain';
```

---

## 디렉터리 구조 시각화

```
src/
├── app/                         # Next.js App Router (권장)
│   ├── layout.tsx
│   ├── page.tsx
│   ├── project-catalog/
│   │   ├── page.tsx
│   │   └── create/
│   │      └── page.tsx
│   └── blogs/
│      └── page.tsx
│
├── features/                    # Domain-specific features
│   ├── posts/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── helpers/
│   │   ├── types/
│   │   └── index.ts
│   ├── blogs/
│   └── auth/
│
├── components/                  # Reusable components
│   ├── SuspenseLoader/
│   ├── CustomAppBar/
│   ├── ErrorBoundary/
│   └── LoadingOverlay/
│
├── hooks/                       # Shared hooks
│   ├── useAuth.ts
│   ├── useMuiSnackbar.ts
│   └── useDebounce.ts
│
├── lib/                         # Shared utilities
│   ├── apiClient.ts
│   └── utils.ts
│
├── types/                       # Shared TypeScript types
│   ├── user.ts
│   ├── post.ts
│   └── common.ts
│
├── config/                      # Configuration
│   └── theme.ts
│
└── pages/                       # (선택) Pages Router를 쓸 때만
   ├── index.tsx
   ├── project-catalog/
   │   ├── index.tsx
   │   └── create/
   │      └── index.tsx
   └── blogs/
      └── index.tsx
```

---

## 요약

**핵심 원칙:**
1. **features/** for domain-specific code
2. **components/** for truly reusable UI
3. Use subdirectories: api/, components/, hooks/, helpers/, types/
4. Import aliases for clean imports (@/, ~types, ~components, ~features)
5. Consistent naming: PascalCase components, camelCase utilities
6. Export public API from feature index.ts

**함께 보기:**
- [component-patterns.md](component-patterns.md) - Component structure
- [data-fetching.md](data-fetching.md) - API service patterns
- [complete-examples.md](complete-examples.md) - Full feature example
