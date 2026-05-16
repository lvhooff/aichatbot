import type { STTAdapter } from './interface'

export class MacOSSTTAdapter implements STTAdapter {
  async transcribe(_audioBuffer: Buffer, _mimeType: string): Promise<string> {
    throw new Error('macOS STT not yet implemented — use Whisper API')
  }
}
