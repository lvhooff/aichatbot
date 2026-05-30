import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaAdapter, OLLAMA_CLOUD_HOST } from '../../../../src/main/providers/llm/ollama'

const constructorConfigs: any[] = []

vi.mock('ollama', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { message: { content: 'Hey' } }
      yield { message: { content: '!' } }
    }
  }
  const MockOllama = function (this: any, config: any) {
    constructorConfigs.push(config)
    this.chat = vi.fn().mockReturnValue(mockStream)
  }
  return { Ollama: MockOllama }
})

describe('OllamaAdapter', () => {
  beforeEach(() => {
    constructorConfigs.length = 0
    delete process.env.OLLAMA_API_KEY
  })

  it('streams tokens and returns full text', async () => {
    const adapter = new OllamaAdapter('llama3')
    const tokens: string[] = []
    const result = await adapter.chat([{ role: 'user', content: 'hello' }], (t) => tokens.push(t))
    expect(tokens).toEqual(['Hey', '!'])
    expect(result).toBe('Hey!')
  })

  it('defaults to the local host with no auth header', async () => {
    const adapter = new OllamaAdapter('llama3')
    await adapter.chat([{ role: 'user', content: 'hi' }], () => {})
    expect(constructorConfigs[0].host).toBe('http://localhost:11434')
    expect(constructorConfigs[0].headers).toBeUndefined()
  })

  it('cancel() does not throw', () => {
    expect(() => new OllamaAdapter('llama3').cancel()).not.toThrow()
  })

  describe('cloud', () => {
    it('targets the cloud host and sends a Bearer token', async () => {
      const adapter = new OllamaAdapter('gpt-oss:120b', { apiKey: 'secret-key', cloud: true })
      await adapter.chat([{ role: 'user', content: 'hi' }], () => {})
      expect(constructorConfigs[0].host).toBe(OLLAMA_CLOUD_HOST)
      expect(constructorConfigs[0].headers).toEqual({ Authorization: 'Bearer secret-key' })
    })

    it('falls back to OLLAMA_API_KEY from the environment', async () => {
      process.env.OLLAMA_API_KEY = 'env-key'
      const adapter = new OllamaAdapter('gpt-oss:120b', { cloud: true })
      await adapter.chat([{ role: 'user', content: 'hi' }], () => {})
      expect(constructorConfigs[0].headers).toEqual({ Authorization: 'Bearer env-key' })
    })

    it('throws a helpful error when no API key is configured', async () => {
      const adapter = new OllamaAdapter('gpt-oss:120b', { cloud: true })
      await expect(adapter.chat([{ role: 'user', content: 'hi' }], () => {})).rejects.toThrow(
        /API key not configured/i
      )
    })
  })
})
