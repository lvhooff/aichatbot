import { Ollama } from 'ollama'
import type { LLMAdapter, Message } from './interface'

export const OLLAMA_CLOUD_HOST = 'https://ollama.com'

interface OllamaOptions {
  /** Host override. Defaults to local Ollama. Use OLLAMA_CLOUD_HOST for cloud. */
  baseUrl?: string
  /** API key for Ollama's hosted cloud. Local Ollama needs no key. */
  apiKey?: string
  /** When true, an API key is required and validated before the first request. */
  cloud?: boolean
}

export class OllamaAdapter implements LLMAdapter {
  private _client?: Ollama
  private host: string
  private cloud: boolean

  constructor(
    private model: string,
    options: OllamaOptions = {}
  ) {
    this.cloud = options.cloud ?? false
    this.host = options.baseUrl ?? (this.cloud ? OLLAMA_CLOUD_HOST : 'http://localhost:11434')
    this._apiKey = options.apiKey
  }

  private _apiKey?: string

  // Lazily resolve the key (settings or env) so an empty key doesn't crash at
  // construction and the error only surfaces when the cloud is actually used.
  private get client(): Ollama {
    if (!this._client) {
      let headers: Record<string, string> | undefined
      if (this.cloud) {
        const key = this._apiKey || process.env['OLLAMA_API_KEY'] || ''
        if (!key) {
          throw new Error(
            'Ollama Cloud API key not configured — open Settings or set OLLAMA_API_KEY'
          )
        }
        headers = { Authorization: `Bearer ${key}` }
      }
      this._client = new Ollama({ host: this.host, headers })
    }
    return this._client
  }

  async chat(messages: Message[], onToken: (token: string) => void): Promise<string> {
    let fullText = ''

    const stream = await this.client.chat({ model: this.model, messages, stream: true })

    for await (const chunk of stream) {
      const token = chunk.message.content
      if (token) {
        onToken(token)
        fullText += token
      }
    }

    return fullText
  }

  // Ollama streaming does not support AbortSignal; cancel is a no-op
  cancel(): void {}
}
