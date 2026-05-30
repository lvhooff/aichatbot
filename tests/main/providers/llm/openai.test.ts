import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIAdapter } from '../../../../src/main/providers/llm/openai'

vi.mock('openai', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { choices: [{ delta: { content: 'Hi' } }] }
      yield { choices: [{ delta: { content: ' there' } }] }
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

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter

  beforeEach(() => {
    adapter = new OpenAIAdapter('test-key', 'gpt-4o')
  })

  it('streams tokens and returns full text', async () => {
    const tokens: string[] = []
    const result = await adapter.chat([{ role: 'user', content: 'hello' }], (t) => tokens.push(t))
    expect(tokens).toEqual(['Hi', ' there'])
    expect(result).toBe('Hi there')
  })

  it('cancel() does not throw', () => {
    expect(() => adapter.cancel()).not.toThrow()
  })
})
