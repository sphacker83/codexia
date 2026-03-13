# 완성 예제

React.FC, 지연 로딩(lazy loading), Suspense, useSuspenseQuery, 스타일링, 라우팅, 에러 처리 등 모든 현대적 패턴을 결합한 완전 동작 예제 모음입니다.

---

## 예제 1: 완전한 현대적 컴포넌트

포함: React.FC, useSuspenseQuery, 캐시 우선(cache-first), useCallback, 스타일링, 에러 처리

```typescript
/**
 * User profile display component
 * Demonstrates modern patterns with Suspense and TanStack Query
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Box, Paper, Typography, Button, Avatar } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../api/userApi';
import { useMuiSnackbar } from '@/hooks/useMuiSnackbar';
import type { User } from '~types/user';

// Styles object
const componentStyles: Record<string, SxProps<Theme>> = {
    container: {
        p: 3,
        maxWidth: 600,
        margin: '0 auto',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        mb: 3,
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
    },
    actions: {
        display: 'flex',
        gap: 1,
        mt: 2,
    },
};

interface UserProfileProps {
    userId: string;
    onUpdate?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, onUpdate }) => {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useMuiSnackbar();
    const [isEditing, setIsEditing] = useState(false);

    // Suspense query - no isLoading needed!
    const { data: user } = useSuspenseQuery({
        queryKey: ['user', userId],
        queryFn: () => userApi.getUser(userId),
        staleTime: 5 * 60 * 1000,
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: (updates: Partial<User>) =>
            userApi.updateUser(userId, updates),

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user', userId] });
            showSuccess('Profile updated');
            setIsEditing(false);
            onUpdate?.();
        },

        onError: () => {
            showError('Failed to update profile');
        },
    });

    // Memoized computed value
    const fullName = useMemo(() => {
        return `${user.firstName} ${user.lastName}`;
    }, [user.firstName, user.lastName]);

    // Event handlers with useCallback
    const handleEdit = useCallback(() => {
        setIsEditing(true);
    }, []);

    const handleSave = useCallback(() => {
        updateMutation.mutate({
            firstName: user.firstName,
            lastName: user.lastName,
        });
    }, [user, updateMutation]);

    const handleCancel = useCallback(() => {
        setIsEditing(false);
    }, []);

    return (
        <Paper sx={componentStyles.container}>
            <Box sx={componentStyles.header}>
                <Avatar sx={{ width: 64, height: 64 }}>
                    {user.firstName[0]}{user.lastName[0]}
                </Avatar>
                <Box>
                    <Typography variant='h5'>{fullName}</Typography>
                    <Typography color='text.secondary'>{user.email}</Typography>
                </Box>
            </Box>

            <Box sx={componentStyles.content}>
                <Typography>Username: {user.username}</Typography>
                <Typography>Roles: {user.roles.join(', ')}</Typography>
            </Box>

            <Box sx={componentStyles.actions}>
                {!isEditing ? (
                    <Button variant='contained' onClick={handleEdit}>
                        Edit Profile
                    </Button>
                ) : (
                    <>
                        <Button
                            variant='contained'
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                        >
                            {updateMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                        <Button onClick={handleCancel}>
                            Cancel
                        </Button>
                    </>
                )}
            </Box>
        </Paper>
    );
};

export default UserProfile;
```

**사용법:**
```typescript
<SuspenseLoader>
    <UserProfile userId='123' onUpdate={() => console.log('Updated')} />
</SuspenseLoader>
```

---

## 예제 2: 완전한 기능(Feature) 구조

`features/posts/`를 기반으로 한 실제 예시:

```
features/
  users/
    api/
      userApi.ts                # API service layer
    components/
      UserProfile.tsx           # Main component (from Example 1)
      UserList.tsx              # List component
      UserBlog.tsx              # Blog component
      modals/
        DeleteUserModal.tsx     # Modal component
    hooks/
      useSuspenseUser.ts        # Suspense query hook
      useUserMutations.ts       # Mutation hooks
      useUserPermissions.ts     # Feature-specific hook
    helpers/
      userHelpers.ts            # Utility functions
      validation.ts             # Validation logic
    types/
      index.ts                  # TypeScript interfaces
    index.ts                    # Public API exports
```

### API 서비스(userApi.ts)

