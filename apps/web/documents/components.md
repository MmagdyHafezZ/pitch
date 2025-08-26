# Component Architecture Guide

This guide covers the component architecture and design patterns used in the PITCH web application.

## Component Organization

```
src/components/
├── ui/                     # shadcn/ui base components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── ...
├── forms/                  # Form components
│   ├── contact-form.tsx
│   ├── login-form.tsx
│   └── ...
├── layout/                 # Layout components
│   ├── header.tsx
│   ├── sidebar.tsx
│   ├── footer.tsx
│   └── ...
├── features/               # Feature-specific components
│   ├── auth/
│   ├── dashboard/
│   └── ...
└── providers/              # Context providers
    ├── query-provider.tsx
    ├── theme-provider.tsx
    └── ...
```

## Design Principles

### 1. Composition over Inheritance
Use component composition to build complex UIs:

```tsx
// Good: Composable components
<Card>
  <CardHeader>
    <CardTitle>User Profile</CardTitle>
    <CardDescription>Manage your account settings</CardDescription>
  </CardHeader>
  <CardContent>
    <UserForm />
  </CardContent>
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
function UserAvatar({ user, size = 'md' }: UserAvatarProps) {
  return (
    <Avatar className={cn(avatarSizes[size])}>
      <AvatarImage src={user.avatar} alt={user.name} />
      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
    </Avatar>
  )
}

// Avoid: Mixed concerns
function UserAvatarAndStatus({ user, showStatus, onStatusChange }) {
  // Mixing avatar display with status management
}
```

### 3. Props Interface Design
Use clear, descriptive prop types:

```tsx
interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}
```

## Base Components (shadcn/ui)

### Button Component
```tsx
import { Button } from '@/components/ui/button'

// Basic usage
<Button>Click me</Button>

// With variants
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>

// With sizes
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// As child (polymorphic)
<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>

// With icons
<Button>
  <PlusIcon />
  Add Item
</Button>
```

### Card Component
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Analytics</CardTitle>
    <CardDescription>View your application metrics</CardDescription>
  </CardHeader>
  <CardContent>
    <MetricsChart />
  </CardContent>
</Card>
```

### Input Component
```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input 
    id="email"
    type="email"
    placeholder="Enter your email"
    required
  />
</div>
```

## Form Components

### Form Architecture
```tsx
// forms/contact-form.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

type ContactFormData = z.infer<typeof contactSchema>

export function ContactForm({ onSubmit }: { onSubmit: (data: ContactFormData) => void }) {
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      message: '',
    },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          {...form.register('name')}
          error={form.formState.errors.name?.message}
        />
      </div>
      
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...form.register('email')}
          error={form.formState.errors.email?.message}
        />
      </div>
      
      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          {...form.register('message')}
          error={form.formState.errors.message?.message}
        />
      </div>
      
      <Button type="submit" loading={form.formState.isSubmitting}>
        Send Message
      </Button>
    </form>
  )
}
```

### Reusable Form Fields
```tsx
// components/ui/form-field.tsx
interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

export function FormField({ label, error, required, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label className={cn(required && "after:content-['*'] after:text-red-500 after:ml-1")}>
        {label}
      </Label>
      {children}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}

// Usage
<FormField label="Email" error={errors.email} required>
  <Input {...register('email')} />
</FormField>
```

## Layout Components

### Header Component
```tsx
// components/layout/header.tsx
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Logo />
          <Navigation />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

function Logo() {
  return (
    <Link href="/" className="flex items-center space-x-2">
      <LogoIcon />
      <span className="font-bold">PITCH</span>
    </Link>
  )
}

function Navigation() {
  return (
    <nav className="hidden md:flex space-x-6">
      <NavLink href="/dashboard">Dashboard</NavLink>
      <NavLink href="/projects">Projects</NavLink>
      <NavLink href="/settings">Settings</NavLink>
    </nav>
  )
}
```

### Layout Provider
```tsx
// components/layout/layout-provider.tsx
interface LayoutProviderProps {
  children: React.ReactNode
  showSidebar?: boolean
  sidebarContent?: React.ReactNode
}

export function LayoutProvider({ children, showSidebar, sidebarContent }: LayoutProviderProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        {showSidebar && (
          <aside className="w-64 border-r">
            {sidebarContent}
          </aside>
        )}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
```

## Feature Components

### Dashboard Components
```tsx
// components/features/dashboard/metrics-card.tsx
interface MetricsCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease'
  }
  icon?: React.ComponentType<{ className?: string }>
}

export function MetricsCard({ title, value, change, icon: Icon }: MetricsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className={cn(
            "text-xs",
            change.type === 'increase' ? "text-green-600" : "text-red-600"
          )}>
            {change.type === 'increase' ? '↗' : '↘'} {Math.abs(change.value)}%
          </p>
        )}
      </CardContent>
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
    () => new QueryClient({
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
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
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

function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const { activeTab, setActiveTab } = useContext(TabsContext)!
  
  return (
    <button
      className={cn(
        "px-3 py-2 text-sm",
        activeTab === value ? "border-b-2 border-primary" : "text-muted-foreground"
      )}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  )
}

function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
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
  errorFallback = (err) => <div>Error: {err.message}</div>
}: AsyncWrapperProps<T>) {
  if (loading) return <>{fallback}</>
  if (error) return <>{errorFallback(error)}</>
  if (!data) return null
  
  return <>{children(data)}</>
}

// Usage
<AsyncWrapper data={users} loading={isLoading} error={error}>
  {(users) => (
    <div>
      {users.map(user => (
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
const ExpensiveComponent = memo(function ExpensiveComponent({ data }: { data: ComplexData }) {
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
      {items.map(item => (
        <ItemComponent 
          key={item.id} 
          item={item} 
          onClick={handleItemClick}
        />
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