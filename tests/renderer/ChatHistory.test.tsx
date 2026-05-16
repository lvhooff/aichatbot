import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatHistory } from '../../src/renderer/components/ChatHistory'
import type { ChatMessage } from '../../src/renderer/types'

describe('ChatHistory', () => {
  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Hello there' },
    { id: '2', role: 'assistant', content: 'Hi! How can I help?' },
  ]

  it('renders all messages', () => {
    render(<ChatHistory messages={messages} />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument()
  })

  it('labels user and assistant messages', () => {
    render(<ChatHistory messages={messages} />)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('renders empty state when no messages', () => {
    render(<ChatHistory messages={[]} />)
    expect(screen.getByText(/start speaking/i)).toBeInTheDocument()
  })
})
