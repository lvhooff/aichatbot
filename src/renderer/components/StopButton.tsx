import { dangerSurfaceStyle } from '../styles'

interface Props {
  onClick: () => void
}

// Shared "Stop speaking" control rendered in both the text and voice footers.
export function StopButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      title="Stop speaking"
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        borderRadius: 6,
        fontSize: 12,
        padding: '3px 10px',
        cursor: 'pointer',
        ...dangerSurfaceStyle
      }}
    >
      ■ Stop
    </button>
  )
}
