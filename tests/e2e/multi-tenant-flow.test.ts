/**
 * E2E Test: Multi-Tenant Flow
 *
 * Tests the complete user journey:
 * 1. Create a new user via Supabase Auth
 * 2. Wait for Turso database provisioning (webhook)
 * 3. Connect to user's personal database
 * 4. Save tabs and notes
 * 5. Generate embeddings via proxy
 * 6. Perform semantic search
 * 7. Cleanup
 *
 * Usage:
 *   npx tsx tests/e2e/multi-tenant-flow.test.ts
 */

import {
  createAnonClient,
  createAdminClient,
  createUserTursoClient,
  EDGE_FUNCTIONS,
  TEST_USER_EMAIL,
  TEST_USER_PASSWORD,
  waitFor,
  sleep,
  generateId,
  logSuccess,
  logError,
  logInfo,
  logStep,
} from './setup'

// Test state
interface TestState {
  userId: string | null
  accessToken: string | null
  tursoUrl: string | null
  tursoToken: string | null
  savedItemIds: string[]
}

const state: TestState = {
  userId: null,
  accessToken: null,
  tursoUrl: null,
  tursoToken: null,
  savedItemIds: [],
}

// ============================================
// Test 1: Create User and Wait for DB Provisioning
// ============================================

async function testCreateUserAndProvisionDB(): Promise<boolean> {
  logStep(1, 'Create User and Wait for DB Provisioning')

  const adminClient = createAdminClient()
  const anonClient = createAnonClient()

  try {
    // Create user via admin API (bypasses email verification)
    logInfo(`Creating test user: ${TEST_USER_EMAIL}`)

    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      email_confirm: true, // Auto-confirm email
    })

    if (createError) {
      logError(`Failed to create user: ${createError.message}`)
      return false
    }

    state.userId = userData.user.id
    logSuccess(`User created with ID: ${state.userId}`)

    // Sign in to get access token
    logInfo('Signing in to get access token...')
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    })

    if (signInError) {
      logError(`Failed to sign in: ${signInError.message}`)
      return false
    }

    state.accessToken = signInData.session.access_token
    logSuccess('Signed in successfully')

    // Wait for Turso database to be provisioned (webhook should trigger)
    logInfo('Waiting for Turso database provisioning (webhook)...')
    logInfo('This may take up to 30 seconds...')

    let dbCredentials: { turso_db_url: string; turso_db_token: string } | null = null

    await waitFor(async () => {
      // Query user_databases table for this user's credentials
      const { data, error } = await adminClient
        .from('user_databases')
        .select('turso_db_url, turso_db_token')
        .eq('user_id', state.userId)
        .single()

      if (error || !data) {
        logInfo('  ... still waiting for database provisioning')
        return false
      }

      dbCredentials = data
      return true
    }, 60000, 3000) // Wait up to 60 seconds, check every 3 seconds

    if (!dbCredentials) {
      logError('Database provisioning timed out')
      return false
    }

    state.tursoUrl = dbCredentials.turso_db_url
    state.tursoToken = dbCredentials.turso_db_token

    logSuccess(`Turso database provisioned: ${state.tursoUrl}`)
    return true
  } catch (error) {
    logError(`Error in test: ${error}`)
    return false
  }
}

// ============================================
// Test 2: Connect to User's Turso Database
// ============================================

async function testConnectToUserDatabase(): Promise<boolean> {
  logStep(2, 'Connect to User\'s Turso Database')

  if (!state.tursoUrl || !state.tursoToken) {
    logError('No Turso credentials available')
    return false
  }

  try {
    const tursoClient = createUserTursoClient(state.tursoUrl, state.tursoToken)

    // Test connection
    logInfo('Testing database connection...')
    const result = await tursoClient.execute('SELECT 1 as test')

    if (result.rows[0]?.test !== 1) {
      logError('Database connection test failed')
      return false
    }

    logSuccess('Database connection successful')

    // Check if schema exists (should be created by provision-turso-db)
    logInfo('Checking database schema...')
    const tablesResult = await tursoClient.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('items', 'projects')"
    )

    const tableNames = tablesResult.rows.map(r => r.name)

    if (!tableNames.includes('items')) {
      logError('Table "items" not found')
      return false
    }

    if (!tableNames.includes('projects')) {
      logError('Table "projects" not found')
      return false
    }

    logSuccess('Database schema verified (items, projects tables exist)')

    tursoClient.close()
    return true
  } catch (error) {
    logError(`Error connecting to database: ${error}`)
    return false
  }
}

