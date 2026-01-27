# Changelog

All notable changes to this project will be documented in this file.

## [0.7.2] - 2026-01-27

### Adicionado
- **Detecção de URL duplicada**: Ao tentar salvar uma tab, verifica se a URL já foi salva anteriormente
- **Aviso visual no Popup**: Mostra preview do item existente com data de criação e projeto
- **Opções de ação**: "Atualizar existente" ou "Salvar como novo" para controle total
- **Verificação da URL completa**: Inclui query params para diferenciar posts do Twitter, páginas de produtos, etc.
- **Atualizar com novo thumbnail**: Botão "Atualizar existente" agora captura novo screenshot da página

### Corrigido
- **Screenshot confiável**: Captura de thumbnail agora usa tabId/windowId do popup para maior precisão
- **Query de tab direto**: Popup consulta `chrome.tabs.query` diretamente em vez de passar pelo background

### Técnico
- Nova função `getItemByExactUrl()` em `db.ts` para busca por URL exata (sem normalização)
- Nova mensagem `CHECK_DUPLICATE_URL` para verificação de duplicatas
- Parâmetros `tabId` e `windowId` adicionados às mensagens `SAVE_VOICE_ITEM` e `UPDATE_ITEM`
- Flag `captureNewThumbnail` em `UPDATE_ITEM` para capturar novo screenshot ao atualizar
- Função `updateItem()` agora suporta atualização de thumbnail

## [0.7.1] - 2026-01-27

### Adicionado
- **RajiLogo Component**: Novo componente React reutilizável para o mascote
- **Mascote French Bulldog**: Design "A2" com orelhas de morcego que transbordam o círculo
- **Gradiente laranja/âmbar**: Cores #ff7733 → #f59e0b mantendo identidade visual do app

### Atualizado
- **Dashboard header**: Brain icon substituído por RajiLogo (28px)
- **Dashboard empty state**: Brain icon substituído por RajiLogo (40px)
- **Popup header**: Brain icon substituído por RajiLogo (20px)
- **Popup states**: Todos os estados (loading, sem API, sem mic) com RajiLogo (24px)
- **Recorder header**: Brain icon substituído por RajiLogo (24px)
- **Options header**: Brain icon substituído por RajiLogo (32px)

### Técnico
- Novo componente: `src/components/RajiLogo.tsx`
- Props: `size` (número em pixels) e `className` (estilos adicionais)
- SVG inline com gradiente e comentários explicativos
- Removido import de `Brain` do lucide-react em todos os arquivos

## [0.7.0] - 2026-01-27

### Adicionado
- **Lixeira (Trash)**: Itens deletados vão para lixeira com opção de restaurar ou excluir permanentemente
- **Botão de Lixeira no sidebar**: Acesso rápido à lixeira com contador de itens
- **Restaurar itens**: Recupere itens excluídos acidentalmente com um clique
- **Esvaziar lixeira**: Opção para excluir permanentemente todos os itens da lixeira
- **Confirmação de exclusão**: Dialog de confirmação antes de deletar qualquer item

### Melhorado
- **Embeddings incluem URL e título**: Busca semântica agora considera URL e título do site para melhor relevância (~35% mais preciso)
- **Hover Preview mais controlado**: Delay aumentado para 1.5s e trigger apenas no painel "Resumo AI" (não no card inteiro)
- **Botão "Abrir" mais visível**: Background laranja com texto branco para maior destaque
- **Botão "Excluir" separado**: Movido para longe do "Abrir" para evitar cliques acidentais
- **Transcrição opcional para tabs**: Tabs podem ser salvas sem transcrição (apenas notas exigem texto)

### Técnico
- Novo helper `buildTextForEmbedding()` em `embeddings.ts` para construir texto para embedding
- Novas mensagens: `GET_DELETED_ITEMS`, `RESTORE_ITEM`, `PERMANENT_DELETE_ITEM`, `EMPTY_TRASH`
- Novas funções no banco: `getDeletedItems()`, `restoreItem()`, `emptyTrashItem()`, `emptyAllTrash()`
- Novo componente `TrashView.tsx` para visualização e gerenciamento da lixeira
- Soft delete mantido (status = 'deleted') - dados nunca são perdidos acidentalmente

## [0.6.0] - 2026-01-27

### Changed
- **REBRANDING: Segundo Cérebro → HeyRaji** 🐕
- **New Identity**: Named after Raji, a beloved French Bulldog who passed away
- **New Tagline**: "Your AI companion"

