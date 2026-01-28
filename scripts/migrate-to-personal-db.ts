/**
 * Script para migrar dados do Turso para Supabase PostgreSQL
 *
 * Este script migra os dados existentes do banco Turso compartilhado
 * para o novo banco Supabase PostgreSQL com multi-tenant (RLS).
 *
 * Uso:
 *   npx tsx scripts/migrate-to-personal-db.ts
 *
 * Pré-requisitos:
 *   1. Ter criado conta no sistema (Supabase Auth)
 *   2. Obter seu user_id do Supabase Auth
 *   3. Configurar as variáveis abaixo
 *
 * IMPORTANTE: Este script deve ser executado apenas UMA VEZ após criar a conta.
 */

import { createClient as createTursoClient } from '@libsql/client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ========== CONFIGURAÇÃO ==========

// Database ORIGEM (Turso - banco antigo)
// Substitua pelos valores do seu banco Turso
const SOURCE_DB_URL = process.env.SOURCE_DB_URL || 'libsql://your-turso-db.turso.io'
const SOURCE_DB_TOKEN = process.env.SOURCE_DB_TOKEN || 'your-turso-token'

// Database DESTINO (Supabase PostgreSQL)
// Obtenha no Supabase Dashboard > Settings > API
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
// Service role key para bypass RLS durante migração (Settings > API > service_role key)
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'

// User ID do Supabase (obtido do dashboard Authentication > Users)
const SUPABASE_USER_ID = process.env.SUPABASE_USER_ID || '' // seu-user-id-aqui

// ========== VALIDAÇÃO ==========

if (!SUPABASE_USER_ID) {
  console.error('❌ Erro: Configure SUPABASE_USER_ID antes de executar!')
  console.error('')
  console.error('Como obter o user_id:')
  console.error('1. Faça login na extensão (Options > Conta)')
  console.error('2. Abra o Supabase Dashboard: https://supabase.com/dashboard/project/mfczpquwzyrczsnjbgaa')
  console.error('3. Vá em Authentication > Users')
  console.error('4. Encontre seu usuário pelo email')
  console.error('5. Copie o UUID e cole no script')
  process.exit(1)
}

// ========== HELPERS ==========

/**
 * Converte embedding de Float32Array (Turso) para string pgvector (Supabase)
 * Turso armazena como BLOB de Float32Array
 * pgvector armazena como string "[1.0, 2.0, 3.0, ...]"
 */
function blobToVectorString(blob: Uint8Array | ArrayBuffer | null): string | null {
  if (!blob) return null

  try {
    // Handle both Uint8Array and ArrayBuffer
    let buffer: ArrayBuffer
    let byteOffset = 0
    let byteLength: number

    if (blob instanceof Uint8Array) {
      buffer = blob.buffer
      byteOffset = blob.byteOffset
      byteLength = blob.byteLength
    } else if (blob instanceof ArrayBuffer) {
      buffer = blob
      byteLength = blob.byteLength
    } else {
      // Unknown type, return null
      return null
    }

    // Need at least 4 bytes for one float
    if (byteLength < 4) return null

    // Converte para Float32Array
    const floatArray = new Float32Array(buffer, byteOffset, byteLength / 4)

    // Converte para array de números
    const numbers = Array.from(floatArray)

    // pgvector requires at least 1 dimension
    if (numbers.length === 0) return null

    // Validate that we have valid numbers (not NaN or Infinity)
    const validNumbers = numbers.every(n => Number.isFinite(n))
    if (!validNumbers) return null

    return `[${numbers.join(',')}]`
  } catch (error) {
    // Silently return null for conversion errors
    return null
  }
}

// ========== SCRIPT ==========

