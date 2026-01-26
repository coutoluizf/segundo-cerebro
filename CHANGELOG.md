# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

## [0.4.0] - 2026-01-26

### Adicionado
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