### Updated
- All UI text updated to "HeyRaji"
- Package name changed to `heyraji`
- Notification titles now show "HeyRaji - Reminder"
- HTML page titles updated
- CLAUDE.md updated with new project description

### Technical
- Storage keys preserved for backward compatibility (`segundo-cerebro-*`)
- manifest.json `name` and `short_name` updated

## [0.5.0] - 2026-01-26

### Adicionado
- **Tab Groups por Projeto**: Tabs são organizadas automaticamente em grupos do Chrome por projeto
- **Grupos ao salvar**: Ao salvar tab (sem fechar), adiciona ao grupo do projeto
- **Grupos em lembretes**: Ao disparar lembrete, abre tab no grupo do projeto
- **Grupos ao abrir**: Ao clicar "Abrir" no dashboard, abre no grupo do projeto
- **Setting "Organizar em grupos"**: Toggle em Configurações para habilitar/desabilitar (default: ON)
- **Mapeamento de cores**: Cores dos projetos mapeadas para cores do Chrome (blue, green, purple, orange, red, pink, cyan, yellow, grey)

### Técnico
- Nova permissão: `tabGroups` para gerenciar grupos de abas
- Novo setting: `useTabGroups: boolean` (default: true)
- Nova mensagem: `OPEN_ITEM_URL` para abrir URLs com suporte a grupos
- Funções `findOrCreateTabGroup` e `mapToTabGroupColor` no background

## [0.4.2] - 2026-01-26

### Melhorado
- **Som de lembrete**: Novo chime duplo elegante (C6 → G5) - mais agradável e familiar
- **Layout do Dashboard**: Barra de busca movida para acima do carrossel de Recentes
- **Fluxo de busca**: Resultados aparecem naturalmente abaixo da busca

### Técnico
- Som gerado via Web Audio API (não depende de arquivo MP3)
- Adicionado `web_accessible_resources` ao manifest para suporte a sons

## [0.4.1] - 2026-01-26

### Adicionado
- **Toggle "Fechar tab ao salvar" no Popup**: Switch amigável abaixo do botão Salvar para controlar se a tab fecha após salvar
- **Persistência do toggle**: Ao alterar o switch no popup, a preferência é salva globalmente nas configurações
- **Presets dinâmicos de lembrete**: "Depois do almoço (14h)" de manhã, "Amanhã de manhã (9h)" à tarde
- **Presets curtos para teste**: 1 minuto, 15 minutos, 1 hora nos lembretes

### Melhorado
- **Borda sutil no textarea**: Campo de comentário agora tem borda visível para melhor identificação
- **Espaçamento do popup**: Separação visual entre ReminderPicker e seção de Projeto/Salvar
- **Switch amigável**: Design de toggle estilo iOS com label "Fechar tab ao salvar" para novatos
- **formatReminderTime**: Exibe "em X min" para intervalos curtos (< 2 horas)
- **Tamanho do popup**: Ajustado para 550x600px (limite máximo do Chrome) com scroll

### Técnico
- Parâmetro `closeTabOnSave` adicionado à mensagem `SAVE_VOICE_ITEM` para override por save
- Background usa `message.closeTabOnSave ?? settings.closeTabOnSave` para respeitar override

## [0.4.0] - 2026-01-26

### Adicionado
- **Sistema de Lembretes**: Agende quando uma tab salva deve ser reaberta automaticamente
- **ReminderPicker**: Componente colapsável com presets (amanhã 9h, próxima segunda, 1 semana) e data customizada
- **Notificação + Som**: Ao disparar lembrete, abre tab + notificação do Chrome + som de alerta
- **Badge de lembrete**: Exibição do lembrete agendado nos cards do dashboard e no drawer
- **Close Tab on Save**: Nova configuração para fechar a tab automaticamente após salvar
- **Offscreen Document**: Documento offscreen para reproduzir som mesmo com popup fechado
- **Fallback de áudio**: Geração de tom via Web Audio API quando arquivo de som não disponível
- **Thumbnails automáticos**: Screenshot da tab capturado automaticamente ao salvar (JPEG 400px, ~30KB)
- **Carrossel de Recentes**: Seção horizontal no topo do dashboard mostrando os últimos 8 itens
- **Quick Glance (Hover Preview)**: Preview expandido ao passar o mouse sobre cards (delay 400ms)
- **Visão por Projetos**: Toggle para visualizar projetos como cards visuais com grid 2x2 de thumbnails
- **Fallback com Favicon**: Cards sem thumbnail exibem favicon grande com fundo colorido baseado no projeto