```typescript
import apiClient from '@/lib/apiClient';
import type { User, CreateUserPayload, UpdateUserPayload } from '../types';

export const userApi = {
    getUser: async (userId: string): Promise<User> => {
        const { data } = await apiClient.get(`/users/${userId}`);
        return data;
    },

    getUsers: async (): Promise<User[]> => {
        const { data } = await apiClient.get('/users');
        return data;
    },

    createUser: async (payload: CreateUserPayload): Promise<User> => {
        const { data } = await apiClient.post('/users', payload);
        return data;
    },

    updateUser: async (userId: string, payload: UpdateUserPayload): Promise<User> => {
        const { data } = await apiClient.put(`/users/${userId}`, payload);
        return data;
    },

    deleteUser: async (userId: string): Promise<void> => {
        await apiClient.delete(`/users/${userId}`);
    },
};
```

### Suspense 훅(useSuspenseUser.ts)

```typescript
import { useSuspenseQuery } from '@tanstack/react-query';
import { userApi } from '../api/userApi';
import type { User } from '../types';

export function useSuspenseUser(userId: string) {
    return useSuspenseQuery<User, Error>({
        queryKey: ['user', userId],
        queryFn: () => userApi.getUser(userId),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useSuspenseUsers() {
    return useSuspenseQuery<User[], Error>({
        queryKey: ['users'],
        queryFn: () => userApi.getUsers(),
        staleTime: 1 * 60 * 1000,  // Shorter for list
    });
}
```

### 타입(types/index.ts)

```typescript
export interface User {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateUserPayload {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
}

export type UpdateUserPayload = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;
```

### 공개 export(index.ts)

```typescript
// Export components
export { UserProfile } from './components/UserProfile';
export { UserList } from './components/UserList';

// Export hooks
export { useSuspenseUser, useSuspenseUsers } from './hooks/useSuspenseUser';
export { useUserMutations } from './hooks/useUserMutations';

// Export API
export { userApi } from './api/userApi';

// Export types
export type { User, CreateUserPayload, UpdateUserPayload } from './types';
```

---

## 예제 3: 지연 로딩을 포함한 완전한 라우트

```typescript
/**
 * User profile page (Next.js App Router)
 * Path: /users/:userId
 * File: app/users/[userId]/page.tsx
 */

import dynamic from 'next/dynamic';
import { SuspenseLoader } from '~components/SuspenseLoader';

// Lazy load the UserProfile component (named export)
const UserProfile = dynamic(
    () => import('@/features/users/components/UserProfile').then((m) => m.UserProfile),
    { loading: () => null },
);

export default function Page({ params }: { params: { userId: string } }) {
    return (
        <SuspenseLoader>
            <UserProfile
                userId={params.userId}
                onUpdate={() => console.log('Profile updated')}
            />
        </SuspenseLoader>
    );
}
```

---

## 예제 4: 검색/필터링이 있는 리스트

```typescript
import React, { useState, useMemo } from 'react';
import { Box, TextField, List, ListItem } from '@mui/material';
import { useDebounce } from 'use-debounce';
import { useSuspenseQuery } from '@tanstack/react-query';
import { userApi } from '../api/userApi';

export const UserList: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch] = useDebounce(searchTerm, 300);

    const { data: users } = useSuspenseQuery({
        queryKey: ['users'],
        queryFn: () => userApi.getUsers(),
    });

    // Memoized filtering
    const filteredUsers = useMemo(() => {
        if (!debouncedSearch) return users;

        return users.filter(user =>
            user.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            user.email.toLowerCase().includes(debouncedSearch.toLowerCase())
        );
    }, [users, debouncedSearch]);

    return (
        <Box>
            <TextField
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder='Search users...'
                fullWidth
                sx={{ mb: 2 }}
            />

            <List>
                {filteredUsers.map(user => (
                    <ListItem key={user.id}>
                        {user.name} - {user.email}
                    </ListItem>
                ))}
            </List>
        </Box>
    );
};
```

---

## 예제 5: 검증(Validation)이 있는 블로그

