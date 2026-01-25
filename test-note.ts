/**
 * Test script for the new "note" feature
 * Tests database migration and saving notes without URL
 */

import { createClient } from '@libsql/client'

// Turso Cloud configuration (same as db.ts)
const TURSO_URL = 'libsql://segundo-cerebro-luizcouto.aws-us-east-1.turso.io'
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjkyOTgwMjUsImlkIjoiZDQ4YTNhZjMtMWFjOC00YzExLTk4ZjQtZmZhNjRjMjQ1YWZiIiwicmlkIjoiYTk5MTZiOTgtYmM3Mi00NDViLThlOWItYzVlMDNiYWZlYjVjIn0.AvWgxq4OVHKWK3Q2G2VIUo_bBimpzGngWCJxUfIeN0sIKueQV1rgpyNE8xra5bOVrPVPd188TSEz0YYsf5xPCQ'

async function testNoteMigration() {
  console.log('🔌 Connecting to Turso...')

  const db = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  })

  try {
    // Check current table schema
    console.log('\n📋 Current table schema:')
    const schema = await db.execute("PRAGMA table_info(items)")
    console.log('Columns:', schema.rows.map(r => r.name))

    // Check if 'type' column exists
    const hasTypeColumn = schema.rows.some(r => r.name === 'type')
    const hasSourceColumn = schema.rows.some(r => r.name === 'source')

    console.log('\n🔍 Column check:')
    console.log('  - type column exists:', hasTypeColumn)
    console.log('  - source column exists:', hasSourceColumn)

    // Add missing columns
    if (!hasTypeColumn) {
      console.log('\n➕ Adding "type" column...')
      await db.execute("ALTER TABLE items ADD COLUMN type TEXT DEFAULT 'tab'")
      console.log('✅ type column added')
    }

    if (!hasSourceColumn) {
      console.log('\n➕ Adding "source" column...')
      await db.execute("ALTER TABLE items ADD COLUMN source TEXT")
      console.log('✅ source column added')
    }

    // Verify columns were added
    console.log('\n📋 Updated table schema:')
    const updatedSchema = await db.execute("PRAGMA table_info(items)")
    console.log('Columns:', updatedSchema.rows.map(r => r.name))

    // Test inserting a note with placeholder URL
    console.log('\n📝 Testing note insertion with placeholder URL...')
    const testId = 'test-note-' + Date.now()
    const noteUrl = `note://local/${testId}` // Placeholder URL for notes
    const testHash = 'test-hash-' + Date.now()

    await db.execute({
      sql: `INSERT INTO items
        (id, type, url, url_hash, title, favicon, source, transcription, project_id, reason, context_tabs, context_tab_count, embedding, created_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        testId,
        'note',
        noteUrl, // Placeholder URL for notes
        testHash,
        null, // No title
        null, // No favicon
        'Twitter @testuser', // Source
        'This is a test note content',
        null,
        null,
        '[]',
        0,
        null,
        Date.now(),
        'saved',
      ],
    })
    console.log('✅ Note inserted successfully with id:', testId)

    // Read it back
    console.log('\n📖 Reading back the note...')
    const result = await db.execute({
      sql: 'SELECT * FROM items WHERE id = ?',
      args: [testId],
    })

    if (result.rows.length > 0) {
      const note = result.rows[0]
      console.log('✅ Note retrieved:')
      console.log('  - type:', note.type)
      console.log('  - url:', note.url)
      console.log('  - source:', note.source)
      console.log('  - transcription:', note.transcription)
    }

    // Clean up test note
    console.log('\n🧹 Cleaning up test note...')
    await db.execute({
      sql: 'DELETE FROM items WHERE id = ?',
      args: [testId],
    })
    console.log('✅ Test note deleted')

    console.log('\n🎉 All tests passed!')

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

testNoteMigration()
