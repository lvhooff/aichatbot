import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../types'

interface Props {
  messages: ChatMessage[]
  textMode: boolean
}

export function ChatHistory({ messages, textMode }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          fontSize: 14
        }}
      >
        {textMode
          ? 'Type a message to begin a conversation'
          : 'Start speaking to begin a conversation'}
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}
        >
          <span style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
            {msg.role === 'user' ? 'You' : 'AI'}
          </span>
          <div
            style={{
              maxWidth: '80%',
              padding: '8px 12px',
              borderRadius: 12,
              background: msg.isError ? '#fee' : msg.role === 'user' ? '#0070f3' : '#f0f0f0',
              color: msg.role === 'user' ? '#fff' : '#000',
              fontSize: 14,
              lineHeight: 1.5
            }}
          >
            {msg.role === 'assistant' && !msg.isError ? (
              <div className="md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
            {msg.isStreaming && <span style={{ opacity: 0.5 }}>▋</span>}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
