# 공통 패턴

폼, 인증, DataGrid, 다이얼로그 등 자주 쓰는 UI 요소를 위한 반복 사용 패턴 모음입니다.

---

## useAuth를 이용한 인증

### 현재 사용자 가져오기

```typescript
import { useAuth } from '@/hooks/useAuth';

export const MyComponent: React.FC = () => {
    const { user } = useAuth();

    // 사용 가능한 프로퍼티:
    // - user.id: string
    // - user.email: string
    // - user.username: string
    // - user.roles: string[]

    return (
        <div>
            <p>로그인 계정: {user.email}</p>
            <p>사용자명: {user.username}</p>
            <p>역할: {user.roles.join(', ')}</p>
        </div>
    );
};
```

**인증을 위해 직접 API를 호출하지 마세요** - 항상 `useAuth` 훅을 사용하세요.

---

## React Hook Form을 사용한 폼

### 기본 폼

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField, Button } from '@mui/material';
import { useMuiSnackbar } from '@/hooks/useMuiSnackbar';

// 검증을 위한 Zod 스키마
const formSchema = z.object({
    username: z.string().min(3, '사용자명은 최소 3자 이상이어야 합니다'),
    email: z.string().email('유효하지 않은 이메일 주소입니다'),
    age: z.number().min(18, '18세 이상이어야 합니다'),
});

type FormData = z.infer<typeof formSchema>;

export const MyForm: React.FC = () => {
    const { showSuccess, showError } = useMuiSnackbar();

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: '',
            email: '',
            age: 18,
        },
    });

    const onSubmit = async (data: FormData) => {
        try {
            await api.submitForm(data);
            showSuccess('폼 제출에 성공했습니다');
        } catch (error) {
            showError('폼 제출에 실패했습니다');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
                {...register('username')}
                label='사용자명'
                error={!!errors.username}
                helperText={errors.username?.message}
            />

            <TextField
                {...register('email')}
                label='이메일'
                error={!!errors.email}
                helperText={errors.email?.message}
                type='email'
            />

            <TextField
                {...register('age', { valueAsNumber: true })}
                label='나이'
                error={!!errors.age}
                helperText={errors.age?.message}
                type='number'
            />

            <Button type='submit' variant='contained'>
                제출
            </Button>
        </form>
    );
};
```

---

## 다이얼로그 컴포넌트 패턴

### 표준 다이얼로그 구조

BEST_PRACTICES.md 기준 - 모든 다이얼로그는 다음을 포함해야 합니다:
- 제목에 아이콘
- 닫기 버튼(X)
- 하단의 액션 버튼들

```typescript
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from '@mui/material';
import { Close, Info } from '@mui/icons-material';

interface MyDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const MyDialog: React.FC<MyDialogProps> = ({ open, onClose, onConfirm }) => {
    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Info color='primary' />
                        다이얼로그 제목
                    </Box>
                    <IconButton onClick={onClose} size='small'>
                        <Close />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent>
                {/* 내용 */}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>취소</Button>
                <Button onClick={onConfirm} variant='contained'>
                    확인
                </Button>
            </DialogActions>
        </Dialog>
    );
};
```

---

## DataGrid 래퍼 패턴

### 래퍼 컴포넌트 계약(Contract)

BEST_PRACTICES.md 기준 - DataGrid 래퍼는 다음을 받도록 설계합니다:

**필수 Props:**
- `rows`: 데이터 배열
- `columns`: 컬럼 정의
- 로딩/에러 상태

**선택 Props:**
- 툴바 컴포넌트
- 커스텀 액션
- 초기 상태

```typescript
import { DataGridPro } from '@mui/x-data-grid-pro';
import type { GridColDef } from '@mui/x-data-grid-pro';

interface DataGridWrapperProps {
    rows: any[];
    columns: GridColDef[];
    loading?: boolean;
    toolbar?: React.ReactNode;
    onRowClick?: (row: any) => void;
}

export const DataGridWrapper: React.FC<DataGridWrapperProps> = ({
    rows,
    columns,
    loading = false,
    toolbar,
    onRowClick,
}) => {
    return (
        <DataGridPro
            rows={rows}
            columns={columns}
            loading={loading}
            slots={{ toolbar: toolbar ? () => toolbar : undefined }}
            onRowClick={(params) => onRowClick?.(params.row)}
            // 표준 설정
            pagination
            pageSizeOptions={[25, 50, 100]}
            initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
            }}
        />
    );
};
```

---

## Mutation 패턴

### 캐시 무효화를 포함한 업데이트

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMuiSnackbar } from '@/hooks/useMuiSnackbar';

export const useUpdateEntity = () => {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useMuiSnackbar();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            api.updateEntity(id, data),

        onSuccess: (result, variables) => {
            // 영향을 받는 쿼리 무효화
            queryClient.invalidateQueries({ queryKey: ['entity', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['entities'] });

            showSuccess('엔티티가 업데이트되었습니다');
        },

        onError: () => {
            showError('엔티티 업데이트에 실패했습니다');
        },
    });
};

// 사용 예시
const updateEntity = useUpdateEntity();

const handleSave = () => {
    updateEntity.mutate({ id: 123, data: { name: 'New Name' } });
};
```

---

## 상태 관리 패턴

### 서버 상태는 TanStack Query 사용(기본/Primary)

서버 데이터는 **전부 TanStack Query**로 처리하세요:
- Fetching: useSuspenseQuery
- Mutations: useMutation
- Caching: 자동
- Synchronization: 내장

```typescript
// ✅ 올바름 - 서버 데이터는 TanStack Query
const { data: users } = useSuspenseQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getUsers(),
});
```

### UI 상태는 useState 사용

`useState`는 **로컬 UI 상태에만** 사용하세요:
- 폼 입력(비제어)
- 모달 열림/닫힘
- 탭 선택
- 임시 UI 플래그

```typescript
// ✅ 올바름 - UI 상태는 useState
const [modalOpen, setModalOpen] = useState(false);
const [selectedTab, setSelectedTab] = useState(0);
```

### 글로벌 클라이언트 상태는 Zustand(최소)

Zustand는 **글로벌 클라이언트 상태에만** 제한적으로 사용하세요:
- 테마 선호
- 사이드바 접힘 상태
- 사용자 선호(서버에서 오지 않는 값)

```typescript
import { create } from 'zustand';

interface AppState {
    sidebarOpen: boolean;
    toggleSidebar: () => void;
}

export const useAppState = create<AppState>((set) => ({
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

**prop drilling은 피하세요** - 대신 context 또는 Zustand를 사용하세요.

---

## 요약

**공통 패턴:**
- ✅ 현재 사용자 조회는 useAuth 훅(id, email, roles, username)
- ✅ 폼은 React Hook Form + Zod
- ✅ 아이콘 + 닫기 버튼이 있는 다이얼로그
- ✅ DataGrid 래퍼 계약(contracts)
- ✅ 캐시 무효화를 포함한 mutations
- ✅ 서버 상태는 TanStack Query
- ✅ UI 상태는 useState
- ✅ 글로벌 클라이언트 상태는 Zustand(최소)

**함께 보기:**
- [data-fetching.md](data-fetching.md) - TanStack Query 패턴
- [component-patterns.md](component-patterns.md) - 컴포넌트 구조
- [loading-and-error-states.md](loading-and-error-states.md) - 에러 처리

