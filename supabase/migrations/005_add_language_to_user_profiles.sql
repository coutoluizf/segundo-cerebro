-- Migration: Add language column to user_profiles table
-- Adds UI language preference for i18n support

-- Add language column to existing user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.language IS 'UI language preference: en (English), pt (Portuguese), es (Spanish)';

-- Index for faster lookups by language
CREATE INDEX IF NOT EXISTS idx_user_profiles_language ON user_profiles(language);
