/**
 * Sentence boundary detection for streaming TTS.
 *
 * Splits a text buffer into complete sentences and returns the remainder that
 * hasn't yet reached a boundary. Designed to be called incrementally as LLM
 * tokens arrive.
 */

// Common abbreviations that end with a period but are NOT sentence boundaries.
// Checked case-insensitively.
const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'vs',
  'etc',
  'approx',
  'dept',
  'est',
  'inc',
  'corp',
  'ltd',
  'govt',
  'fig',
  'vol',
  'pp',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
  'st',
  'ave',
  'blvd',
  'rd',
  'u.s',
  'u.k',
  'e.g',
  'i.e',
  'a.m',
  'p.m'
])

/**
 * Returns true when the word immediately before the terminal punctuation
 * looks like a sentence-ending abbreviation.
 */
function isAbbreviation(precedingWord: string): boolean {
  const lower = precedingWord.toLowerCase().replace(/\.$/, '')
  return ABBREVIATIONS.has(lower) || /^\d+$/.test(lower)
}

/**
 * Given a running text buffer, extract all complete sentences and return the
 * remainder. A "complete" sentence ends with `.`, `!`, or `?` (allowing `...`
 * for ellipsis) followed by either whitespace + an uppercase letter, or the
 * end of a clearly terminated clause (closing quote / paren before whitespace).
 *
 * This is intentionally conservative: it prefers waiting a little longer over
 * splitting in the wrong place and creating odd TTS pauses.
 */
export function extractCompleteSentences(buffer: string): {
  sentences: string[]
  remainder: string
} {
  const sentences: string[] = []
  const text = buffer

  // Pattern explanation:
  //   [^.!?]*?          — non-greedy run of non-terminal chars
  //   (?:\.{3}|[.!?]+)  — terminal: either ellipsis OR one-or-more .!?
  //   ['")\]]*          — optional closing quote/paren
  //   (?=\s+[A-Z\d"'(] | \s*$)  — followed by whitespace+capital, OR end
  //
  // We loop rather than using a global regex so we can apply the abbreviation
  // check for each candidate match.
  const boundary = /([^\n]*?)(?:\.{3}|([.!?]+))(['")\]]*)\s*(?=\n|$|[ \t]+[A-Z\d"'(\u2018\u201C])/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = boundary.exec(text)) !== null) {
    const terminator = match[2] ?? '...' // undefined when ellipsis matched
    const isSingleDot = terminator === '.'

    if (isSingleDot) {
      // Check if the word right before the period is an abbreviation.
      const before = text.slice(lastIndex, match.index + match[1].length)
      const wordMatch = before.match(/(\S+)$/)
      if (wordMatch && isAbbreviation(wordMatch[1])) {
        // Skip — not a real sentence boundary.
        continue
      }
    }

    // Everything from lastIndex to the end of the match (including terminator
    // and closing punctuation) is a complete sentence.
    const endOfSentence = match.index + match[0].length
    const sentence = text.slice(lastIndex, endOfSentence).trim()
    if (sentence) sentences.push(sentence)
    lastIndex = endOfSentence
    // Advance past any trailing whitespace so the next sentence starts clean.
    while (lastIndex < text.length && /\s/.test(text[lastIndex])) lastIndex++
    boundary.lastIndex = lastIndex
  }

  const remainder = text.slice(lastIndex)
  return { sentences, remainder }
}
