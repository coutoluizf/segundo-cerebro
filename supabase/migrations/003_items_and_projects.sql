-- Migration: Create items and projects tables with pgvector support
-- This replaces the Turso-based storage with native Supabase/PostgreSQL

-- ============================================
-- Enable pgvector extension for embeddings
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Projects table
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at BIGINT NOT NULL,  -- Unix timestamp in milliseconds (JS Date.now())
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- ============================================
-- Items table (voice items, tabs, notes)
-- ============================================
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT DEFAULT 'tab',  -- 'tab' | 'note'
  url TEXT,
  url_hash TEXT NOT NULL,
  title TEXT,
  favicon TEXT,
  thumbnail TEXT,
  source TEXT,
  transcription TEXT NOT NULL,
  ai_summary TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  reason TEXT,
  context_tabs JSONB DEFAULT '[]'::jsonb,  -- Use JSONB for better querying
  context_tab_count INTEGER DEFAULT 0,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  created_at BIGINT NOT NULL,  -- Unix timestamp in milliseconds
  status TEXT DEFAULT 'saved',  -- 'saved' | 'deleted'
  reminder_at BIGINT,  -- Unix timestamp for reminder
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for items
CREATE POLICY "Users can view own items" ON items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own items" ON items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items" ON items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own items" ON items
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_project ON items(project_id);
CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_reminder ON items(reminder_at) WHERE reminder_at IS NOT NULL;

-- Unique constraint: one URL per user (for duplicate detection)
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_user_url_hash ON items(user_id, url_hash);

-- Vector index for fast similarity search (IVFFlat)
-- Note: IVFFlat requires at least some data to build. For empty tables, use HNSW.
-- We'll use HNSW which is faster and doesn't require training
CREATE INDEX IF NOT EXISTS idx_items_embedding ON items
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================
-- Function for semantic search
-- ============================================
CREATE OR REPLACE FUNCTION search_items_by_embedding(
  query_embedding vector(1536),
  query_user_id UUID,
  query_project_id TEXT DEFAULT NULL,
  match_count INTEGER DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id TEXT,
  type TEXT,
  url TEXT,
  url_hash TEXT,
  title TEXT,
  favicon TEXT,
  thumbnail TEXT,
  source TEXT,
  transcription TEXT,
  ai_summary TEXT,
  project_id TEXT,
  reason TEXT,
  context_tabs JSONB,
  context_tab_count INTEGER,
  embedding vector(1536),
  created_at BIGINT,
  status TEXT,
  reminder_at BIGINT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.type,
    i.url,
    i.url_hash,
    i.title,
    i.favicon,
    i.thumbnail,
    i.source,
    i.transcription,
    i.ai_summary,
    i.project_id,
    i.reason,
    i.context_tabs,
    i.context_tab_count,
    i.embedding,
    i.created_at,
    i.status,
    i.reminder_at,
    1 - (i.embedding <=> query_embedding) AS similarity  -- Cosine similarity
  FROM items i
  WHERE i.user_id = query_user_id
    AND i.status = 'saved'
    AND i.embedding IS NOT NULL
    AND (query_project_id IS NULL OR i.project_id = query_project_id)
    AND 1 - (i.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY i.embedding <=> query_embedding  -- Order by distance (ascending)
  LIMIT match_count;
END;
$$;

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE projects IS 'User projects/folders for organizing saved items';
COMMENT ON TABLE items IS 'Voice-saved items (tabs, notes) with transcription and embeddings';
COMMENT ON COLUMN items.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';
COMMENT ON COLUMN items.url_hash IS 'SHA-256 hash of normalized URL for duplicate detection';
COMMENT ON COLUMN items.status IS 'Item status: saved (active), deleted (in trash)';
COMMENT ON FUNCTION search_items_by_embedding IS 'Semantic search using pgvector cosine similarity';
