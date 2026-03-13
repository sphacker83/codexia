# 라우팅 가이드 (Next.js 최신)

Next.js의 **파일 기반 라우팅**을 기준으로, App Router(권장) / Pages Router(선택) 환경에서 라우트 구성, 동적 라우트, 레이아웃/에러 경계, 지연 로딩 패턴을 정리합니다.

---

## 1) 라우팅 기준 선택

### App Router (권장)
- 디렉터리: `app/` 또는 `src/app/`
- 파일 규칙: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`
- 데이터 페칭/캐싱/리밸리데이션을 **서버 컴포넌트 중심**으로 구성하기 쉬움

### Pages Router (선택)
- 디렉터리: `pages/` 또는 `src/pages/`
- 파일 규칙: `pages/posts/[postId].tsx` 형태
- 새 프로젝트라면 App Router로 시작하는 것을 권장

---

## 2) App Router 디렉터리 구조

```txt
app/
  layout.tsx                  # 루트 레이아웃(전역)
  page.tsx                    # 홈 (/)
  posts/
    page.tsx                  # /posts
    loading.tsx               # /posts 로딩 경계
    error.tsx                 # /posts 에러 경계
    [postId]/
      page.tsx                # /posts/:postId
      not-found.tsx           # (선택) /posts/:postId Not Found
  (dashboard)/
    settings/
      page.tsx                # /settings (라우트 그룹)
  api/
    posts/
      route.ts                # /api/posts (Route Handler)
```

**핵심 규칙**
- `page.tsx`가 URL 엔드포인트입니다.
- `layout.tsx`는 하위 라우트에 공통 UI(네비게이션/프레임/Provider 등)를 제공합니다.
- `loading.tsx` / `error.tsx` / `not-found.tsx`는 **라우트 레벨 경계**입니다.

---

## 3) 기본 페이지 예시 (App Router)

`app/posts/page.tsx`:

```tsx
import { PostsPage } from '@/features/posts/components/PostsPage';

export default function Page() {
  return <PostsPage />;
}
```

- `PostsPage`가 훅을 사용한다면 `PostsPage.tsx` 쪽에 `'use client'`를 선언합니다.
- App Router에서는 가능한 한 **서버 컴포넌트(page.tsx)에서 껍데기 구성** → **인터랙티브 부분만 Client Component**로 두는 편이 유지보수에 유리합니다.

---

## 4) 동적 라우트 (App Router)

`app/users/[userId]/page.tsx`:

```tsx
import { UserProfile } from '@/features/users/components/UserProfile';

export default function Page({ params }: { params: { userId: string } }) {
  return <UserProfile userId={params.userId} />;
}
```

- Pages Router의 `useRouter().query` 대신, App Router는 `params`를 기본 인자로 받습니다.

---

## 5) 네비게이션

### 링크
- `next/link`를 기본으로 사용합니다.

### App Router 클라이언트 네비게이션

Client Component에서:

```tsx
'use client';

import { useRouter } from 'next/navigation';

export function GoButton() {
  const router = useRouter();
  return <button onClick={() => router.push('/posts')}>Posts</button>;
}
```

자주 쓰는 훅:
- `useRouter()`
- `usePathname()`
- `useSearchParams()`

---

## 6) 로딩/에러 경계 (App Router)

### 라우트 레벨(권장)
- `app/posts/loading.tsx`: `/posts` 진입 시 로딩 UI
- `app/posts/error.tsx`: `/posts`에서 throw된 에러 UI

이 방식은 조기 return(early return)로 로딩을 처리하는 패턴보다 **레이아웃 안정성과 UX**가 좋습니다.

### 컴포넌트 레벨(필요할 때)
- 특정 위젯만 늦게 로드되거나, 클라이언트에서만 데이터가 필요한 경우 `<SuspenseLoader>` 같은 컴포넌트 경계를 사용합니다.

---

## 7) 지연 로딩 (Next.js)

### `next/dynamic` (권장)
- 특히 DataGrid/차트/에디터처럼 **클라이언트 전용** 또는 **무거운 컴포넌트**에 사용합니다.

```tsx
'use client';

import dynamic from 'next/dynamic';
import { SuspenseLoader } from '~components/SuspenseLoader';

const HeavyGrid = dynamic(() => import('@/features/reports/components/HeavyGrid'), {
  ssr: false,
  loading: () => null,
});

export function ReportWidget() {
  return (
    <SuspenseLoader>
      <HeavyGrid />
    </SuspenseLoader>
  );
}
```

- `ssr: false`는 브라우저 전용 의존성이 있을 때만 사용합니다.

---

## 8) Pages Router 구조(선택)

```txt
pages/
  index.tsx                 # /
  posts/
    index.tsx               # /posts
    [postId].tsx            # /posts/:postId
  api/
    posts.ts                # /api/posts
```

- 새 기능은 가능하면 App Router로 옮기거나, 새 프로젝트는 App Router로 시작하세요.

---

## 체크리스트

- [ ] App Router인지 Pages Router인지 먼저 확인
- [ ] App Router면 `loading.tsx`/`error.tsx` 등 **경계 파일**을 우선 고려
- [ ] 훅/브라우저 API가 필요하면 **Client Component**로 분리하고 `'use client'`
- [ ] 무거운 컴포넌트는 `next/dynamic`으로 지연 로딩
