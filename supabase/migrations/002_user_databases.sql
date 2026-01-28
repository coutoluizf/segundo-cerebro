-- Migration: Create user_databases table for multi-tenant Turso credentials
-- Each user gets their own Turso database with isolated data

-- Create the user_databases table
CREATE TABLE IF NOT EXISTS user_databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  turso_db_name TEXT NOT NULL,
  turso_db_url TEXT NOT NULL,
  turso_db_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_databases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own database credentials
CREATE POLICY "Users can view own database" ON user_databases
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own database credentials
CREATE POLICY "Users can update own database" ON user_databases
  FOR UPDATE USING (auth.uid() = user_id);

-- Note: INSERT is handled by the provision-turso-db Edge Function
-- which uses service role key, so no INSERT policy needed for users

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_user_databases_user_id ON user_databases(user_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_databases_updated_at
  BEFORE UPDATE ON user_databases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE user_databases IS 'Stores Turso database credentials per user for multi-tenant isolation';
COMMENT ON COLUMN user_databases.user_id IS 'Foreign key to auth.users - one database per user';
COMMENT ON COLUMN user_databases.turso_db_name IS 'Name of the Turso database (e.g., heyraji-{user_id_prefix})';
COMMENT ON COLUMN user_databases.turso_db_url IS 'Turso database URL (libsql://...)';
COMMENT ON COLUMN user_databases.turso_db_token IS 'Auth token for accessing the Turso database';
