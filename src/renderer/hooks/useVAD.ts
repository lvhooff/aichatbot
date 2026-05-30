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
    baseAssetPath: '/',
    onnxWASMBasePath: '/',
    ortConfig: (ort) => {
      ort.env.wasm.wasmPaths = '/'
    },
    // Higher threshold while TTS is playing — prevents AI voice triggering barge-in
    positiveSpeechThreshold: isPlaying ? 0.90 : 0.50,
    negativeSpeechThreshold: 0.35,
    minSpeechMs: 240,
    preSpeechPadMs: 60,
    onSpeechEnd: (audio: Float32Array) => {
      const wav = encodeWAV(audio)
      onAudioReady(wav)
    },
  })

  useEffect(() => {
    if (vad.errored) {
      const e = vad.errored as unknown
      onError(e instanceof Error ? e : new Error(String(e)))
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
