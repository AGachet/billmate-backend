module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: 'tests/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@common/(.*)$': '<rootDir>/common/$1'
  }
}
