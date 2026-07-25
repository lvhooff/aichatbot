import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatHistory } from '../../src/renderer/components/ChatHistory'
import type { ChatMessage } from '../../src/renderer/types'

describe('ChatHistory steer markers', () => {
  it('shows the steer at the point it landed', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Heard this part. Then the new direction.',
        steers: [{ at: 16, nudge: 'just the steps' }]
      }
    ]
    render(<ChatHistory messages={messages} textMode={true} />)

    expect(screen.getByText('just the steps')).toBeInTheDocument()
    expect(screen.getByText('Heard this part.')).toBeInTheDocument()
    expect(screen.getByText('Then the new direction.')).toBeInTheDocument()
  })

  it('shows no marker on a reply that was never steered', () => {
    const messages: ChatMessage[] = [{ id: '1', role: 'assistant', content: 'Straight through.' }]
    render(<ChatHistory messages={messages} textMode={true} />)
    expect(screen.getByText('Straight through.')).toBeInTheDocument()
    expect(screen.queryByText('⤳')).not.toBeInTheDocument()
  })

  it('shows one marker per steer', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'AAA BBB CCC',
        steers: [
          { at: 4, nudge: 'first nudge' },
          { at: 8, nudge: 'second nudge' }
        ]
      }
    ]
    render(<ChatHistory messages={messages} textMode={true} />)
    expect(screen.getByText('first nudge')).toBeInTheDocument()
    expect(screen.getByText('second nudge')).toBeInTheDocument()
  })
})

describe('ChatHistory', () => {
  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Hello there' },
    { id: '2', role: 'assistant', content: 'Hi! How can I help?' }
  ]

  it('renders all messages', () => {
    render(<ChatHistory messages={messages} textMode={false} />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument()
  })

  it('labels user and assistant messages', () => {
    render(<ChatHistory messages={messages} textMode={false} />)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('renders the voice empty state when no messages', () => {
    render(<ChatHistory messages={[]} textMode={false} />)
    expect(screen.getByText(/start speaking/i)).toBeInTheDocument()
  })

  it('renders the text empty state in text mode', () => {
    render(<ChatHistory messages={[]} textMode={true} />)
    expect(screen.getByText(/type a message/i)).toBeInTheDocument()
  })
})

describe('ChatHistory markdown links', () => {
  it('forces assistant links to open externally instead of navigating the window', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: '[click me](https://attacker.example)'
      }
    ]
    render(<ChatHistory messages={messages} textMode={true} />)

    const link = screen.getByRole('link', { name: 'click me' })
    expect(link).toHaveAttribute('href', 'https://attacker.example')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
