/**
 * Edge Function: generate-summary
 *
 * Proxy for OpenAI GPT-4o-mini to generate page summaries.
 * Uses system API key so users don't need their own OpenAI account.
 *
 * Endpoint: POST /functions/v1/generate-summary
 * Body: { pageContent: string, language: string }
 * Response: { summary: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// System prompts for summarization in different languages
const SYSTEM_PROMPTS: Record<string, string> = {
  'pt-BR': `Você é um assistente que cria resumos concisos de páginas web.
Analise o conteúdo e crie um resumo em 1-2 frases em português brasileiro.
Foque no ponto principal e valor da página.
NÃO mencione "este artigo/página fala sobre" - vá direto ao ponto.`,

  'en-US': `You are an assistant that creates concise web page summaries.
Analyze the content and create a 1-2 sentence summary in English.
Focus on the main point and value of the page.
DO NOT mention "this article/page talks about" - get straight to the point.`,

  'es': `Eres un asistente que crea resúmenes concisos de páginas web.
Analiza el contenido y crea un resumen de 1-2 oraciones en español.
Enfócate en el punto principal y el valor de la página.
NO menciones "este artículo/página habla de" - ve directo al grano.`,

  'fr': `Vous êtes un assistant qui crée des résumés concis de pages web.
Analysez le contenu et créez un résumé de 1-2 phrases en français.
Concentrez-vous sur le point principal et la valeur de la page.
NE mentionnez PAS "cet article/cette page parle de" - allez droit au but.`,

  'de': `Sie sind ein Assistent, der prägnante Zusammenfassungen von Webseiten erstellt.
Analysieren Sie den Inhalt und erstellen Sie eine Zusammenfassung in 1-2 Sätzen auf Deutsch.
Konzentrieren Sie sich auf den Hauptpunkt und den Wert der Seite.
Erwähnen Sie NICHT "dieser Artikel/diese Seite handelt von" - kommen Sie direkt zum Punkt.`,
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

    // Parse request body
    const { pageContent, language = 'pt-BR' } = await req.json()

    if (!pageContent || typeof pageContent !== 'string') {
      return new Response(
        JSON.stringify({ error: 'pageContent is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get OpenAI API key from system config
    const { data: config, error: configError } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'OPENAI_API_KEY')
      .single()

    if (configError || !config?.value) {
      console.error('Failed to get OpenAI API key:', configError)
      return new Response(
        JSON.stringify({ error: 'System configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get system prompt for language (fallback to English)
    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS['en-US']

    // Truncate content if too long (max ~4000 tokens worth)
    const truncatedContent = pageContent.slice(0, 12000)

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: truncatedContent }
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('OpenAI API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate summary' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await openaiResponse.json()
    const summary = result.choices?.[0]?.message?.content || ''

    return new Response(
      JSON.stringify({ summary }),
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
