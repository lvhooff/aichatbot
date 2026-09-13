import type { CSSProperties } from 'react'

// Shared red "danger" surface used for error blocks, failure notices, and the
// stop-speaking control, so the palette moves in lockstep across all three.
export const dangerSurfaceStyle: CSSProperties = {
  background: 'rgba(229,62,62,0.15)',
  border: '1px solid rgba(229,62,62,0.4)',
  color: '#ffb4b4'
}
