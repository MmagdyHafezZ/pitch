module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'test',
  testRegex: '.*\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/setup-integration.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../src/$1',
  },
  testTimeout: 60000,
  maxWorkers: 1, // Run integration tests sequentially
};
