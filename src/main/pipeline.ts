import type { AppSettings } from './settings'
import type { STTAdapter } from './providers/stt/interface'
import type { LLMAdapter, Message } from './providers/llm/interface'
import type { TTSAdapter } from './providers/tts/interface'
import { WhisperAPIAdapter } from './providers/stt/whisper-api'
import { MacOSSTTAdapter } from './providers/stt/macos'
import { ClaudeAdapter } from './providers/llm/claude'
import { OpenAIAdapter } from './providers/llm/openai'
import { OllamaAdapter } from './providers/llm/ollama'
import { OpenRouterAdapter } from './providers/llm/openrouter'
import { MacOSSayAdapter } from './providers/tts/macos-say'
import { OpenAITTSAdapter } from './providers/tts/openai-tts'

function createSTTAdapter(settings: AppSettings['stt']): STTAdapter {
  switch (settings.provider) {
    case 'whisper-api': return new WhisperAPIAdapter(settings.apiKey)
    case 'macos': return new MacOSSTTAdapter()
    default: throw new Error(`Unknown STT provider: ${settings.provider}`)
  }
}

function createLLMAdapter(settings: AppSettings['llm']): LLMAdapter {
  switch (settings.provider) {
    case 'claude': return new ClaudeAdapter(settings.apiKey, settings.model)
    case 'openai': return new OpenAIAdapter(settings.apiKey, settings.model)
    case 'ollama': return new OllamaAdapter(settings.model, settings.baseUrl)
    case 'openrouter': return new OpenRouterAdapter(settings.apiKey, settings.model)
    default: throw new Error(`Unknown LLM provider: ${settings.provider}`)
  }
}

function createTTSAdapter(settings: AppSettings['tts']): TTSAdapter {
  switch (settings.provider) {
    case 'macos-say': return new MacOSSayAdapter()
    case 'openai-tts': return new OpenAITTSAdapter(settings.apiKey, settings.voice)
    default: throw new Error(`Unknown TTS provider: ${settings.provider}`)
  }
}

export class Pipeline {
  private stt: STTAdapter
  private llm: LLMAdapter
  private tts: TTSAdapter

  constructor(settings: AppSettings) {
    this.stt = createSTTAdapter(settings.stt)
    this.llm = createLLMAdapter(settings.llm)
    this.tts = createTTSAdapter(settings.tts)
  }

  transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    return this.stt.transcribe(audioBuffer, mimeType)
  }

  chat(messages: Message[], onToken: (token: string) => void): Promise<string> {
    return this.llm.chat(messages, onToken)
  }

  async speak(text: string): Promise<void> {
    return this.tts.speak(text)
  }

  stopSpeaking(): void {
    this.tts.stop()
  }

  cancelLLM(): void {
    this.llm.cancel()
  }

  updateProviders(settings: AppSettings): void {
    this.stt = createSTTAdapter(settings.stt)
    this.llm = createLLMAdapter(settings.llm)
    this.tts = createTTSAdapter(settings.tts)
  }
}
