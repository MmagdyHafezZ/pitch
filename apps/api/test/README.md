# Backend Integration Tests

This directory contains end-to-end (e2e) integration tests for the PITCH API.

## Test Files

### LLM Providers Tests

**File:** `llm-providers.e2e-spec.ts`

Tests for the LLM providers endpoint (`GET /simulation/llm/providers`):

- ✅ Returns list of available providers with models and details
- ✅ Includes OpenAI provider when `OPENAI_API_KEY` is set
- ✅ Includes WatsonX provider when credentials are set
- ✅ Includes complete model details with pricing and capabilities
- ✅ Returns consistent data structure across multiple calls
- ✅ Handles requests with appropriate headers
- ✅ Includes fallback models when catalog service is unavailable
- ✅ Marks providers as disabled when credentials are missing
- ✅ Includes decision-support data for model selection (pricing, context window, capabilities)

### Session Creation Tests

**File:** `session-creation.e2e-spec.ts`

Tests for session creation with LLM configuration (`POST /simulation/sessions`):

- ✅ Creates text sessions with LLM configuration
- ✅ Creates voice sessions with LLM and TTS configuration
- ✅ Creates sessions with WatsonX LLM provider
- ✅ Creates sessions with minimal LLM configuration
- ✅ Creates sessions without LLM configuration (uses defaults)
- ✅ Handles complex sessionConfig with multiple settings
- ✅ Validates required fields are present
- ✅ Accepts different session types (text, voice, video)
- ✅ Creates sessions with all supported LLM models
- ✅ Persists LLM configuration for later retrieval
- ✅ Handles Content-Type headers correctly
- ✅ Complete session lifecycle (create, retrieve, update, end)

## Prerequisites

### 1. Docker

Docker must be running for testcontainers to work:

```bash
# Check if Docker is running
docker ps

# If Docker Desktop is installed, start it from Applications
# Or use Docker CLI
docker info
```

### 2. Environment Variables

Set up required environment variables in `.env.test`:

```bash
# Required for OpenAI provider tests
OPENAI_API_KEY=sk-...

# Required for WatsonX provider tests
WATSONX_API_KEY=...
WATSONX_PROJECT_ID=...

# JWT secrets (auto-set by setup-e2e.ts)
JWT_SECRET=test-secret
JWT_REFRESH_SECRET=test-refresh-secret
```

### 3. Dependencies

Install all dependencies:

```bash
pnpm install
```

## Running the Tests

### Run All E2E Tests

```bash
pnpm test:e2e
```

### Run Specific Test File

```bash
# LLM providers tests
pnpm test:e2e llm-providers.e2e-spec.ts

# Session creation tests
pnpm test:e2e session-creation.e2e-spec.ts
```

### Run Tests in Watch Mode

```bash
pnpm test:e2e --watch
```

### Run Tests with Coverage

```bash
pnpm test:e2e --coverage
```

## Troubleshooting

### Issue: "Could not find a working container runtime strategy"

**Cause:** Testcontainers cannot detect Docker.

**Solutions:**

1. Ensure Docker Desktop is running:

   ```bash
   docker ps
   ```

2. Check Docker socket permissions (macOS/Linux):

   ```bash
   ls -la /var/run/docker.sock
   ```

3. Set `DOCKER_HOST` environment variable if using Docker Machine or remote Docker:

   ```bash
   export DOCKER_HOST=unix:///var/run/docker.sock
   ```

4. For macOS with Colima:
   ```bash
   export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"
   ```

### Issue: Tests timeout

**Cause:** Database container takes too long to start.

**Solution:** Increase timeout in `setup-e2e.ts` (default is 60 seconds):

```typescript
beforeAll(async () => {
  // ...
}, 120000); // Increase to 120 seconds
```

### Issue: Port conflicts

**Cause:** PostgreSQL container port is already in use.

**Solution:** Testcontainers automatically maps to random available ports. If issues persist, stop conflicting containers:

```bash
docker ps
docker stop <container_id>
```

### Issue: Tests fail with database errors

**Cause:** Database schema not migrated.

**Solution:** The tests should handle migrations automatically. If not, you may need to:

```bash
# Generate Prisma client
cd apps/api/src/microservices/simulation
pnpm prisma generate

# Run migrations (if needed)
pnpm prisma migrate deploy
```

## Test Structure

### Setup (`setup-e2e.ts`)

- Starts PostgreSQL container before all tests
- Sets up environment variables
- Configures test database URL
- Stops container after all tests complete

### Test Flow

1. **beforeAll**: Start PostgreSQL container, initialize NestJS app
2. **Test execution**: Make HTTP requests to endpoints
3. **Assertions**: Verify response structure and data
4. **afterAll**: Clean up, stop containers

### Example Test

```typescript
it('should create a session with LLM configuration', async () => {
  const response = await request(app.getHttpServer())
    .post('/simulation/sessions')
    .query({ userId: 'test-user' })
    .send({
      orgId: 'test-org',
      type: SessionType.text,
      sessionConfig: {
        llm: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
        },
      },
    })
    .expect(201);

  expect(response.body.sessionConfig.llm.provider).toBe('openai');
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      docker:
        image: docker:dind
        options: --privileged

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          WATSONX_API_KEY: ${{ secrets.WATSONX_API_KEY }}
          WATSONX_PROJECT_ID: ${{ secrets.WATSONX_PROJECT_ID }}
```

## Writing New Tests

### 1. Create Test File

Create a new file in the `test/` directory with suffix `.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SimulationModule } from '../src/microservices/simulation/simulation.module';

describe('My Feature (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SimulationModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should test something', async () => {
    const response = await request(app.getHttpServer())
      .get('/endpoint')
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
```

### 2. Test Best Practices

- **Descriptive names**: Use clear, descriptive test names
- **Isolation**: Each test should be independent
- **Cleanup**: Clean up test data in `afterEach` or `afterAll`
- **Assertions**: Test one thing per test, multiple assertions OK
- **Error cases**: Test both success and failure scenarios
- **Edge cases**: Test boundary conditions and edge cases

### 3. Mocking External Services

For tests that call external APIs (OpenAI, WatsonX):

```typescript
import { LLMProviderRegistry } from '../src/microservices/simulation/providers/llm/llm-provider.registry';

beforeAll(async () => {
  // Mock the provider to avoid real API calls
  const mockProvider = {
    chat: jest.fn().mockResolvedValue({ content: 'mock response' }),
    supportsModel: jest.fn().mockReturnValue(true),
  };

  providerRegistry.registerProvider('openai', mockProvider);
});
```

## Performance Considerations

- **Container startup**: ~5-10 seconds
- **Test execution**: ~1-2 seconds per test
- **Container cleanup**: ~2-3 seconds
- **Total runtime**: Typically 20-40 seconds for full suite

## Additional Resources

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testcontainers Documentation](https://node.testcontainers.org/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
