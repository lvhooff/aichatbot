import Anthropic from '@anthropic-ai/sdk'
import type { LLMAdapter, Message } from './interface'

export class ClaudeAdapter implements LLMAdapter {
  private _client?: Anthropic
  private abortController?: AbortController

  constructor(
    private apiKey: string,
    private model: string
  ) {}

  private get client(): Anthropic {
    if (!this._client) {
      if (!this.apiKey) throw new Error('Anthropic API key not configured — open Settings')
      this._client = new Anthropic({ apiKey: this.apiKey })
    }
    return this._client
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
