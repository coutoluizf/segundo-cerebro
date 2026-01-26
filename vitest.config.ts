/**
 * Vitest configuration for Segundo Cérebro tests
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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
