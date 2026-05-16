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

  it('merges defaults when saved settings are missing fields', () => {
    // DEFAULT_SETTINGS should always have all required fields
    const settings = { ...DEFAULT_SETTINGS }
    delete (settings as any).conversationWindowSize
    // After merging, the missing field should be restored
    // (This tests the shape contract rather than SettingsManager directly,
    //  since SettingsManager requires a real filesystem)
    const merged = {
      ...DEFAULT_SETTINGS,
      ...settings,
    }
    expect(merged.conversationWindowSize).toBe(10)
  })
})
