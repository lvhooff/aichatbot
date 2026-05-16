import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test-aichatbot' }
}))

import { DEFAULT_SETTINGS } from '../../src/main/settings'

describe('DEFAULT_SETTINGS', () => {
  it('has all required provider sections', () => {
    expect(DEFAULT_SETTINGS.llm.provider).toBe('claude')
    expect(DEFAULT_SETTINGS.stt.provider).toBe('whisper-api')
    expect(DEFAULT_SETTINGS.tts.provider).toBe('macos-say')
    expect(DEFAULT_SETTINGS.conversationWindowSize).toBe(10)
  })
})