// ============================================
// Test 3: Test Edge Function - Generate Summary
// ============================================

async function testGenerateSummary(): Promise<boolean> {
  logStep(3, 'Test Edge Function - Generate Summary')

  if (!state.accessToken) {
    logError('No access token available')
    return false
  }

  try {
    logInfo('Calling generate-summary Edge Function...')

    const response = await fetch(EDGE_FUNCTIONS.generateSummary, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.accessToken}`,
      },
      body: JSON.stringify({
        pageContent: 'This is a test page about JavaScript programming. It covers topics like async/await, promises, and event loops.',
        language: 'en',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logError(`Edge Function error: ${response.status} - ${errorText}`)
      return false
    }

    const data = await response.json()

    if (!data.summary || typeof data.summary !== 'string') {
      logError('Invalid response: missing summary')
      return false
    }

    logSuccess(`Summary generated: "${data.summary.substring(0, 100)}..."`)
    return true
  } catch (error) {
    logError(`Error calling Edge Function: ${error}`)
    return false
  }
}

// ============================================
// Test 4: Test Edge Function - Generate Embedding
// ============================================

async function testGenerateEmbedding(): Promise<boolean> {
  logStep(4, 'Test Edge Function - Generate Embedding')

  if (!state.accessToken) {
    logError('No access token available')
    return false
  }

  try {
    logInfo('Calling generate-embedding Edge Function...')

    const response = await fetch(EDGE_FUNCTIONS.generateEmbedding, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.accessToken}`,
      },
      body: JSON.stringify({
        text: 'This is a test document about machine learning and artificial intelligence.',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logError(`Edge Function error: ${response.status} - ${errorText}`)
      return false
    }

    const data = await response.json()

    if (!data.embedding || !Array.isArray(data.embedding)) {
      logError('Invalid response: missing embedding array')
      return false
    }

    // text-embedding-3-small returns 1536-dimensional vectors
    if (data.embedding.length !== 1536) {
      logError(`Invalid embedding dimension: ${data.embedding.length} (expected 1536)`)
      return false
    }

    logSuccess(`Embedding generated: ${data.embedding.length} dimensions`)
    return true
  } catch (error) {
    logError(`Error calling Edge Function: ${error}`)
    return false
  }
}

// ============================================
// Test 5: Test Edge Function - Scribe Token
// ============================================

async function testScribeToken(): Promise<boolean> {
  logStep(5, 'Test Edge Function - Scribe Token')

  if (!state.accessToken) {
    logError('No access token available')
    return false
  }

  try {
    logInfo('Calling scribe-token Edge Function...')

    const response = await fetch(EDGE_FUNCTIONS.scribeToken, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${state.accessToken}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      logError(`Edge Function error: ${response.status} - ${errorText}`)
      return false
    }

    const data = await response.json()

    if (!data.token || typeof data.token !== 'string') {
      logError('Invalid response: missing token')
      return false
    }

    logSuccess(`Scribe token generated (length: ${data.token.length})`)
    return true
  } catch (error) {
    logError(`Error calling Edge Function: ${error}`)
    return false
  }
}

// ============================================
// Test 6: Save Items to User's Database
// ============================================

