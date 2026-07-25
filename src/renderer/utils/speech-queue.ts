/**
 * Sentence-at-a-time speech queue.
 *
 * Sentences are pushed as the LLM finishes them and spoken one at a time, so
 * playback is gapless even though generation is still in progress.
 *
 * Each sentence is pushed with a `mark` — the offset in the reply text at which
 * that sentence ends — and the queue remembers the mark of the last sentence to
 * *finish* playing. That single number is the delivery boundary: everything
 * before it reached the listener's ears, everything after it did not. Steering
 * uses it to pivot a reply exactly where the listener actually got to.
 */
export class SpeechQueue {
  private queue: { text: string; mark: number }[] = []
  private draining = false
  private stopped = false
  private lastMark = 0
  private waiters: (() => void)[] = []

  /** True if any sentence failed to play — surfaced as a notice by the caller. */
  errored = false

  constructor(private speak: (text: string) => Promise<void>) {}

  /** Offset up to which the listener has heard whole sentences. */
  get mark(): number {
    return this.lastMark
  }

  get idle(): boolean {
    return !this.draining && this.queue.length === 0
  }

  /** Queue a sentence that ends at `mark` in the reply text. */
  push(text: string, mark: number): void {
    if (this.stopped) return
    this.queue.push({ text, mark })
    void this.drain()
  }

  /**
   * Abandon everything still queued and stop draining. The sentence currently
   * playing is killed separately by the caller (via the TTS adapter), since only
   * the main process can signal the running `say`/`afplay` process.
   */
  cancel(): void {
    this.stopped = true
    this.queue.length = 0
  }

  /** Re-open the queue after a cancel, for a steered reply that resumes speaking. */
  resume(): void {
    this.stopped = false
  }

  /** Resolves once nothing is queued or playing. */
  idleWait(): Promise<void> {
    if (this.idle) return Promise.resolve()
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  private async drain(): Promise<void> {
    if (this.draining) return
    this.draining = true
    while (!this.stopped && this.queue.length > 0) {
      const next = this.queue.shift()!
      try {
        await this.speak(next.text)
        // A cancel landing mid-sentence resolves speak() gracefully (the TTS
        // adapter treats SIGTERM as a clean stop), so the flag is what
        // distinguishes "finished playing" from "cut off". A half-heard sentence
        // is not delivered.
        if (!this.stopped) this.lastMark = next.mark
      } catch {
        // Keep draining so the mic isn't left paused, but remember the failure.
        this.errored = true
      }
    }
    this.draining = false
    if (this.queue.length === 0) {
      const waiting = this.waiters
      this.waiters = []
      waiting.forEach((resolve) => resolve())
    }
  }
}
