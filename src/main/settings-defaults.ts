// No electron imports — safe to import in the renderer process.

export interface LLMSettings {
  provider: 'claude' | 'openai' | 'ollama' | 'ollama-cloud' | 'openrouter'
  model: string
  /** Per-provider API keys — keyed by provider name so switching providers restores the correct key. */
  apiKeys: Partial<Record<LLMSettings['provider'], string>>
  baseUrl?: string
}

// Valid provider ids double as the runtime allow-list used to coerce unknown
// values loaded from disk (see SettingsManager.load), so the type and the
// validation can never drift apart.
export const STT_PROVIDERS = ['whisper-api', 'macos', 'none'] as const
export const TTS_PROVIDERS = ['macos-say', 'openai-tts', 'none'] as const

export interface STTSettings {
  provider: (typeof STT_PROVIDERS)[number]
  apiKey: string
}

export interface TTSSettings {
  provider: (typeof TTS_PROVIDERS)[number]
  apiKey: string
  voice?: string
}

export type VADSensitivity = 'low' | 'normal' | 'high'

// Maps sensitivity presets to VAD thresholds.
// positiveSpeechThreshold: confidence needed to START detecting speech (higher = less sensitive).
// minSpeechMs: minimum sustained speech duration before it triggers (higher = ignores short sounds).
export const VAD_SENSITIVITY_PRESETS: Record<
  VADSensitivity,
  { positiveSpeechThreshold: number; minSpeechMs: number }
> = {
  high: { positiveSpeechThreshold: 0.5, minSpeechMs: 240 },
  normal: { positiveSpeechThreshold: 0.65, minSpeechMs: 400 },
  low: { positiveSpeechThreshold: 0.8, minSpeechMs: 600 }
}

export interface AppSettings {
  llm: LLMSettings
  stt: STTSettings
  tts: TTSSettings
  conversationWindowSize: number
  vadSensitivity: VADSensitivity
}

export const DEFAULT_SETTINGS: AppSettings = {
  llm: { provider: 'claude', model: 'claude-sonnet-4-6', apiKeys: {} },
  stt: { provider: 'whisper-api', apiKey: '' },
  tts: { provider: 'macos-say', apiKey: '' },
  conversationWindowSize: 10,
  vadSensitivity: 'normal'
}
