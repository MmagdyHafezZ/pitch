# Component Architecture Guide

This guide covers the component architecture and design patterns used in the
PITCH web application with Mantine UI.

## Component Organization

```
src/components/
├── common/                 # Shared/reusable components
│   ├── LoadingSpinner.tsx
│   ├── ErrorBoundary.tsx
│   ├── PageHeader.tsx
│   └── ...
├── forms/                  # Form components
│   ├── ContactForm.tsx
│   ├── LoginForm.tsx
│   └── ...
├── layout/                 # Layout components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── Footer.tsx
│   └── ...
├── features/               # Feature-specific components
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── stores/
│   ├── dashboard/
│   └── ...
└── lib/                    # Utilities and configurations
    ├── providers.tsx       # App providers (Mantine, Query, etc.)
    ├── client.ts          # API client
    └── ...
```

## Design Principles

### 1. Composition over Inheritance

Use Mantine component composition to build complex UIs:

```tsx
// Good: Composable Mantine components
import { Card, Text, Stack, Button } from '@mantine/core'

<Card shadow="sm" padding="lg" radius="md" withBorder>
  <Stack>
    <Text size="xl" weight={500}>User Profile</Text>
    <Text size="sm" color="dimmed">Manage your account settings</Text>
    <UserForm />
  </Stack>
</Card>

// Avoid: Monolithic components with too many props
<UserCard
  title="User Profile"
  description="Manage your account settings"
  showForm={true}
  formType="user"
  // ... many more props
/>
```

### 2. Single Responsibility

Each component should have one clear purpose:

```tsx
// Good: Focused responsibility
import { Avatar } from '@mantine/core'

interface UserAvatarProps {
  user: User
  size?: number
}

function UserAvatar({ user, size = 40 }: UserAvatarProps) {
  return (
    <Avatar src={user.avatar} alt={user.name} size={size} radius="xl">
      {user.name.charAt(0)}
    </Avatar>
  )
}

// Avoid: Mixed concerns
function UserAvatarAndStatus({ user, showStatus, onStatusChange }) {
  // Mixing avatar display with status management
}
```

### 3. Props Interface Design

Use clear, descriptive prop types with Mantine integration:

```tsx
import { ButtonProps } from '@mantine/core'

interface CustomButtonProps extends ButtonProps {
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}
```

## Mantine UI Components

### Button Component

```tsx
import { Button } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'

// Basic usage
<Button>Click me</Button>

// With variants
<Button color="red">Delete</Button>
<Button variant="outline">Cancel</Button>

// With sizes
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// As polymorphic component
<Button component="a" href="/dashboard">Go to Dashboard</Button>

// With icons
<Button leftSection={<IconPlus size={16} />}>
  Add Item
</Button>
```

### Card Component

```tsx
import { Card, Text, Stack } from '@mantine/core'
;<Card shadow="sm" padding="lg" radius="md" withBorder>
  <Stack>
    <Text size="xl" weight={500}>
      Analytics
    </Text>
    <Text size="sm" color="dimmed">
      View your application metrics
    </Text>
    <MetricsChart />
  </Stack>
</Card>
```

### Input Component

```tsx
import { TextInput, Stack } from '@mantine/core'
;<Stack>
  <TextInput
    label="Email"
    placeholder="Enter your email"
    required
    type="email"
  />
</Stack>
```

## Form Components

### Form Architecture with Mantine

```tsx
// forms/ContactForm.tsx
import { useForm } from '@mantine/form'
import { TextInput, Textarea, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'

interface ContactFormData {
  name: string
  email: string
  message: string
}

export function ContactForm({
  onSubmit,
}: {
  onSubmit: (data: ContactFormData) => void
}) {
  const form = useForm<ContactFormData>({
    initialValues: {
      name: '',
      email: '',
      message: '',
    },
    validate: {
      name: (value) =>
        value.length < 2 ? 'Name must have at least 2 letters' : null,
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      message: (value) =>
        value.length < 10 ? 'Message must be at least 10 characters' : null,
    },
  })

  const handleSubmit = (values: ContactFormData) => {
    onSubmit(values)
    notifications.show({
      title: 'Success',
      message: 'Message sent successfully!',
      color: 'green',
    })
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

        <Textarea
          label="Message"
          placeholder="Your message"
          minRows={3}
          {...form.getInputProps('message')}
        />

        <Button type="submit">Send Message</Button>
      </Stack>
    </form>
  )
}
```

