import { execFile, execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// On-device speech recognition via Apple's macOS 26 Speech framework
// (SpeechAnalyzer + SpeechTranscriber). Fully local: no API key, no network for
// recognition, no audio leaves the machine. The model is downloaded once via
// AssetInventory on first use. Source is embedded here so it bundles with the
// app; it is written out and compiled to a cached binary on first run.
export const SWIFT_SOURCE = `import Foundation
import Speech
import AVFoundation

func err(_ s: String) { FileHandle.standardError.write((s + "\\n").data(using: .utf8)!) }

@available(macOS 26.0, *)
func run(url: URL, localeID: String) async throws -> String {
  let supported = await SpeechTranscriber.supportedLocales
  func norm(_ l: Locale) -> String { l.identifier(.bcp47).lowercased() }
  let want = Locale(identifier: localeID).identifier(.bcp47).lowercased()
  let locale =
    supported.first(where: { norm($0) == want })
    ?? supported.first(where: { norm($0).hasPrefix(String(want.prefix(2))) })
    ?? supported.first
  guard let locale else { throw NSError(domain: "stt", code: 10, userInfo: [NSLocalizedDescriptionKey: "no supported locales installed"]) }
  err("using-locale=\\(locale.identifier)")

  let transcriber = SpeechTranscriber(locale: locale, preset: .transcription)

  if let req = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
    err("downloading-model")
    try await req.downloadAndInstall()
    err("model-installed")
  }

  let analyzer = SpeechAnalyzer(modules: [transcriber])
  let audioFile = try AVAudioFile(forReading: url)

  let collect = Task { () -> String in
    var text = AttributedString()
    for try await result in transcriber.results { text += result.text }
    return String(text.characters)
  }

  if let last = try await analyzer.analyzeSequence(from: audioFile) {
    try await analyzer.finalizeAndFinish(through: last)
  } else {
    try await analyzer.finalizeAndFinishThroughEndOfInput()
  }

  return try await collect.value
}

let args = CommandLine.arguments
guard args.count > 1 else { err("usage: transcribe <audio-file> [locale]"); exit(2) }
let url = URL(fileURLWithPath: args[1])
let localeID = args.count > 2 ? args[2] : "en-US"

let sema = DispatchSemaphore(value: 0)
var exitCode: Int32 = 0

Task {
  if #available(macOS 26.0, *) {
    do {
      let transcript = try await run(url: url, localeID: localeID)
      print(transcript.trimmingCharacters(in: .whitespacesAndNewlines))
    } catch {
      err("error: \\(error.localizedDescription)")
      exitCode = 1
    }
  } else {
    err("requires macOS 26 or later")
    exitCode = 7
  }
  sema.signal()
}

sema.wait()
exit(exitCode)
`

// The macOS 26 Speech API requires Swift 6.2+ and the macOS 26 SDK. The
// system's default `xcode-select` toolchain is often an older Xcode, so probe
// candidate developer dirs and prefer the Command Line Tools, which ships the
// newer toolchain.
const CANDIDATE_DEVELOPER_DIRS = [
  '/Library/Developer/CommandLineTools',
  undefined, // current xcode-select default
  '/Applications/Xcode.app/Contents/Developer',
]

function probeToolchain(developerDir?: string): string | undefined {
  const env = developerDir ? { ...process.env, DEVELOPER_DIR: developerDir } : process.env
  try {
    const version = execFileSync('xcrun', ['swiftc', '--version'], { env, encoding: 'utf8' })
    const m = version.match(/Apple Swift version (\d+)\.(\d+)/)
    const major = m ? Number(m[1]) : 0
    const minor = m ? Number(m[2]) : 0
    if (major < 6 || (major === 6 && minor < 2)) return undefined
    const sdk = execFileSync('xcrun', ['--sdk', 'macosx', '--show-sdk-version'], { env, encoding: 'utf8' }).trim()
    if (Number(sdk.split('.')[0]) < 26) return undefined
    return developerDir ?? ''
  } catch {
    return undefined
  }
}

let cachedToolchain: string | undefined | null = null

export function findSwiftToolchain(): string | undefined {
  if (cachedToolchain !== null) {
    if (cachedToolchain === undefined) {
      throw new Error(
        'macOS on-device speech recognition requires Swift 6.2+ with the macOS 26 SDK ' +
          '(Xcode 26 or matching Command Line Tools). None was found — run `xcode-select --install` ' +
          'or update Xcode, or choose a different speech-to-text provider in Settings.'
      )
    }
    return cachedToolchain || undefined
  }
  for (const dir of CANDIDATE_DEVELOPER_DIRS) {
    const found = probeToolchain(dir)
    if (found !== undefined) {
      cachedToolchain = found
      return found || undefined
    }
  }
  cachedToolchain = undefined
  return findSwiftToolchain() // throws with the helpful message
}

function toolchainEnv(): NodeJS.ProcessEnv {
  const dir = findSwiftToolchain()
  return dir ? { ...process.env, DEVELOPER_DIR: dir } : process.env
}

/**
 * Ensure the Swift transcriber binary is compiled and up to date in `cacheDir`.
 * Recompiles only when missing or when the embedded source changes. Returns the
 * absolute path to the binary.
 */
export function ensureBinary(cacheDir: string): string {
  const dir = join(cacheDir, 'macos-stt')
  const binPath = join(dir, 'transcribe')
  const srcPath = join(dir, 'transcribe.swift')
  const stampPath = join(dir, 'transcribe.hash')
  const hash = createHash('sha256').update(SWIFT_SOURCE).digest('hex')

  const upToDate =
    existsSync(binPath) && existsSync(stampPath) && readFileSync(stampPath, 'utf8') === hash
  if (upToDate) return binPath

  mkdirSync(dir, { recursive: true })
  writeFileSync(srcPath, SWIFT_SOURCE)
  execFileSync(
    'xcrun',
    ['swiftc', '-O', '-framework', 'Speech', '-framework', 'AVFoundation', '-framework', 'Foundation', srcPath, '-o', binPath],
    { env: toolchainEnv(), encoding: 'utf8' }
  )
  writeFileSync(stampPath, hash)
  return binPath
}

/** Transcribe a WAV/audio buffer to text using the compiled on-device binary. */
export async function transcribeBuffer(
  cacheDir: string,
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const binPath = ensureBinary(cacheDir)
  const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'wav'
  const audioPath = join(tmpdir(), `aichatbot-stt-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`)
  writeFileSync(audioPath, audioBuffer)
  try {
    // First run may download the on-device model, so allow a generous timeout.
    const { stdout } = await execFileAsync(binPath, [audioPath], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 })
    return stdout.trim()
  } finally {
    rmSync(audioPath, { force: true })
  }
}
