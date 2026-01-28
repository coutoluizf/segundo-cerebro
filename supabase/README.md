# Supabase Setup for HeyRaji

This directory contains the Supabase configuration for the HeyRaji multi-tenant architecture.

## Project Info

- **Project URL**: https://mfczpquwzyrczsnjbgaa.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/mfczpquwzyrczsnjbgaa

## Setup Steps

### 1. Run Migrations

Run the SQL migrations in order via Supabase SQL Editor or CLI:

```bash
# Via Supabase CLI (if logged in)
supabase db push

# Or manually via Dashboard:
# 1. Go to SQL Editor
# 2. Run migrations/001_system_config.sql
# 3. Run migrations/002_user_databases.sql
```

### 2. Configure System API Keys

After creating the `system_config` table, insert your API keys:

```sql
-- Insert via SQL Editor (Dashboard > SQL Editor)
INSERT INTO system_config (key, value, description) VALUES
  ('OPENAI_API_KEY', 'sk-your-openai-key', 'OpenAI API key for embeddings and summarization'),
  ('ELEVENLABS_API_KEY', 'your-elevenlabs-key', 'ElevenLabs API key for speech-to-text'),
  ('TURSO_ORG_NAME', 'luizcouto', 'Turso organization for creating user databases'),
  ('TURSO_API_TOKEN', 'your-turso-platform-token', 'Turso Platform API token');
```

### 3. Deploy Edge Functions

```bash
# Login to Supabase CLI
supabase login

# Link to project
supabase link --project-ref mfczpquwzyrczsnjbgaa

# Deploy all functions
supabase functions deploy generate-summary
supabase functions deploy generate-embedding
supabase functions deploy scribe-token
supabase functions deploy provision-turso-db
```

### 4. Configure Auth Settings

In Supabase Dashboard:

1. Go to **Authentication > Providers**
2. Enable **Email** provider
3. Configure **Magic Link** settings:
   - Confirm email: Enabled
   - Secure email change: Enabled

4. Go to **Authentication > URL Configuration**
5. Add redirect URLs:
   - `chrome-extension://YOUR_EXTENSION_ID/src/auth/index.html`
   - `http://localhost:5173/src/auth/index.html` (for development)

### 5. Configure Database Webhook

Create a webhook to trigger database provisioning on user signup:

1. Go to **Database > Webhooks**
2. Create new webhook:
   - Name: `provision-turso-db`
   - Table: `auth.users`
   - Events: `INSERT`
   - Webhook URL: `https://mfczpquwzyrczsnjbgaa.supabase.co/functions/v1/provision-turso-db`
   - HTTP Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

## Edge Functions

| Function | Purpose |
|----------|---------|
| `generate-summary` | Proxy for OpenAI GPT-4o-mini summarization |
| `generate-embedding` | Proxy for OpenAI text-embedding-3-small |
| `scribe-token` | Generate single-use token for ElevenLabs STT |
| `provision-turso-db` | Create Turso database on user signup |

## Environment Variables

Edge Functions use these environment variables (auto-set by Supabase):
- `SUPABASE_URL` - Project URL
- `SUPABASE_ANON_KEY` - Anonymous key for client requests
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

## Testing

1. Create a test account via the extension Options page
2. Check Supabase Dashboard > Authentication > Users for the new user
3. Check Turso Dashboard for the new database
4. Verify data sync works between devices

## Troubleshooting

### Edge Function Errors

Check function logs in Dashboard > Edge Functions > [function name] > Logs

### Database Provisioning Failed

1. Check webhook is configured correctly
2. Verify TURSO_API_TOKEN is valid
3. Check Edge Function logs for errors

### Auth Issues

1. Verify redirect URLs are configured
2. Check email provider is enabled
3. Verify anon key in extension matches project
