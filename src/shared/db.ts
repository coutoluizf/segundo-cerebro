/**
 * Database wrapper using libSQL (Turso Cloud)
 * Stores data in Turso Cloud for persistence and sync
 * Supports vector similarity search for semantic queries
 */

import { createClient, type Client } from '@libsql/client/web'
import type { VoiceItem, Project, SearchResult } from './types'
import { generateId, generateUrlHash, NOTE_URL_PREFIX } from './types'

// Turso Cloud configuration
const TURSO_URL = 'libsql://segundo-cerebro-luizcouto.aws-us-east-1.turso.io'
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjkyOTgwMjUsImlkIjoiZDQ4YTNhZjMtMWFjOC00YzExLTk4ZjQtZmZhNjRjMjQ1YWZiIiwicmlkIjoiYTk5MTZiOTgtYmM3Mi00NDViLThlOWItYzVlMDNiYWZlYjVjIn0.AvWgxq4OVHKWK3Q2G2VIUo_bBimpzGngWCJxUfIeN0sIKueQV1rgpyNE8xra5bOVrPVPd188TSEz0YYsf5xPCQ'

// Database singleton
let db: Client | null = null

// Initialize the database connection
export async function initDatabase(): Promise<Client> {
  if (db) {
    return db
  }

  // Connect to Turso Cloud
  db = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  })

  // Create tables
  await db.batch([
    // Items table with vector embedding support
    `CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      type TEXT DEFAULT 'tab',
      url TEXT,
      url_hash TEXT NOT NULL UNIQUE,
      title TEXT,
      favicon TEXT,
      source TEXT,
      transcription TEXT NOT NULL,
      project_id TEXT,
      reason TEXT,
      context_tabs TEXT,
      context_tab_count INTEGER DEFAULT 0,
      embedding BLOB,
      created_at INTEGER NOT NULL,
      status TEXT DEFAULT 'saved'
    )`,
    // Projects table
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      created_at INTEGER NOT NULL
    )`,
    // Indexes for common queries
    `CREATE INDEX IF NOT EXISTS idx_items_project ON items(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_items_status ON items(status)`,
    `CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)`,
  ])

  // Migration: Add new columns if they don't exist (for existing databases)
  try {
    await db.execute('ALTER TABLE items ADD COLUMN type TEXT DEFAULT \'tab\'')
  } catch {
    // Column already exists, ignore
  }
  try {
    await db.execute('ALTER TABLE items ADD COLUMN source TEXT')
  } catch {
    // Column already exists, ignore
  }

  return db
}

// Get the database instance
export async function getDatabase(): Promise<Client> {
  if (!db) {
    return initDatabase()
  }
  return db
}

// Convert embedding array to blob for storage
function embeddingToBlob(embedding: number[]): Uint8Array {
  const buffer = new Float32Array(embedding)
  return new Uint8Array(buffer.buffer)
}

// Convert blob back to embedding array
function blobToEmbedding(blob: Uint8Array): number[] {
  const buffer = new Float32Array(blob.buffer)
  return Array.from(buffer)
}

// Calculate cosine similarity between two vectors
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

// Save a voice item
export async function saveItem(
  item: Omit<VoiceItem, 'id' | 'createdAt' | 'urlHash' | 'embedding'>,
  embedding: number[] | null
): Promise<VoiceItem> {
  const database = await getDatabase()

  const id = generateId()
  // For notes, use placeholder URL since url column is NOT NULL
  const isNote = item.type === 'note'
  const url = isNote ? `${NOTE_URL_PREFIX}${id}` : item.url
  const urlHash = generateUrlHash(url)
  const createdAt = Date.now()

  const savedItem: VoiceItem = {
    ...item,
    id,
    url,
    urlHash,
    createdAt,
    embedding,
  }

  await database.execute({
    sql: `INSERT OR REPLACE INTO items
      (id, type, url, url_hash, title, favicon, source, transcription, project_id, reason, context_tabs, context_tab_count, embedding, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      item.type || 'tab',
      url,
      urlHash,
      item.title,
      item.favicon,
      item.source,
      item.transcription,
      item.projectId,
      item.reason,
      JSON.stringify(item.contextTabs),
      item.contextTabCount,
      embedding ? embeddingToBlob(embedding) : null,
      createdAt,
      item.status || 'saved',
    ],
  })

  return savedItem
}

// Get items with optional filters
export async function getItems(
  options: { limit?: number; projectId?: string; status?: string } = {}
): Promise<VoiceItem[]> {
  const database = await getDatabase()

  let sql = 'SELECT * FROM items WHERE status = ?'
  const args: (string | number)[] = [options.status || 'saved']

  if (options.projectId) {
    sql += ' AND project_id = ?'
    args.push(options.projectId)
  }

  sql += ' ORDER BY created_at DESC'

  if (options.limit) {
    sql += ' LIMIT ?'
    args.push(options.limit)
  }

  const result = await database.execute({ sql, args })

  return result.rows.map(row => ({
    id: row.id as string,
    type: (row.type as VoiceItem['type']) || 'tab',
    url: (row.url as string) || '', // Fallback to empty string for legacy items
    urlHash: row.url_hash as string,
    title: row.title as string | null,
    favicon: row.favicon as string | null,
    source: row.source as string | null,
    transcription: row.transcription as string,
    projectId: row.project_id as string | null,
    reason: row.reason as string | null,
    contextTabs: JSON.parse((row.context_tabs as string) || '[]'),
    contextTabCount: row.context_tab_count as number,
    embedding: row.embedding ? blobToEmbedding(new Uint8Array(row.embedding as ArrayBuffer)) : null,
    createdAt: row.created_at as number,
    status: row.status as VoiceItem['status'],
  }))
}