```typescript
import React from 'react';
import { Box, TextField, Button, Paper } from '@mui/material';
import { useBlog } from 'react-hook-blog';
import { zodResolver } from '@hookblog/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../api/userApi';
import { useMuiSnackbar } from '@/hooks/useMuiSnackbar';

const userSchema = z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
});

type UserBlogData = z.infer<typeof userSchema>;

interface CreateUserBlogProps {
    onSuccess?: () => void;
}

export const CreateUserBlog: React.FC<CreateUserBlogProps> = ({ onSuccess }) => {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useMuiSnackbar();

    const { register, handleSubmit, blogState: { errors }, reset } = useBlog<UserBlogData>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            username: '',
            email: '',
            firstName: '',
            lastName: '',
        },
    });

    const createMutation = useMutation({
        mutationFn: (data: UserBlogData) => userApi.createUser(data),

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            showSuccess('User created successfully');
            reset();
            onSuccess?.();
        },

        onError: () => {
            showError('Failed to create user');
        },
    });

    const onSubmit = (data: UserBlogData) => {
        createMutation.mutate(data);
    };

    return (
        <Paper sx={{ p: 3, maxWidth: 500 }}>
            <blog onSubmit={handleSubmit(onSubmit)}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        {...register('username')}
                        label='Username'
                        error={!!errors.username}
                        helperText={errors.username?.message}
                        fullWidth
                    />

                    <TextField
                        {...register('email')}
                        label='Email'
                        type='email'
                        error={!!errors.email}
                        helperText={errors.email?.message}
                        fullWidth
                    />

                    <TextField
                        {...register('firstName')}
                        label='First Name'
                        error={!!errors.firstName}
                        helperText={errors.firstName?.message}
                        fullWidth
                    />

                    <TextField
                        {...register('lastName')}
                        label='Last Name'
                        error={!!errors.lastName}
                        helperText={errors.lastName?.message}
                        fullWidth
                    />

                    <Button
                        type='submit'
                        variant='contained'
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending ? 'Creating...' : 'Create User'}
                    </Button>
                </Box>
            </blog>
        </Paper>
    );
};

export default CreateUserBlog;
```

---

## 예제 2: 지연 로딩을 포함한 부모 컨테이너

```typescript
import React from 'react';
import { Box } from '@mui/material';
import { SuspenseLoader } from '~components/SuspenseLoader';

// Lazy load heavy components
const UserList = React.lazy(() => import('./UserList'));
const UserStats = React.lazy(() => import('./UserStats'));
const ActivityFeed = React.lazy(() => import('./ActivityFeed'));

export const UserDashboard: React.FC = () => {
    return (
        <Box sx={{ p: 2 }}>
            <SuspenseLoader>
                <UserStats />
            </SuspenseLoader>

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Box sx={{ flex: 2 }}>
                    <SuspenseLoader>
                        <UserList />
                    </SuspenseLoader>
                </Box>

                <Box sx={{ flex: 1 }}>
                    <SuspenseLoader>
                        <ActivityFeed />
                    </SuspenseLoader>
                </Box>
            </Box>
        </Box>
    );
};

export default UserDashboard;
```

**Benefits:**
- Each section loads independently
- User sees partial content sooner
- Better perceived perblogance

---

## 예제 3: 캐시 우선 전략 구현

Complete example based on useSuspensePost.ts:

```typescript
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { postApi } from '../api/postApi';
import type { Post } from '../types';

/**
 * Smart post hook with cache-first strategy
 * Reuses data from grid cache when available
 */
export function useSuspensePost(blogId: number, postId: number) {
    const queryClient = useQueryClient();

    return useSuspenseQuery<Post, Error>({
        queryKey: ['post', blogId, postId],
        queryFn: async () => {
            // Strategy 1: Check grid cache first (avoids API call)
            const gridCache = queryClient.getQueryData<{ rows: Post[] }>([
                'posts-v2',
                blogId,
                'summary'
            ]) || queryClient.getQueryData<{ rows: Post[] }>([
                'posts-v2',
                blogId,
                'flat'
            ]);

            if (gridCache?.rows) {
                const cached = gridCache.rows.find(
                    (row) => row.S_ID === postId
                );

                if (cached) {
                    return cached;  // Return from cache - no API call!
                }
            }

            // Strategy 2: Not in cache, fetch from API
            return postApi.getPost(blogId, postId);
        },
        staleTime: 5 * 60 * 1000,       // Fresh for 5 minutes
        gcTime: 10 * 60 * 1000,          // Cache for 10 minutes
        refetchOnWindowFocus: false,     // Don't refetch on focus
    });
}
```

**Why this pattern:**
- Checks grid cache before API
- Instant data if user came from grid
- Falls back to API if not cached
- Configurable cache times

---

## 예제 4: 완전한 라우트 파일

```typescript
/**
 * Project catalog page (Next.js App Router)
 * Path: /project-catalog
 * File: app/project-catalog/page.tsx
 */

import dynamic from 'next/dynamic';

// Lazy load the PostTable component (named export)
// Note: PostTable이 브라우저 전용 의존성이 있다면 `ssr: false`를 고려하세요.
const PostTable = dynamic(
    () => import('@/features/posts/components/PostTable').then((m) => m.PostTable),
    { loading: () => null },
);

// Page constants
const PROJECT_CATALOG_FORM_ID = 744;
const PROJECT_CATALOG_PROJECT_ID = 225;

export default function Page() {
    return (
        <PostTable
            blogId={PROJECT_CATALOG_FORM_ID}
            projectId={PROJECT_CATALOG_PROJECT_ID}
            tableType='active_projects'
            title='Blog Dashboard'
        />
    );
}
```

