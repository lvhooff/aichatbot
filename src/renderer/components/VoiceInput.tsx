import { useVAD } from '../hooks/useVAD'
import { StatusBar } from './StatusBar'

interface Props {
  isPlaying: boolean
  onAudioReady: (audioBuffer: ArrayBuffer) => void
}

// Voice input footer. Owning the VAD hook here means the microphone is only
// initialised while voice mode is active — switching STT to "none" unmounts
// this component and releases the mic.
export function VoiceInput({ isPlaying, onAudioReady }: Props) {
  const { status } = useVAD({
    isPlaying,
    onAudioReady,
    onError: (err) => console.error('VAD error:', err)
  })

  return <StatusBar status={status} isPlaying={isPlaying} />
}
