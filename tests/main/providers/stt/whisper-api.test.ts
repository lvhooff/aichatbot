import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WhisperAPIAdapter } from '../../../../src/main/providers/stt/whisper-api'

vi.mock('openai', () => {
  const MockOpenAI = function(this: any) {
    this.audio = {
      transcriptions: {
        create: vi.fn().mockResolvedValue({ text: 'hello world' })
      }
    }
  }
  return { default: MockOpenAI }
})

describe('WhisperAPIAdapter', () => {
  let adapter: WhisperAPIAdapter

  beforeEach(() => {
    adapter = new WhisperAPIAdapter('test-key')
  })

  it('returns transcript text', async () => {
    const buffer = Buffer.from('fake-audio')
    const result = await adapter.transcribe(buffer, 'audio/wav')
    expect(result).toBe('hello world')
  })
})
