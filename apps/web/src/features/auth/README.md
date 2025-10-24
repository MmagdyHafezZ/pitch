# Authentication Feature

This authentication feature provides a complete login/signup system using modern
React patterns and libraries.

## Architecture

### Tech Stack

- **UI Framework**: Mantine v8.3.1
- **State Management**: Zustand v5.0.8
- **API Client**: TanStack Query v5.85.5
- **Form Handling**: Mantine Form
- **TypeScript**: Full type safety

### Folder Structure

```
src/features/auth/
├── components/          # React components
│   ├── AuthPage.tsx    # Main auth page with mode switching
│   ├── LoginForm.tsx   # Login form component
│   └── RegisterForm.tsx # Register form component
├── hooks/              # Custom hooks
│   ├── useAuth.ts      # Main auth hook orchestrating store + queries
│   └── useAuthForm.ts  # Form-specific hooks
├── services/           # API services
│   └── auth.service.ts # TanStack Query mutations and queries
├── stores/             # Zustand stores
│   └── auth.store.ts   # Authentication state management
├── types/              # TypeScript types
│   └── auth.types.ts   # Auth-related type definitions
└── index.ts           # Public API exports
```

### Key Features

1. **Unified State Management**
   - Zustand store for client-side state
   - TanStack Query for server state
   - Persistent authentication across sessions

2. **Form Handling**
   - Mantine Form with validation
   - Real-time error handling
   - Loading states

3. **API Integration**
   - Type-safe API client in `lib/client.ts`
   - Automatic token management
   - Error handling and retry logic

4. **SSR Support**
   - Server-side rendering for auth pages
   - Proper hydration handling
   - SEO-optimized metadata

## Usage

### Basic Authentication

```tsx
import { useAuth } from '@/features/auth'

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth()

  if (!isAuthenticated) {
    return <div>Please log in</div>
  }

  return <div>Welcome, {user?.name}!</div>
}
```

### Using Auth Forms

```tsx
import { LoginForm, RegisterForm } from '@/features/auth'

function AuthPage() {
  return (
    <LoginForm
      onSuccess={() => router.push('/dashboard')}
      onSwitchToRegister={() => setMode('register')}
    />
  )
}
```

## API Endpoints

The auth system expects these backend endpoints:

- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/refresh` - Refresh token

## Pages

- `/auth` - Main auth page (defaults to login)
- `/auth/login` - Login page
- `/auth/register` - Register page

## Configuration

### Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Client Configuration

The API client is configured in `lib/client.ts` with:

- Base URL configuration
- Request/response interceptors
- Automatic token attachment
- Error handling
- Timeout management

## Security Features

- Automatic token storage in localStorage
- Token validation on app initialization
- Secure logout with token cleanup
- Request timeout protection
- CSRF protection ready
