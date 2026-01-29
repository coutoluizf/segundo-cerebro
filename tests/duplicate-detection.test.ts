/**
 * Integration tests for Duplicate URL Detection
 * Tests the full flow against the REAL Supabase database
 *
 * These tests use a dedicated test user for authentication.
 * See tests/CLAUDE.md for test user credentials and documentation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loginTestUser, logoutTestUser, TEST_USER } from './setup/auth'
import {
  saveItem,
  getItemByExactUrl,
  getItemByUrlHash,
  deleteItem,
  permanentlyDeleteItem,
} from './setup/test-db'
import { generateUrlHash } from '@/shared/types'

// Test URLs - using unique paths to avoid conflicts with real data
const TEST_URL_BASE = 'https://test-heyraji.example.com/integration-test'
const TEST_URL_1 = `${TEST_URL_BASE}/page-${Date.now()}-1`
const TEST_URL_2 = `${TEST_URL_BASE}/page-${Date.now()}-2`
const TEST_URL_WITH_PARAMS = `${TEST_URL_BASE}/page?id=${Date.now()}&filter=active`

// Track created items for cleanup
const createdItemIds: string[] = []

describe('Duplicate URL Detection - Integration Tests', () => {
  // Login as test user before all tests
  beforeAll(async () => {
    console.log('\n🔐 Authenticating as test user...')
    await loginTestUser()
    console.log('✅ Authenticated')
  })

  // Cleanup: permanently delete all test items and logout
  afterAll(async () => {
    console.log('\n🧹 Cleaning up test items...')
    for (const id of createdItemIds) {
      try {
        await permanentlyDeleteItem(id)
        console.log(`  Deleted: ${id}`)
      } catch (e) {
        console.log(`  Failed to delete ${id}:`, e)
      }
    }
    console.log('✅ Cleanup complete')

    await logoutTestUser()
  })

  describe('URL Hash Generation', () => {
    it('should generate consistent hash for same URL', () => {
      const url = 'https://github.com/user/repo'
      const hash1 = generateUrlHash(url)
      const hash2 = generateUrlHash(url)

      console.log(`URL: ${url}`)
      console.log(`Hash: ${hash1}`)

      expect(hash1).toBe(hash2)
    })

    it('should generate different hash for different URLs', () => {
      const url1 = 'https://github.com/user/repo1'
      const url2 = 'https://github.com/user/repo2'

      const hash1 = generateUrlHash(url1)
      const hash2 = generateUrlHash(url2)

      console.log(`URL1: ${url1} -> Hash: ${hash1}`)
      console.log(`URL2: ${url2} -> Hash: ${hash2}`)

      expect(hash1).not.toBe(hash2)
    })

    it('should generate different hash for URLs with different query params', () => {
      const url1 = 'https://x.com/user/status/12345'
      const url2 = 'https://x.com/user/status/67890'

      const hash1 = generateUrlHash(url1)
      const hash2 = generateUrlHash(url2)

      console.log(`Tweet 1: ${url1} -> Hash: ${hash1}`)
      console.log(`Tweet 2: ${url2} -> Hash: ${hash2}`)

      expect(hash1).not.toBe(hash2)
    })

    it('should generate different hash for trailing slash difference', () => {
      const url1 = 'https://github.com/user/repo'
      const url2 = 'https://github.com/user/repo/'

      const hash1 = generateUrlHash(url1)
      const hash2 = generateUrlHash(url2)

      console.log(`Without slash: ${url1} -> Hash: ${hash1}`)
      console.log(`With slash: ${url2} -> Hash: ${hash2}`)

      // These SHOULD be different (raw comparison)
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('Save and Find by Exact URL', () => {
    it('should save an item and find it by exact URL', async () => {
      console.log(`\n📝 Saving item with URL: ${TEST_URL_1}`)

      // Save a test item
      const savedItem = await saveItem(
        {
          type: 'tab',
          url: TEST_URL_1,
          title: 'Test Page for Duplicate Detection',
          favicon: null,
          thumbnail: null,
          source: null,
          transcription: 'This is a test item for integration testing',
          aiSummary: null,
          projectId: null,
          reason: null,
          contextTabs: [],
          contextTabCount: 0,
          status: 'saved',
          reminderAt: null,
        },
        null // no embedding
      )

      createdItemIds.push(savedItem.id)
      console.log(`✅ Saved item with ID: ${savedItem.id}`)
      console.log(`   URL Hash: ${savedItem.urlHash}`)

      // Now try to find it by exact URL
      console.log(`\n🔍 Searching for URL: ${TEST_URL_1}`)
      const foundItem = await getItemByExactUrl(TEST_URL_1)

      expect(foundItem).not.toBeNull()
      expect(foundItem?.id).toBe(savedItem.id)
      expect(foundItem?.url).toBe(TEST_URL_1)

      console.log(`✅ Found item: ${foundItem?.id}`)
    })

    it('should NOT find item with different URL', async () => {
      console.log(`\n🔍 Searching for non-existent URL: ${TEST_URL_2}`)

      const foundItem = await getItemByExactUrl(TEST_URL_2)

      expect(foundItem).toBeNull()
      console.log('✅ Correctly returned null for non-existent URL')
    })

    it('should find item with query parameters', async () => {
      console.log(`\n📝 Saving item with query params: ${TEST_URL_WITH_PARAMS}`)

      const savedItem = await saveItem(
        {
          type: 'tab',
          url: TEST_URL_WITH_PARAMS,
          title: 'Test Page with Query Params',
          favicon: null,
          thumbnail: null,
          source: null,
          transcription: 'Testing query parameter detection',
          aiSummary: null,
          projectId: null,
          reason: null,
          contextTabs: [],
          contextTabCount: 0,
          status: 'saved',
          reminderAt: null,
        },
        null
      )

      createdItemIds.push(savedItem.id)
      console.log(`✅ Saved item with ID: ${savedItem.id}`)

      // Find by exact URL with params
      const foundItem = await getItemByExactUrl(TEST_URL_WITH_PARAMS)

      expect(foundItem).not.toBeNull()
      expect(foundItem?.url).toBe(TEST_URL_WITH_PARAMS)

      console.log(`✅ Found item with query params`)
    })

    it('should distinguish URLs with different query params', async () => {
      const urlWithDifferentParams = `${TEST_URL_BASE}/page?id=DIFFERENT&filter=inactive`

      console.log(`\n🔍 Searching for URL with different params: ${urlWithDifferentParams}`)

      const foundItem = await getItemByExactUrl(urlWithDifferentParams)

      expect(foundItem).toBeNull()
      console.log('✅ Correctly returned null - different query params are distinct')
    })
  })

  describe('Duplicate Detection Flow', () => {
    const DUPLICATE_TEST_URL = `${TEST_URL_BASE}/duplicate-test-${Date.now()}`

    it('should detect duplicate when saving same URL twice', async () => {
      console.log(`\n📝 Step 1: Save first item with URL: ${DUPLICATE_TEST_URL}`)

      // Save first item
      const firstItem = await saveItem(
        {
          type: 'tab',
          url: DUPLICATE_TEST_URL,
          title: 'First Save',
          favicon: null,
          thumbnail: null,
          source: null,
          transcription: 'First transcription',
          aiSummary: null,
          projectId: null,
          reason: null,
          contextTabs: [],
          contextTabCount: 0,
          status: 'saved',
          reminderAt: null,
        },
        null
      )

      createdItemIds.push(firstItem.id)
      console.log(`✅ First item saved: ${firstItem.id}`)

      // Check if duplicate exists BEFORE saving second
      console.log(`\n🔍 Step 2: Check for duplicate before second save`)
      const duplicateCheck = await getItemByExactUrl(DUPLICATE_TEST_URL)

      expect(duplicateCheck).not.toBeNull()
      expect(duplicateCheck?.id).toBe(firstItem.id)

      console.log(`✅ Duplicate detected! Existing item: ${duplicateCheck?.id}`)
      console.log(`   Title: ${duplicateCheck?.title}`)
      console.log(`   Transcription: ${duplicateCheck?.transcription}`)

      // This simulates what the popup should do - show warning instead of saving
      console.log('\n⚠️  In real app: Would show "URL already saved" warning')
    })

    it('should allow saving after soft delete', async () => {
      const SOFT_DELETE_URL = `${TEST_URL_BASE}/soft-delete-test-${Date.now()}`

      console.log(`\n📝 Save item: ${SOFT_DELETE_URL}`)

      // Save item
      const item = await saveItem(
        {
          type: 'tab',
          url: SOFT_DELETE_URL,
          title: 'Will be deleted',
          favicon: null,
          thumbnail: null,
          source: null,
          transcription: 'This will be soft deleted',
          aiSummary: null,
          projectId: null,
          reason: null,
          contextTabs: [],
          contextTabCount: 0,
          status: 'saved',
          reminderAt: null,
        },
        null
      )

      createdItemIds.push(item.id)
      console.log(`✅ Saved: ${item.id}`)

      // Soft delete it
      console.log(`\n🗑️  Soft deleting item...`)
      await deleteItem(item.id)

      // Check - should NOT find deleted item
      console.log(`\n🔍 Checking for duplicate after soft delete`)
      const afterDelete = await getItemByExactUrl(SOFT_DELETE_URL)

      expect(afterDelete).toBeNull()
      console.log('✅ Deleted items are not considered duplicates')
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long URLs', async () => {
      const longPath = 'a'.repeat(500)
      const longUrl = `${TEST_URL_BASE}/${longPath}`

      console.log(`\n📝 Testing very long URL (${longUrl.length} chars)`)

      const item = await saveItem(
        {
          type: 'tab',
          url: longUrl,
          title: 'Long URL Test',
          favicon: null,
          thumbnail: null,
          source: null,
          transcription: 'Testing very long URL',
          aiSummary: null,
          projectId: null,
          reason: null,
          contextTabs: [],
          contextTabCount: 0,
          status: 'saved',
          reminderAt: null,
        },
        null
      )

      createdItemIds.push(item.id)

      const found = await getItemByExactUrl(longUrl)
      expect(found).not.toBeNull()
      expect(found?.url).toBe(longUrl)

      console.log('✅ Long URLs work correctly')
    })

    it('should handle URLs with special characters', async () => {
      const specialUrl = `${TEST_URL_BASE}/search?q=hello+world&lang=pt-BR&filter=2024%2F01`

      console.log(`\n📝 Testing URL with special chars: ${specialUrl}`)

      const item = await saveItem(
        {
          type: 'tab',
          url: specialUrl,
          title: 'Special Chars Test',
          favicon: null,
          thumbnail: null,
          source: null,
          transcription: 'Testing special characters',
          aiSummary: null,
          projectId: null,
          reason: null,
          contextTabs: [],
          contextTabCount: 0,
          status: 'saved',
          reminderAt: null,
        },
        null
      )

      createdItemIds.push(item.id)

      const found = await getItemByExactUrl(specialUrl)
      expect(found).not.toBeNull()
      expect(found?.url).toBe(specialUrl)

      console.log('✅ Special characters in URLs work correctly')
    })

    it('should handle URL with hash fragment', async () => {
      const urlWithHash = `${TEST_URL_BASE}/docs#section-${Date.now()}`

      console.log(`\n📝 Testing URL with hash: ${urlWithHash}`)

      const item = await saveItem(
        {
          type: 'tab',
          url: urlWithHash,
          title: 'Hash Fragment Test',
          favicon: null,
          thumbnail: null,
          source: null,
          transcription: 'Testing hash fragment',
          aiSummary: null,
          projectId: null,
          reason: null,
          contextTabs: [],
          contextTabCount: 0,
          status: 'saved',
          reminderAt: null,
        },
        null
      )

      createdItemIds.push(item.id)

      const found = await getItemByExactUrl(urlWithHash)
      expect(found).not.toBeNull()
      expect(found?.url).toBe(urlWithHash)

      console.log('✅ URLs with hash fragments work correctly')
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle GitHub repository URLs', async () => {
      const githubUrl = `https://github.com/test-user/test-repo-${Date.now()}`

      console.log(`\n📝 Testing GitHub URL: ${githubUrl}`)

      const item = await saveItem(
        {
          type: 'tab',
          url: githubUrl,
          title: 'Test Repository',
          favicon: 'https://github.githubassets.com/favicons/favicon.svg',
          thumbnail: null,
          source: null,
          transcription: 'Interesting repo about testing',
          aiSummary: null,
          projectId: null,
          reason: null,
          contextTabs: [],
          contextTabCount: 0,
          status: 'saved',
          reminderAt: null,
        },
        null
      )

      createdItemIds.push(item.id)

      // Simulate opening popup on same page
      const duplicate = await getItemByExactUrl(githubUrl)

      expect(duplicate).not.toBeNull()
      expect(duplicate?.title).toBe('Test Repository')

      console.log('✅ GitHub URLs work correctly')
    })

    it('should handle Twitter/X post URLs', async () => {
      const tweetUrl1 = `https://x.com/testuser/status/${Date.now()}1`
      const tweetUrl2 = `https://x.com/testuser/status/${Date.now()}2`

      console.log(`\n📝 Testing Twitter URLs:`)
      console.log(`   Tweet 1: ${tweetUrl1}`)
      console.log(`   Tweet 2: ${tweetUrl2}`)

      // Save first tweet
      const tweet1 = await saveItem(
        {
          type: 'tab',
          url: tweetUrl1,
          title: 'Tweet 1',
          favicon: null,
          thumbnail: null,
          source: null,
          transcription: 'First tweet content',
          aiSummary: null,
          projectId: null,
          reason: null,
          contextTabs: [],
          contextTabCount: 0,
          status: 'saved',
          reminderAt: null,
        },
        null
      )
      createdItemIds.push(tweet1.id)

      // Save second tweet
      const tweet2 = await saveItem(
        {
          type: 'tab',
          url: tweetUrl2,
          title: 'Tweet 2',
          favicon: null,
          thumbnail: null,
          source: null,
          transcription: 'Second tweet content',
          aiSummary: null,
          projectId: null,
          reason: null,
          contextTabs: [],
          contextTabCount: 0,
          status: 'saved',
          reminderAt: null,
        },
        null
      )
      createdItemIds.push(tweet2.id)

      // Each should be found independently
      const found1 = await getItemByExactUrl(tweetUrl1)
      const found2 = await getItemByExactUrl(tweetUrl2)

      expect(found1).not.toBeNull()
      expect(found2).not.toBeNull()
      expect(found1?.id).not.toBe(found2?.id)

      console.log('✅ Different tweets are stored as distinct items')
    })
  })
})
