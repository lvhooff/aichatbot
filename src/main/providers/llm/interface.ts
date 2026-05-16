export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMAdapter {
  chat(messages: Message[], onToken: (token: string) => void): Promise<string>
  cancel(): void
}
