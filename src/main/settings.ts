import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface LLMSettings {
  provider: 'claude' | 'openai' | 'ollama' | 'ollama-cloud' | 'openrouter'
  model: string
  apiKey: string
  baseUrl?: string
}

export interface STTSettings {
  provider: 'whisper-api' | 'macos' | 'whisper-local' | 'none'
  apiKey: string
}

export interface TTSSettings {
  provider: 'macos-say' | 'openai-tts' | 'elevenlabs' | 'none'
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
  conversationWindowSize: 10,
}

export class SettingsManager {
  private settings: AppSettings
  private filePath: string

  constructor() {
    const dir = app.getPath('userData')
    this.filePath = join(dir, 'settings.json')
    this.settings = this.load()
  }

  private load(): AppSettings {
    if (!existsSync(this.filePath)) return structuredClone(DEFAULT_SETTINGS)
    try {
      const saved = JSON.parse(readFileSync(this.filePath, 'utf-8'))
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        llm: { ...DEFAULT_SETTINGS.llm, ...saved.llm },
        stt: { ...DEFAULT_SETTINGS.stt, ...saved.stt },
        tts: { ...DEFAULT_SETTINGS.tts, ...saved.tts },
      }
    } catch {
      return structuredClone(DEFAULT_SETTINGS)
    }
  }

  get(): AppSettings {
    return this.settings
  }

  save(settings: AppSettings): void {
    this.settings = settings
    const dir = join(this.filePath, '..')
    mkdirSync(dir, { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(settings, null, 2))
  }
}
