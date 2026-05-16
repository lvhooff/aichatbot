export interface STTAdapter {
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<string>
}
