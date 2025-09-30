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
    '!**/*.spec.ts',
  ],
  collectCoverage: shouldCollectCoverage,
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^src/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: ['node_modules/(?!(@faker-js/faker)/)'],
  testTimeout: 30000,
};

if (shouldCollectCoverage) {
  baseConfig.coverageThreshold = {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  };
}

module.exports = baseConfig;
