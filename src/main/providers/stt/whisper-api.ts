import OpenAI, { toFile } from 'openai'
import type { STTAdapter } from './interface'

export class WhisperAPIAdapter implements STTAdapter {
  private _client?: OpenAI

  constructor(private apiKey: string) {}

  private get client(): OpenAI {
    if (!this._client) {
      if (!this.apiKey) throw new Error('OpenAI API key not configured — open Settings')
      this._client = new OpenAI({ apiKey: this.apiKey })
    }
    return this._client
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'wav'
    const file = await toFile(audioBuffer, `audio.${ext}`, { type: mimeType })

    const response = await this.client.audio.transcriptions.create({
      file,
      model: 'whisper-1'
    })

    return response.text
  }
}
