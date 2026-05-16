import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../types'

interface Props {
  messages: ChatMessage[]
}

export function ChatHistory({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 14 }}>
        Start speaking to begin a conversation
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {messages.map((msg) => (
        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
          <span style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
            {msg.role === 'user' ? 'You' : 'AI'}
          </span>
          <div style={{
            maxWidth: '80%',
            padding: '8px 12px',
            borderRadius: 12,
            background: msg.isError ? '#fee' : msg.role === 'user' ? '#0070f3' : '#f0f0f0',
            color: msg.role === 'user' ? '#fff' : '#000',
            fontSize: 14,
            lineHeight: 1.5,
          }}>
            {msg.content}
            {msg.isStreaming && <span style={{ opacity: 0.5 }}>▋</span>}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
