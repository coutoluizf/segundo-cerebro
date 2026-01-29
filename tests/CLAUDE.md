# Tests Documentation

This document describes the test infrastructure for the HeyRaji extension.

## Test User for Integration Tests

A dedicated test user exists in Supabase for running integration tests that require authentication.

### Credentials

| Field | Value |
|-------|-------|
| Email | `test-integration@heyraji.com` |
| Password | `TestPassword123!` |
| User ID | `9375275d-345b-4fb5-846f-f6328aec846c` |

> **Important**: This user should only be used for automated tests. Do not use for manual testing or production purposes.

### Usage

The test setup file `tests/setup/auth.ts` provides helper functions to authenticate as the test user:

```typescript
import { loginTestUser, logoutTestUser, getTestSession } from './setup/auth'

// In your test
beforeAll(async () => {
  await loginTestUser()
})

afterAll(async () => {
  await logoutTestUser()
})
```

## Test Categories

### Unit Tests (`tests/i18n/`)

Pure unit tests that don't require authentication or external services. These tests use mocks for:
- `chrome.storage.local`
- `navigator.language`

Run with: `npm test -- tests/i18n/`

### Integration Tests (`tests/`)

Tests that interact with real Supabase database:
- `duplicate-detection.test.ts` - Tests URL duplicate detection
- `ai-summary.test.ts` - Tests AI summary generation (uses mocks for OpenAI)

These tests require the test user to be authenticated.

Run with: `npm test -- tests/duplicate-detection.test.ts`

### E2E Tests (`tests/e2e/`)

End-to-end tests that test complete user flows:
- `multi-tenant-flow.test.ts` - Tests multi-tenant data isolation

Run with: `npm test -- tests/e2e/`

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/i18n/config.test.ts

# Run tests in watch mode
npm run test:watch

# Run only unit tests (no auth required)
npm test -- tests/i18n/
```

## Test Environment

Tests run in Node.js environment with Vitest. The following globals are mocked:
- `chrome.storage.local` - For extension storage
- `navigator.language` - For browser language detection
- `localStorage` - For Supabase session storage

## Adding New Tests

1. **Unit tests**: Add to appropriate folder, use mocks for external dependencies
2. **Integration tests**: Use `loginTestUser()` in `beforeAll`, clean up data in `afterAll`
3. **E2E tests**: Place in `tests/e2e/`, follow existing patterns

## Cleanup

Integration tests should clean up any data they create. Use unique identifiers (e.g., timestamps) to avoid conflicts with other tests or real data.

```typescript
const TEST_URL = `https://test.example.com/page-${Date.now()}`
const createdItemIds: string[] = []

afterAll(async () => {
  for (const id of createdItemIds) {
    await permanentlyDeleteItem(id)
  }
})
```
