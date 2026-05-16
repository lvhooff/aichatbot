import { Ollama } from 'ollama'
import type { LLMAdapter, Message } from './interface'

export class OllamaAdapter implements LLMAdapter {
  private client: Ollama

  constructor(private model: string, baseUrl?: string) {
    this.client = new Ollama({ host: baseUrl ?? 'http://localhost:11434' })
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