// Semantic search using cosine similarity
export async function semanticSearch(
  queryEmbedding: number[],
  options: { limit?: number; projectId?: string } = {}
): Promise<SearchResult[]> {
  const database = await getDatabase()

  // Get all items with embeddings
  let sql = 'SELECT * FROM items WHERE status = ? AND embedding IS NOT NULL'
  const args: (string | number)[] = ['saved']

  if (options.projectId) {
    sql += ' AND project_id = ?'
    args.push(options.projectId)
  }

  const result = await database.execute({ sql, args })

  // Calculate similarity for each item
  const itemsWithSimilarity: SearchResult[] = result.rows.map(row => {
    const embedding = row.embedding ? blobToEmbedding(new Uint8Array(row.embedding as ArrayBuffer)) : null
    const similarity = embedding ? cosineSimilarity(queryEmbedding, embedding) : 0

    return {
      id: row.id as string,
      type: (row.type as VoiceItem['type']) || 'tab',
      url: (row.url as string) || '', // Fallback to empty string for legacy items
      urlHash: row.url_hash as string,
      title: row.title as string | null,
      favicon: row.favicon as string | null,
      source: row.source as string | null,
      transcription: row.transcription as string,
      projectId: row.project_id as string | null,
      reason: row.reason as string | null,
      contextTabs: JSON.parse((row.context_tabs as string) || '[]'),
      contextTabCount: row.context_tab_count as number,
      embedding,
      createdAt: row.created_at as number,
      status: row.status as VoiceItem['status'],
      similarity,
    }
  })

  // Sort by similarity and limit
  const sorted = itemsWithSimilarity.sort((a, b) => b.similarity - a.similarity)
  const limit = options.limit || 10

  return sorted.slice(0, limit)
}

// Delete an item
export async function deleteItem(id: string): Promise<void> {
  const database = await getDatabase()
  await database.execute({
    sql: 'UPDATE items SET status = ? WHERE id = ?',
    args: ['deleted', id],
  })
}

// Update an item's project
export async function updateItemProject(id: string, projectId: string | null): Promise<void> {
  const database = await getDatabase()
  await database.execute({
    sql: 'UPDATE items SET project_id = ? WHERE id = ?',
    args: [projectId, id],
  })
}

// Permanently delete an item
export async function permanentlyDeleteItem(id: string): Promise<void> {
  const database = await getDatabase()
  await database.execute({
    sql: 'DELETE FROM items WHERE id = ?',
    args: [id],
  })
}

// Create a project
export async function createProject(name: string, color?: string): Promise<Project> {
  const database = await getDatabase()

  const id = generateId()
  const createdAt = Date.now()

  await database.execute({
    sql: 'INSERT INTO projects (id, name, color, created_at) VALUES (?, ?, ?, ?)',
    args: [id, name, color || null, createdAt],
  })

  return { id, name, color: color || null, createdAt }
}

// Get all projects
export async function getProjects(): Promise<Project[]> {
  const database = await getDatabase()
  const result = await database.execute('SELECT * FROM projects ORDER BY created_at ASC')

  return result.rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    color: row.color as string | null,
    createdAt: row.created_at as number,
  }))
}

// Update a project
export async function updateProject(id: string, name: string, color?: string): Promise<Project | null> {
  const database = await getDatabase()

  await database.execute({
    sql: 'UPDATE projects SET name = ?, color = ? WHERE id = ?',
    args: [name, color || null, id],
  })

  // Return the updated project
  const result = await database.execute({
    sql: 'SELECT * FROM projects WHERE id = ?',
    args: [id],
  })

  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string | null,
    createdAt: row.created_at as number,
  }
}

// Delete a project
export async function deleteProject(id: string): Promise<void> {
  const database = await getDatabase()
  await database.execute({
    sql: 'DELETE FROM projects WHERE id = ?',
    args: [id],
  })
  // Update items to remove project reference
  await database.execute({
    sql: 'UPDATE items SET project_id = NULL WHERE project_id = ?',
    args: [id],
  })
}

// Check if default projects exist and seed if needed
export async function seedDefaultProjects(): Promise<void> {
  const projects = await getProjects()

  if (projects.length === 0) {
    const defaultProjects = [
      { name: 'Old Jobs (Recrutamento)', color: '#3B82F6' },
      { name: 'NetCartas (Jogos)', color: '#10B981' },
      { name: 'Pessoal', color: '#8B5CF6' },
      { name: 'Rei Eu (E-commerce)', color: '#F59E0B' },
      { name: 'Estudos', color: '#EF4444' },
      { name: 'Outros', color: '#6B7280' },
    ]

    for (const project of defaultProjects) {
      await createProject(project.name, project.color)
    }
  }
}
