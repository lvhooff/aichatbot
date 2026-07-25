import { describe, it, expect, vi } from 'vitest'
import { SpeechQueue } from '../../src/renderer/utils/speech-queue'

/** A speak() stub whose individual calls can be resolved on demand. */
function deferredSpeaker() {
  const pending: { text: string; resolve: () => void; reject: (e: Error) => void }[] = []
  const speak = (text: string): Promise<void> =>
    new Promise((resolve, reject) => pending.push({ text, resolve, reject }))
  return { speak, pending }
}

describe('SpeechQueue', () => {
  it('starts with the delivery boundary at zero', () => {
    const queue = new SpeechQueue(vi.fn().mockResolvedValue(undefined))
    expect(queue.mark).toBe(0)
    expect(queue.idle).toBe(true)
  })

  it('advances the boundary only once a sentence finishes playing', async () => {
    const { speak, pending } = deferredSpeaker()
    const queue = new SpeechQueue(speak)

    queue.push('First one.', 10)
    await Promise.resolve()
    // Playing, but not finished — nothing has reached the listener yet.
    expect(queue.mark).toBe(0)

    pending[0].resolve()
    await queue.idleWait()
    expect(queue.mark).toBe(10)
  })

  it('speaks sentences one at a time, in order', async () => {
    const { speak, pending } = deferredSpeaker()
    const queue = new SpeechQueue(speak)

    queue.push('One.', 4)
    queue.push('Two.', 9)
    await Promise.resolve()

    expect(pending).toHaveLength(1)
    expect(pending[0].text).toBe('One.')

    pending[0].resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(pending).toHaveLength(2)
    expect(pending[1].text).toBe('Two.')
  })

  it('leaves the boundary at the last finished sentence when cancelled', async () => {
    const { speak, pending } = deferredSpeaker()
    const queue = new SpeechQueue(speak)

    queue.push('Heard this.', 11)
    queue.push('Never heard this.', 29)
    await Promise.resolve()
    pending[0].resolve()
    await Promise.resolve()
    await Promise.resolve()

    // Second sentence is mid-playback when the user steers.
    queue.cancel()
    pending[1].resolve()
    await queue.idleWait()

    // The interrupted sentence does not count as delivered.
    expect(queue.mark).toBe(11)
  })

  it('drops queued sentences on cancel', async () => {
    const { speak, pending } = deferredSpeaker()
    const queue = new SpeechQueue(speak)

    queue.push('One.', 4)
    queue.push('Two.', 9)
    queue.push('Three.', 16)
    await Promise.resolve()

    queue.cancel()
    pending[0].resolve()
    await queue.idleWait()

    expect(pending).toHaveLength(1)
    expect(queue.mark).toBe(0)
  })

  it('ignores pushes while cancelled, and accepts them again after resume', async () => {
    const speak = vi.fn().mockResolvedValue(undefined)
    const queue = new SpeechQueue(speak)

    queue.cancel()
    queue.push('ignored', 7)
    await queue.idleWait()
    expect(speak).not.toHaveBeenCalled()

    queue.resume()
    queue.push('spoken', 6)
    await queue.idleWait()
    expect(speak).toHaveBeenCalledWith('spoken')
    expect(queue.mark).toBe(6)
  })

  it('keeps draining after a playback failure but flags it', async () => {
    const speak = vi
      .fn()
      .mockRejectedValueOnce(new Error('say died'))
      .mockResolvedValueOnce(undefined)
    const queue = new SpeechQueue(speak)

    queue.push('Broken.', 7)
    queue.push('Fine.', 13)
    await queue.idleWait()

    expect(queue.errored).toBe(true)
    expect(speak).toHaveBeenCalledTimes(2)
    // The failed sentence never advanced the boundary; the next one did.
    expect(queue.mark).toBe(13)
  })

  it('idleWait resolves immediately when nothing is queued', async () => {
    const queue = new SpeechQueue(vi.fn())
    await expect(queue.idleWait()).resolves.toBeUndefined()
  })
})
