import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TextInput } from '../../src/renderer/components/TextInput'

describe('TextInput', () => {
  it('does not show a Stop button when nothing is playing', () => {
    render(<TextInput onSubmit={() => {}} isPlaying={false} onStopSpeaking={() => {}} />)
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument()
  })

  it('shows a Stop button while TTS is playing, even in text mode', () => {
    render(<TextInput onSubmit={() => {}} isPlaying={true} onStopSpeaking={() => {}} />)
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
  })

  it('calls onStopSpeaking when the Stop button is clicked', () => {
    const onStopSpeaking = vi.fn()
    render(<TextInput onSubmit={() => {}} isPlaying={true} onStopSpeaking={onStopSpeaking} />)
    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    expect(onStopSpeaking).toHaveBeenCalledOnce()
  })
})
