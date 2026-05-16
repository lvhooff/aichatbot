import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaAdapter } from '../../../../src/main/providers/llm/ollama'

vi.mock('ollama', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { message: { content: 'Hey' } }
      yield { message: { content: '!' } }
    }
  }
  const MockOllama = function (this: any) {
    this.chat = vi.fn().mockReturnValue(mockStream)
  }
  return { Ollama: MockOllama }
})

describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter

  beforeEach(() => {
    adapter = new OllamaAdapter('llama3')
  })

  it('streams tokens and returns full text', async () => {
    const tokens: string[] = []
    const result = await adapter.chat(
      [{ role: 'user', content: 'hello' }],
      (t) => tokens.push(t)
    )
    expect(tokens).toEqual(['Hey', '!'])
    expect(result).toBe('Hey!')
  })

  it('cancel() does not throw', () => {
    expect(() => adapter.cancel()).not.toThrow()
  })
})
