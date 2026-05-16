import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel } from '../../src/renderer/components/SettingsPanel'
import { DEFAULT_SETTINGS } from '../../src/main/settings'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test-aichatbot' }
}))

describe('SettingsPanel', () => {
  it('renders all provider dropdowns', () => {
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByLabelText(/llm provider/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/stt provider/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tts provider/i)).toBeInTheDocument()
  })

  it('calls onSave with updated settings when Save is clicked', () => {
    const onSave = vi.fn()
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ llm: expect.any(Object) }))
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onSave={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})
