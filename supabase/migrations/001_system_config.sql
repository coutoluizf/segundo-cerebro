-- Migration: Create system_config table for storing API keys and global settings
-- This table stores API keys that should NOT be exposed to clients

-- Create the system_config table
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read config values
-- Note: This allows reading API keys from the client, which is necessary
-- for Edge Functions to access them. However, Edge Functions run server-side
-- so the actual keys are never exposed to browsers.
CREATE POLICY "Authenticated users can read config" ON system_config
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE system_config IS 'Stores system-wide configuration including API keys';
COMMENT ON COLUMN system_config.key IS 'Configuration key (e.g., OPENAI_API_KEY)';
COMMENT ON COLUMN system_config.value IS 'Configuration value (encrypted for sensitive data)';
COMMENT ON COLUMN system_config.description IS 'Human-readable description of this config';
