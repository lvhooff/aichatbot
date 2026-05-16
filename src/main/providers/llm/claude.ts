import Anthropic from '@anthropic-ai/sdk'
import type { LLMAdapter, Message } from './interface'

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic
  private abortController?: AbortController

  constructor(apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey })
  }

  async chat(messages: Message[], onToken: (token: string) => void): Promise<string> {
    this.abortController = new AbortController()
    let fullText = ''

    const stream = this.client.messages.stream(
      { model: this.model, max_tokens: 1024, messages },
      { signal: this.abortController.signal }
    )

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        onToken(chunk.delta.text)
        fullText += chunk.delta.text
      }
    }

    return fullText
  }

  cancel(): void {
    this.abortController?.abort()
  }
}
