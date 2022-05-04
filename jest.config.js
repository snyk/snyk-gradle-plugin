module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {}, // ignore .babelrc file
  collectCoverage: false, // Enabled by running `npm run test:coverage`
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['text-summary', 'html'],
  testMatch: [
    '<rootDir>/test/*.spec.ts',
    '<rootDir>/test/manual/*.spec.ts',
    '<rootDir>/test/functional/*.spec.ts',
    '<rootDir>/test/system/*.test.ts',
  ], // Remove when all tests are using Jest
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/test/manual/tsconfig.json',
    },
  },
  modulePathIgnorePatterns: ['<rootDir>/test/.*fixtures'],
};
