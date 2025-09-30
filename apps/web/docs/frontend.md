# Frontend Development Guide

This guide covers frontend development for the PITCH application using Next.js,
Mantine UI, and modern React practices.

## Tech Stack

- **Next.js 15** with App Router
- **React 19**
- **TypeScript**
- **Mantine UI** component library
- **TanStack Query** for data fetching
- **Zustand** for state management
- **React Hook Form** for forms (with Mantine integration)
- **NextAuth** for authentication

## Getting Started

### Development Server

```bash
# Start the frontend development server from root
pnpm run dev

# Or start web only
pnpm --filter web dev
```

The frontend will be available at `http://localhost:3000`. The API will be
available at `http://localhost:8001`.

### Project Structure

```
apps/web/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── auth/           # Authentication pages
│   │   ├── layout.tsx      # Root layout with providers
│   │   ├── page.tsx        # Home page
│   │   └── globals.css     # Global styles
│   ├── features/           # Feature-based architecture
│   │   └── auth/          # Authentication feature
│   │       ├── components/ # Auth UI components
│   │       ├── hooks/     # Auth hooks (useAuth, etc.)
│   │       ├── services/  # Auth API services
│   │       └── stores/    # Zustand auth store
│   ├── lib/               # Utilities and configurations
│   │   ├── client.ts      # API client with TanStack Query
│   │   └── providers.tsx  # App providers (Mantine, Query, etc.)
│   └── components/        # Shared components
├── public/               # Static assets
└── package.json
```

## Mantine UI Setup and Usage

### Current Configuration

The project is configured with Mantine v7 including:

```typescript
// lib/providers.tsx
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="light">
        <ModalsProvider>
          <Notifications />
          {children}
        </ModalsProvider>
      </MantineProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### Available Mantine Components

Currently installed and configured:

- `@mantine/core` - Core components (Button, TextInput, Card, etc.)
- `@mantine/notifications` - Toast notifications
- `@mantine/modals` - Modal dialogs
- `@mantine/hooks` - Utility hooks
- `@mantine/form` - Form management (if needed)

### Adding New Mantine Components

Mantine components are included by default with the core package:

```bash
# Install additional Mantine packages if needed
pnpm add @mantine/dates          # Date picker components
pnpm add @mantine/dropzone       # File upload dropzone
pnpm add @mantine/spotlight      # Command palette
pnpm add @mantine/carousel       # Image carousel
```

### Using Mantine Components

```tsx
import { Button, TextInput, Card, Text, Group, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'

export default function MyComponent() {
  const handleSubmit = () => {
    notifications.show({
      title: 'Success',
      message: 'Form submitted successfully!',
      color: 'green',
    })
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack>
        <Text size="xl" weight={500}>
          Example Form
        </Text>
        <TextInput label="Your name" placeholder="Enter your name" required />
        <Group position="right">
          <Button onClick={handleSubmit}>Submit</Button>
        </Group>
      </Stack>
    </Card>
  )
}
```

## Development Practices

### Component Structure

```tsx
// components/my-component.tsx
import { Box, BoxProps } from '@mantine/core'

interface MyComponentProps extends BoxProps {
  title: string
  children: React.ReactNode
}

export function MyComponent({
  title,
  children,
  ...boxProps
}: MyComponentProps) {
  return (
    <Box {...boxProps}>
      <Text size="lg" weight={500}>
        {title}
      </Text>
      {children}
    </Box>
  )
}
```

### Styling with Mantine

Mantine provides a comprehensive styling system:

```tsx
// Use Mantine's style props
<Box
  p="md"           // padding: medium
  m="xl"           // margin: extra large
  bg="blue.1"      // background: light blue
  c="dark.9"       // color: dark text
  ta="center"      // text-align: center
>
  <Text size="lg" weight={700}>Styled with Mantine</Text>
</Box>

// Responsive design with Mantine
<SimpleGrid
  cols={{ base: 1, sm: 2, lg: 3 }}
  spacing={{ base: 10, sm: 'xl' }}
>
  {/* content */}
</SimpleGrid>
```

### Data Fetching with TanStack Query

```tsx
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/client'

export function UserProfile() {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
  })

  const updateProfile = useMutation({
    mutationFn: api.users.update,
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Profile updated successfully!',
      })
    },
  })

  if (isLoading) return <Loader />
  if (error) return <Alert color="red">Error loading profile</Alert>

  return (
    <Card>
      <Text size="xl">{user?.name}</Text>
      <Button onClick={() => updateProfile.mutate(userData)}>
        Update Profile
      </Button>
    </Card>
  )
}
```

### Form Handling with Mantine Forms

```tsx
import { useForm } from '@mantine/form'
import { TextInput, Button, Stack } from '@mantine/core'

interface FormData {
  name: string
  email: string
}