---

## 예제 5: 블로그가 포함된 다이얼로그

```typescript
import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    IconButton,
} from '@mui/material';
import { Close, PersonAdd } from '@mui/icons-material';
import { useBlog } from 'react-hook-blog';
import { zodResolver } from '@hookblog/resolvers/zod';
import { z } from 'zod';

const blogSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
});

type BlogData = z.infer<typeof blogSchema>;

interface AddUserDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: BlogData) => Promise<void>;
}

export const AddUserDialog: React.FC<AddUserDialogProps> = ({
    open,
    onClose,
    onSubmit,
}) => {
    const { register, handleSubmit, blogState: { errors }, reset } = useBlog<BlogData>({
        resolver: zodResolver(blogSchema),
    });

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleBlogSubmit = async (data: BlogData) => {
        await onSubmit(data);
        handleClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonAdd color='primary' />
                        Add User
                    </Box>
                    <IconButton onClick={handleClose} size='small'>
                        <Close />
                    </IconButton>
                </Box>
            </DialogTitle>

            <blog onSubmit={handleSubmit(handleBlogSubmit)}>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            {...register('name')}
                            label='Name'
                            error={!!errors.name}
                            helperText={errors.name?.message}
                            fullWidth
                            autoFocus
                        />

                        <TextField
                            {...register('email')}
                            label='Email'
                            type='email'
                            error={!!errors.email}
                            helperText={errors.email?.message}
                            fullWidth
                        />
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button type='submit' variant='contained'>
                        Add User
                    </Button>
                </DialogActions>
            </blog>
        </Dialog>
    );
};
```

---

## 예제 6: 병렬 데이터 페칭

```typescript
import React from 'react';
import { Box, Grid, Paper } from '@mui/material';
import { useSuspenseQueries } from '@tanstack/react-query';
import { userApi } from '../api/userApi';
import { statsApi } from '../api/statsApi';
import { activityApi } from '../api/activityApi';

export const Dashboard: React.FC = () => {
    // Fetch all data in parallel with Suspense
    const [statsQuery, usersQuery, activityQuery] = useSuspenseQueries({
        queries: [
            {
                queryKey: ['stats'],
                queryFn: () => statsApi.getStats(),
            },
            {
                queryKey: ['users', 'active'],
                queryFn: () => userApi.getActiveUsers(),
            },
            {
                queryKey: ['activity', 'recent'],
                queryFn: () => activityApi.getRecent(),
            },
        ],
    });

    return (
        <Box sx={{ p: 2 }}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2 }}>
                        <h3>Stats</h3>
                        <p>Total: {statsQuery.data.total}</p>
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2 }}>
                        <h3>Active Users</h3>
                        <p>Count: {usersQuery.data.length}</p>
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2 }}>
                        <h3>Recent Activity</h3>
                        <p>Events: {activityQuery.data.length}</p>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

// Usage with Suspense
<SuspenseLoader>
    <Dashboard />
</SuspenseLoader>
```

---

## 예제 7: 낙관적 업데이트(Optimistic Update)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { User } from '../types';

export const useToggleUserStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userId: string) => userApi.toggleStatus(userId),

        // Optimistic update
        onMutate: async (userId) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['users'] });

            // Snapshot previous value
            const previousUsers = queryClient.getQueryData<User[]>(['users']);

            // Optimistically update UI
            queryClient.setQueryData<User[]>(['users'], (old) => {
                return old?.map(user =>
                    user.id === userId
                        ? { ...user, active: !user.active }
                        : user
                ) || [];
            });

            return { previousUsers };
        },

        // Rollback on error
        onError: (err, userId, context) => {
            queryClient.setQueryData(['users'], context?.previousUsers);
        },

        // Refetch after mutation
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });
};
```

---

## 요약

**Key Takeaways:**

1. **Component Pattern**: React.FC + lazy + Suspense + useSuspenseQuery
2. **Feature Structure**: Organized subdirectories (api/, components/, hooks/, etc.)
3. **Routing**: Folder-based with lazy loading
4. **Data Fetching**: useSuspenseQuery with cache-first strategy
5. **Blogs**: React Hook Blog + Zod validation
6. **Error Handling**: useMuiSnackbar + onError callbacks
7. **Perblogance**: useMemo, useCallback, React.memo, debouncing
8. **Styling**: Inline <100 lines, sx prop, MUI v7 syntax

**See other resources for detailed explanations of each pattern.**
