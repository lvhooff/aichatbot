import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClaudeAdapter } from '../../../../src/main/providers/llm/claude'

vi.mock('@anthropic-ai/sdk', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } }
      yield { type: 'message_stop' }
    }
  }
  const MockAnthropic = function (this: any) {
    this.messages = {
      stream: vi.fn().mockReturnValue(mockStream)
    }
  }
  return { default: MockAnthropic }
})

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter

  beforeEach(() => {
    adapter = new ClaudeAdapter('test-key', 'claude-sonnet-4-6')
  })

  it('streams tokens and returns full text', async () => {
    const tokens: string[] = []
    const result = await adapter.chat(
      [{ role: 'user', content: 'hi' }],
      (t) => tokens.push(t)
    )
    expect(tokens).toEqual(['Hello', ' world'])
    expect(result).toBe('Hello world')
  })

  it('cancel() does not throw', () => {
    expect(() => adapter.cancel()).not.toThrow()
  })
})
