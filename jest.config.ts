export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'], // Định dạng file test là .test.ts
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/src/$1' // Ánh xạ alias `~` tới thư mục `src`
  },
  roots: ['<rootDir>/__tests__', '<rootDir>/src'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  }
}
