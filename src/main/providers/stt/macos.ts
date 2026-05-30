import { app } from 'electron'
import type { STTAdapter } from './interface'
import { ensureBinary, transcribeBuffer } from './macos-impl'

export class MacOSSTTAdapter implements STTAdapter {
  private cacheDir = app.getPath('userData')

  constructor() {
    // Compile the helper ahead of the first utterance so transcription is fast.
    // Errors here are ignored; they resurface (with context) on transcribe().
    queueMicrotask(() => {
      try {
        ensureBinary(this.cacheDir)
      } catch {
        /* surfaced on transcribe() */
      }
    })
  }

  transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    return transcribeBuffer(this.cacheDir, audioBuffer, mimeType)
  }
}
