module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)"
  ],
  moduleNameMapper: {
    '^utils/(.*)$': '<rootDir>/utils/$1',
    '^types/(.*)$': '<rootDir>/types/$1'
  }
};
