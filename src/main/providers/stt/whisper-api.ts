import OpenAI, { toFile } from 'openai'
import type { STTAdapter } from './interface'

export class WhisperAPIAdapter implements STTAdapter {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'wav'
    const file = await toFile(audioBuffer, `audio.${ext}`, { type: mimeType })

    const response = await this.client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    })

    return response.text
  }
}
