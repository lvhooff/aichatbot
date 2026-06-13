import { describe, it, expect } from 'vitest'
import { extractCompleteSentences } from '../../src/renderer/utils/sentences'

describe('extractCompleteSentences', () => {
  it('splits a buffer into complete sentences and keeps the trailing partial as remainder', () => {
    const { sentences, remainder } = extractCompleteSentences('Hello world. How are yo')
    expect(sentences).toEqual(['Hello world.'])
    expect(remainder).toBe('How are yo')
  })

  it('returns no sentences when no boundary has been reached yet', () => {
    const { sentences, remainder } = extractCompleteSentences('This is only a partial')
    expect(sentences).toEqual([])
    expect(remainder).toBe('This is only a partial')
  })

  it('handles ! and ? terminators', () => {
    const { sentences, remainder } = extractCompleteSentences('Really? Yes! Now what')
    expect(sentences).toEqual(['Really?', 'Yes!'])
    expect(remainder).toBe('Now what')
  })

  it('treats an ellipsis as a single boundary, not three', () => {
    const { sentences } = extractCompleteSentences('Wait... Something happened.')
    expect(sentences).toEqual(['Wait...', 'Something happened.'])
  })

  it('does not split on common title abbreviations', () => {
    const { sentences, remainder } = extractCompleteSentences('Dr. Smith arrived. He waved')
    expect(sentences).toEqual(['Dr. Smith arrived.'])
    expect(remainder).toBe('He waved')
  })

  it('does not split inside decimal numbers', () => {
    const { sentences, remainder } = extractCompleteSentences('It costs 3.5 dollars today')
    expect(sentences).toEqual([])
    expect(remainder).toBe('It costs 3.5 dollars today')
  })

  it('splits after "no." used as a sentence-ending word', () => {
    const { sentences } = extractCompleteSentences('The answer is no. Yes please.')
    expect(sentences).toEqual(['The answer is no.', 'Yes please.'])
  })

  it('keeps a closing quote with the sentence it ends', () => {
    const { sentences, remainder } = extractCompleteSentences('She said "go." Then left')
    expect(sentences).toEqual(['She said "go."'])
    expect(remainder).toBe('Then left')
  })
})
