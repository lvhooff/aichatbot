import type { TTSAdapter } from './interface'

// No-op text-to-speech: the assistant's reply is shown as text and never spoken.
export class NoneTTSAdapter implements TTSAdapter {
  async speak(): Promise<void> {}
  stop(): void {}
}
