import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../types'

interface Props {
  messages: ChatMessage[]
  textMode: boolean
}

const TYPING_ANIMATION = `
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}
.typing-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #888;
  animation: typingBounce 1.2s ease-in-out infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
`

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 4px' }}>
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  )
}

export function ChatHistory({ messages, textMode }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const lastScrollTop = useRef(0)

  // Decide whether to keep following the bottom of the stream. Programmatic
  // auto-scroll only ever moves *down*, so a decrease in scrollTop means the
  // user deliberately scrolled up to read — in that case we stop following.
  // Returning to the bottom re-engages following.
  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (el.scrollTop < lastScrollTop.current - 1) {
      stickToBottom.current = false
    } else if (distanceFromBottom < 40) {
      stickToBottom.current = true
    }
    lastScrollTop.current = el.scrollTop
  }

  useEffect(() => {
    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
    }
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
      ref={containerRef}
      onScroll={handleScroll}
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
      <style>{TYPING_ANIMATION}</style>
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
            {msg.role === 'assistant' && msg.isStreaming && msg.content === '' ? (
              <TypingIndicator />
            ) : msg.role === 'assistant' && !msg.isError ? (
              <div className="md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                {msg.isStreaming && <span style={{ opacity: 0.5 }}>▋</span>}
              </div>
            ) : (
              msg.content
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
