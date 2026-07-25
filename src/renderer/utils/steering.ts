/**
 * Live steering — redirecting a reply that is already in flight.
 *
 * The user can interrupt a reply with a short instruction ("shorter", "in
 * Python", "skip the history") instead of stopping it and asking again. The
 * reply is not restarted: whatever was already *delivered* is kept, and
 * generation resumes from that exact point with the new instruction applied.
 *
 * "Delivered" is the important word. Generation runs ahead of speech — the model
 * may be five sentences in while the listener has only heard two — so the pivot
 * happens where the user actually got to, not where the model got to. Text that
 * was generated but never spoken is retracted: as far as the conversation is
 * concerned, it was never said.
 */

import type { Message } from '../../main/providers/llm/interface'

/** A point in an assistant message where the user redirected the reply. */
export interface SteerPivot {
  /** Character offset in the message content where the steer took effect. */
  at: number
  /** What the user asked for, verbatim. */
  nudge: string
}

/**
 * Continuation prompt for a steered reply.
 *
 * Shaped as `… user(question) → assistant(delivered) → user(steer)` so it stays
 * strictly role-alternating, which every provider accepts — Claude in
 * particular rejects two user turns in a row.
 */
export function buildSteerMessages(
  history: Message[],
  deliveredSoFar: string,
  nudge: string
): Message[] {
  if (!deliveredSoFar.trim()) {
    // Steered before a single sentence had been delivered, so there is nothing to
    // continue from — fold the instruction into the question and start over. This
    // also keeps providers from seeing an empty assistant turn, which they reject.
    const question = history[history.length - 1]
    if (!question || question.role !== 'user') return history
    return [...history.slice(0, -1), { role: 'user', content: `${question.content}\n\n(${nudge})` }]
  }

  return [
    ...history,
    { role: 'assistant', content: deliveredSoFar },
    {
      role: 'user',
      content:
        `[MID-REPLY STEER] I cut you off mid-reply — you got as far as the text above — to say: "${nudge}"\n\n` +
        'Carry straight on from where you broke off, applying what I just asked from here on. ' +
        'Your output is appended verbatim onto your unfinished text, so begin with the exact words ' +
        'that come next (finishing the broken sentence if it was mid-sentence). Do not repeat any of ' +
        'it, do not start over, and do not acknowledge the interruption or apologise.'
    }
  ]
}

/**
 * Drop any leading text in `continuation` that just repeats the tail of
 * `prefix`.
 *
 * Handed a cut-off sentence, models often restate the last word or two before
 * carrying on — a prefix ending "…a spring-piston lever, which" comes back as
 * "which introduced…", which would render as "which which". Only whole words are
 * considered, longest overlap first, comparing case- and whitespace-insensitively
 * so "The\n" still matches "the ".
 */
export function stripOverlap(prefix: string, continuation: string): string {
  const normalise = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ')
  const tail = normalise(prefix).trimEnd()
  if (!tail) return continuation

  // A continuation often opens with an ellipsis to signal it is resuming
  // mid-thought ("…over-correct the bike"). That marker hides the repeat from the
  // word scan below, so it is set aside first — and because it is proof the model
  // is picking up a broken word, a partial-word repeat is trusted in that case.
  const resuming = continuation.match(/^\s*(?:\.{2,}|…)\s*/)
  const body = continuation.slice(resuming?.[0].length ?? 0).replace(/^\s+/, '')
  if (!body) return continuation

  // Candidate cut points, shortest first: the end of each leading word, plus —
  // when resuming — each position inside the first word.
  const cuts: { at: number; partial: boolean }[] = []
  const word = /\S+/g
  let match: RegExpExecArray | null
  while ((match = word.exec(body)) !== null && match.index < 120) {
    if (resuming && match.index === 0) {
      for (let k = 1; k < match[0].length; k++) cuts.push({ at: k, partial: true })
    }
    cuts.push({ at: match.index + match[0].length, partial: false })
  }

  for (let i = cuts.length - 1; i >= 0; i--) {
    const candidate = normalise(body.slice(0, cuts[i].at)).trim()
    // Whole words are safe at two characters; a partial word needs to be longer
    // before it outweighs the risk of eating a genuine word ("the" → "theory").
    if (candidate.length < (cuts[i].partial ? 3 : 2)) continue
    if (tail.endsWith(candidate)) return body.slice(cuts[i].at)
  }
  return continuation
}

/**
 * Slice a reply into the stretches between its steers, so the transcript can
 * show each redirection where it actually happened rather than as a footnote.
 *
 * The first stretch has no `nudgeBefore`; every later one is introduced by the
 * steer that produced it. Offsets are clamped and re-sorted, so a malformed
 * pivot list degrades to fewer splits instead of dropping text.
 */
export function splitAtPivots(
  content: string,
  steers: SteerPivot[] = []
): { text: string; nudgeBefore?: string }[] {
  if (steers.length === 0) return [{ text: content }]

  const parts: { text: string; nudgeBefore?: string }[] = []
  let cursor = 0
  let pending: string | undefined

  for (const pivot of [...steers].sort((a, b) => a.at - b.at)) {
    const at = Math.min(Math.max(pivot.at, cursor), content.length)
    parts.push({ text: content.slice(cursor, at), nudgeBefore: pending })
    pending = pivot.nudge
    cursor = at
  }
  parts.push({ text: content.slice(cursor), nudgeBefore: pending })

  // An empty stretch is still worth keeping when it carries a steer marker (two
  // steers in a row), but not otherwise.
  return parts.filter((part, i) => i === 0 || part.text.length > 0 || part.nudgeBefore)
}

/**
 * Join a delivered prefix to a freshly generated continuation, dropping any
 * repeated words and inserting a space only where the two would otherwise
 * collide mid-word.
 */
export function joinContinuation(prefix: string, continuation: string): string {
  const cleaned = stripOverlap(prefix, continuation)
  if (!prefix) return cleaned.replace(/^\s+/, '')
  if (!cleaned) return prefix
  const needsSpace = !/\s$/.test(prefix) && !/^[\s.,;:!?)\]'"]/.test(cleaned)
  return prefix + (needsSpace ? ' ' : '') + cleaned
}
