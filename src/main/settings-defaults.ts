// No electron imports — safe to import in the renderer process.

export interface LLMSettings {
  provider: 'claude' | 'openai' | 'ollama' | 'ollama-cloud' | 'openrouter'
  model: string
  apiKey: string
  baseUrl?: string
}

export interface STTSettings {
  provider: 'whisper-api' | 'macos' | 'none'
  apiKey: string
}

export interface TTSSettings {
  provider: 'macos-say' | 'openai-tts' | 'none'
  apiKey: string
  voice?: string
}

export interface AppSettings {
  llm: LLMSettings
  stt: STTSettings
  tts: TTSSettings
  conversationWindowSize: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  llm: { provider: 'claude', model: 'claude-sonnet-4-6', apiKey: '' },
  stt: { provider: 'whisper-api', apiKey: '' },
  tts: { provider: 'macos-say', apiKey: '' },
  conversationWindowSize: 10
}
