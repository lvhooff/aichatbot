export interface TTSAdapter {
  speak(text: string): Promise<void>
  stop(): void
}
