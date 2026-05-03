module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  // jest globals (beforeEach 등) 가 사용 가능한 setup file —
  // 옵션명은 setupFilesAfterEach 가 아니라 setupFilesAfterEach... 가 아닌
  // jest 29 의 'setupFilesAfterEach' 도 아닌 — 실제는 jest 가 setup file 을
  // 자동 감지하지 않으므로 각 test 파일이 직접 beforeEach 호출. setup.ts
  // 는 글로벌 mock / shim 만 담당.
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
};
