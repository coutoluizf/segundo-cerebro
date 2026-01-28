/**
 * ⚠️ DEPRECATED - DO NOT USE
 *
 * Esta Edge Function foi criada para a arquitetura original com Turso (database por usuário).
 * Agora usamos Supabase PostgreSQL com RLS (Row Level Security), que não requer
 * provisionamento de database separado por usuário.
 *
 * Este arquivo é mantido apenas para referência histórica.
 *
 * @deprecated Since v0.8.0 - Migrated to Supabase PostgreSQL with RLS
 * @see supabase/migrations/003_items_and_projects.sql for current schema
 *
 * ---
 *
 * Edge Function: provision-turso-db (DEPRECATED)
 *
 * Triggered via Database Webhook on auth.users INSERT (new user signup).
 * Creates a new Turso database for the user and stores credentials.
 *
 * Flow:
 * 1. User signs up → Supabase creates auth.users record
 * 2. Database webhook triggers this function
 * 3. Function creates new Turso database via Platform API
 * 4. Function generates auth token for the database
 * 5. Function initializes schema (items, projects tables)
 * 6. Function stores credentials in user_databases table
 *
 * Webhook payload structure:
 * {
 *   type: 'INSERT',
 *   table: 'users',
 *   schema: 'auth',
 *   record: { id, email, ... },
 *   old_record: null
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Schema SQL to initialize in the new database
const INIT_SCHEMA_SQL = `
-- Create items table for voice-saved content
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'tab',
  url TEXT,
  url_hash TEXT NOT NULL UNIQUE,
  title TEXT,
  favicon TEXT,
  thumbnail TEXT,
  source TEXT,
  transcription TEXT NOT NULL,
  ai_summary TEXT,
  embedding BLOB,
  project_id TEXT,
  reason TEXT,
  context_tabs TEXT,
  context_tab_count INTEGER,
  status TEXT DEFAULT 'saved',
  reminder_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_project ON items(project_id);
CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_reminder ON items(reminder_at) WHERE reminder_at IS NOT NULL;

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Insert default projects
INSERT OR IGNORE INTO projects (id, name, color, created_at) VALUES
  ('proj_inbox', 'Inbox', '#6366f1', strftime('%s', 'now') * 1000),
  ('proj_work', 'Work', '#22c55e', strftime('%s', 'now') * 1000),
  ('proj_personal', 'Personal', '#a855f7', strftime('%s', 'now') * 1000),
  ('proj_learning', 'Learning', '#ef4444', strftime('%s', 'now') * 1000),
  ('proj_other', 'Other', '#6b7280', strftime('%s', 'now') * 1000);
`

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse webhook payload
    const payload = await req.json()
    console.log('Webhook payload:', JSON.stringify(payload, null, 2))

    // Verify this is a user INSERT event
    if (payload.type !== 'INSERT' || payload.table !== 'users' || payload.schema !== 'auth') {
      return new Response(
        JSON.stringify({ message: 'Ignoring non-user-insert event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = payload.record?.id
    const userEmail = payload.record?.email

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user ID in payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Provisioning database for user: ${userId} (${userEmail})`)

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Turso credentials from system config
    const { data: configs, error: configError } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['TURSO_ORG_NAME', 'TURSO_API_TOKEN'])

    if (configError || !configs || configs.length < 2) {
      console.error('Failed to get Turso config:', configError)
      return new Response(
        JSON.stringify({ error: 'System configuration error - Turso credentials missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tursoOrgName = configs.find(c => c.key === 'TURSO_ORG_NAME')?.value
    const tursoApiToken = configs.find(c => c.key === 'TURSO_API_TOKEN')?.value

    if (!tursoOrgName || !tursoApiToken) {
      console.error('Missing Turso credentials in config')
      return new Response(
        JSON.stringify({ error: 'Turso credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate database name (use first 8 chars of user ID for uniqueness)
    const dbNameSuffix = userId.replace(/-/g, '').slice(0, 8)
    const dbName = `heyraji-${dbNameSuffix}`

    console.log(`Creating Turso database: ${dbName}`)

    // Step 1: Create database via Turso Platform API
    const createDbResponse = await fetch(
      `https://api.turso.tech/v1/organizations/${tursoOrgName}/databases`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tursoApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: dbName,
          group: 'default', // Use default group
        }),
      }
    )

    if (!createDbResponse.ok) {
      const error = await createDbResponse.text()
      console.error('Failed to create Turso database:', error)

      // Check if database already exists (409 Conflict)
      if (createDbResponse.status === 409) {
        console.log('Database already exists, fetching existing credentials')
      } else {
        return new Response(
          JSON.stringify({ error: `Failed to create database: ${error}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const dbResult = await createDbResponse.json().catch(() => ({}))
    console.log('Database creation result:', dbResult)

    // Step 2: Get database URL (fetch database info)
    const getDbResponse = await fetch(
      `https://api.turso.tech/v1/organizations/${tursoOrgName}/databases/${dbName}`,
      {
        headers: {
          'Authorization': `Bearer ${tursoApiToken}`,
        },
      }
    )

    if (!getDbResponse.ok) {
      const error = await getDbResponse.text()
      console.error('Failed to get database info:', error)
      return new Response(
        JSON.stringify({ error: `Failed to get database info: ${error}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const dbInfo = await getDbResponse.json()
    const dbUrl = `libsql://${dbInfo.database?.hostname || dbInfo.hostname}`
    console.log('Database URL:', dbUrl)

    // Step 3: Create auth token for the database
    const createTokenResponse = await fetch(
      `https://api.turso.tech/v1/organizations/${tursoOrgName}/databases/${dbName}/auth/tokens`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tursoApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // No expiration for permanent token
        }),
      }
    )

    if (!createTokenResponse.ok) {
      const error = await createTokenResponse.text()
      console.error('Failed to create database token:', error)
      return new Response(
        JSON.stringify({ error: `Failed to create database token: ${error}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokenResult = await createTokenResponse.json()
    const dbToken = tokenResult.jwt
    console.log('Database token created successfully')

    // Step 4: Initialize schema in the new database
    // We need to use libSQL HTTP API to run SQL
    // Split schema into individual statements
    const schemaStatements = [
      // Create items table
      `CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        type TEXT DEFAULT 'tab',
        url TEXT,
        url_hash TEXT NOT NULL UNIQUE,
        title TEXT,
        favicon TEXT,
        thumbnail TEXT,
        source TEXT,
        transcription TEXT NOT NULL,
        ai_summary TEXT,
        embedding BLOB,
        project_id TEXT,
        reason TEXT,
        context_tabs TEXT,
        context_tab_count INTEGER,
        status TEXT DEFAULT 'saved',
        reminder_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      )`,
      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_items_status ON items(status)`,
      `CREATE INDEX IF NOT EXISTS idx_items_project ON items(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)`,
      // Create projects table
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      )`,
      // Insert default projects
      `INSERT OR IGNORE INTO projects (id, name, color, created_at) VALUES ('proj_inbox', 'Inbox', '#6366f1', strftime('%s', 'now') * 1000)`,
      `INSERT OR IGNORE INTO projects (id, name, color, created_at) VALUES ('proj_work', 'Work', '#22c55e', strftime('%s', 'now') * 1000)`,
      `INSERT OR IGNORE INTO projects (id, name, color, created_at) VALUES ('proj_personal', 'Personal', '#a855f7', strftime('%s', 'now') * 1000)`,
      `INSERT OR IGNORE INTO projects (id, name, color, created_at) VALUES ('proj_learning', 'Learning', '#ef4444', strftime('%s', 'now') * 1000)`,
      `INSERT OR IGNORE INTO projects (id, name, color, created_at) VALUES ('proj_other', 'Other', '#6b7280', strftime('%s', 'now') * 1000)`,
    ]

    // Build requests array for batch execution
    const requests = schemaStatements.map(sql => ({
      type: 'execute',
      stmt: { sql },
    }))
    requests.push({ type: 'close' } as any)

    console.log(`Initializing schema with ${schemaStatements.length} statements...`)

    // Use libSQL HTTP Hrana protocol v2
    const httpUrl = dbUrl.replace('libsql://', 'https://')

    // Execute each statement individually to ensure all run
    let schemaInitialized = true
    for (let i = 0; i < schemaStatements.length; i++) {
      const sql = schemaStatements[i]
      console.log(`Executing statement ${i + 1}/${schemaStatements.length}...`)

      try {
        const stmtResponse = await fetch(`${httpUrl}/v2/pipeline`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dbToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              { type: 'execute', stmt: { sql } },
              { type: 'close' },
            ],
          }),
        })

        if (!stmtResponse.ok) {
          const error = await stmtResponse.text()
          console.warn(`Statement ${i + 1} failed:`, stmtResponse.status, error)
          // Continue trying other statements
        } else {
          const result = await stmtResponse.json()
          console.log(`Statement ${i + 1} succeeded`)
        }
      } catch (stmtError) {
        console.warn(`Statement ${i + 1} error:`, stmtError)
      }
    }

    console.log('Schema initialization completed')

    // Step 5: Store credentials in user_databases table
    const { error: insertError } = await supabase
      .from('user_databases')
      .insert({
        user_id: userId,
        turso_db_name: dbName,
        turso_db_url: dbUrl,
        turso_db_token: dbToken,
      })

    if (insertError) {
      console.error('Failed to store database credentials:', insertError)
      // If duplicate, try update instead
      if (insertError.code === '23505') {
        const { error: updateError } = await supabase
          .from('user_databases')
          .update({
            turso_db_name: dbName,
            turso_db_url: dbUrl,
            turso_db_token: dbToken,
          })
          .eq('user_id', userId)

        if (updateError) {
          console.error('Failed to update database credentials:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to store database credentials' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'Failed to store database credentials' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log(`Successfully provisioned database for user ${userId}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database provisioned successfully',
        database: {
          name: dbName,
          url: dbUrl,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
