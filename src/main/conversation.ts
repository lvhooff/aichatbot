import type { Message } from './providers/llm/interface'

export class ConversationManager {
  private history: Message[] = []

  constructor(private maxTurns: number = 10) {}

  add(message: Message): void {
    this.history.push(message)
  }

  getWindow(): Message[] {
    const maxMessages = this.maxTurns * 2
    return this.history.slice(-maxMessages)
  }

  clear(): void {
    this.history = []
  }

  updateMaxTurns(n: number): void {
    this.maxTurns = n
  }
}
