// Global test setup for E2E tests
import 'reflect-metadata';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  'test-secret-key-for-e2e-testing-minimum-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-key-for-e2e-testing-minimum-32-characters';

// Use existing local Postgres container instead of testcontainers
// The container pitch-postgres-user-local is already running on port 5439
const USE_EXISTING_DB = process.env.USE_EXISTING_DB !== 'false';

if (USE_EXISTING_DB) {
  // Use the existing local database (pitch-postgres-user-local on port 5439)
  // You can override these with environment variables
  const dbHost = process.env.TEST_DB_HOST || 'localhost';
  const dbPort = process.env.TEST_DB_PORT || '5439';
  const dbName = process.env.TEST_DB_NAME || 'pitch_user';
  const dbUser = process.env.TEST_DB_USER || 'pitch_user';
  const dbPassword = process.env.TEST_DB_PASSWORD || 'pitch_admin';

  process.env.DATABASE_URL = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
  console.log(`Using existing database: ${dbHost}:${dbPort}/${dbName}`);
} else {
  // Fallback: Use testcontainers (requires Docker runtime detection)
  const { GenericContainer, StartedTestContainer } = require('testcontainers');
  let postgresContainer: StartedTestContainer;

  beforeAll(async () => {
    postgresContainer = await new GenericContainer('postgres:15-alpine')
      .withEnvironment({
        POSTGRES_DB: 'test_db',
        POSTGRES_USER: 'test_user',
        POSTGRES_PASSWORD: 'test_password',
      })
      .withExposedPorts(5432)
      .start();

    const port = postgresContainer.getMappedPort(5432);
    const host = postgresContainer.getHost();

    process.env.DATABASE_URL = `postgresql://test_user:test_password@${host}:${port}/test_db`;
  }, 60000);

  afterAll(async () => {
    if (postgresContainer) {
      await postgresContainer.stop();
    }
  }, 10000);
}

// Increase timeout for E2E tests
jest.setTimeout(60000);
