module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@configs/(.*)$': '<rootDir>/configs/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@test-configs/(.*)$': '<rootDir>/../test-configs/$1'
  },
  setupFilesAfterEnv: ['../test-configs/unit-mocks-glob.ts']
}
