const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Automatically clear mock calls, instances and results before every test
  clearMocks: true,
  
  // Cache configuration for faster runs
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Run tests in parallel for speed
  maxWorkers: '50%',
  
  // Fail fast on first test failure in CI
  bail: process.env.CI ? 1 : 0,
  
  // Collect coverage from important files
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!app/**/layout.{js,jsx,ts,tsx}',
    '!app/**/loading.{js,jsx,ts,tsx}',
    '!app/**/error.{js,jsx,ts,tsx}',
    '!app/**/not-found.{js,jsx,ts,tsx}',
    '!app/globals.css',
    '!**/*.stories.{js,jsx,ts,tsx}',
    '!**/types/**',
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  
  // Test environment
  testEnvironment: 'jsdom',
  
  // Module name mapping for absolute imports and mocks
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^.+\\.(css|less|scss|sass)$': '<rootDir>/__tests__/mocks/styleMock.js',
    '^.+\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__tests__/mocks/fileMock.js',
  },
  
  // Transform files with SWC for faster compilation
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
          decorators: false,
          dynamicImport: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
          },
        },
      },
    }],
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tools/',
    '<rootDir>/e2e/',
  ],
  
  // Watch mode ignore patterns for better performance
  watchPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tools/',
    '<rootDir>/.jest-cache/',
  ],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)',
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Timeout for tests
  testTimeout: 10000,
  
  // Globals for faster test execution
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)