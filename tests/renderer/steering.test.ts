import { describe, it, expect } from 'vitest'
import {
  buildSteerMessages,
  stripOverlap,
  joinContinuation,
  splitAtPivots
} from '../../src/renderer/utils/steering'
import type { Message } from '../../src/main/providers/llm/interface'

describe('buildSteerMessages', () => {
  const history: Message[] = [{ role: 'user', content: 'How do I make espresso?' }]

  it('keeps roles strictly alternating', () => {
    const msgs = buildSteerMessages(
      history,
      'Espresso was invented in Italy, when',
      'just the steps'
    )
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
  })

  it('carries the delivered prefix as the assistant turn', () => {
    const msgs = buildSteerMessages(
      history,
      'Espresso was invented in Italy, when',
      'just the steps'
    )
    expect(msgs[1].content).toBe('Espresso was invented in Italy, when')
  })

  it('quotes the steer verbatim in the final turn', () => {
    const msgs = buildSteerMessages(history, 'partial', 'in Python, no comments')
    expect(msgs[2].content).toContain('"in Python, no comments"')
  })

  it('preserves prior conversation turns ahead of the pivot', () => {
    const longer: Message[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'How do I make espresso?' }
    ]
    const msgs = buildSteerMessages(longer, 'partial', 'shorter')
    expect(msgs.slice(0, 3)).toEqual(longer)
  })
})

describe('buildSteerMessages with nothing delivered', () => {
  const history: Message[] = [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'hello' },
    { role: 'user', content: 'Explain espresso.' }
  ]

  it('folds the steer into the question instead of sending an empty reply', () => {
    const msgs = buildSteerMessages(history, '', 'be brief')
    expect(msgs).toHaveLength(3)
    expect(msgs[2]).toEqual({ role: 'user', content: 'Explain espresso.\n\n(be brief)' })
  })

  it('treats whitespace-only delivery as nothing delivered', () => {
    const msgs = buildSteerMessages(history, '   \n ', 'be brief')
    expect(msgs[msgs.length - 1].content).toContain('(be brief)')
    expect(msgs.some((m) => m.role === 'assistant' && m.content.trim() === '')).toBe(false)
  })
})

describe('splitAtPivots', () => {
  it('returns one stretch when nothing was steered', () => {
    expect(splitAtPivots('a plain reply')).toEqual([{ text: 'a plain reply' }])
  })

  it('splits at the pivot and attributes the steer to the later stretch', () => {
    expect(splitAtPivots('HeardThisRest', [{ at: 9, nudge: 'shorter' }])).toEqual([
      { text: 'HeardThis', nudgeBefore: undefined },
      { text: 'Rest', nudgeBefore: 'shorter' }
    ])
  })

  it('handles several steers in order', () => {
    const parts = splitAtPivots('AAABBBCCC', [
      { at: 6, nudge: 'second' },
      { at: 3, nudge: 'first' }
    ])
    expect(parts.map((p) => [p.text, p.nudgeBefore])).toEqual([
      ['AAA', undefined],
      ['BBB', 'first'],
      ['CCC', 'second']
    ])
  })

  it('keeps a marker for back-to-back steers at the same point', () => {
    const parts = splitAtPivots('AAABBB', [
      { at: 3, nudge: 'first' },
      { at: 3, nudge: 'again' }
    ])
    expect(parts.map((p) => p.nudgeBefore)).toEqual([undefined, 'first', 'again'])
  })

  it('clamps an out-of-range offset without losing text', () => {
    const parts = splitAtPivots('short', [{ at: 999, nudge: 'oops' }])
    expect(parts.map((p) => p.text).join('')).toBe('short')
  })
})

describe('stripOverlap', () => {
  it('drops a repeated single word', () => {
    expect(
      stripOverlap('refined it with a spring-piston lever, which', 'which introduced pressure')
    ).toBe(' introduced pressure')
  })

  it('drops the longest repeated run, not just the first word', () => {
    expect(stripOverlap('The cat sat on the', 'on the mat quietly')).toBe(' mat quietly')
  })

  it('ignores case and whitespace differences', () => {
    expect(stripOverlap('it happens in the\n', 'The chloroplasts')).toBe(' chloroplasts')
  })

  it('leaves a genuine continuation untouched', () => {
    expect(stripOverlap('Photosynthesis needs light.', 'Chloroplasts do the work.')).toBe(
      'Chloroplasts do the work.'
    )
  })

  it('does not strip a partial word match', () => {
    // Prefix ends with "the"; continuation starts with "theory" — a different word.
    expect(stripOverlap('according to the', 'theory of relativity')).toBe('theory of relativity')
  })

  it('strips a partial-word repeat when the model signals it is resuming', () => {
    // Observed live: the reply was cut mid-word at "…a lean can *over" and the
    // continuation came back as "…over‑correct the bike, making it wobble".
    expect(stripOverlap('that a lean can *over', '…over-correct the bike')).toBe(
      '-correct the bike'
    )
  })

  it('accepts a dotted ellipsis as the resumption marker too', () => {
    expect(stripOverlap('the temperature rises to nine', '...ninety degrees')).toBe('ty degrees')
  })

  it('still refuses a partial-word match with no resumption marker', () => {
    expect(stripOverlap('according to the', 'theory of relativity')).toBe('theory of relativity')
  })

  it('leaves a resuming continuation alone when it does not actually repeat', () => {
    expect(stripOverlap('Grind the beans.', '…then tamp them flat.')).toBe('…then tamp them flat.')
  })

  it('handles an empty continuation', () => {
    expect(stripOverlap('anything', '')).toBe('')
  })

  it('handles an empty prefix', () => {
    expect(stripOverlap('', 'a fresh start')).toBe('a fresh start')
  })
})

describe('joinContinuation', () => {
  it('inserts a space between colliding words', () => {
    expect(joinContinuation('Grind the beans', 'finely.')).toBe('Grind the beans finely.')
  })

  it('does not double up existing whitespace', () => {
    expect(joinContinuation('Grind the beans ', 'finely.')).toBe('Grind the beans finely.')
  })

  it('does not space before punctuation', () => {
    expect(joinContinuation('Grind the beans', ', then tamp.')).toBe('Grind the beans, then tamp.')
  })

  it('removes the repeated word while joining', () => {
    expect(joinContinuation('a spring-piston lever, which', 'which introduced pressure')).toBe(
      'a spring-piston lever, which introduced pressure'
    )
  })

  it('trims leading whitespace when there is no prefix', () => {
    expect(joinContinuation('', '  hello')).toBe('hello')
  })

  it('returns the prefix unchanged when the continuation is empty', () => {
    expect(joinContinuation('kept', '')).toBe('kept')
  })
})
