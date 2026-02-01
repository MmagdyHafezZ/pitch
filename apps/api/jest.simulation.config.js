const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  rootDir: 'src/microservices/simulation',
  testRegex: '.*\\.spec\\.ts$',
  setupFilesAfterEnv: ['<rootDir>/../../../test/setup.ts'],
  coverageDirectory: '../../../coverage/simulation',
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/*.interface.ts',
    '!**/*.spec.ts',
    '!**/dto/**',
    '!**/*.module.ts',
    '!**/schemas/**',
    '!**/services/redis/**',
    '!**/prisma/**',
    '!**/dist/**',
    '!**/main.ts',
  ],
  moduleNameMapper: {
    '^@microservices/(.*)$': '<rootDir>/../$1',
    '^@nestjs/config$': '<rootDir>/__tests__/mocks/nestjs-config.ts',
  },
};
