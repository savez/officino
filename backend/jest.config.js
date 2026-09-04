module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterSetup: [],
  testTimeout: 15000,
  setupFiles: ['<rootDir>/tests/helpers/set-env.js'],
};
