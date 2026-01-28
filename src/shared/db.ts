/**
 * Database wrapper using Supabase PostgreSQL
 * Stores data in Supabase Cloud with pgvector for semantic search
 *
 * Multi-tenant architecture:
 * - Each user's data is isolated via Row Level Security (RLS)
 * - user_id is automatically set based on authenticated user
 * - All queries are filtered by auth.uid() via RLS policies
 */

import { getSupabaseClient, getSession } from './supabase'
import type { VoiceItem, Project, SearchResult } from './types'
import { generateId, generateUrlHash, NOTE_URL_PREFIX } from './types'

// ============================================
// Initialization and Connection Management
// ============================================

/**
 * Initialize the database connection
 * For Supabase, this just ensures the client is ready and user is authenticated
 */
export async function initDatabase(): Promise<void> {
  const session = await getSession()
  if (!session) {
    console.log('[Supabase] No active session - database operations will require authentication')
  } else {
    console.log('[Supabase] ✅ Connected to Supabase PostgreSQL')
    console.log('[Supabase] User:', session.user.email, '| ID:', session.user.id)
  }
}

/**
 * Initialize database with user credentials
 * @deprecated With Supabase, credentials are managed via auth session
 * This function is kept for backwards compatibility during migration
 */
export async function initDatabaseWithCredentials(_url: string, _token: string): Promise<void> {
  console.log('[Supabase] initDatabaseWithCredentials is deprecated with Supabase - using auth session instead')
  await initDatabase()
}

/**
 * Disconnect from the database
 * @deprecated With Supabase, connection is managed automatically
 */
export function disconnectDatabase(): void {
  console.log('[Supabase] disconnectDatabase is deprecated with Supabase')
}

/**
 * Check if database is connected with user credentials
 * Returns true if user is authenticated
 */
export async function isUsingUserCredentials(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

/**
 * Get current database credentials
 * @deprecated With Supabase, credentials are managed via auth session
 */
export function getCurrentCredentials(): { url: string; token: string } | null {
  console.log('[Supabase] getCurrentCredentials is deprecated with Supabase')
  return null
}

/**
 * Get the database instance
 * @deprecated Use Supabase client directly via getSupabaseClient()
 */
export async function getDatabase(): Promise<ReturnType<typeof getSupabaseClient>> {
  return getSupabaseClient()
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get current user ID from session
 * Throws if not authenticated
 */
async function getCurrentUserId(): Promise<string> {
  const session = await getSession()
  if (!session) {
    throw new Error('Not authenticated - please sign in')
  }
  return session.user.id
}

/**
 * Convert embedding array to PostgreSQL vector format
 * pgvector expects format: [0.1, 0.2, 0.3, ...]
 */
function embeddingToVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Parse PostgreSQL vector to embedding array
 */
function vectorToEmbedding(vector: string | null): number[] | null {
  if (!vector) return null
  // Vector format: [0.1, 0.2, ...]
  const cleaned = vector.replace('[', '').replace(']', '')
  return cleaned.split(',').map(Number)
}

// ============================================
// Items CRUD Operations
// ============================================

/**
 * Save a voice item
 */
export async function saveItem(
  item: Omit<VoiceItem, 'id' | 'createdAt' | 'urlHash' | 'embedding'>,
  embedding: number[] | null
): Promise<VoiceItem> {
  const supabase = getSupabaseClient()
  const userId = await getCurrentUserId()

  const id = generateId()
  // For notes, use placeholder URL since url column can be empty
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
    ai_summary: item.aiSummary || null,
    project_id: item.projectId,
    reason: item.reason,
    context_tabs: item.contextTabs || [],
    context_tab_count: item.contextTabCount || 0,
    embedding: embedding ? embeddingToVector(embedding) : null,
    created_at: createdAt,
    status: item.status || 'saved',
    reminder_at: item.reminderAt || null,
  })

  if (error) {
    console.error('[Supabase] Failed to save item:', error)
    throw error
  }

  return savedItem
}

/**
 * Get items with optional filters
 */
export async function getItems(
  options: { limit?: number; projectId?: string; status?: string } = {}
): Promise<VoiceItem[]> {
  const supabase = getSupabaseClient()

  let query = supabase
    .from('items')
    .select('*')
    .eq('status', options.status || 'saved')
    .order('created_at', { ascending: false })

  if (options.projectId) {
    query = query.eq('project_id', options.projectId)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Supabase] Failed to get items:', error)
    throw error
  }

  const items = (data || []).map(rowToVoiceItem)
  console.log(`[Supabase] Loaded ${items.length} items from PostgreSQL`)
  return items
}

/**
 * Helper function to convert a database row to VoiceItem
 */
