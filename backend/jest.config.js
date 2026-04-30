module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/db.js',
    '!src/middleware/**',
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  testTimeout: 30000,
  verbose: true,
};
