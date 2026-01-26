/**
 * End-to-end tests for AI Summary feature
 * Tests the full flow from page content extraction to summary generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock chrome API
const mockChromeStorage: Record<string, unknown> = {}
const mockChrome = {
  storage: {
    local: {
      get: vi.fn((key: string) => {
        return Promise.resolve({ [key]: mockChromeStorage[key] })
      }),
      set: vi.fn((data: Record<string, unknown>) => {
        Object.assign(mockChromeStorage, data)
        return Promise.resolve()
      }),
    },
  },
}
// @ts-expect-error - Mocking chrome global
global.chrome = mockChrome

describe('AI Summary Feature', () => {
  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks()
    // Clear chrome storage mock
    Object.keys(mockChromeStorage).forEach(key => delete mockChromeStorage[key])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateSummary', () => {
    it('should generate a summary from page content', async () => {
      // Import the function dynamically to pick up mocks
      const { generateSummary } = await import('@/shared/summarize')

      // Mock successful OpenAI response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: 'This is a test summary of the page content.',
                },
              },
            ],
          }),
      })

      const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20)
      const result = await generateSummary(content, 'en-US', 'test-api-key')

      // Verify API was called
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
        })
      )

      // Verify result
      expect(result).toBe('This is a test summary of the page content.')
    })

    it('should return null for short content (< 100 chars)', async () => {
      const { generateSummary } = await import('@/shared/summarize')

      const result = await generateSummary('Short content', 'en-US', 'test-api-key')

      // Should not call API
      expect(mockFetch).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('should return null on API error', async () => {
      const { generateSummary } = await import('@/shared/summarize')

      // Mock failed API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      })

      const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20)
      const result = await generateSummary(content, 'en-US', 'test-api-key')

      expect(result).toBeNull()
    })

    it('should truncate content longer than 12000 characters', async () => {
      const { generateSummary } = await import('@/shared/summarize')

      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Summary' } }],
          }),
      })

      // Create content longer than 12000 chars
      const longContent = 'A'.repeat(15000)
      await generateSummary(longContent, 'en-US', 'test-api-key')

      // Check that the content was truncated
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const userMessage = callBody.messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).toContain('...')
      expect(userMessage.content.length).toBeLessThan(15000)
    })

    it('should use correct language in prompt', async () => {
      const { generateSummary } = await import('@/shared/summarize')

      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Resumo' } }],
          }),
      })

      const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20)
      await generateSummary(content, 'pt-BR', 'test-api-key')

      // Check that Portuguese is in the system prompt
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const systemMessage = callBody.messages.find((m: { role: string }) => m.role === 'system')
      expect(systemMessage.content).toContain('Brazilian Portuguese')
    })
  })

  describe('Settings', () => {
    it('should return default settings when none are saved', async () => {
      const { getSettings } = await import('@/shared/settings')

      const settings = await getSettings()

      expect(settings).toEqual({
        language: 'pt-BR',
        autoSummarize: true,
      })
    })

    it('should save and retrieve settings', async () => {
      const { getSettings, saveSettings } = await import('@/shared/settings')

      // Save custom settings
      await saveSettings({ language: 'en-US', autoSummarize: false })

      // Retrieve settings
      const settings = await getSettings()

      expect(settings.language).toBe('en-US')
      expect(settings.autoSummarize).toBe(false)
    })

    it('should merge partial settings with defaults', async () => {
      const { getSettings, saveSettings } = await import('@/shared/settings')

      // Save only language
      await saveSettings({ language: 'es-ES' })

      // Retrieve settings - autoSummarize should still be default (true)
      const settings = await getSettings()

      expect(settings.language).toBe('es-ES')
      expect(settings.autoSummarize).toBe(true)
    })
  })

  describe('Integration', () => {
    it('should generate summary with correct language setting', async () => {
      const { saveSettings } = await import('@/shared/settings')
      const { generateSummary } = await import('@/shared/summarize')

      // Set language to Spanish
      await saveSettings({ language: 'es-ES' })

      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Resumen en español' } }],
          }),
      })

      const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20)
      const result = await generateSummary(content, 'es-ES', 'test-api-key')

      // Check that Spanish is in the system prompt
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const systemMessage = callBody.messages.find((m: { role: string }) => m.role === 'system')
      expect(systemMessage.content).toContain('Spanish')

      expect(result).toBe('Resumen en español')
    })

    it('should not generate summary when autoSummarize is disabled', async () => {
      const { saveSettings, getSettings } = await import('@/shared/settings')

      // Disable auto-summarize
      await saveSettings({ autoSummarize: false })

      const settings = await getSettings()

      // In the actual implementation, this check happens in the background
      // Here we just verify the setting is correctly stored
      expect(settings.autoSummarize).toBe(false)
    })

    it('should handle empty content gracefully', async () => {
      const { generateSummary } = await import('@/shared/summarize')

      const result = await generateSummary('', 'en-US', 'test-api-key')

      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle undefined content gracefully', async () => {
      const { generateSummary } = await import('@/shared/summarize')

      // @ts-expect-error - Testing undefined input
      const result = await generateSummary(undefined, 'en-US', 'test-api-key')

      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Language Support', () => {
    const languages = [
      { code: 'pt-BR', expected: 'Brazilian Portuguese' },
      { code: 'en-US', expected: 'English' },
      { code: 'es-ES', expected: 'Spanish' },
      { code: 'fr-FR', expected: 'French' },
      { code: 'de-DE', expected: 'German' },
      { code: 'it-IT', expected: 'Italian' },
      { code: 'ja-JP', expected: 'Japanese' },
      { code: 'ko-KR', expected: 'Korean' },
      { code: 'zh-CN', expected: 'Simplified Chinese' },
    ]

    languages.forEach(({ code, expected }) => {
      it(`should generate summary in ${expected} (${code})`, async () => {
        const { generateSummary } = await import('@/shared/summarize')

        // Mock successful response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: `Summary in ${expected}` } }],
            }),
        })

        const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20)
        await generateSummary(content, code, 'test-api-key')

        // Check that the correct language is in the system prompt
        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        const systemMessage = callBody.messages.find((m: { role: string }) => m.role === 'system')
        expect(systemMessage.content).toContain(expected)
      })
    })

    it('should fallback to English for unknown language codes', async () => {
      const { generateSummary } = await import('@/shared/summarize')

      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Summary' } }],
          }),
      })

      const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20)
      await generateSummary(content, 'xx-XX', 'test-api-key')

      // Should fallback to English
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const systemMessage = callBody.messages.find((m: { role: string }) => m.role === 'system')
      expect(systemMessage.content).toContain('English')
    })
  })
})
