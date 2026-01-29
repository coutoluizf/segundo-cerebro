/**
 * Vitest configuration for HeyRaji tests
 */

import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Global test timeout
    testTimeout: 30000,
    // Enable type-checking in tests
    typecheck: {
      enabled: true,
    },
    // Environment
    environment: 'node',
    // Include patterns
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Disable file parallelism to avoid E2E test conflicts
    // (E2E tests share the same test user session)
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
