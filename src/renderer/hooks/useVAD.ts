import { useMicVAD } from '@ricky0123/vad-react'
import { useEffect } from 'react'
import { encodeWAV } from '../utils/wav'
import { VAD_SENSITIVITY_PRESETS, type VADSensitivity } from '../../main/settings-defaults'

export type VADStatus = 'idle' | 'listening' | 'recording' | 'error'

interface UseVADOptions {
  isPlaying: boolean
  sensitivity: VADSensitivity
  onAudioReady: (audioBuffer: ArrayBuffer) => void
  onError: (err: Error) => void
}

export function useVAD({ isPlaying, sensitivity, onAudioReady, onError }: UseVADOptions) {
  const { positiveSpeechThreshold, minSpeechMs } = VAD_SENSITIVITY_PRESETS[sensitivity]

  const vad = useMicVAD({
    startOnLoad: true,
    baseAssetPath: '/',
    onnxWASMBasePath: '/',
    ortConfig: (ort) => {
      ort.env.wasm.wasmPaths = '/'
    },
    positiveSpeechThreshold,
    negativeSpeechThreshold: 0.35,
    minSpeechMs,
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
