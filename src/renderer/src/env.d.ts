/// <reference types="vite/client" />

import type { AppSettings } from '../../main/settings'
import type { Message } from '../../main/providers/llm/interface'

declare global {
  interface Window {
    api: {
      transcribe(audioBuffer: ArrayBuffer, mimeType: string): Promise<string>
      chat(messages: Message[]): Promise<string>
      onLLMToken(callback: (token: string) => void): () => void
      speak(text: string): Promise<void>
      stopSpeaking(): Promise<void>
      cancelLLM(): Promise<void>
      getSettings(): Promise<AppSettings>
      saveSettings(settings: AppSettings): Promise<void>
    }
  }
}
