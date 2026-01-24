/**
 * Typed message protocol for UI <-> Background communication
 * Defines all message types and response types
 */

import type { VoiceItem, Project, CapturedContext, SearchResult, ApiKeys } from './types'

// Event name for items changed broadcast
export const EVENT_ITEMS_CHANGED = 'ITEMS_CHANGED'

// Message types from UI to Background
export type BgMessage =
  | { type: 'SAVE_VOICE_ITEM'; item: Partial<VoiceItem>; transcription: string }
  | { type: 'GET_ITEMS'; limit?: number; projectId?: string }
  | { type: 'SEMANTIC_SEARCH'; query: string; limit?: number }
  | { type: 'GET_PROJECTS' }
  | { type: 'CREATE_PROJECT'; name: string; color?: string }
  | { type: 'DELETE_PROJECT'; id: string }
  | { type: 'GET_CONTEXT' }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'GET_API_KEYS' }
  | { type: 'SET_API_KEYS'; elevenlabs?: string; openai?: string }
  | { type: 'CHECK_API_KEYS' }

// Response types based on message type
export type BgResponse<T extends BgMessage['type']> =
  T extends 'SAVE_VOICE_ITEM' ? { success: boolean; item?: VoiceItem; error?: string } :
  T extends 'GET_ITEMS' ? { items: VoiceItem[] } :
  T extends 'SEMANTIC_SEARCH' ? { results: SearchResult[] } :
  T extends 'GET_PROJECTS' ? { projects: Project[] } :
  T extends 'CREATE_PROJECT' ? { success: boolean; project?: Project; error?: string } :
  T extends 'DELETE_PROJECT' ? { success: boolean; error?: string } :
  T extends 'GET_CONTEXT' ? CapturedContext :
  T extends 'DELETE_ITEM' ? { success: boolean; error?: string } :
  T extends 'GET_API_KEYS' ? ApiKeys :
  T extends 'SET_API_KEYS' ? { success: boolean; error?: string } :
  T extends 'CHECK_API_KEYS' ? { hasKeys: boolean; elevenlabs: boolean; openai: boolean } :
  never

// Helper function to send typed messages to background
export async function sendMessage<T extends BgMessage>(
  message: T
): Promise<BgResponse<T['type']>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(response)
      }
    })
  })
}

// Broadcast event listener helper
export function onItemsChanged(callback: () => void): () => void {
  const handler = (message: { type: string }) => {
    if (message.type === EVENT_ITEMS_CHANGED) {
      callback()
    }
  }

  chrome.runtime.onMessage.addListener(handler)

  // Return cleanup function
  return () => {
    chrome.runtime.onMessage.removeListener(handler)
  }
}
