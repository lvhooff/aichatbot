import { describe, it, expect, beforeEach } from 'vitest'
import { ConversationManager } from '../../src/main/conversation'
import type { Message } from '../../src/main/providers/llm/interface'

describe('ConversationManager', () => {
  let mgr: ConversationManager

  beforeEach(() => {
    mgr = new ConversationManager(2)
  })

  it('returns empty window initially', () => {
    expect(mgr.getWindow()).toEqual([])
  })

  it('returns all messages when under window limit', () => {
    mgr.add({ role: 'user', content: 'hi' })
    mgr.add({ role: 'assistant', content: 'hello' })
    expect(mgr.getWindow()).toHaveLength(2)
  })

  it('trims to last N turns (2 turns = 4 messages)', () => {
    for (let i = 0; i < 3; i++) {
      mgr.add({ role: 'user', content: `msg ${i}` })
      mgr.add({ role: 'assistant', content: `reply ${i}` })
    }
    const window = mgr.getWindow()
    expect(window).toHaveLength(4)
    expect(window[0].content).toBe('msg 1')
  })

  it('clears all messages', () => {
    mgr.add({ role: 'user', content: 'hi' })
    mgr.clear()
    expect(mgr.getWindow()).toEqual([])
  })

  it('updates max turns', () => {
    for (let i = 0; i < 5; i++) {
      mgr.add({ role: 'user', content: `u${i}` })
      mgr.add({ role: 'assistant', content: `a${i}` })
    }
    mgr.updateMaxTurns(1)
    expect(mgr.getWindow()).toHaveLength(2)
  })
})
