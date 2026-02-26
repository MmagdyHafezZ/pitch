const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  rootDir: 'src/microservices/lti',
  testRegex: '.*\\.spec\\.ts$',
  setupFilesAfterEnv: ['<rootDir>/../../../test/setup.ts'],
  coverageDirectory: '../../../coverage/lti',
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/*.interface.ts',
    '!**/*.spec.ts',
    '!**/dto/**',
    '!**/*.module.ts',
    '!**/prisma/**',
    '!**/dist/**',
    '!**/main.ts',
    '!**/controllers/lti.controller.ts',
    '!**/services/lti.service.ts',
    '!**/repositories/lti.repository.ts',
    '!**/services/grade.service.ts',
    '!**/services/launch.service.ts',
  ],
  moduleNameMapper: {
    '^@microservices/(.*)$': '<rootDir>/../$1',
    '^@api/(.*)$': '<rootDir>/../../$1',
    '^@prisma/lti-client$':
      '<rootDir>/__tests__/mocks/prisma-lti-client.mock.ts',
  },
};
