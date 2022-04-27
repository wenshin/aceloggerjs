// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = Object.assign({
  ...require('./jest.config'),
  testMatch: [
    '**/es/**/__tests__/**/*.[jt]s?(x)',
    '**/es/**/?(*.)+(spec|test).[tj]s?(x)',
    '**/lib/**/__tests__/**/*.[jt]s?(x)',
    '**/lib/**/?(*.)+(spec|test).[tj]s?(x)',
  ],
});
