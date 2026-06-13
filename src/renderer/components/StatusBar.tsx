import type { VADStatus } from '../hooks/useVAD'
import { StopButton } from './StopButton'

interface Props {
  status: VADStatus
  isPlaying: boolean
  onStopSpeaking?: () => void
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'Initializing...',
  listening: 'Listening',
  recording: 'Recording...',
  error: 'Mic error'
}

export function StatusBar({ status, isPlaying, onStopSpeaking }: Props) {
  const label = isPlaying ? 'Speaking...' : (STATUS_LABELS[status] ?? 'Listening')
  const isActive = status === 'recording' || isPlaying

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.1)',
        fontSize: 13,
        color: '#bbb'
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isActive ? '#e53e3e' : status === 'listening' ? '#38a169' : '#aaa'
        }}
      />
      {label}
      {isPlaying && onStopSpeaking && <StopButton onClick={onStopSpeaking} />}
    </div>
  )
}