function rowToVoiceItem(row: Record<string, unknown>): VoiceItem {
  return {
    id: row.id as string,
    type: (row.type as VoiceItem['type']) || 'tab',
    url: (row.url as string) || '',
    urlHash: row.url_hash as string,
    title: row.title as string | null,
    favicon: row.favicon as string | null,
    thumbnail: row.thumbnail as string | null,
    source: row.source as string | null,
    transcription: row.transcription as string,
    aiSummary: row.ai_summary as string | null,
    projectId: row.project_id as string | null,
    reason: row.reason as string | null,
    contextTabs: (row.context_tabs as string[]) || [],
    contextTabCount: (row.context_tab_count as number) || 0,
    embedding: vectorToEmbedding(row.embedding as string | null),
    createdAt: row.created_at as number,
    status: row.status as VoiceItem['status'],
    reminderAt: row.reminder_at as number | null,
  }
}

/**
 * Semantic search using pgvector cosine similarity
 */
export async function semanticSearch(
  queryEmbedding: number[],
  options: { limit?: number; projectId?: string } = {}
): Promise<SearchResult[]> {
  const supabase = getSupabaseClient()

  // Call the RPC function for semantic search
  // Note: RPC uses auth.uid() automatically - no user_id parameter needed (security fix)
  const { data, error } = await supabase.rpc('search_items_by_embedding', {
    query_embedding: embeddingToVector(queryEmbedding),
    query_project_id: options.projectId || null,
    match_count: options.limit || 10,
    similarity_threshold: 0.0,
  })

  if (error) {
    console.error('[Supabase] Semantic search failed:', error)
    throw error
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    ...rowToVoiceItem(row),
    similarity: row.similarity as number,
  }))
}

/**
 * Delete an item (soft delete - moves to trash)
 */
export async function deleteItem(id: string): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('items')
    .update({ status: 'deleted' })
    .eq('id', id)

  if (error) {
    console.error('[Supabase] Failed to delete item:', error)
    throw error
  }
}

/**
 * Update an item's project
 */
export async function updateItemProject(id: string, projectId: string | null): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('items')
    .update({ project_id: projectId })
    .eq('id', id)

  if (error) {
    console.error('[Supabase] Failed to update item project:', error)
    throw error
  }
}

/**
 * Update an item's content and optionally its embedding
 */
export async function updateItem(
  id: string,
  updates: { title?: string; transcription?: string; aiSummary?: string; thumbnail?: string },
  embedding?: number[] | null
): Promise<VoiceItem | null> {
  const supabase = getSupabaseClient()

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}

  if (updates.title !== undefined) updateData.title = updates.title
  if (updates.transcription !== undefined) updateData.transcription = updates.transcription
  if (updates.aiSummary !== undefined) updateData.ai_summary = updates.aiSummary
  if (updates.thumbnail !== undefined) updateData.thumbnail = updates.thumbnail
  if (embedding !== undefined) {
    updateData.embedding = embedding ? embeddingToVector(embedding) : null
  }

  if (Object.keys(updateData).length === 0) {
    // Nothing to update, just return the existing item
    return getItemById(id)
  }

  const { error } = await supabase
    .from('items')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('[Supabase] Failed to update item:', error)
    throw error
  }

  // Return the updated item
  return getItemById(id)
}

/**
 * Get a single item by ID
 */
export async function getItemById(id: string): Promise<VoiceItem | null> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('[Supabase] Failed to get item by ID:', error)
    throw error
  }

  return rowToVoiceItem(data)
}

/**
 * Get an item by URL hash (for duplicate detection)
 * Only returns saved items, not deleted ones
 */
export async function getItemByUrlHash(urlHash: string): Promise<VoiceItem | null> {
  const supabase = getSupabaseClient()
  console.log('[Supabase] getItemByUrlHash - searching for urlHash:', urlHash)

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('url_hash', urlHash)
    .eq('status', 'saved')
    .maybeSingle()

  if (error) {
    console.error('[Supabase] Failed to get item by URL hash:', error)
    throw error
  }

  console.log('[Supabase] getItemByUrlHash - found:', data ? 'yes' : 'no')

  if (!data) return null

  const item = rowToVoiceItem(data)
  console.log('[Supabase] getItemByUrlHash - returning item:', item.id, item.url)
  return item
}

/**
 * Get an item by exact URL match (for duplicate detection)
 */