### Reusable Form Fields with Mantine

```tsx
// components/common/FormField.tsx
import { Box, Text } from '@mantine/core'

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

export function FormField({
  label,
  error,
  required,
  children,
}: FormFieldProps) {
  return (
    <Box>
      <Text size="sm" weight={500} mb={5}>
        {label}
        {required && (
          <Text component="span" c="red">
            {' '}
            *
          </Text>
        )}
      </Text>
      {children}
      {error && (
        <Text size="xs" c="red" mt={5}>
          {error}
        </Text>
      )}
    </Box>
  )
}

// Usage with Mantine form
import { TextInput } from '@mantine/core'
;<FormField label="Email" error={form.errors.email} required>
  <TextInput {...form.getInputProps('email')} />
</FormField>
```

## Layout Components

### Header Component with Mantine

```tsx
// components/layout/Header.tsx
import {
  Header as MantineHeader,
  Group,
  Text,
  Menu,
  Avatar,
} from '@mantine/core'
import { IconChevronDown } from '@tabler/icons-react'
import Link from 'next/link'

export function Header() {
  return (
    <MantineHeader height={60} px="md">
      <Group justify="space-between" h="100%">
        <Logo />
        <Navigation />
        <UserMenu />
      </Group>
    </MantineHeader>
  )
}

function Logo() {
  return (
    <Group>
      <Text size="xl" weight={700} c="blue">
        PITCH
      </Text>
    </Group>
  )
}

function Navigation() {
  return (
    <Group visibleFrom="md">
      <Text component={Link} href="/dashboard" size="sm">
        Dashboard
      </Text>
      <Text component={Link} href="/projects" size="sm">
        Projects
      </Text>
      <Text component={Link} href="/settings" size="sm">
        Settings
      </Text>
    </Group>
  )
}

function UserMenu() {
  return (
    <Menu>
      <Menu.Target>
        <Group style={{ cursor: 'pointer' }}>
          <Avatar size={32} radius="xl" />
          <IconChevronDown size={16} />
        </Group>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item>Profile</Menu.Item>
        <Menu.Item>Settings</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red">Logout</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
```

### Layout Provider with Mantine

```tsx
// components/layout/LayoutProvider.tsx
import { AppShell, Burger } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Header } from './Header'

interface LayoutProviderProps {
  children: React.ReactNode
  showSidebar?: boolean
  sidebarContent?: React.ReactNode
}

export function LayoutProvider({
  children,
  showSidebar,
  sidebarContent,
}: LayoutProviderProps) {
  const [opened, { toggle }] = useDisclosure()

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={
        showSidebar
          ? {
              width: 300,
              breakpoint: 'sm',
              collapsed: { mobile: !opened },
            }
          : undefined
      }
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          {showSidebar && (
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
          )}
          <Header />
        </Group>
      </AppShell.Header>

      {showSidebar && (
        <AppShell.Navbar p="md">{sidebarContent}</AppShell.Navbar>
      )}

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
```

## Feature Components

### Dashboard Components with Mantine

```tsx
// components/features/dashboard/MetricsCard.tsx
import { Card, Text, Group, Stack, ThemeIcon } from '@mantine/core'
import { IconTrendingUp, IconTrendingDown } from '@tabler/icons-react'

interface MetricsCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease'
  }
  icon?: React.ComponentType<{ size?: number }>
}

export function MetricsCard({
  title,
  value,
  change,
  icon: Icon,
}: MetricsCardProps) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Text size="sm" c="dimmed">
          {title}
        </Text>
        {Icon && (
          <ThemeIcon size="sm" variant="light">
            <Icon size={16} />
          </ThemeIcon>
        )}
      </Group>

      <Text size="xl" weight={700}>
        {value}
      </Text>

      {change && (
        <Group mt="xs">
          <ThemeIcon
            size="xs"
            color={change.type === 'increase' ? 'green' : 'red'}
            variant="light"
          >
            {change.type === 'increase' ? (
              <IconTrendingUp size={12} />
            ) : (
              <IconTrendingDown size={12} />
            )}
          </ThemeIcon>
          <Text size="xs" c={change.type === 'increase' ? 'green' : 'red'}>
            {Math.abs(change.value)}%
          </Text>
        </Group>
      )}
    </Card>
  )
}
```

