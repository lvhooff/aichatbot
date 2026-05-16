import OpenAI from 'openai'
import type { LLMAdapter, Message } from './interface'

export class OpenRouterAdapter implements LLMAdapter {
  private _client?: OpenAI
  private abortController?: AbortController

  constructor(private apiKey: string, private model: string) {}

  private get client(): OpenAI {
    if (!this._client) {
      const key = this.apiKey || process.env['OPENROUTER_API_KEY'] || ''
      if (!key) throw new Error('OpenRouter API key not configured — open Settings or set OPENROUTER_API_KEY')
      this._client = new OpenAI({ apiKey: key, baseURL: 'https://openrouter.ai/api/v1' })
    }
    return this._client
  }

  async chat(messages: Message[], onToken: (token: string) => void): Promise<string> {
    this.abortController = new AbortController()
    let fullText = ''

    const stream = await this.client.chat.completions.create(
      { model: this.model, messages, stream: true },
      { signal: this.abortController.signal }
    )

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? ''
      if (token) {
        onToken(token)
        fullText += token
      }
    }

    return fullText
  }

  cancel(): void {
    this.abortController?.abort()
  }
}
