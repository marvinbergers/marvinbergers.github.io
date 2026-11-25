import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/e2e/**/*.spec.js'], testTimeout: 30000, hookTimeout: 30000, fileParallelism: false },
});
