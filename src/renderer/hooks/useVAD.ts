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
    positiveSpeechThreshold: 0.5,
    negativeSpeechThreshold: 0.35,
    minSpeechMs: 240,
    preSpeechPadMs: 60,
    onSpeechEnd: (audio: Float32Array) => {
      const wav = encodeWAV(audio)
      onAudioReady(wav)
    }
  })

  // Pause the VAD entirely while TTS is speaking so the mic doesn't pick up
  // the speaker output and trigger a spurious transcription.
  useEffect(() => {
    if (vad.loading) return
    if (isPlaying) {
      vad.pause()
    } else {
      vad.start()
    }
  }, [isPlaying, vad.loading])

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
      : vad.loading || isPlaying
        ? 'idle'
        : 'listening'

  return { status }
}