### Melhorado
- **Cards visuais**: Thumbnail em destaque no topo de cada card com gradient overlay
- **Item Detail Drawer**: Thumbnail exibido no topo do drawer para contexto visual
- **Navegação visual**: Thumbnails facilitam identificação rápida de itens salvos

### Técnico
- Nova permissão: `alarms` para agendamento de lembretes
- Nova permissão: `notifications` para alertas visuais
- Nova permissão: `offscreen` para reprodução de áudio em background
- Novo campo `reminder_at` na tabela items com migração automática
- Novo campo `closeTabOnSave` nas configurações do usuário
- Mensagem `UPDATE_ITEM_REMINDER` para atualização de lembretes
- Recreação automática de alarms do banco ao reiniciar o browser
- Cancelamento automático de alarm ao deletar item
- Novo campo `thumbnail TEXT` na tabela items com migração automática
- Utilitário `screenshot.ts` usando `chrome.tabs.captureVisibleTab()` com compressão JPEG
- Componente `FaviconFallback` para fallback visual consistente
- Componente `RecentCarousel` com scroll horizontal e botões de navegação
- Componente `HoverPreview` usando Radix Tooltip com delay configurável
- Componente `ProjectGrid` com grid de projetos e contagem de itens
- ViewMode toggle persistido em localStorage

## [0.3.0] - 2026-01-25

### Adicionado
- **AI Summary**: Resumo automático de páginas usando GPT-4o-mini ao salvar tabs
- **Configuração de idioma**: Escolha o idioma dos resumos AI (9 idiomas suportados)
- **Toggle auto-summarize**: Opção para desabilitar resumo automático nas configurações
- **Item Detail Drawer**: Painel lateral com visão expandida do item ao clicar no card
- **Navegação no Drawer**: Setas ←/→ para navegar entre itens sem fechar o drawer
- **Edição inline**: Editar título, transcrição e resumo AI diretamente no drawer
- **Regeneração de embedding**: Embedding é regenerado automaticamente ao editar conteúdo
- **Voice Search**: Busca por voz no search bar usando ElevenLabs STT
- **Hero Search Bar**: Campo de busca em destaque acima dos cards

### Melhorado
- **Search Bar**: Movido para posição de destaque com suporte a voz
- **Busca semântica**: Embedding agora combina transcrição + resumo AI para melhor relevância

### Técnico
- Novo campo `ai_summary` na tabela items com migração automática
- Mensagem `UPDATE_ITEM` para atualização de campos com regeneração de embedding
- Content script para extração de texto de páginas via `chrome.scripting`
- Testes unitários com Vitest para a feature de AI summary

## [0.2.0] - 2026-01-25

### Adicionado
- **Quick Notes**: Salvar notas rápidas sem URL (modo "Nota Rápida" no popup)
- **Detecção de clipboard**: Detecta texto copiado e sugere criar nota
- **Campo de fonte**: Campo opcional para indicar origem da nota (Twitter, livro, etc.)
- **Light Mode**: Tema claro com bom contraste
- **Theme Toggle**: Dropdown no header para alternar entre Claro/Escuro/Sistema
- **Grid View**: Visualização em 2 ou 3 colunas além do modo lista
- **Persistência de preferências**: View mode e tema salvos no localStorage

### Melhorado
- **UX Redesign completo**: Nova estética "Luminous Mind" inspirada em Apple, Linear, Vercel
- **Contraste no Dark Mode**: Branco puro (#fff) sobre preto puro (#000) como Twitter/X
- **Bordas dos cards**: Mais visíveis para melhor separação visual
- **Tipografia**: Font Inter com hierarquia refinada
- **Animações**: Fade-in suave nos cards, pulse no botão de gravação
- **Cards luminosos**: Gradientes sutis e efeitos de glow no hover

### Corrigido
- Migração do banco para suportar campo `type` e `source`
- URL placeholder para notas (`note://local/{id}`) para contornar constraint NOT NULL

## [0.1.0] - 2026-01-24

### Adicionado
- Estrutura inicial da extensão Chrome MV3
- Gravação de voz com ElevenLabs Scribe v2
- Transcrição em tempo real
- Embeddings via OpenAI text-embedding-3-small
- Busca semântica com similaridade de cosseno
- Dashboard com lista de itens salvos
- Popup para salvar tabs com voz
- Sistema de projetos com cores
- Armazenamento em Turso Cloud (libSQL)
