module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {}, // ignore .babelrc file
  collectCoverage: false, // Enabled by running `npm run test:coverage`
  collectCoverageFrom: [ 'src/**/*.ts' ],
  coverageReporters: [ 'text-summary', 'html' ],
  testMatch: [ '**/*.spec.ts' ], // Remove when all tests are using Jest
  globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/test/manual/tsconfig.json',
    },
  },
  modulePathIgnorePatterns: [
    '<rootDir>/test/.*fixtures',
  ],
};
