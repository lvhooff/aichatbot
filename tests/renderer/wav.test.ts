import { describe, it, expect } from 'vitest'
import { encodeWAV } from '../../src/renderer/utils/wav'

describe('encodeWAV', () => {
  it('produces a buffer with RIFF header', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1.0])
    const buffer = encodeWAV(samples)
    const view = new DataView(buffer)
    // RIFF header magic bytes
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe('RIFF')
    expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe('WAVE')
  })

  it('output length = 44 header + 2 bytes per sample', () => {
    const samples = new Float32Array(100)
    const buffer = encodeWAV(samples)
    expect(buffer.byteLength).toBe(44 + 100 * 2)
  })
})