async function testSaveItems(): Promise<boolean> {
  logStep(6, 'Save Items to User\'s Database')

  if (!state.tursoUrl || !state.tursoToken || !state.accessToken) {
    logError('Missing credentials')
    return false
  }

  try {
    const tursoClient = createUserTursoClient(state.tursoUrl, state.tursoToken)

    // Generate embedding for the test item
    logInfo('Generating embedding for test tab...')
    const embeddingResponse = await fetch(EDGE_FUNCTIONS.generateEmbedding, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.accessToken}`,
      },
      body: JSON.stringify({
        text: 'React documentation about hooks and state management',
      }),
    })

    const embeddingData = await embeddingResponse.json()
    const embedding = embeddingData.embedding

    // Convert embedding to blob
    const embeddingBuffer = new Float32Array(embedding)
    const embeddingBlob = new Uint8Array(embeddingBuffer.buffer)

    // Save a tab item
    const tabId = generateId()
    const tabCreatedAt = Date.now()

    logInfo('Saving tab item...')
    await tursoClient.execute({
      sql: `INSERT INTO items (
        id, type, url, url_hash, title, favicon, transcription, ai_summary,
        embedding, project_id, context_tabs, context_tab_count, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        tabId,
        'tab',
        'https://react.dev/reference/react/useState',
        `hash-${tabId}`,
        'useState – React',
        'https://react.dev/favicon.ico',
        'Saving this React documentation for later reference on hooks',
        'React useState hook documentation covering state management in functional components',
        embeddingBlob,
        null,
        '[]',
        0,
        'saved',
        tabCreatedAt,
      ],
    })

    state.savedItemIds.push(tabId)
    logSuccess(`Tab saved with ID: ${tabId}`)

    // Save a note item
    const noteId = generateId()
    const noteCreatedAt = Date.now()

    logInfo('Saving note item...')
    await tursoClient.execute({
      sql: `INSERT INTO items (
        id, type, url, url_hash, title, transcription, ai_summary,
        project_id, context_tabs, context_tab_count, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        noteId,
        'note',
        `note://${noteId}`,
        `hash-${noteId}`,
        'Quick note about React hooks',
        'Remember to use useCallback for memoizing functions and useMemo for expensive computations',
        'Note about React performance optimization with hooks',
        null,
        '[]',
        0,
        'saved',
        noteCreatedAt,
      ],
    })

    state.savedItemIds.push(noteId)
    logSuccess(`Note saved with ID: ${noteId}`)

    // Verify items were saved
    const countResult = await tursoClient.execute(
      "SELECT COUNT(*) as count FROM items WHERE status = 'saved'"
    )
    const count = countResult.rows[0]?.count as number

    logSuccess(`Total saved items in database: ${count}`)

    tursoClient.close()
    return true
  } catch (error) {
    logError(`Error saving items: ${error}`)
    return false
  }
}

// ============================================
// Test 7: Query and Search Items
// ============================================

