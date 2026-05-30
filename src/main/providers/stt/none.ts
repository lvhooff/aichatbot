import type { STTAdapter } from './interface'

// Disabled speech-to-text: the user types messages instead of speaking, so the
// renderer never calls transcribe. Guards against accidental use.
export class NoneSTTAdapter implements STTAdapter {
  async transcribe(): Promise<string> {
    throw new Error('Speech-to-text is disabled (text input mode)')
  }
}
