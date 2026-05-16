import OpenAI from 'openai'
import type { LLMAdapter, Message } from './interface'

export class OpenRouterAdapter implements LLMAdapter {
  private client: OpenAI
  private abortController?: AbortController

  constructor(apiKey: string, private model: string) {
    this.client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })
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