export async function getItemByExactUrl(url: string): Promise<VoiceItem | null> {
  const supabase = getSupabaseClient()
  console.log('[Supabase] getItemByExactUrl - searching for:', url)

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('url', url)
    .eq('status', 'saved')
    .eq('type', 'tab')
    .maybeSingle()

  if (error) {
    console.error('[Supabase] Failed to get item by exact URL:', error)
    throw error
  }

  console.log('[Supabase] getItemByExactUrl - found:', data ? 'yes' : 'no')

  if (!data) return null

  const item = rowToVoiceItem(data)
  console.log('[Supabase] getItemByExactUrl - returning item:', item.id, item.title)
  return item
}

/**
 * Permanently delete an item
 */
export async function permanentlyDeleteItem(id: string): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[Supabase] Failed to permanently delete item:', error)
    throw error
  }
}

// ============================================
// Projects CRUD Operations
// ============================================

/**
 * Create a project
 */
export async function createProject(name: string, color?: string): Promise<Project> {
  const supabase = getSupabaseClient()
  const userId = await getCurrentUserId()

  const id = generateId()
  const createdAt = Date.now()

  const { error } = await supabase.from('projects').insert({
    id,
    user_id: userId,
    name,
    color: color || null,
    created_at: createdAt,
  })

  if (error) {
    console.error('[Supabase] Failed to create project:', error)
    throw error
  }

  return { id, name, color: color || null, createdAt }
}

/**
 * Get all projects
 */
export async function getProjects(): Promise<Project[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[Supabase] Failed to get projects:', error)
    throw error
  }

  return (data || []).map(row => ({
    id: row.id as string,
    name: row.name as string,
    color: row.color as string | null,
    createdAt: row.created_at as number,
  }))
}

/**
 * Update a project
 */
export async function updateProject(id: string, name: string, color?: string): Promise<Project | null> {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('projects')
    .update({ name, color: color || null })
    .eq('id', id)

  if (error) {
    console.error('[Supabase] Failed to update project:', error)
    throw error
  }

  // Return the updated project
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!data) return null

  return {
    id: data.id as string,
    name: data.name as string,
    color: data.color as string | null,
    createdAt: data.created_at as number,
  }
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
  const supabase = getSupabaseClient()

  // Delete the project
  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('[Supabase] Failed to delete project:', deleteError)
    throw deleteError
  }

  // Note: Items with this project_id will have it set to NULL automatically
  // due to ON DELETE SET NULL constraint in the database schema
}

/**
 * Check if default projects exist and seed if needed
 */
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

// ============================================
// Reminder functions
// ============================================

/**
 * Update an item's reminder timestamp
 */
export async function updateItemReminder(id: string, reminderAt: number | null): Promise<VoiceItem | null> {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('items')
    .update({ reminder_at: reminderAt })
    .eq('id', id)

  if (error) {
    console.error('[Supabase] Failed to update item reminder:', error)
    throw error
  }

  return getItemById(id)
}

/**
 * Get all items with pending reminders (for recreating alarms on startup)
 */
export async function getItemsWithPendingReminders(): Promise<VoiceItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('status', 'saved')
    .not('reminder_at', 'is', null)
    .order('reminder_at', { ascending: true })

  if (error) {
    console.error('[Supabase] Failed to get items with pending reminders:', error)
    throw error
  }

  return (data || []).map(rowToVoiceItem)
}

/**
 * Clear an item's reminder after it has been triggered
 */
export async function clearItemReminder(id: string): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('items')
    .update({ reminder_at: null })
    .eq('id', id)

  if (error) {
    console.error('[Supabase] Failed to clear item reminder:', error)
    throw error
  }
}

// ============================================
// Trash functions (soft-deleted items)
// ============================================

/**
 * Get all deleted items (trash)
 */
export async function getDeletedItems(): Promise<VoiceItem[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('status', 'deleted')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Supabase] Failed to get deleted items:', error)
    throw error
  }

  return (data || []).map(rowToVoiceItem)
}

/**
 * Restore a deleted item (move from trash back to saved)
 */
export async function restoreItem(id: string): Promise<VoiceItem | null> {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('items')
    .update({ status: 'saved' })
    .eq('id', id)

  if (error) {
    console.error('[Supabase] Failed to restore item:', error)
    throw error
  }

  return getItemById(id)
}

/**
 * Permanently delete an item from trash
 */
export async function emptyTrashItem(id: string): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .eq('status', 'deleted')

  if (error) {
    console.error('[Supabase] Failed to empty trash item:', error)
    throw error
  }
}

/**
 * Empty all trash (permanently delete all deleted items)
 */
export async function emptyAllTrash(): Promise<number> {
  const supabase = getSupabaseClient()

  // First count how many items we're deleting
  const { count } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'deleted')

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('status', 'deleted')

  if (error) {
    console.error('[Supabase] Failed to empty all trash:', error)
    throw error
  }

  return count || 0
}
