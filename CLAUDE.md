# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

HeyRaji is a Chrome extension (Manifest V3) for voice-first tab management with semantic search. Users speak the reason for saving a tab, the system transcribes it, generates embeddings, and enables semantic search across saved items. Named after Raji, a beloved French Bulldog mascot.

**Tagline:** "Your AI companion"

**Core hypothesis:** "If I capture WHY I'm saving something (via voice), I'll find things better later."

## Build Commands

```bash
npm run dev          # Vite dev server (UI hot reload)
npm run build        # Production build to dist/
npm run typecheck    # TypeScript type checking
npm run package      # Build + create zip for Chrome Web Store
```

## Architecture

### Entry Points
- **Background service worker** (`src/background/index.ts`): Message routing, DB operations, embedding generation
- **Popup** (`src/popup/`): Voice capture UI with real-time transcription
- **Dashboard** (`src/dashboard/`): Semantic search and item management
- **Options** (`src/options/`): API key configuration

### Shared Layer (`src/shared/`)
- `db.ts`: libSQL/Turso wrapper with vector similarity search
- `messaging.ts`: Typed message protocol (`BgMessage`/`BgResponse`)
- `types.ts`: Core types (`VoiceItem`, `Project`, `CapturedContext`)
- `scribe.ts`: ElevenLabs Scribe v2 realtime STT client
- `embeddings.ts`: OpenAI text-embedding-3-small client
- `context.ts`: Tab context capture
- `theme.ts`: Dark mode (MV3 CSP-safe)

### API Integrations
- **ElevenLabs Scribe v2**: Real-time speech-to-text via WebSocket
- **OpenAI Embeddings**: text-embedding-3-small for 1536d vectors
- **libSQL (Turso)**: Local SQLite with WASM for vector storage

### Message Flow
UI components call `sendMessage()` → background handles via `chrome.runtime.onMessage` → returns typed response. Background broadcasts `EVENT_ITEMS_CHANGED` for real-time UI updates.

### UI Components
- shadcn/ui primitives in `src/components/ui/`
- Tailwind for styling; use `@/*` path alias for imports

## Key Constraints

- **MV3 CSP**: No inline scripts. Theme detection uses `initSystemTheme()` from `src/shared/theme.ts`
- **shadcn/ui**: Do not modify generated primitives in `src/components/ui/`
- **Overlay z-index**: Dropdowns/dialogs use `z-[2000]`, tooltips use `z-[1000]`
- **API Keys**: Stored in `chrome.storage.local`, never in code

## API Keys Required

| Service | Purpose | Get Key |
|---------|---------|---------|
| ElevenLabs | Voice transcription | https://elevenlabs.io/app/settings/api-keys |
| OpenAI | Embeddings & search | https://platform.openai.com/api-keys |

## Code Style

- Always add comments on code you create
- If you find comments on the code don't remove them