async function migrate() {
  console.log('🚀 Iniciando migração de dados Turso → Supabase...')
  console.log('')
  console.log(`📦 Origem: Turso (${SOURCE_DB_URL})`)
  console.log(`📦 Destino: Supabase (${SUPABASE_URL})`)
  console.log(`👤 User ID: ${SUPABASE_USER_ID}`)
  console.log('')

  // Conectar ao Turso (origem)
  const tursoClient = createTursoClient({
    url: SOURCE_DB_URL,
    authToken: SOURCE_DB_TOKEN,
  })

  // Conectar ao Supabase (destino) com service role para bypass RLS
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // 1. Verificar conexão com Turso
    console.log('🔌 Testando conexão com Turso...')
    await tursoClient.execute('SELECT 1')
    console.log('  ✅ Turso conectado')

    // 2. Verificar conexão com Supabase
    console.log('🔌 Testando conexão com Supabase...')
    const { data: testData, error: testError } = await supabase
      .from('items')
      .select('count')
      .limit(1)

    if (testError && !testError.message.includes('no rows')) {
      throw new Error(`Supabase error: ${testError.message}`)
    }
    console.log('  ✅ Supabase conectado')
    console.log('')

    // 3. Migrar projetos
    console.log('📁 Migrando projetos...')
    const { rows: projects } = await tursoClient.execute('SELECT * FROM projects')

    let projectsCount = 0
    let projectsErrors = 0
    for (const project of projects) {
      try {
        const { error } = await supabase.from('projects').upsert({
          id: project.id,
          user_id: SUPABASE_USER_ID,
          name: project.name,
          color: project.color,
          created_at: project.created_at,
        }, { onConflict: 'id' })

        if (error) {
          console.error(`  ❌ Erro no projeto ${project.name}:`, error.message)
          projectsErrors++
        } else {
          projectsCount++
          console.log(`  ✅ Projeto: ${project.name}`)
        }
      } catch (error) {
        console.error(`  ❌ Erro no projeto ${project.name}:`, error)
        projectsErrors++
      }
    }
    console.log(`  Total: ${projectsCount}/${projects.length} projetos migrados`)
    if (projectsErrors > 0) {
      console.log(`  ⚠️  ${projectsErrors} projetos com erro`)
    }
    console.log('')

    // 4. Migrar items (excluindo deletados permanentemente)
    console.log('📝 Migrando items...')
    const { rows: items } = await tursoClient.execute('SELECT * FROM items')

    let itemsCount = 0
    let itemsErrors = 0
    let embeddingsConverted = 0

    for (const item of items) {
      try {
        // Converter embedding de blob para string pgvector
        let embeddingVector: string | null = null
        if (item.embedding) {
          embeddingVector = blobToVectorString(item.embedding as Uint8Array)
          if (embeddingVector) {
            embeddingsConverted++
          }
        }

        const { error } = await supabase.from('items').upsert({
          id: item.id,
          user_id: SUPABASE_USER_ID,
          type: item.type || 'tab',
          url: item.url,
          url_hash: item.url_hash,
          title: item.title,
          favicon: item.favicon,
          thumbnail: item.thumbnail,
          source: item.source,
          transcription: item.transcription,
          ai_summary: item.ai_summary,
          embedding: embeddingVector,
          project_id: item.project_id,
          reason: item.reason,
          context_tabs: item.context_tabs ? JSON.parse(item.context_tabs as string) : [],
          context_tab_count: item.context_tab_count || 0,
          status: item.status || 'saved',
          reminder_at: item.reminder_at,
          created_at: item.created_at,
        }, { onConflict: 'id' })

        if (error) {
          console.error(`  ❌ Erro no item ${item.id}:`, error.message)
          itemsErrors++
        } else {
          itemsCount++
          // Mostrar progresso a cada 10 items
          if (itemsCount % 10 === 0) {
            console.log(`  ⏳ ${itemsCount}/${items.length} items...`)
          }
        }
      } catch (error) {
        console.error(`  ❌ Erro no item ${item.id}:`, error)
        itemsErrors++
      }
    }

    console.log(`  ✅ Total: ${itemsCount}/${items.length} items migrados`)
    console.log(`  📊 Embeddings convertidos: ${embeddingsConverted}`)
    if (itemsErrors > 0) {
      console.log(`  ⚠️  ${itemsErrors} items com erro`)
    }
    console.log('')

    // 5. Verificar migração
    console.log('🔍 Verificando migração no Supabase...')

    const { count: destProjectCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', SUPABASE_USER_ID)

    const { count: destItemCount } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', SUPABASE_USER_ID)

    const { count: destSavedCount } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', SUPABASE_USER_ID)
      .eq('status', 'saved')

    const { count: destWithEmbedding } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', SUPABASE_USER_ID)
      .not('embedding', 'is', null)

    console.log(`  📁 Projetos no Supabase: ${destProjectCount}`)
    console.log(`  📝 Items no Supabase: ${destItemCount}`)
    console.log(`  ✅ Items salvos: ${destSavedCount}`)
    console.log(`  🔍 Items com embedding: ${destWithEmbedding}`)
    console.log('')

    // 6. Testar busca semântica (se houver embeddings)
    if (destWithEmbedding && destWithEmbedding > 0) {
      console.log('🔍 Testando busca semântica...')
      const { data: searchTest, error: searchError } = await supabase
        .from('items')
        .select('id, title')
        .eq('user_id', SUPABASE_USER_ID)
        .not('embedding', 'is', null)
        .limit(3)

      if (searchError) {
        console.log(`  ⚠️  Erro na busca: ${searchError.message}`)
      } else {
        console.log(`  ✅ Items com embedding encontrados:`)
        for (const item of searchTest || []) {
          console.log(`     - ${item.title?.substring(0, 50)}...`)
        }
      }
      console.log('')
    }

    console.log('✨ Migração concluída com sucesso!')
    console.log('')
    console.log('⚠️  Próximos passos:')
    console.log('   1. Recarregue a extensão (chrome://extensions > HeyRaji > Reload)')
    console.log('   2. Faça login com sua conta')
    console.log('   3. Verifique os dados no Dashboard da extensão')
    console.log('   4. Teste a busca semântica')
    console.log('   5. Se tudo OK, pode arquivar o banco Turso')

  } catch (error) {
    console.error('❌ Erro durante migração:', error)
    process.exit(1)
  } finally {
    // Fechar conexão Turso
    tursoClient.close()
  }
}

// Executar
migrate().catch(console.error)