## Provider Components

### Query Provider

```tsx
// components/providers/query-provider.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### Theme Provider

```tsx
// components/providers/theme-provider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
```

## Component Patterns

### Compound Components

```tsx
// components/ui/tabs.tsx
interface TabsContextType {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = createContext<TabsContextType | undefined>(undefined)

function Tabs({ defaultValue, children, onValueChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue)

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    onValueChange?.(tab)
  }

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ children }: { children: React.ReactNode }) {
  return <div className="flex space-x-1 border-b">{children}</div>
}

function TabsTrigger({
  value,
  children,
}: {
  value: string
  children: React.ReactNode
}) {
  const { activeTab, setActiveTab } = useContext(TabsContext)!

  return (
    <button
      className={cn(
        'px-3 py-2 text-sm',
        activeTab === value
          ? 'border-b-2 border-primary'
          : 'text-muted-foreground'
      )}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  )
}

function TabsContent({
  value,
  children,
}: {
  value: string
  children: React.ReactNode
}) {
  const { activeTab } = useContext(TabsContext)!

  if (activeTab !== value) return null

  return <div className="mt-4">{children}</div>
}

// Export as compound component
Tabs.List = TabsList
Tabs.Trigger = TabsTrigger
Tabs.Content = TabsContent

export { Tabs }
```

### Render Props Pattern

```tsx
// components/ui/async-wrapper.tsx
interface AsyncWrapperProps<T> {
  data: T | undefined
  loading: boolean
  error: Error | null
  children: (data: T) => React.ReactNode
  fallback?: React.ReactNode
  errorFallback?: (error: Error) => React.ReactNode
}

export function AsyncWrapper<T>({
  data,
  loading,
  error,
  children,
  fallback = <div>Loading...</div>,
  errorFallback = (err) => <div>Error: {err.message}</div>,
}: AsyncWrapperProps<T>) {
  if (loading) return <>{fallback}</>
  if (error) return <>{errorFallback(error)}</>
  if (!data) return null

  return <>{children(data)}</>
}

// Usage
;<AsyncWrapper data={users} loading={isLoading} error={error}>
  {(users) => (
    <div>
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  )}
</AsyncWrapper>
```

## Testing Components

### Component Testing Strategy

```tsx
// __tests__/components/ui/button.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../button'

describe('Button Component', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive')
  })

  it('handles asChild prop', () => {
    render(
      <Button asChild>
        <a href="/test">Link</a>
      </Button>
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/test')
  })

  it('shows loading state', () => {
    render(<Button loading>Submit</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
```

## Performance Optimization

### Memoization

```tsx
// Memoize expensive computations
const ExpensiveComponent = memo(function ExpensiveComponent({
  data,
}: {
  data: ComplexData
}) {
  const processedData = useMemo(() => {
    return expensiveProcessing(data)
  }, [data])

  return <div>{processedData}</div>
})

// Memoize callbacks to prevent unnecessary re-renders
function ParentComponent({ items }: { items: Item[] }) {
  const handleItemClick = useCallback((itemId: string) => {
    // Handle click
  }, [])

  return (
    <div>
      {items.map((item) => (
        <ItemComponent key={item.id} item={item} onClick={handleItemClick} />
      ))}
    </div>
  )
}
```

### Code Splitting

```tsx
// Lazy load components
const AdminPanel = lazy(() => import('./admin-panel'))
const UserDashboard = lazy(() => import('./user-dashboard'))

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/dashboard" element={<UserDashboard />} />
      </Routes>
    </Suspense>
  )
}
```

## Best Practices

1. **Keep components small and focused**
2. **Use TypeScript for prop validation**
3. **Implement proper error boundaries**
4. **Follow accessibility guidelines (ARIA, semantic HTML)**
5. **Use consistent naming conventions**
6. **Implement proper loading and error states**
7. **Write comprehensive tests**
8. **Document component APIs with JSDoc**
9. **Use Storybook for component documentation**
10. **Optimize for performance with memoization and code splitting**