export function MyForm() {
  const form = useForm<FormData>({
    initialValues: {
      name: '',
      email: '',
    },
    validate: {
      name: (value) =>
        value.length < 2 ? 'Name must have at least 2 letters' : null,
      email: (value) => (/^\\S+@\\S+$/.test(value) ? null : 'Invalid email'),
    },
  })

  const handleSubmit = (values: FormData) => {
    console.log(values)
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack>
        <TextInput
          label="Name"
          placeholder="Your name"
          {...form.getInputProps('name')}
        />

        <TextInput
          label="Email"
          placeholder="your@email.com"
          {...form.getInputProps('email')}
        />

        <Button type="submit">Submit</Button>
      </Stack>
    </form>
  )
}
```

## Authentication Integration

### Auth Store (Zustand)

```tsx
// features/auth/stores/auth.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const response = await api.auth.login({ email, password })
        set({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
        })
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    { name: 'auth-storage' }
  )
)
```

### Auth Components

```tsx
// features/auth/components/LoginForm.tsx
import { useForm } from '@mantine/form'
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Stack,
} from '@mantine/core'
import { useAuthStore } from '../stores/auth.store'

export function LoginForm() {
  const login = useAuthStore((state) => state.login)

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (val) => (/^\\S+@\\S+$/.test(val) ? null : 'Invalid email'),
      password: (val) =>
        val.length >= 6 ? null : 'Password should be at least 6 characters',
    },
  })

  return (
    <Paper radius="md" p="xl" withBorder>
      <Title order={2} ta="center" mt="md" mb={50}>
        Welcome back to PITCH!
      </Title>

      <form
        onSubmit={form.onSubmit(({ email, password }) =>
          login(email, password)
        )}
      >
        <Stack>
          <TextInput
            required
            label="Email"
            placeholder="hello@mantine.dev"
            {...form.getInputProps('email')}
          />

          <PasswordInput
            required
            label="Password"
            placeholder="Your password"
            {...form.getInputProps('password')}
          />

          <Button type="submit" radius="xl">
            Sign in
          </Button>
        </Stack>
      </form>
    </Paper>
  )
}
```

## Customization

### Theme Customization

Configure Mantine theme in your providers:

```tsx
import { MantineProvider, createTheme } from '@mantine/core'

const theme = createTheme({
  colors: {
    brand: [
      '#f0f4ff',
      '#d9e2ff',
      '#a6c1ff',
      '#739eff',
      '#4c82ff',
      '#3366ff', // primary
      '#2952cc',
      '#1f3f99',
      '#152d66',
      '#0c1a33',
    ],
  },
  primaryColor: 'brand',
  defaultRadius: 'md',
})

export function Providers({ children }) {
  return <MantineProvider theme={theme}>{children}</MantineProvider>
}
```

### Custom Components

Create reusable components extending Mantine:

```tsx
// components/CustomCard.tsx
import { Card, CardProps, Text } from '@mantine/core'

interface CustomCardProps extends CardProps {
  title: string
  subtitle?: string
}

export function CustomCard({
  title,
  subtitle,
  children,
  ...cardProps
}: CustomCardProps) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder {...cardProps}>
      <Text size="lg" weight={500}>
        {title}
      </Text>
      {subtitle && (
        <Text size="sm" color="dimmed" mt={5}>
          {subtitle}
        </Text>
      )}
      {children}
    </Card>
  )
}
```

## Building and Deployment

### Build Commands

```bash
# Development build
pnpm --filter web dev

# Production build
pnpm --filter web build

# Start production server
pnpm --filter web start

# Lint code
pnpm --filter web lint

# Type checking
pnpm --filter web type-check
```

### Environment Variables

Create `.env.local` in the `apps/web` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

## Best Practices

1. **Component Organization**
   - Use feature-based architecture
   - Keep components small and focused
   - Use TypeScript interfaces for props
   - Export from index files for clean imports

2. **Styling**
   - Use Mantine's style props system
   - Leverage Mantine's theme and color system
   - Create consistent spacing with Mantine tokens
   - Use responsive props for mobile-first design

3. **State Management**
   - Use TanStack Query for server state
   - Use Zustand for complex client state
   - Use Mantine forms for form state
   - Use React useState for simple local state

4. **Performance**
   - Use Next.js Image component for images
   - Implement proper loading states with Mantine Loader
   - Lazy load pages and components when appropriate
   - Use TanStack Query's caching effectively

5. **Accessibility**
   - Leverage Mantine's built-in accessibility
   - Use proper ARIA attributes where needed
   - Test with keyboard navigation
   - Use semantic HTML elements

## Troubleshooting

### Common Issues

**Mantine styles not loading:**

- Ensure CSS imports are in the correct order in providers.tsx
- Check that MantineProvider wraps your app
- Restart the development server

**API calls failing:**

- Verify API_BASE_URL in environment variables
- Check that the API server is running on port 8001
- Inspect network tab for detailed error messages

**TypeScript errors:**

```bash
# Check TypeScript configuration
pnpm --filter web run type-check

# Clear Next.js cache
rm -rf .next
pnpm --filter web dev
```

**Zustand store not persisting:**

- Check browser localStorage for the persisted data
- Ensure persist middleware is properly configured
- Verify the storage key name matches your expectations
