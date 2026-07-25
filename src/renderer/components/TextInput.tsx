import { useState, KeyboardEvent } from 'react'
import { StopButton } from './StopButton'

interface Props {
  onSubmit: (text: string) => void
  disabled?: boolean
  /** True while TTS is speaking — surfaces a Stop control in text mode. */
  isPlaying?: boolean
  onStopSpeaking?: () => void
  /**
   * True while a reply is in flight. The composer becomes a steering control:
   * what you type redirects the reply that's already running instead of queuing
   * a new message.
   */
  steering?: boolean
  onSteer?: (nudge: string) => void
}

const STEER_ACCENT = '#7a5cc4'

// Input footer, shown when STT is set to "none". Enter sends; Shift+Enter inserts
// a newline. While a reply is streaming it switches to steering mode — same box,
// different target.
export function TextInput({
  onSubmit,
  disabled,
  isPlaying,
  onStopSpeaking,
  steering,
  onSteer
}: Props) {
  const [text, setText] = useState('')
  const canSteer = Boolean(steering && onSteer)

  function submit() {
    const trimmed = text.trim()
    if (!trimmed) return
    if (canSteer) {
      onSteer!(trimmed)
      setText('')
      return
    }
    if (disabled) return
    onSubmit(trimmed)
    setText('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const inert = canSteer ? !text.trim() : disabled || !text.trim()

  return (
    <>
      {isPlaying && onStopSpeaking && (
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
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e53e3e' }} />
          Speaking...
          <StopButton onClick={onStopSpeaking} />
        </div>
      )}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          padding: '10px 16px',
          flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            canSteer ? 'Steer the reply — “shorter”, “skip the intro”…' : 'Type a message…'
          }
          rows={1}
          aria-label={canSteer ? 'Steer the reply' : 'Message'}
          style={{
            flex: 1,
            resize: 'none',
            fontSize: 14,
            fontFamily: 'inherit',
            padding: '8px 10px',
            borderRadius: 8,
            border: `1px solid ${canSteer ? STEER_ACCENT : '#ccc'}`,
            maxHeight: 120,
            minHeight: 38
          }}
        />
        <button
          onClick={submit}
          disabled={inert}
          title={canSteer ? 'Redirect the reply from where it has got to' : undefined}
          style={{
            height: 38,
            padding: '0 16px',
            borderRadius: 8,
            background: inert ? '#ccc' : canSteer ? STEER_ACCENT : '#0070f3',
            color: '#fff',
            border: 'none',
            cursor: inert ? 'default' : 'pointer',
            fontSize: 14,
            whiteSpace: 'nowrap'
          }}
        >
          {canSteer ? '⤳ Steer' : 'Send'}
        </button>
      </div>
    </>
  )
}
