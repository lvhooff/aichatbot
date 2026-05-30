import { useState, KeyboardEvent } from 'react'

interface Props {
  onSubmit: (text: string) => void
  disabled?: boolean
}

// Text input footer, shown when STT is set to "none". Enter sends the message;
// Shift+Enter inserts a newline.
export function TextInput({ onSubmit, disabled }: Props) {
  const [text, setText] = useState('')

  function submit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setText('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        padding: '10px 16px',
        borderTop: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type a message…"
        rows={1}
        aria-label="Message"
        style={{
          flex: 1,
          resize: 'none',
          fontSize: 14,
          fontFamily: 'inherit',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid #ccc',
          maxHeight: 120,
          minHeight: 38
        }}
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        style={{
          padding: '8px 16px',
          borderRadius: 8,
          background: disabled || !text.trim() ? '#ccc' : '#0070f3',
          color: '#fff',
          border: 'none',
          cursor: disabled || !text.trim() ? 'default' : 'pointer',
          fontSize: 14
        }}
      >
        Send
      </button>
    </div>
  )
}
