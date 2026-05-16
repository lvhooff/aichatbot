import OpenAI from 'openai'
import { execFile, ChildProcess } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { TTSAdapter } from './interface'

export class OpenAITTSAdapter implements TTSAdapter {
  private client: OpenAI
  private afplayProcess?: ChildProcess

  constructor(apiKey: string, private voice: string = 'alloy') {
    this.client = new OpenAI({ apiKey })
  }

  async speak(text: string): Promise<void> {
    this.stop()
    const response = await this.client.audio.speech.create({
      model: 'tts-1',
      voice: this.voice as 'alloy',
      input: text,
      response_format: 'mp3',
    })

    const buffer = Buffer.from(await response.arrayBuffer())
    const tmpFile = join(tmpdir(), `aichatbot-tts-${Date.now()}.mp3`)
    await writeFile(tmpFile, buffer)

    return new Promise((resolve, reject) => {
      this.afplayProcess = execFile('afplay', [tmpFile], async (err) => {
        await unlink(tmpFile).catch(() => {})
        if (err && err.killed) resolve()
        else if (err) reject(err)
        else resolve()
      })
    })
  }

  stop(): void {
    this.afplayProcess?.kill('SIGTERM')
  }
}
