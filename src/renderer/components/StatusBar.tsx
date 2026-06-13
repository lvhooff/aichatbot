import type { VADStatus } from '../hooks/useVAD'

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
      {isPlaying && onStopSpeaking && (
        <button
          onClick={onStopSpeaking}
          title="Stop speaking"
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(229,62,62,0.15)',
            border: '1px solid rgba(229,62,62,0.4)',
            borderRadius: 6,
            color: '#ffb4b4',
            fontSize: 12,
            padding: '3px 10px',
            cursor: 'pointer'
          }}
        >
          ■ Stop
        </button>
      )}
    </div>
  )
}
