import OpenAI from 'openai'
import { Readable } from 'stream'
import type { STTAdapter } from './interface'

export class WhisperAPIAdapter implements STTAdapter {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const readable = Readable.from(audioBuffer) as NodeJS.ReadableStream & { name?: string }
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'wav'
    readable.name = `audio.${ext}`

    const response = await this.client.audio.transcriptions.create({
      file: readable as Parameters<typeof this.client.audio.transcriptions.create>[0]['file'],
      model: 'whisper-1',
    })

    return response.text
  }
}
