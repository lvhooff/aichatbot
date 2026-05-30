import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenRouterAdapter } from '../../../../src/main/providers/llm/openrouter'

vi.mock('openai', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { choices: [{ delta: { content: 'Hello' } }] }
      yield { choices: [{ delta: { content: ' from OpenRouter' } }] }
    }
  }
  const MockOpenAI = function (this: any) {
    this.chat = {
      completions: {
        create: vi.fn().mockReturnValue(mockStream)
      }
    }
  }
  return { default: MockOpenAI }
})

describe('OpenRouterAdapter', () => {
  let adapter: OpenRouterAdapter

  beforeEach(() => {
    adapter = new OpenRouterAdapter('sk-or-test-key', 'anthropic/claude-opus-4')
  })

  it('streams tokens and returns full text', async () => {
    const tokens: string[] = []
    const result = await adapter.chat([{ role: 'user', content: 'hi' }], (t) => tokens.push(t))
    expect(tokens).toEqual(['Hello', ' from OpenRouter'])
    expect(result).toBe('Hello from OpenRouter')
  })

  it('cancel() does not throw', () => {
    expect(() => adapter.cancel()).not.toThrow()
  })
})
