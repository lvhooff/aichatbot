import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type STTSettings,
  type TTSSettings
} from './settings-defaults'

export type { LLMSettings, STTSettings, TTSSettings, AppSettings } from './settings-defaults'
export { DEFAULT_SETTINGS } from './settings-defaults'

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
      // Coerce unknown provider strings (e.g. 'whisper-local', 'elevenlabs' from
      // older versions) back to a valid value so the Pipeline switch never throws.
      const sttProvider: STTSettings['provider'] =
        saved.stt?.provider === 'whisper-api' ||
        saved.stt?.provider === 'macos' ||
        saved.stt?.provider === 'none'
          ? saved.stt.provider
          : DEFAULT_SETTINGS.stt.provider
      const ttsProvider: TTSSettings['provider'] =
        saved.tts?.provider === 'macos-say' ||
        saved.tts?.provider === 'openai-tts' ||
        saved.tts?.provider === 'none'
          ? saved.tts.provider
          : DEFAULT_SETTINGS.tts.provider
      const llmSaved = saved.llm ?? {}
      // Migrate legacy single apiKey field into the per-provider map.
      const migratedApiKeys: Partial<Record<string, string>> = { ...llmSaved.apiKeys }
      if (llmSaved.apiKey && !migratedApiKeys[llmSaved.provider ?? DEFAULT_SETTINGS.llm.provider]) {
        migratedApiKeys[llmSaved.provider ?? DEFAULT_SETTINGS.llm.provider] = llmSaved.apiKey
      }
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        llm: {
          ...DEFAULT_SETTINGS.llm,
          ...llmSaved,
          apiKeys: migratedApiKeys,
          apiKey: undefined
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
