import { useVAD } from '../hooks/useVAD'
import { StatusBar } from './StatusBar'
import type { VADSensitivity } from '../../main/settings-defaults'

interface Props {
  isPlaying: boolean
  sensitivity: VADSensitivity
  onAudioReady: (audioBuffer: ArrayBuffer) => void
  onStopSpeaking: () => void
}

// Voice input footer. Owning the VAD hook here means the microphone is only
// initialised while voice mode is active — switching STT to "none" unmounts
// this component and releases the mic.
export function VoiceInput({ isPlaying, sensitivity, onAudioReady, onStopSpeaking }: Props) {
  const { status } = useVAD({
    isPlaying,
    sensitivity,
    onAudioReady,
    onError: (err) => console.error('VAD error:', err)
  })

  return <StatusBar status={status} isPlaying={isPlaying} onStopSpeaking={onStopSpeaking} />
}
