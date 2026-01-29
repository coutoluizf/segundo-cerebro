/**
 * Test database utilities
 *
 * Wraps the main db functions to work with the test Supabase client.
 * This module re-exports db functions that use the test client instead of chrome.storage.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getTestSupabaseClient, getTestSession, TEST_USER } from './auth'
import type { VoiceItem, Project, SearchResult } from '@/shared/types'
import { generateId, generateUrlHash, NOTE_URL_PREFIX } from '@/shared/types'

// ============================================
// Helper Functions
// ============================================

/**
 * Get current user ID from test session
 */
function getCurrentUserId(): string {
  const session = getTestSession()
  if (!session) {
    throw new Error('Not authenticated - call loginTestUser() first')
  }
  return session.user.id
}

/**
 * Convert embedding array to PostgreSQL vector format
 */
function embeddingToVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

// ============================================
// Items CRUD Operations
// ============================================

/**
 * Save a voice item using test client
 */
export async function saveItem(
  item: Omit<VoiceItem, 'id' | 'createdAt' | 'urlHash' | 'embedding'>,
  embedding: number[] | null
): Promise<VoiceItem> {
  const supabase = getTestSupabaseClient()
  const userId = getCurrentUserId()

  const id = generateId()
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

  const { error } = await supabase.from('items').insert({
    id,
    user_id: userId,
    type: item.type || 'tab',
    url,
    url_hash: urlHash,
    title: item.title,
    favicon: item.favicon,
    thumbnail: item.thumbnail || null,
    source: item.source,
    transcription: item.transcription,
    ai_summary: item.aiSummary,
    project_id: item.projectId,
    reason: item.reason,
    context_tabs: item.contextTabs || [],
    context_tab_count: item.contextTabCount || 0,
    embedding: embedding ? embeddingToVector(embedding) : null,
    created_at: createdAt,
    status: item.status || 'saved',
    reminder_at: item.reminderAt,
  })

  if (error) {
    console.error('[Test DB] Error saving item:', error)
    throw new Error(`Failed to save item: ${error.message}`)
  }

  console.log('[Test DB] ✅ Saved item:', id)
  return savedItem
}

/**
 * Get item by exact URL using test client
 */
export async function getItemByExactUrl(url: string): Promise<VoiceItem | null> {
  const supabase = getTestSupabaseClient()
  const urlHash = generateUrlHash(url)

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('url_hash', urlHash)
    .eq('status', 'saved')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('[Test DB] Error getting item by URL:', error)
    return null
  }

  return mapRowToItem(data)
}

/**
 * Get item by URL hash using test client
 */
export async function getItemByUrlHash(urlHash: string): Promise<VoiceItem | null> {
  const supabase = getTestSupabaseClient()

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('url_hash', urlHash)
    .eq('status', 'saved')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('[Test DB] Error getting item by hash:', error)
    return null
  }

  return mapRowToItem(data)
}

/**
 * Soft delete an item (move to trash)
 */
export async function deleteItem(id: string): Promise<void> {
  const supabase = getTestSupabaseClient()

  const { error } = await supabase
    .from('items')
    .update({ status: 'deleted' })
    .eq('id', id)

  if (error) {
    console.error('[Test DB] Error deleting item:', error)
    throw new Error(`Failed to delete item: ${error.message}`)
  }

  console.log('[Test DB] ✅ Soft deleted item:', id)
}

/**
 * Permanently delete an item
 */
export async function permanentlyDeleteItem(id: string): Promise<void> {
  const supabase = getTestSupabaseClient()

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[Test DB] Error permanently deleting item:', error)
    throw new Error(`Failed to permanently delete item: ${error.message}`)
  }

  console.log('[Test DB] ✅ Permanently deleted item:', id)
}

/**
 * Get all items for current user
 */
export async function getItems(): Promise<VoiceItem[]> {
  const supabase = getTestSupabaseClient()

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('status', 'saved')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Test DB] Error getting items:', error)
    return []
  }

  return data.map(mapRowToItem)
}

// ============================================
// Helper to map DB row to VoiceItem
// ============================================

function mapRowToItem(row: Record<string, unknown>): VoiceItem {
  return {
    id: row.id as string,
    type: (row.type as 'tab' | 'note') || 'tab',
    url: row.url as string,
    urlHash: row.url_hash as string,
    title: row.title as string | null,
    favicon: row.favicon as string | null,
    thumbnail: row.thumbnail as string | null,
    source: row.source as string | null,
    transcription: row.transcription as string,
    aiSummary: row.ai_summary as string | null,
    projectId: row.project_id as string | null,
    reason: row.reason as string | null,
    contextTabs: (row.context_tabs as Array<{ url: string; title: string }>) || [],
    contextTabCount: (row.context_tab_count as number) || 0,
    embedding: null, // Don't load embeddings in tests
    createdAt: row.created_at as number,
    status: (row.status as 'saved' | 'deleted') || 'saved',
    reminderAt: row.reminder_at as number | null,
  }
}

// ============================================
// Projects CRUD (if needed for tests)
// ============================================

/**
 * Create a project
 */
export async function createProject(name: string, color: string): Promise<Project> {
  const supabase = getTestSupabaseClient()
  const userId = getCurrentUserId()

  const id = generateId()
  const createdAt = Date.now()

  const project: Project = {
    id,
    name,
    color,
    createdAt,
  }

  const { error } = await supabase.from('projects').insert({
    id,
    user_id: userId,
    name,
    color,
    created_at: createdAt,
  })

  if (error) {
    console.error('[Test DB] Error creating project:', error)
    throw new Error(`Failed to create project: ${error.message}`)
  }

  console.log('[Test DB] ✅ Created project:', id)
  return project
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
  const supabase = getTestSupabaseClient()

  const { error } = await supabase.from('projects').delete().eq('id', id)

  if (error) {
    console.error('[Test DB] Error deleting project:', error)
    throw new Error(`Failed to delete project: ${error.message}`)
  }

  console.log('[Test DB] ✅ Deleted project:', id)
}

/**
 * Get all projects for current user
 */
export async function getProjects(): Promise<Project[]> {
  const supabase = getTestSupabaseClient()

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Test DB] Error getting projects:', error)
    return []
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  }))
}
