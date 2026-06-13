import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_SETTINGS,
  STT_PROVIDERS,
  TTS_PROVIDERS,
  type AppSettings
} from './settings-defaults'

export type { LLMSettings, STTSettings, TTSSettings, AppSettings } from './settings-defaults'
export { DEFAULT_SETTINGS } from './settings-defaults'

// Coerce an unknown provider string (e.g. 'whisper-local' or 'elevenlabs' from an
// older version) back to a valid value so the Pipeline switch never throws.
function coerceProvider<T extends string>(value: unknown, valid: readonly T[], fallback: T): T {
  return valid.includes(value as T) ? (value as T) : fallback
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
      const sttProvider = coerceProvider(
        saved.stt?.provider,
        STT_PROVIDERS,
        DEFAULT_SETTINGS.stt.provider
      )
      const ttsProvider = coerceProvider(
        saved.tts?.provider,
        TTS_PROVIDERS,
        DEFAULT_SETTINGS.tts.provider
      )
      const llmSaved = saved.llm ?? {}
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        llm: {
          ...DEFAULT_SETTINGS.llm,
          ...llmSaved,
          apiKeys: { ...llmSaved.apiKeys }
        },
        stt: { ...DEFAULT_SETTINGS.stt, ...saved.stt, provider: sttProvider },
        tts: { ...DEFAULT_SETTINGS.tts, ...saved.tts, provider: ttsProvider }
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
