const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const shouldCollectCoverage =
  process.env.CI === 'true' ||
  process.argv.includes('--coverage') ||
  process.env.JEST_COLLECT_COVERAGE === 'true'

const customJestConfig = {
  displayName: 'web',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    // Handle module aliases (same as Next.js)
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/features/(.*)$': '<rootDir>/src/features/$1',

    // Handle CSS imports (with CSS modules)
    '\\.(css|less|scss|sss|styl)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: ['src/features/auth/stores/**/*.{ts,tsx}'],
  collectCoverage: shouldCollectCoverage,
  coverageDirectory: '<rootDir>/coverage',
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.(test|spec).{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/', // E2E tests directory
    '<rootDir>/src/__tests__/',
  ],
  testTimeout: 10000,
  roots: ['<rootDir>'],
}

const baseConfig = createJestConfig(customJestConfig)

module.exports = async () => {
  const config = await baseConfig()

  config.transformIgnorePatterns = []
  config.extensionsToTreatAsEsm = ['.ts', '.tsx']
  config.transform = {
    '^.+\\.(js|jsx|ts|tsx|mjs)$': [
      'babel-jest',
      {
        presets: ['next/babel'],
        plugins: ['@babel/plugin-transform-modules-commonjs'],
        sourceType: 'unambiguous',
      },
    ],
  }

  if (!shouldCollectCoverage) {
    delete config.coverageThreshold
  }

  return config
}
