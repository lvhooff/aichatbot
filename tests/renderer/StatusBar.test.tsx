import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from '../../src/renderer/components/StatusBar'

describe('StatusBar', () => {
  it('shows listening state', () => {
    render(<StatusBar status="listening" isPlaying={false} />)
    expect(screen.getByText(/listening/i)).toBeInTheDocument()
  })

  it('shows recording state', () => {
    render(<StatusBar status="recording" isPlaying={false} />)
    expect(screen.getByText(/recording/i)).toBeInTheDocument()
  })

  it('shows speaking state when isPlaying', () => {
    render(<StatusBar status="listening" isPlaying={true} />)
    expect(screen.getByText(/speaking/i)).toBeInTheDocument()
  })
})
