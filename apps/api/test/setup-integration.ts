// Global test setup for integration tests
import 'reflect-metadata';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

let postgresContainer: StartedTestContainer;

beforeAll(async () => {
  // Start PostgreSQL container for integration tests
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

// Increase timeout for integration tests
jest.setTimeout(60000);
