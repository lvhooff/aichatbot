import { useMicVAD } from '@ricky0123/vad-react'
import { useEffect } from 'react'
import { encodeWAV } from '../utils/wav'

export type VADStatus = 'idle' | 'listening' | 'recording' | 'error'

interface UseVADOptions {
  isPlaying: boolean
  onAudioReady: (audioBuffer: ArrayBuffer) => void
  onError: (err: Error) => void
}

export function useVAD({ isPlaying, onAudioReady, onError }: UseVADOptions) {
  const vad = useMicVAD({
    startOnLoad: true,
    // Higher threshold while TTS is playing — prevents AI voice triggering barge-in
    positiveSpeechThreshold: isPlaying ? 0.90 : 0.50,
    negativeSpeechThreshold: 0.35,
    minSpeechMs: 240,      // ~4 frames at 60ms/frame
    preSpeechPadMs: 60,    // ~1 frame of pre-speech padding
    onSpeechEnd: (audio: Float32Array) => {
      const wav = encodeWAV(audio)
      onAudioReady(wav)
    },
  })

  useEffect(() => {
    if (vad.errored) {
      onError(new Error(vad.errored))
    }
  }, [vad.errored, onError])

  const status: VADStatus = vad.errored
    ? 'error'
    : vad.userSpeaking
      ? 'recording'
      : vad.loading
        ? 'idle'
        : 'listening'

  return { status }
}
