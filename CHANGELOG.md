# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

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
