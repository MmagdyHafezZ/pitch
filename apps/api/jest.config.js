const shouldCollectCoverage =
  process.env.CI === 'true' ||
  process.argv.includes('--coverage') ||
  process.env.JEST_COLLECT_COVERAGE === 'true';

const baseConfig = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/prisma/generated/**',
    '!**/main.ts',
    '!**/*.interface.ts',
    '!**/*.dto.ts',
    '!**/*.module.ts',
    '!**/*.mock.ts',
    '!**/*.factory.ts',
    '!**/*prisma.service.ts',
    '!**/dto/**',
    '!**/interfaces/**',
    '!**/gateway/**',
    '!**/microservices/**/prisma/**',
    '!**/microservices/userManagement/controllers/**',
    '!**/microservices/userManagement/decorators/**',
    '!**/microservices/userManagement/guards/**',
    '!**/microservices/userManagement/strategies/**',
    '!**/microservices/userManagement/repositories/**',
    '!**/microservices/userManagement/services/auth.service.ts',
    '!**/*.spec.ts',
  ],
  collectCoverage: shouldCollectCoverage,
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^src/(.*)$': '<rootDir>/$1',
    '^@api/(.*)$': '<rootDir>/$1',
    '^@gateway/(.*)$': '<rootDir>/gateway/$1',
    '^@microservices/(.*)$': '<rootDir>/microservices/$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@faker-js/faker|uuid)/)',
    '/node_modules/.pnpm/(?!(?:@faker-js\\+faker|uuid)@)',
  ],
  testTimeout: 30000,
};

if (shouldCollectCoverage) {
  baseConfig.coverageThreshold = {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10,
    },
  };
}

module.exports = baseConfig;
