module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'test',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/setup-e2e.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '^@gateway/(.*)$': '<rootDir>/../src/gateway/$1',
    '^@microservices/(.*)$': '<rootDir>/../src/microservices/$1',
  },
  testTimeout: 60000,
  maxWorkers: 1, // Run E2E tests sequentially
};
