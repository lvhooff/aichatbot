import { execFileSync } from 'child_process'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { ensureBinary, findSwiftToolchain, transcribeBuffer } from './macos-impl'

// These tests compile and run the Swift on-device transcriber, so they only
// run on a macOS host that has a Swift 6.2+ / macOS 26 SDK toolchain.
let toolchainAvailable = false
try {
  findSwiftToolchain()
  toolchainAvailable = true
} catch {
  toolchainAvailable = false
}

const d = toolchainAvailable ? describe : describe.skip

const cacheDir = mkdtempSync(join(tmpdir(), 'aichatbot-stt-test-'))
afterAll(() => rmSync(cacheDir, { recursive: true, force: true }))

function makeTestWav(): Buffer {
  const aiff = join(cacheDir, 'sample.aiff')
  const wav = join(cacheDir, 'sample.wav')
  execFileSync('say', ['the quick brown fox jumps over the lazy dog', '-o', aiff])
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, wav])
  return readFileSync(wav)
}

d('macOS on-device STT', () => {
  it('compiles the helper binary and caches it', () => {
    const binPath = ensureBinary(cacheDir)
    expect(existsSync(binPath)).toBe(true)
    // Second call should be a no-op (cached) and return the same path.
    expect(ensureBinary(cacheDir)).toBe(binPath)
  })

  it('transcribes spoken audio to text', async () => {
    const wav = makeTestWav()
    const text = await transcribeBuffer(cacheDir, wav, 'audio/wav')
    expect(text.toLowerCase()).toContain('quick brown fox')
  }, 130_000)
})
