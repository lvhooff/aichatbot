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

  describe('steering mode', () => {
    it('offers a Steer control while a reply is in flight', () => {
      render(<TextInput onSubmit={() => {}} disabled steering onSteer={() => {}} />)
      expect(screen.getByRole('button', { name: /steer/i })).toBeInTheDocument()
      expect(screen.getByLabelText('Steer the reply')).toBeInTheDocument()
    })

    it('steers instead of sending, even though sending is disabled', () => {
      const onSubmit = vi.fn()
      const onSteer = vi.fn()
      render(<TextInput onSubmit={onSubmit} disabled steering onSteer={onSteer} />)

      fireEvent.change(screen.getByLabelText('Steer the reply'), { target: { value: 'shorter' } })
      fireEvent.click(screen.getByRole('button', { name: /steer/i }))

      expect(onSteer).toHaveBeenCalledWith('shorter')
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('steers on Enter and clears the box', () => {
      const onSteer = vi.fn()
      render(<TextInput onSubmit={() => {}} disabled steering onSteer={onSteer} />)
      const box = screen.getByLabelText('Steer the reply') as HTMLTextAreaElement

      fireEvent.change(box, { target: { value: 'skip the intro' } })
      fireEvent.keyDown(box, { key: 'Enter' })

      expect(onSteer).toHaveBeenCalledWith('skip the intro')
      expect(box.value).toBe('')
    })

    it('ignores an empty steer', () => {
      const onSteer = vi.fn()
      render(<TextInput onSubmit={() => {}} disabled steering onSteer={onSteer} />)
      fireEvent.keyDown(screen.getByLabelText('Steer the reply'), { key: 'Enter' })
      expect(onSteer).not.toHaveBeenCalled()
    })

    it('goes back to sending once the reply is done', () => {
      const onSubmit = vi.fn()
      render(<TextInput onSubmit={onSubmit} onSteer={() => {}} />)

      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'next question' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))

      expect(onSubmit).toHaveBeenCalledWith('next question')
    })
  })
})