async function testQueryAndSearchItems(): Promise<boolean> {
  logStep(7, 'Query and Search Items')

  if (!state.tursoUrl || !state.tursoToken || !state.accessToken) {
    logError('Missing credentials')
    return false
  }

  try {
    const tursoClient = createUserTursoClient(state.tursoUrl, state.tursoToken)

    // Query all saved items
    logInfo('Querying saved items...')
    const itemsResult = await tursoClient.execute(
      "SELECT id, type, title, transcription FROM items WHERE status = 'saved' ORDER BY created_at DESC"
    )

    logSuccess(`Found ${itemsResult.rows.length} saved items:`)
    for (const row of itemsResult.rows) {
      logInfo(`  - [${row.type}] ${row.title}`)
    }

    // Perform semantic search
    logInfo('Performing semantic search for "React hooks"...')

    // Generate query embedding
    const searchEmbeddingResponse = await fetch(EDGE_FUNCTIONS.generateEmbedding, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.accessToken}`,
      },
      body: JSON.stringify({
        text: 'React hooks documentation',
      }),
    })

    const searchEmbeddingData = await searchEmbeddingResponse.json()
    const queryEmbedding = searchEmbeddingData.embedding

    // Get all items with embeddings
    const embeddingItemsResult = await tursoClient.execute(
      "SELECT id, title, embedding FROM items WHERE status = 'saved' AND embedding IS NOT NULL"
    )

    // Calculate cosine similarity for each item
    const results: Array<{ id: string; title: string; similarity: number }> = []

    for (const row of embeddingItemsResult.rows) {
      if (row.embedding) {
        const itemEmbedding = blobToEmbedding(row.embedding as Uint8Array)
        const similarity = cosineSimilarity(queryEmbedding, itemEmbedding)
        results.push({
          id: row.id as string,
          title: row.title as string,
          similarity,
        })
      }
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity)

    logSuccess('Semantic search results:')
    for (const result of results) {
      logInfo(`  - ${result.title} (similarity: ${result.similarity.toFixed(4)})`)
    }

    tursoClient.close()
    return true
  } catch (error) {
    logError(`Error querying items: ${error}`)
    return false
  }
}

// ============================================
// Cleanup: Delete Test User
// ============================================

async function cleanup(): Promise<void> {
  logStep(8, 'Cleanup')

  const adminClient = createAdminClient()

  if (state.userId) {
    logInfo(`Deleting test user: ${TEST_USER_EMAIL}`)

    try {
      // Delete user (this should cascade delete user_databases entry)
      const { error } = await adminClient.auth.admin.deleteUser(state.userId)

      if (error) {
        logError(`Failed to delete user: ${error.message}`)
      } else {
        logSuccess('Test user deleted')
      }
    } catch (error) {
      logError(`Error during cleanup: ${error}`)
    }
  }

  // Note: Turso database is NOT deleted automatically
  // In production, you'd want a cleanup Edge Function or scheduled job
  logInfo('Note: Turso database is not automatically deleted')
}

// ============================================
// Helper Functions
// ============================================

function blobToEmbedding(blob: Uint8Array): number[] {
  const buffer = new Float32Array(blob.buffer)
  return Array.from(buffer)
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

// ============================================
// Main Test Runner
// ============================================

async function runTests(): Promise<void> {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 E2E Test: Multi-Tenant Flow')
  console.log('='.repeat(60))
  console.log(`Test user: ${TEST_USER_EMAIL}`)
  console.log('='.repeat(60))

  const results: { name: string; passed: boolean }[] = []

  // Run tests in sequence
  const tests = [
    { name: 'Create User and Provision DB', fn: testCreateUserAndProvisionDB },
    { name: 'Connect to User Database', fn: testConnectToUserDatabase },
    { name: 'Generate Summary (Edge Function)', fn: testGenerateSummary },
    { name: 'Generate Embedding (Edge Function)', fn: testGenerateEmbedding },
    { name: 'Scribe Token (Edge Function)', fn: testScribeToken },
    { name: 'Save Items', fn: testSaveItems },
    { name: 'Query and Search Items', fn: testQueryAndSearchItems },
  ]

  for (const test of tests) {
    try {
      const passed = await test.fn()
      results.push({ name: test.name, passed })

      if (!passed) {
        logError(`Test "${test.name}" failed, stopping...`)
        break
      }
    } catch (error) {
      logError(`Test "${test.name}" threw error: ${error}`)
      results.push({ name: test.name, passed: false })
      break
    }
  }

  // Cleanup
  await cleanup()

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Test Results Summary')
  console.log('='.repeat(60))

  let passedCount = 0
  let failedCount = 0

  for (const result of results) {
    if (result.passed) {
      passedCount++
      console.log(`✅ ${result.name}`)
    } else {
      failedCount++
      console.log(`❌ ${result.name}`)
    }
  }

  console.log('='.repeat(60))
  console.log(`Total: ${results.length} tests | Passed: ${passedCount} | Failed: ${failedCount}`)
  console.log('='.repeat(60))

  // Exit with appropriate code
  process.exit(failedCount > 0 ? 1 : 0)
}

// Run tests
runTests().catch(error => {
  logError(`Fatal error: ${error}`)
  process.exit(1)
})
