# PITCH Web Application

The frontend for the PITCH business management platform built with Next.js, Mantine UI, and modern React practices.

## Tech Stack

- **Next.js 15** with App Router
- **React 19**
- **TypeScript**
- **Mantine UI** components and hooks
- **TanStack Query** for API state management
- **Zustand** for client state management
- **NextAuth** for authentication (planned)

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (package manager)
- Docker (for database services)

### Development Setup

1. **Start database services:**
   ```bash
   # From project root
   docker-compose -f docker-compose.local.yml up -d postgres mongodb redis rabbitmq
   ```

2. **Start development servers:**
   ```bash
   # From project root (starts both web and API)
   pnpm run dev

   # Or start web only
   pnpm --filter web dev
   ```

3. **Open the application:**
   - Web app: [http://localhost:3000](http://localhost:3000)
   - API docs: [http://localhost:8001/docs](http://localhost:8001/docs)

## Project Structure

```
apps/web/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── auth/               # Authentication pages
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   ├── features/               # Feature-based architecture
│   │   └── auth/              # Authentication feature
│   │       ├── components/    # Auth-specific components
│   │       ├── hooks/         # Auth hooks
│   │       ├── services/      # Auth API services
│   │       └── stores/        # Auth Zustand stores
│   ├── lib/                   # Shared utilities
│   │   ├── client.ts         # API client
│   │   └── providers.tsx     # App providers
│   └── components/           # Shared components
├── public/                   # Static assets
└── package.json
```

## Features

### Authentication System
- **Login/Register forms** with Mantine components
- **JWT-based authentication** with refresh tokens
- **Zustand store** for auth state management
- **TanStack Query** for API operations
- **Protected routes** and authentication guards

### UI Components
- **Mantine UI** component library
- **Responsive design** with mobile-first approach
- **Dark/light theme** support
- **Accessible components** with proper ARIA attributes
- **Form validation** with built-in Mantine validation

## Development Commands

```bash
# Development
pnpm dev                    # Start development server
pnpm build                  # Build for production
pnpm start                  # Start production server
pnpm lint                   # Run ESLint
pnpm type-check            # Run TypeScript checking
```

## API Integration

The web app connects to the PITCH API running on port 8001:

```typescript
// API client configuration
export const API_BASE_URL = 'http://localhost:8001/api/v1'

// Example API usage
const { data: user } = useQuery({
  queryKey: ['auth', 'me'],
  queryFn: () => api.auth.me()
})
```

## State Management

### Zustand Stores
- **Auth Store**: User authentication state
- **UI Store**: Global UI state (modals, notifications)

### TanStack Query
- **API caching** and synchronization
- **Optimistic updates** for better UX
- **Background refetching** and error handling

## Environment Variables

Create `.env.local` in the web app directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Mantine Documentation](https://mantine.dev/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)