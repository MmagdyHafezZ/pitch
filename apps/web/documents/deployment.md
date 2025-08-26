# Web Application Deployment Guide

This guide covers deployment options and configurations for the PITCH frontend application.

## Deployment Targets

### Vercel (Recommended)
Next.js applications deploy seamlessly to Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from web app directory
cd apps/web
vercel

# Production deployment
vercel --prod
```

**Environment Variables:**
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-production-secret
```

### Docker Deployment
Use the provided Docker setup:

```bash
# Build and deploy with Docker
docker-compose -f docker-compose.prod.yml up -d web

# Or with staging configuration
docker-compose -f docker-compose.staging.yml up -d web
```

### Static Export
For static hosting (CDN, S3, etc.):

```bash
# Configure next.config.ts for static export
# Add: output: 'export'

# Build static files
pnpm build

# Deploy 'out' directory to static host
```

## Build Configuration

### Next.js Config
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: "standalone", // For Docker
  // output: "export",  // For static hosting
  
  // Environment-specific settings
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Performance optimizations
  experimental: {
    optimizeCss: true,
  },
}
```

### Environment Variables

**Required for all environments:**
- `NEXT_PUBLIC_API_URL` - API server URL
- `NEXTAUTH_URL` - Application URL  
- `NEXTAUTH_SECRET` - Authentication secret

**Optional:**
- `NEXT_TELEMETRY_DISABLED=1` - Disable Next.js telemetry
- `NODE_ENV=production` - Set production mode

## Performance Optimization

### Build Optimizations
```bash
# Analyze bundle size
pnpm build
npx @next/bundle-analyzer

# Enable compression
# Add to next.config.ts:
compress: true
```

### Image Optimization
```typescript
// next.config.ts
images: {
  domains: ['your-image-domain.com'],
  formats: ['image/webp', 'image/avif'],
  minimumCacheTTL: 60,
}
```

### Caching Strategy
```typescript
// next.config.ts
headers: async () => [
  {
    source: '/static/(.*)',
    headers: [
      {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, immutable',
      },
    ],
  },
]
```

## CI/CD Pipeline

### GitHub Actions
```yaml
# .github/workflows/web-deploy.yml
name: Deploy Web App

on:
  push:
    branches: [main]
    paths: ['apps/web/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm --filter web build
      - run: pnpm --filter web test
      
      # Deploy to Vercel
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: apps/web
```

## Health Checks

### Application Health Endpoint
```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  })
}
```

### Docker Health Check
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

## Monitoring

### Error Tracking
```bash
# Add Sentry
pnpm add @sentry/nextjs

# Configure in next.config.ts
const { withSentryConfig } = require('@sentry/nextjs')
module.exports = withSentryConfig(nextConfig, sentryOptions)
```

### Analytics
```typescript
// Add Google Analytics
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <GoogleAnalytics gaId="GA_MEASUREMENT_ID" />
      </body>
    </html>
  )
}
```

## Security Considerations

### Content Security Policy
```typescript
// next.config.ts
headers: async () => [
  {
    source: '/(.*)',
    headers: [
      {
        key: 'Content-Security-Policy',
        value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline';"
      }
    ],
  },
]
```

### Security Headers
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  return response
}
```

## Troubleshooting

### Common Build Issues

**Module Resolution:**
```bash
# Clear Next.js cache
rm -rf .next
pnpm build
```

**Memory Issues:**
```json
// package.json
"scripts": {
  "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
}
```

**Type Errors:**
```bash
# Skip type checking for faster builds
NEXT_IGNORE_TYPE_ERRORS=1 pnpm build
```

### Runtime Issues

**API Connection:**
- Verify `NEXT_PUBLIC_API_URL` environment variable
- Check CORS configuration on API server
- Ensure API is accessible from deployment environment

**Authentication:**
- Verify `NEXTAUTH_SECRET` is set in production
- Check `NEXTAUTH_URL` matches deployment domain
- Ensure OAuth providers are configured correctly

## Rollback Strategy

### Vercel
```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote [deployment-url]
```

### Docker
```bash
# Tag current version
docker tag current-image:latest current-image:v1.0.0

# Rollback to previous version
docker-compose up -d --scale web=0
docker-compose up -d previous-image:v0.9.0
```