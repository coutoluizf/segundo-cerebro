/**
 * Edge Function: scribe-token
 *
 * Generates a single-use token for ElevenLabs Scribe v2 WebSocket connection.
 * The token is valid for 15 minutes and one use only.
 * This allows real-time speech-to-text without exposing our API key to clients.
 *
 * Endpoint: GET /functions/v1/scribe-token
 * Response: { token: string, expiresAt: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the JWT token by extracting it from the header
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get ElevenLabs API key from system config
    const { data: config, error: configError } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'ELEVENLABS_API_KEY')
      .single()

    if (configError || !config?.value) {
      console.error('Failed to get ElevenLabs API key:', configError)
      return new Response(
        JSON.stringify({ error: 'System configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Request single-use token from ElevenLabs
    // This token is valid for 15 minutes and can only be used once
    const elevenlabsResponse = await fetch(
      'https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=realtime_scribe',
      {
        method: 'GET',
        headers: {
          'xi-api-key': config.value,
        },
      }
    )

    if (!elevenlabsResponse.ok) {
      // Try alternative endpoint for realtime STT token
      const altResponse = await fetch(
        'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
        {
          method: 'POST',
          headers: {
            'xi-api-key': config.value,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Token configuration
            expires_in_seconds: 900, // 15 minutes
          }),
        }
      )

      if (!altResponse.ok) {
        const error = await altResponse.text()
        console.error('ElevenLabs API error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to generate scribe token' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const altResult = await altResponse.json()
      return new Response(
        JSON.stringify({
          token: altResult.token || altResult.signed_url,
          expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await elevenlabsResponse.json()

    return new Response(
      JSON.stringify({
        token: result.signed_url || result.token,
        expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
