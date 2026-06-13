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
  )
}
