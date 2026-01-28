-- Migration: Security fixes for RLS and RPC
-- Fixes identified in code review:
-- 1. RPC search_items_by_embedding should use auth.uid() automatically (not accept user_id param)
-- 2. system_config should NOT be readable by authenticated users (only service role)

-- ============================================
-- Fix 1: system_config RLS - deny client access
-- Only Edge Functions (via service role) can read API keys
-- ============================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can read config" ON system_config;

-- Create restrictive policy (no one can read via client)
-- Service role bypasses RLS automatically, so Edge Functions still work
CREATE POLICY "No client access to config" ON system_config
  FOR SELECT USING (false);

-- Add comment explaining security model
COMMENT ON POLICY "No client access to config" ON system_config IS
  'API keys are only accessible via Edge Functions (service role). Client SDK cannot read.';

-- ============================================
-- Fix 2: search_items_by_embedding - use auth.uid() automatically
-- Remove query_user_id parameter to prevent cross-user access
-- ============================================

-- Drop and recreate function with secure signature
DROP FUNCTION IF EXISTS search_items_by_embedding(vector(1536), UUID, TEXT, INTEGER, FLOAT);

CREATE OR REPLACE FUNCTION search_items_by_embedding(
  query_embedding vector(1536),
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
SECURITY DEFINER  -- Run with owner privileges but still respect RLS for items table
SET search_path = public
AS $$
BEGIN
  -- Use auth.uid() automatically - no user_id parameter needed
  -- This prevents any possibility of cross-user data access
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
    1 - (i.embedding <=> query_embedding) AS similarity
  FROM items i
  WHERE i.user_id = auth.uid()  -- Secure: always uses authenticated user
    AND i.status = 'saved'
    AND i.embedding IS NOT NULL
    AND (query_project_id IS NULL OR i.project_id = query_project_id)
    AND 1 - (i.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add security comment
COMMENT ON FUNCTION search_items_by_embedding IS
  'Secure semantic search - automatically filters by auth.uid(). No user_id parameter to prevent cross-user access.';

-- ============================================
-- Add FORCE ROW LEVEL SECURITY for extra safety
-- Ensures RLS is enforced even for table owner
-- ============================================
ALTER TABLE items FORCE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
