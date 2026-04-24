# Frontend Testing Guide

Comprehensive testing strategy for the PITCH web application using modern
testing tools.

## Testing Stack

- **Jest** - Unit testing framework
- **React Testing Library** - React component testing
- **Playwright** - End-to-end testing
- **Storybook** - Component documentation and testing
- **MSW (Mock Service Worker)** - API mocking

## Setup

### Install Testing Dependencies

```bash
# Core testing libraries
pnpm add -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event

# Next.js testing utilities
pnpm add -D @next/eslint-plugin-next jest-environment-jsdom

# E2E testing
pnpm add -D @playwright/test

# API mocking
pnpm add -D msw
```

### Jest Configuration

```javascript
// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}

module.exports = createJestConfig(customJestConfig)
```

### Jest Setup

```javascript
// jest.setup.js
import '@testing-library/jest-dom'
import { server } from './src/mocks/server'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/mocked-path',
  useSearchParams: () => new URLSearchParams(),
}))

// Setup MSW
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## Unit Testing

### Component Testing

```typescript
// src/components/ui/__tests__/button.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../button'

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies variant styles correctly', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive')
  })

  it('supports asChild prop', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/test')
    expect(link).toHaveAttribute('data-slot', 'button')
  })
})
```

### Hook Testing

```typescript
// src/hooks/__tests__/use-api.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApi } from '../use-api'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useApi', () => {
  it('fetches data successfully', async () => {
    const { result } = renderHook(() => useApi('/api/users'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockUsers)
  })

  it('handles errors correctly', async () => {
    // MSW will intercept this and return an error
    const { result } = renderHook(() => useApi('/api/error'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toHaveProperty('message')
  })
})
```

### Page Testing

```typescript
// src/app/__tests__/page.test.tsx
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from '../page'

const Providers = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('HomePage', () => {
  it('renders welcome message', () => {
    render(<HomePage />, { wrapper: Providers })
    expect(screen.getByText(/welcome to pitch/i)).toBeInTheDocument()
  })

  it('displays loading state initially', () => {
    render(<HomePage />, { wrapper: Providers })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
```

## API Mocking

### MSW Setup

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Users API
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: '1', name: 'John Doe', email: 'john@example.com' },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    ])
  }),

  http.post('/api/users', async ({ request }) => {
    const newUser = await request.json()
    return HttpResponse.json({ id: '3', ...newUser }, { status: 201 })
  }),

  // Error scenarios
  http.get('/api/error', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }),

  // Authentication
  http.post('/api/auth/signin', () => {
    return HttpResponse.json({ token: 'mock-jwt-token' })
  }),
]
```

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

## Integration Testing

### Form Testing

```typescript
// src/components/__tests__/contact-form.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactForm } from '../contact-form'

describe('ContactForm', () => {
  it('submits form with valid data', async () => {
    const onSubmit = jest.fn()
    render(<ContactForm onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText(/name/i), 'John Doe')
    await userEvent.type(screen.getByLabelText(/email/i), 'john@example.com')
    await userEvent.type(screen.getByLabelText(/message/i), 'Hello world')

    await userEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello world',
    })
  })

  it('shows validation errors', async () => {
    render(<ContactForm onSubmit={jest.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
  })
})
```

## E2E Testing with Playwright

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### E2E Test Examples

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('user can sign in', async ({ page }) => {
    await page.goto('/signin')

    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password123')
    await page.click('[data-testid="signin-button"]')

    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('Welcome back!')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/signin')

    await page.fill('[data-testid="email"]', 'invalid@example.com')
    await page.fill('[data-testid="password"]', 'wrongpassword')
    await page.click('[data-testid="signin-button"]')

    await expect(page.getByText('Invalid credentials')).toBeVisible()
  })
})
```

## Visual Testing

### Storybook Setup

```javascript
// .storybook/main.js
module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-design-tokens',
  ],
  framework: '@storybook/nextjs',
}
```

### Component Stories

```typescript
// src/components/ui/button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './button'

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Button',
  },
}

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
}

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <PlusIcon />
        Add Item
      </>
    ),
  },
}
```

## Performance Testing

### Bundle Analysis

```json
// package.json
{
  "scripts": {
    "analyze": "ANALYZE=true pnpm build",
    "test:lighthouse": "lighthouse http://localhost:3000 --output html --output-path ./lighthouse-report.html"
  }
}
```

### Web Vitals Testing

```typescript
// src/lib/__tests__/web-vitals.test.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

describe('Web Vitals', () => {
  it('should meet performance thresholds', (done) => {
    const vitals = {}
    let count = 0
    const expected = 5

    const onPerfEntry = (name: string) => (metric: any) => {
      vitals[name] = metric.value
      count++

      if (count === expected) {
        expect(vitals.LCP).toBeLessThan(2500) // Large Contentful Paint
        expect(vitals.FID).toBeLessThan(100) // First Input Delay
        expect(vitals.CLS).toBeLessThan(0.1) // Cumulative Layout Shift
        done()
      }
    }

    getCLS(onPerfEntry('CLS'))
    getFID(onPerfEntry('FID'))
    getFCP(onPerfEntry('FCP'))
    getLCP(onPerfEntry('LCP'))
    getTTFB(onPerfEntry('TTFB'))
  })
})
```

## Test Scripts

### Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:visual": "storybook build && npx chromatic --project-token=your-token",
    "test:all": "pnpm test && pnpm test:e2e"
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --filter web test --coverage
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --filter web build
      - uses: microsoft/playwright-github-action@v1
      - run: pnpm --filter web test:e2e
```

## Best Practices

1. **Test Structure**: Follow AAA pattern (Arrange, Act, Assert)
2. **Test Data**: Use factories and builders for test data
3. **Mocking**: Mock external dependencies, keep internal logic real
4. **Coverage**: Aim for 80%+ coverage, focus on critical paths
5. **Performance**: Keep tests fast, parallelize when possible
6. **Maintenance**: Regular test review and cleanup
7. **Documentation**: Clear test descriptions and comments
