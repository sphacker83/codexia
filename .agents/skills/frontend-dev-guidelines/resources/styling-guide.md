# 스타일링 가이드

MUI v7의 `sx` prop, 인라인 스타일, 테마 연동을 사용하는 현대적 스타일링 패턴입니다.

---

## 인라인 vs 분리 스타일

### 판단 기준

**100줄 미만: 컴포넌트 상단에 인라인 스타일**

```typescript
import type { SxProps, Theme } from '@mui/material';

const componentStyles: Record<string, SxProps<Theme>> = {
    container: {
        p: 2,
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        mb: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
    },
    // ... more styles
};

export const MyComponent: React.FC = () => {
    return (
        <Box sx={componentStyles.container}>
            <Box sx={componentStyles.header}>
                <h2>Title</h2>
            </Box>
        </Box>
    );
};
```

**100줄 초과: `.styles.ts` 파일로 분리**

```typescript
// MyComponent.styles.ts
import type { SxProps, Theme } from '@mui/material';

export const componentStyles: Record<string, SxProps<Theme>> = {
    container: { ... },
    header: { ... },
    // ... 100+ lines of styles
};

// MyComponent.tsx
import { componentStyles } from './MyComponent.styles';

export const MyComponent: React.FC = () => {
    return <Box sx={componentStyles.container}>...</Box>;
};
```

### 실제 예시: UnifiedForm.tsx

**48-126줄**: 인라인 스타일 78줄(허용 가능)

```typescript
const formStyles: Record<string, SxProps<Theme>> = {
    gridContainer: {
        height: '100%',
        maxHeight: 'calc(100vh - 220px)',
    },
    section: {
        height: '100%',
        maxHeight: 'calc(100vh - 220px)',
        overflow: 'auto',
        p: 4,
    },
    // ... 15 more style objects
};
```

**가이드라인**: 인라인 ~80줄은 무리 없는 수준입니다. 100줄 전후로는 상황에 따라 판단하세요.

---

## sx prop 패턴

### 기본 사용법

```typescript
<Box sx={{ p: 2, mb: 3, display: 'flex' }}>
    Content
</Box>
```

### 테마 접근 포함

```typescript
<Box
    sx={{
        p: 2,
        backgroundColor: (theme) => theme.palette.primary.main,
        color: (theme) => theme.palette.primary.contrastText,
        borderRadius: (theme) => theme.shape.borderRadius,
    }}
>
    Themed Box
</Box>
```

### 반응형 스타일

```typescript
<Box
    sx={{
        p: { xs: 1, sm: 2, md: 3 },
        width: { xs: '100%', md: '50%' },
        flexDirection: { xs: 'column', md: 'row' },
    }}
>
    Responsive Layout
</Box>
```

### 의사 선택자(Pseudo-selectors)

```typescript
<Box
    sx={{
        p: 2,
        '&:hover': {
            backgroundColor: 'rgba(0,0,0,0.05)',
        },
        '&:active': {
            backgroundColor: 'rgba(0,0,0,0.1)',
        },
        '& .child-class': {
            color: 'primary.main',
        },
    }}
>
    Interactive Box
</Box>
```

---

## MUI v7 패턴

### Grid 컴포넌트(v7 문법)

```typescript
import { Grid } from '@mui/material';

// ✅ CORRECT - v7 syntax with size prop
<Grid container spacing={2}>
    <Grid size={{ xs: 12, md: 6 }}>
        Left Column
    </Grid>
    <Grid size={{ xs: 12, md: 6 }}>
        Right Column
    </Grid>
</Grid>

// ❌ WRONG - Old v6 syntax
<Grid container spacing={2}>
    <Grid xs={12} md={6}>  {/* OLD - Don't use */}
        Content
    </Grid>
</Grid>
```

**핵심 변경점**: `xs={12} md={6}` 대신 `size={{ xs: 12, md: 6 }}`

### 반응형 Grid

```typescript
<Grid container spacing={3}>
    <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
        Responsive Column
    </Grid>
</Grid>
```

### 중첩 Grid

```typescript
<Grid container spacing={2}>
    <Grid size={{ xs: 12, md: 8 }}>
        <Grid container spacing={1}>
            <Grid size={{ xs: 12, sm: 6 }}>
                Nested 1
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
                Nested 2
            </Grid>
        </Grid>
    </Grid>

    <Grid size={{ xs: 12, md: 4 }}>
        Sidebar
    </Grid>
</Grid>
```

---

## 타입 안전한 스타일

### 스타일 객체 타입

```typescript
import type { SxProps, Theme } from '@mui/material';

// Type-safe styles
const styles: Record<string, SxProps<Theme>> = {
    container: {
        p: 2,
        // Autocomplete and type checking work here
    },
};

// Or individual style
const containerStyle: SxProps<Theme> = {
    p: 2,
    display: 'flex',
};
```

### 테마 인지(Theme-aware) 스타일

```typescript
const styles: Record<string, SxProps<Theme>> = {
    primary: {
        color: (theme) => theme.palette.primary.main,
        backgroundColor: (theme) => theme.palette.primary.light,
        '&:hover': {
            backgroundColor: (theme) => theme.palette.primary.dark,
        },
    },
    customSpacing: {
        padding: (theme) => theme.spacing(2),
        margin: (theme) => theme.spacing(1, 2), // top/bottom: 1, left/right: 2
    },
};
```

---

## 사용하지 말아야 할 것

### ❌ makeStyles(MUI v4 패턴)

```typescript
// ❌ AVOID - Old Material-UI v4 pattern
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles((theme) => ({
    root: {
        padding: theme.spacing(2),
    },
}));
```

**피해야 하는 이유**: Deprecated 되었고, v7에서 지원이 좋지 않습니다.

### ❌ styled() 컴포넌트

```typescript
// ❌ AVOID - styled-components pattern
import { styled } from '@mui/material/styles';

const StyledBox = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2),
}));
```

**피해야 하는 이유**: `sx` prop이 더 유연하고, 불필요한 새 컴포넌트를 만들지 않습니다.

### ✅ 대신 sx prop 사용

```typescript
// ✅ PREFERRED
<Box
    sx={{
        p: 2,
        backgroundColor: 'primary.main',
    }}
>
    Content
</Box>
```

---

## 코드 스타일 표준

### 들여쓰기

**스페이스 4칸**(2칸 금지, 탭 금지)

```typescript
const styles: Record<string, SxProps<Theme>> = {
    container: {
        p: 2,
        display: 'flex',
        flexDirection: 'column',
    },
};
```

### 따옴표

문자열은 **싱글 쿼트** 사용(프로젝트 표준)

```typescript
// ✅ CORRECT
const color = 'primary.main';
import { Box } from '@mui/material';

// ❌ WRONG
const color = "primary.main";
import { Box } from "@mui/material";
```

### 트레일링 콤마

객체/배열에는 **항상 트레일링 콤마**를 사용하세요.

```typescript
// ✅ CORRECT
const styles = {
    container: { p: 2 },
    header: { mb: 1 },  // Trailing comma
};

const items = [
    'item1',
    'item2',  // Trailing comma
];

// ❌ WRONG - No trailing comma
const styles = {
    container: { p: 2 },
    header: { mb: 1 }  // Missing comma
};
```

---

## 자주 쓰는 스타일 패턴

### Flexbox 레이아웃

```typescript
const styles = {
    flexRow: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    flexColumn: {
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
    },
    spaceBetween: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
};
```

### 여백(Spacing)

```typescript
// Padding
p: 2           // All sides
px: 2          // Horizontal (left + right)
py: 2          // Vertical (top + bottom)
pt: 2, pr: 1   // Specific sides

// Margin
m: 2, mx: 2, my: 2, mt: 2, mr: 1

// Units: 1 = 8px (theme.spacing(1))
p: 2  // = 16px
p: 0.5  // = 4px
```

### 위치 지정(Positioning)

```typescript
const styles = {
    relative: {
        position: 'relative',
    },
    absolute: {
        position: 'absolute',
        top: 0,
        right: 0,
    },
    sticky: {
        position: 'sticky',
        top: 0,
        zIndex: 1000,
    },
};
```

---

## 요약

**스타일링 체크리스트:**
- ✅ Use `sx` prop for MUI styling
- ✅ Type-safe with `SxProps<Theme>`
- ✅ <100 lines: inline; >100 lines: separate file
- ✅ MUI v7 Grid: `size={{ xs: 12 }}`
- ✅ 4 space indentation
- ✅ Single quotes
- ✅ Trailing commas
- ❌ No makeStyles or styled()

**함께 보기:**
- [component-patterns.md](component-patterns.md) - Component structure
- [complete-examples.md](complete-examples.md) - Full styling examples
