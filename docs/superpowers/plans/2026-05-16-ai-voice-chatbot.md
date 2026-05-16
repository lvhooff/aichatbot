# AI Voice Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Mac Electron desktop app that listens continuously with VAD, transcribes speech via STT, sends to a configurable LLM, and speaks the response back via TTS — with barge-in support to interrupt playback.

**Architecture:** Pure Electron app. React renderer owns VAD (via `@ricky0123/vad-react`), streams audio to main process over IPC. Main process owns provider adapters (STT/LLM/TTS), conversation state, and settings. All three provider types implement TypeScript interfaces, making them hot-swappable via a settings panel.

**Tech Stack:** Electron 28, electron-vite 2, React 18, TypeScript 5, `@ricky0123/vad-react`, `@anthropic-ai/sdk`, `openai`, `ollama`, Vitest, `@testing-library/react`

---

## File Map

```
aichatbot/
├── src/
│   ├── main/
│   │   ├── index.ts                        # Window creation, app lifecycle
│   │   ├── ipc.ts                          # ipcMain handler registration
│   │   ├── settings.ts                     # AppSettings read/write (JSON)
│   │   ├── conversation.ts                 # ConversationManager (rolling window)
│   │   ├── pipeline.ts                     # Orchestrates adapters; barge-in state
│   │   └── providers/
│   │       ├── stt/
│   │       │   ├── interface.ts            # STTAdapter interface
│   │       │   ├── whisper-api.ts          # OpenAI Whisper API
│   │       │   └── macos.ts               # Stub (throws NotImplemented)
│   │       ├── llm/
│   │       │   ├── interface.ts            # LLMAdapter interface + Message type
│   │       │   ├── claude.ts              # Anthropic Claude streaming
│   │       │   ├── openai.ts              # OpenAI GPT streaming
│   │       │   └── ollama.ts              # Ollama local streaming
│   │       └── tts/
│   │           ├── interface.ts            # TTSAdapter interface
│   │           ├── macos-say.ts           # macOS `say` command
│   │           └── openai-tts.ts          # OpenAI TTS API
│   ├── preload/
│   │   └── index.ts                        # contextBridge API exposure
│   └── renderer/
│       ├── index.html
│       ├── main.tsx                        # React entry point
│       ├── App.tsx                         # Root: state, pipeline orchestration
│       ├── types.ts                        # Shared renderer types (ChatMessage etc.)
│       ├── utils/
│       │   └── wav.ts                      # Float32Array → WAV ArrayBuffer encoder
│       ├── components/
│       │   ├── ChatHistory.tsx             # Scrollable message list
│       │   ├── StatusBar.tsx              # VAD status indicator
│       │   └── SettingsPanel.tsx          # Provider dropdowns + API key fields
│       └── hooks/
│           └── useVAD.ts                   # VAD lifecycle + barge-in threshold
├── tests/
│   ├── main/
│   │   ├── settings.test.ts
│   │   ├── conversation.test.ts
│   │   └── providers/
│   │       ├── llm/
│   │       │   ├── claude.test.ts
│   │       │   ├── openai.test.ts
│   │       │   └── ollama.test.ts
│   │       └── stt/
│   │           └── whisper-api.test.ts
│   └── renderer/
│       ├── ChatHistory.test.tsx
│       ├── StatusBar.test.tsx
│       └── SettingsPanel.test.tsx
├── electron.vite.config.ts
├── package.json
└── tsconfig.json
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: entire project via electron-vite template, then replace/add files per this plan

- [ ] **Step 1: Scaffold the electron-vite React TypeScript project**

```bash
cd path/to/aichatbot
npm create @quick-start/electron . -- --template react-ts --skip-git
```

Accept all prompts. This creates the electron-vite structure with `src/main`, `src/preload`, `src/renderer`.

- [ ] **Step 2: Install dependencies**

```bash
npm install @anthropic-ai/sdk openai ollama @ricky0123/vad-react @ricky0123/vad-web
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

- [ ] **Step 3: Configure Vitest in `electron.vite.config.ts`**

Replace the generated `electron.vite.config.ts` with:

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } } }
  },
  renderer: {
    plugins: [react()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } } }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  }
})
```

- [ ] **Step 4: Create test setup file**

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to `package.json`**

In `package.json`, ensure `scripts` contains:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify scaffold runs**

```bash
npm run dev
```

Expected: Electron window opens with default Vite+React template. Close the window.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold electron-vite react-ts project"
```

---

## Task 2: Shared Types and Provider Interfaces

**Files:**
- Create: `src/main/providers/stt/interface.ts`
- Create: `src/main/providers/llm/interface.ts`
- Create: `src/main/providers/tts/interface.ts`
- Create: `src/main/settings.ts` (types only first, persistence in Task 3)

- [ ] **Step 1: Write failing test for settings shape**

Create `tests/main/settings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/main/settings'

describe('DEFAULT_SETTINGS', () => {
  it('has all required provider sections', () => {
    expect(DEFAULT_SETTINGS.llm.provider).toBe('claude')
    expect(DEFAULT_SETTINGS.stt.provider).toBe('whisper-api')
    expect(DEFAULT_SETTINGS.tts.provider).toBe('macos-say')
    expect(DEFAULT_SETTINGS.conversationWindowSize).toBe(10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/main/settings.test.ts
```

Expected: FAIL — `Cannot find module '../../src/main/settings'`

- [ ] **Step 3: Create `src/main/settings.ts` with types and defaults**

```typescript
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface LLMSettings {
  provider: 'claude' | 'openai' | 'ollama'
  model: string
  apiKey: string
  baseUrl?: string
}

export interface STTSettings {
  provider: 'whisper-api' | 'macos' | 'whisper-local'
  apiKey: string
}

export interface TTSSettings {
  provider: 'macos-say' | 'openai-tts' | 'elevenlabs'
  apiKey: string
  voice?: string
}

export interface AppSettings {
  llm: LLMSettings
  stt: STTSettings
  tts: TTSSettings
  conversationWindowSize: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  llm: { provider: 'claude', model: 'claude-sonnet-4-6', apiKey: '' },
  stt: { provider: 'whisper-api', apiKey: '' },
  tts: { provider: 'macos-say', apiKey: '' },
  conversationWindowSize: 10,
}

export class SettingsManager {
  private settings: AppSettings
  private filePath: string

  constructor() {
    const dir = app.getPath('userData')
    this.filePath = join(dir, 'settings.json')
    this.settings = this.load()
  }

  private load(): AppSettings {
    if (!existsSync(this.filePath)) return { ...DEFAULT_SETTINGS }
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8'))
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }

  get(): AppSettings {
    return this.settings
  }

  save(settings: AppSettings): void {
    this.settings = settings
    const dir = join(this.filePath, '..')
    mkdirSync(dir, { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(settings, null, 2))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/main/settings.test.ts
```

Expected: PASS

- [ ] **Step 5: Create STT interface**

Create `src/main/providers/stt/interface.ts`:

```typescript
export interface STTAdapter {
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<string>
}
```

- [ ] **Step 6: Create LLM interface**

Create `src/main/providers/llm/interface.ts`:

```typescript
export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMAdapter {
  chat(messages: Message[], onToken: (token: string) => void): Promise<string>
  cancel(): void
}
```

- [ ] **Step 7: Create TTS interface**

Create `src/main/providers/tts/interface.ts`:

```typescript
export interface TTSAdapter {
  speak(text: string): Promise<void>
  stop(): void
}
```

- [ ] **Step 8: Commit**

```bash
git add src/main/settings.ts src/main/providers tests/main/settings.test.ts tests/setup.ts
git commit -m "feat: add shared types, provider interfaces, and settings defaults"
```

---

## Task 3: Conversation Manager

**Files:**
- Create: `src/main/conversation.ts`
- Create: `tests/main/conversation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/main/conversation.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/main/conversation.test.ts
```

Expected: FAIL — `Cannot find module '../../src/main/conversation'`

- [ ] **Step 3: Implement ConversationManager**

Create `src/main/conversation.ts`:

```typescript
import type { Message } from './providers/llm/interface'

export class ConversationManager {
  private history: Message[] = []

  constructor(private maxTurns: number = 10) {}

  add(message: Message): void {
    this.history.push(message)
  }

  getWindow(): Message[] {
    const maxMessages = this.maxTurns * 2
    return this.history.slice(-maxMessages)
  }

  clear(): void {
    this.history = []
  }

  updateMaxTurns(n: number): void {
    this.maxTurns = n
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/main/conversation.test.ts
```

Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/main/conversation.ts tests/main/conversation.test.ts
git commit -m "feat: add ConversationManager with rolling window"
```

---

## Task 4: LLM Providers — Claude, OpenAI, Ollama

**Files:**
- Create: `src/main/providers/llm/claude.ts`
- Create: `src/main/providers/llm/openai.ts`
- Create: `src/main/providers/llm/ollama.ts`
- Create: `tests/main/providers/llm/claude.test.ts`
- Create: `tests/main/providers/llm/openai.test.ts`
- Create: `tests/main/providers/llm/ollama.test.ts`

- [ ] **Step 1: Write failing tests for Claude adapter**

Create `tests/main/providers/llm/claude.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClaudeAdapter } from '../../../../src/main/providers/llm/claude'

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } }
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } }
            yield { type: 'message_stop' }
          }
        })
      }
    }))
  }
})

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter

  beforeEach(() => {
    adapter = new ClaudeAdapter('test-key', 'claude-sonnet-4-6')
  })

  it('streams tokens and returns full text', async () => {
    const tokens: string[] = []
    const result = await adapter.chat(
      [{ role: 'user', content: 'hi' }],
      (t) => tokens.push(t)
    )
    expect(tokens).toEqual(['Hello', ' world'])
    expect(result).toBe('Hello world')
  })

  it('cancel() does not throw', () => {
    expect(() => adapter.cancel()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/main/providers/llm/claude.test.ts
```

Expected: FAIL — `Cannot find module '../../../../src/main/providers/llm/claude'`

- [ ] **Step 3: Implement ClaudeAdapter**

Create `src/main/providers/llm/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { LLMAdapter, Message } from './interface'

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic
  private abortController?: AbortController

  constructor(apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey })
  }

  async chat(messages: Message[], onToken: (token: string) => void): Promise<string> {
    this.abortController = new AbortController()
    let fullText = ''

    const stream = this.client.messages.stream(
      { model: this.model, max_tokens: 1024, messages },
      { signal: this.abortController.signal }
    )

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        onToken(chunk.delta.text)
        fullText += chunk.delta.text
      }
    }

    return fullText
  }

  cancel(): void {
    this.abortController?.abort()
  }
}
```

- [ ] **Step 4: Run Claude test to verify it passes**

```bash
npm test -- tests/main/providers/llm/claude.test.ts
```

Expected: PASS

- [ ] **Step 5: Write failing tests for OpenAI adapter**

Create `tests/main/providers/llm/openai.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIAdapter } from '../../../../src/main/providers/llm/openai'

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockReturnValue({
            [Symbol.asyncIterator]: async function* () {
              yield { choices: [{ delta: { content: 'Hi' } }] }
              yield { choices: [{ delta: { content: ' there' } }] }
            }
          })
        }
      }
    }))
  }
})

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter

  beforeEach(() => {
    adapter = new OpenAIAdapter('test-key', 'gpt-4o')
  })

  it('streams tokens and returns full text', async () => {
    const tokens: string[] = []
    const result = await adapter.chat(
      [{ role: 'user', content: 'hello' }],
      (t) => tokens.push(t)
    )
    expect(tokens).toEqual(['Hi', ' there'])
    expect(result).toBe('Hi there')
  })

  it('cancel() does not throw', () => {
    expect(() => adapter.cancel()).not.toThrow()
  })
})
```

- [ ] **Step 6: Implement OpenAIAdapter**

Create `src/main/providers/llm/openai.ts`:

```typescript
import OpenAI from 'openai'
import type { LLMAdapter, Message } from './interface'

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI
  private abortController?: AbortController

  constructor(apiKey: string, private model: string) {
    this.client = new OpenAI({ apiKey })
  }

  async chat(messages: Message[], onToken: (token: string) => void): Promise<string> {
    this.abortController = new AbortController()
    let fullText = ''

    const stream = await this.client.chat.completions.create(
      { model: this.model, messages, stream: true },
      { signal: this.abortController.signal }
    )

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? ''
      if (token) {
        onToken(token)
        fullText += token
      }
    }

    return fullText
  }

  cancel(): void {
    this.abortController?.abort()
  }
}
```

- [ ] **Step 7: Write failing tests for Ollama adapter**

Create `tests/main/providers/llm/ollama.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaAdapter } from '../../../../src/main/providers/llm/ollama'

vi.mock('ollama', () => {
  return {
    Ollama: vi.fn().mockImplementation(() => ({
      chat: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { message: { content: 'Hey' } }
          yield { message: { content: '!' } }
        }
      })
    }))
  }
})

describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter

  beforeEach(() => {
    adapter = new OllamaAdapter('llama3')
  })

  it('streams tokens and returns full text', async () => {
    const tokens: string[] = []
    const result = await adapter.chat(
      [{ role: 'user', content: 'hello' }],
      (t) => tokens.push(t)
    )
    expect(tokens).toEqual(['Hey', '!'])
    expect(result).toBe('Hey!')
  })

  it('cancel() does not throw', () => {
    expect(() => adapter.cancel()).not.toThrow()
  })
})
```

- [ ] **Step 8: Implement OllamaAdapter**

Create `src/main/providers/llm/ollama.ts`:

```typescript
import { Ollama } from 'ollama'
import type { LLMAdapter, Message } from './interface'

export class OllamaAdapter implements LLMAdapter {
  private client: Ollama
  private abortController?: AbortController

  constructor(private model: string, baseUrl?: string) {
    this.client = new Ollama({ host: baseUrl ?? 'http://localhost:11434' })
  }

  async chat(messages: Message[], onToken: (token: string) => void): Promise<string> {
    this.abortController = new AbortController()
    let fullText = ''

    const stream = await this.client.chat({ model: this.model, messages, stream: true })

    for await (const chunk of stream) {
      const token = chunk.message.content
      if (token) {
        onToken(token)
        fullText += token
      }
    }

    return fullText
  }

  cancel(): void {
    this.abortController?.abort()
  }
}
```

- [ ] **Step 9: Run all LLM tests**

```bash
npm test -- tests/main/providers/llm
```

Expected: PASS — 6 tests across 3 files

- [ ] **Step 10: Commit**

```bash
git add src/main/providers/llm tests/main/providers/llm
git commit -m "feat: add Claude, OpenAI, and Ollama LLM adapters"
```

---

## Task 5: STT Provider — Whisper API

**Files:**
- Create: `src/main/providers/stt/whisper-api.ts`
- Create: `src/main/providers/stt/macos.ts`
- Create: `tests/main/providers/stt/whisper-api.test.ts`

- [ ] **Step 1: Write failing test for Whisper API adapter**

Create `tests/main/providers/stt/whisper-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WhisperAPIAdapter } from '../../../../src/main/providers/stt/whisper-api'

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({ text: 'hello world' })
        }
      }
    }))
  }
})

describe('WhisperAPIAdapter', () => {
  let adapter: WhisperAPIAdapter

  beforeEach(() => {
    adapter = new WhisperAPIAdapter('test-key')
  })

  it('returns transcript text', async () => {
    const buffer = Buffer.from('fake-audio')
    const result = await adapter.transcribe(buffer, 'audio/wav')
    expect(result).toBe('hello world')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/main/providers/stt/whisper-api.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement WhisperAPIAdapter**

Create `src/main/providers/stt/whisper-api.ts`:

```typescript
import OpenAI from 'openai'
import { Readable } from 'stream'
import type { STTAdapter } from './interface'

export class WhisperAPIAdapter implements STTAdapter {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const readable = Readable.from(audioBuffer) as NodeJS.ReadableStream & { name?: string }
    readable.name = `audio.${mimeType.split('/')[1] ?? 'wav'}`

    const response = await this.client.audio.transcriptions.create({
      file: readable as Parameters<typeof this.client.audio.transcriptions.create>[0]['file'],
      model: 'whisper-1',
    })

    return response.text
  }
}
```

- [ ] **Step 4: Create macOS STT stub**

Create `src/main/providers/stt/macos.ts`:

```typescript
import type { STTAdapter } from './interface'

export class MacOSSTTAdapter implements STTAdapter {
  async transcribe(_audioBuffer: Buffer, _mimeType: string): Promise<string> {
    throw new Error('macOS STT not yet implemented — use Whisper API')
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- tests/main/providers/stt
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/providers/stt tests/main/providers/stt
git commit -m "feat: add Whisper API STT adapter"
```

---

## Task 6: TTS Providers — macOS say and OpenAI TTS

**Files:**
- Create: `src/main/providers/tts/macos-say.ts`
- Create: `src/main/providers/tts/openai-tts.ts`

No unit tests for TTS adapters — they depend on external processes/APIs and are best verified manually. Integration-tested in Task 9 verification.

- [ ] **Step 1: Implement macOS say adapter**

Create `src/main/providers/tts/macos-say.ts`:

```typescript
import { spawn, ChildProcess } from 'child_process'
import type { TTSAdapter } from './interface'

export class MacOSSayAdapter implements TTSAdapter {
  private process?: ChildProcess

  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('say', [text])
      this.process.on('close', (code) => {
        if (code === 0 || code === null) resolve()
        else reject(new Error(`say exited with code ${code}`))
      })
      this.process.on('error', reject)
    })
  }

  stop(): void {
    this.process?.kill('SIGTERM')
  }
}
```

- [ ] **Step 2: Implement OpenAI TTS adapter**

Create `src/main/providers/tts/openai-tts.ts`:

```typescript
import OpenAI from 'openai'
import { execFile, ChildProcess } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { TTSAdapter } from './interface'

export class OpenAITTSAdapter implements TTSAdapter {
  private client: OpenAI
  private afplayProcess?: ChildProcess

  constructor(apiKey: string, private voice: string = 'alloy') {
    this.client = new OpenAI({ apiKey })
  }

  async speak(text: string): Promise<void> {
    const response = await this.client.audio.speech.create({
      model: 'tts-1',
      voice: this.voice as 'alloy',
      input: text,
      response_format: 'mp3',
    })

    const buffer = Buffer.from(await response.arrayBuffer())
    const tmpFile = join(tmpdir(), `aichatbot-tts-${Date.now()}.mp3`)
    await writeFile(tmpFile, buffer)

    return new Promise((resolve, reject) => {
      this.afplayProcess = execFile('afplay', [tmpFile], async (err) => {
        await unlink(tmpFile).catch(() => {})
        if (err && err.killed) resolve()
        else if (err) reject(err)
        else resolve()
      })
    })
  }

  stop(): void {
    this.afplayProcess?.kill('SIGTERM')
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/providers/tts
git commit -m "feat: add macOS say and OpenAI TTS adapters"
```

---

## Task 7: Pipeline and Provider Factories

**Files:**
- Create: `src/main/pipeline.ts`

- [ ] **Step 1: Implement Pipeline with provider factories**

Create `src/main/pipeline.ts`:

```typescript
import type { AppSettings } from './settings'
import type { STTAdapter } from './providers/stt/interface'
import type { LLMAdapter, Message } from './providers/llm/interface'
import type { TTSAdapter } from './providers/tts/interface'
import { WhisperAPIAdapter } from './providers/stt/whisper-api'
import { MacOSSTTAdapter } from './providers/stt/macos'
import { ClaudeAdapter } from './providers/llm/claude'
import { OpenAIAdapter } from './providers/llm/openai'
import { OllamaAdapter } from './providers/llm/ollama'
import { MacOSSayAdapter } from './providers/tts/macos-say'
import { OpenAITTSAdapter } from './providers/tts/openai-tts'

function createSTTAdapter(settings: AppSettings['stt']): STTAdapter {
  switch (settings.provider) {
    case 'whisper-api': return new WhisperAPIAdapter(settings.apiKey)
    case 'macos': return new MacOSSTTAdapter()
    default: throw new Error(`Unknown STT provider: ${settings.provider}`)
  }
}

function createLLMAdapter(settings: AppSettings['llm']): LLMAdapter {
  switch (settings.provider) {
    case 'claude': return new ClaudeAdapter(settings.apiKey, settings.model)
    case 'openai': return new OpenAIAdapter(settings.apiKey, settings.model)
    case 'ollama': return new OllamaAdapter(settings.model, settings.baseUrl)
    default: throw new Error(`Unknown LLM provider: ${settings.provider}`)
  }
}

function createTTSAdapter(settings: AppSettings['tts']): TTSAdapter {
  switch (settings.provider) {
    case 'macos-say': return new MacOSSayAdapter()
    case 'openai-tts': return new OpenAITTSAdapter(settings.apiKey, settings.voice)
    default: throw new Error(`Unknown TTS provider: ${settings.provider}`)
  }
}

export class Pipeline {
  private stt: STTAdapter
  private llm: LLMAdapter
  private tts: TTSAdapter

  constructor(settings: AppSettings) {
    this.stt = createSTTAdapter(settings.stt)
    this.llm = createLLMAdapter(settings.llm)
    this.tts = createTTSAdapter(settings.tts)
  }

  transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    return this.stt.transcribe(audioBuffer, mimeType)
  }

  chat(messages: Message[], onToken: (token: string) => void): Promise<string> {
    return this.llm.chat(messages, onToken)
  }

  async speak(text: string): Promise<void> {
    return this.tts.speak(text)
  }

  stopSpeaking(): void {
    this.tts.stop()
  }

  cancelLLM(): void {
    this.llm.cancel()
  }

  updateProviders(settings: AppSettings): void {
    this.stt = createSTTAdapter(settings.stt)
    this.llm = createLLMAdapter(settings.llm)
    this.tts = createTTSAdapter(settings.tts)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/pipeline.ts
git commit -m "feat: add Pipeline orchestrator with provider factories"
```

---

## Task 8: Preload Script and IPC Handlers

**Files:**
- Modify: `src/preload/index.ts`
- Create: `src/main/ipc.ts`

- [ ] **Step 1: Write the preload script**

Replace `src/preload/index.ts` with:

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings } from '../main/settings'
import type { Message } from '../main/providers/llm/interface'

contextBridge.exposeInMainWorld('api', {
  transcribe: (audioBuffer: ArrayBuffer, mimeType: string): Promise<string> =>
    ipcRenderer.invoke('stt:transcribe', audioBuffer, mimeType),

  chat: (messages: Message[]): Promise<string> =>
    ipcRenderer.invoke('llm:chat', messages),

  onLLMToken: (callback: (token: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, token: string) => callback(token)
    ipcRenderer.on('llm:token', handler)
    return () => ipcRenderer.removeListener('llm:token', handler)
  },

  speak: (text: string): Promise<void> =>
    ipcRenderer.invoke('tts:speak', text),

  stopSpeaking: (): Promise<void> =>
    ipcRenderer.invoke('tts:stop'),

  cancelLLM: (): Promise<void> =>
    ipcRenderer.invoke('llm:cancel'),

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:get'),

  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke('settings:save', settings),
})
```

- [ ] **Step 2: Create `src/main/ipc.ts`**

```typescript
import { ipcMain, WebContents } from 'electron'
import type { Pipeline } from './pipeline'
import type { SettingsManager } from './settings'
import type { Message } from './providers/llm/interface'

export function registerIpcHandlers(pipeline: Pipeline, settingsManager: SettingsManager, webContents: WebContents): void {
  ipcMain.handle('stt:transcribe', async (_event, audioBuffer: ArrayBuffer, mimeType: string) => {
    return pipeline.transcribe(Buffer.from(audioBuffer), mimeType)
  })

  ipcMain.handle('llm:chat', async (_event, messages: Message[]) => {
    return pipeline.chat(messages, (token) => {
      webContents.send('llm:token', token)
    })
  })

  ipcMain.handle('llm:cancel', async () => {
    pipeline.cancelLLM()
  })

  ipcMain.handle('tts:speak', async (_event, text: string) => {
    return pipeline.speak(text)
  })

  ipcMain.handle('tts:stop', async () => {
    pipeline.stopSpeaking()
  })

  ipcMain.handle('settings:get', async () => {
    return settingsManager.get()
  })

  ipcMain.handle('settings:save', async (_event, settings) => {
    settingsManager.save(settings)
    pipeline.updateProviders(settings)
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts src/main/ipc.ts
git commit -m "feat: add preload contextBridge and IPC handlers"
```

---

## Task 9: Main Process Entry Point

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Rewrite main process entry**

Replace `src/main/index.ts` with:

```typescript
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SettingsManager } from './settings'
import { Pipeline } from './pipeline'
import { registerIpcHandlers } from './ipc'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 360,
    minHeight: 500,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.aichatbot')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const settingsManager = new SettingsManager()
  const pipeline = new Pipeline(settingsManager.get())
  const win = createWindow()

  win.webContents.once('did-finish-load', () => {
    registerIpcHandlers(pipeline, settingsManager, win.webContents)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 2: Verify app still launches**

```bash
npm run dev
```

Expected: Electron window opens (still showing Vite template). No console errors in main process.

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: wire up main process with pipeline and IPC handlers"
```

---

## Task 10: WAV Encoder Utility

**Files:**
- Create: `src/renderer/utils/wav.ts`

- [ ] **Step 1: Write failing test**

Create `tests/renderer/wav.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { encodeWAV } from '../../src/renderer/utils/wav'

describe('encodeWAV', () => {
  it('produces a buffer with RIFF header', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1.0])
    const buffer = encodeWAV(samples)
    const view = new DataView(buffer)
    // RIFF header magic bytes
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe('RIFF')
    expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe('WAVE')
  })

  it('output length = 44 header + 2 bytes per sample', () => {
    const samples = new Float32Array(100)
    const buffer = encodeWAV(samples)
    expect(buffer.byteLength).toBe(44 + 100 * 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/renderer/wav.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement WAV encoder**

Create `src/renderer/utils/wav.ts`:

```typescript
export function encodeWAV(samples: Float32Array, sampleRate = 16000): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)         // subchunk size
  view.setUint16(20, 1, true)          // PCM format
  view.setUint16(22, 1, true)          // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)          // block align
  view.setUint16(34, 16, true)         // bits per sample
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return buffer
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/renderer/wav.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/utils/wav.ts tests/renderer/wav.test.ts
git commit -m "feat: add Float32Array to WAV ArrayBuffer encoder"
```

---

## Task 11: useVAD Hook

**Files:**
- Create: `src/renderer/hooks/useVAD.ts`

Note: `@ricky0123/vad-react` requires its ONNX model files to be served. Copy them to the renderer public directory.

- [ ] **Step 1: Copy VAD ONNX assets**

```bash
cp node_modules/@ricky0123/vad-web/dist/silero_vad.onnx src/renderer/public/
cp node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js src/renderer/public/
cp node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm src/renderer/public/ 2>/dev/null || true
```

- [ ] **Step 2: Implement useVAD hook**

Create `src/renderer/hooks/useVAD.ts`:

```typescript
import { useMicVAD, utils } from '@ricky0123/vad-react'
import { encodeWAV } from '../utils/wav'

export type VADStatus = 'idle' | 'listening' | 'recording' | 'error'

interface UseVADOptions {
  isPlaying: boolean
  onAudioReady: (audioBuffer: ArrayBuffer) => void
  onError: (err: Error) => void
}

export function useVAD({ isPlaying, onAudioReady, onError }: UseVADOptions) {
  const vad = useMicVAD({
    startOnLoad: true,
    // Higher threshold while TTS is playing — prevents AI voice triggering barge-in
    positiveSpeechThreshold: isPlaying ? 0.90 : 0.50,
    negativeSpeechThreshold: 0.35,
    minSpeechFrames: 4,
    preSpeechPadFrames: 1,
    onSpeechEnd: (audio: Float32Array) => {
      const wav = encodeWAV(audio)
      onAudioReady(wav)
    },
    onError: (err: Error) => onError(err),
  })

  const status: VADStatus = vad.errored
    ? 'error'
    : vad.userSpeaking
      ? 'recording'
      : vad.loading
        ? 'idle'
        : 'listening'

  return { status }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/useVAD.ts src/renderer/public/
git commit -m "feat: add useVAD hook with barge-in threshold support"
```

---

## Task 12: React Components

**Files:**
- Create: `src/renderer/types.ts`
- Create: `src/renderer/components/ChatHistory.tsx`
- Create: `src/renderer/components/StatusBar.tsx`
- Create: `src/renderer/components/SettingsPanel.tsx`
- Create: `tests/renderer/ChatHistory.test.tsx`
- Create: `tests/renderer/StatusBar.test.tsx`
- Create: `tests/renderer/SettingsPanel.test.tsx`

- [ ] **Step 1: Create shared renderer types**

Create `src/renderer/types.ts`:

```typescript
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  isError?: boolean
}
```

- [ ] **Step 2: Write failing test for ChatHistory**

Create `tests/renderer/ChatHistory.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatHistory } from '../../src/renderer/components/ChatHistory'
import type { ChatMessage } from '../../src/renderer/types'

describe('ChatHistory', () => {
  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Hello there' },
    { id: '2', role: 'assistant', content: 'Hi! How can I help?' },
  ]

  it('renders all messages', () => {
    render(<ChatHistory messages={messages} />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument()
  })

  it('labels user and assistant messages', () => {
    render(<ChatHistory messages={messages} />)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('renders empty state when no messages', () => {
    render(<ChatHistory messages={[]} />)
    expect(screen.getByText(/start speaking/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Implement ChatHistory**

Create `src/renderer/components/ChatHistory.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../types'

interface Props {
  messages: ChatMessage[]
}

export function ChatHistory({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 14 }}>
        Start speaking to begin a conversation
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {messages.map((msg) => (
        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
          <span style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
            {msg.role === 'user' ? 'You' : 'AI'}
          </span>
          <div style={{
            maxWidth: '80%',
            padding: '8px 12px',
            borderRadius: 12,
            background: msg.isError ? '#fee' : msg.role === 'user' ? '#0070f3' : '#f0f0f0',
            color: msg.role === 'user' ? '#fff' : '#000',
            fontSize: 14,
            lineHeight: 1.5,
          }}>
            {msg.content}
            {msg.isStreaming && <span style={{ opacity: 0.5 }}>▋</span>}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 4: Write failing test for StatusBar**

Create `tests/renderer/StatusBar.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from '../../src/renderer/components/StatusBar'

describe('StatusBar', () => {
  it('shows listening state', () => {
    render(<StatusBar status="listening" isPlaying={false} />)
    expect(screen.getByText(/listening/i)).toBeInTheDocument()
  })

  it('shows recording state', () => {
    render(<StatusBar status="recording" isPlaying={false} />)
    expect(screen.getByText(/recording/i)).toBeInTheDocument()
  })

  it('shows speaking state when isPlaying', () => {
    render(<StatusBar status="listening" isPlaying={true} />)
    expect(screen.getByText(/speaking/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Implement StatusBar**

Create `src/renderer/components/StatusBar.tsx`:

```tsx
import type { VADStatus } from '../hooks/useVAD'

interface Props {
  status: VADStatus
  isPlaying: boolean
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'Initializing...',
  listening: 'Listening',
  recording: 'Recording...',
  error: 'Mic error',
}

export function StatusBar({ status, isPlaying }: Props) {
  const label = isPlaying ? 'Speaking...' : STATUS_LABELS[status] ?? 'Listening'
  const isActive = status === 'recording' || isPlaying

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 16px',
      borderTop: '1px solid #e0e0e0',
      fontSize: 13,
      color: '#555',
    }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: isActive ? '#e53e3e' : status === 'listening' ? '#38a169' : '#aaa',
      }} />
      {label}
    </div>
  )
}
```

- [ ] **Step 6: Write failing test for SettingsPanel**

Create `tests/renderer/SettingsPanel.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel } from '../../src/renderer/components/SettingsPanel'
import { DEFAULT_SETTINGS } from '../../src/main/settings'

describe('SettingsPanel', () => {
  it('renders all provider dropdowns', () => {
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByLabelText(/llm provider/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/stt provider/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tts provider/i)).toBeInTheDocument()
  })

  it('calls onSave with updated settings when Save is clicked', () => {
    const onSave = vi.fn()
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ llm: expect.any(Object) }))
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onSave={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 7: Implement SettingsPanel**

Create `src/renderer/components/SettingsPanel.tsx`:

```tsx
import { useState } from 'react'
import type { AppSettings } from '../../main/settings'

interface Props {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  onClose: () => void
}

export function SettingsPanel({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<AppSettings>(structuredClone(settings))

  function set<K extends keyof AppSettings>(section: K, updates: Partial<AppSettings[K]>) {
    setDraft((prev) => ({ ...prev, [section]: { ...prev[section], ...updates } }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 360, maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Settings</h2>

        <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 600 }}>LLM</legend>
          <label htmlFor="llm-provider" style={{ fontSize: 13 }}>LLM Provider</label>
          <select id="llm-provider" value={draft.llm.provider} onChange={(e) => set('llm', { provider: e.target.value as AppSettings['llm']['provider'] })}>
            <option value="claude">Claude (Anthropic)</option>
            <option value="openai">OpenAI GPT</option>
            <option value="ollama">Ollama (local)</option>
          </select>
          <label htmlFor="llm-model" style={{ fontSize: 13 }}>Model</label>
          <input id="llm-model" value={draft.llm.model} onChange={(e) => set('llm', { model: e.target.value })} placeholder="e.g. claude-sonnet-4-6" />
          {draft.llm.provider !== 'ollama' && (
            <>
              <label htmlFor="llm-key" style={{ fontSize: 13 }}>API Key</label>
              <input id="llm-key" type="password" value={draft.llm.apiKey} onChange={(e) => set('llm', { apiKey: e.target.value })} placeholder="sk-..." />
            </>
          )}
          {draft.llm.provider === 'ollama' && (
            <>
              <label htmlFor="ollama-url" style={{ fontSize: 13 }}>Ollama Base URL</label>
              <input id="ollama-url" value={draft.llm.baseUrl ?? ''} onChange={(e) => set('llm', { baseUrl: e.target.value })} placeholder="http://localhost:11434" />
            </>
          )}
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 600 }}>Speech-to-Text</legend>
          <label htmlFor="stt-provider" style={{ fontSize: 13 }}>STT Provider</label>
          <select id="stt-provider" value={draft.stt.provider} onChange={(e) => set('stt', { provider: e.target.value as AppSettings['stt']['provider'] })}>
            <option value="whisper-api">OpenAI Whisper API</option>
            <option value="macos">macOS (not yet implemented)</option>
          </select>
          {draft.stt.provider === 'whisper-api' && (
            <>
              <label htmlFor="stt-key" style={{ fontSize: 13 }}>OpenAI API Key</label>
              <input id="stt-key" type="password" value={draft.stt.apiKey} onChange={(e) => set('stt', { apiKey: e.target.value })} placeholder="sk-..." />
            </>
          )}
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 600 }}>Text-to-Speech</legend>
          <label htmlFor="tts-provider" style={{ fontSize: 13 }}>TTS Provider</label>
          <select id="tts-provider" value={draft.tts.provider} onChange={(e) => set('tts', { provider: e.target.value as AppSettings['tts']['provider'] })}>
            <option value="macos-say">macOS say (free)</option>
            <option value="openai-tts">OpenAI TTS</option>
          </select>
          {draft.tts.provider === 'openai-tts' && (
            <>
              <label htmlFor="tts-key" style={{ fontSize: 13 }}>OpenAI API Key</label>
              <input id="tts-key" type="password" value={draft.tts.apiKey} onChange={(e) => set('tts', { apiKey: e.target.value })} placeholder="sk-..." />
              <label htmlFor="tts-voice" style={{ fontSize: 13 }}>Voice</label>
              <select id="tts-voice" value={draft.tts.voice ?? 'alloy'} onChange={(e) => set('tts', { voice: e.target.value })}>
                <option value="alloy">Alloy</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
                <option value="shimmer">Shimmer</option>
              </select>
            </>
          )}
        </fieldset>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="window-size" style={{ fontSize: 13 }}>Conversation Window (turns)</label>
          <input
            id="window-size"
            type="number"
            min={1}
            max={50}
            value={draft.conversationWindowSize}
            onChange={(e) => setDraft((prev) => ({ ...prev, conversationWindowSize: Number(e.target.value) }))}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(draft)} style={{ padding: '8px 16px', borderRadius: 6, background: '#0070f3', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Run all renderer tests**

```bash
npm test -- tests/renderer
```

Expected: PASS — ChatHistory (3), StatusBar (3), SettingsPanel (3)

- [ ] **Step 9: Commit**

```bash
git add src/renderer/types.ts src/renderer/components tests/renderer
git commit -m "feat: add ChatHistory, StatusBar, and SettingsPanel components"
```

---

## Task 13: App.tsx — Root Component Wiring

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/main.tsx`

- [ ] **Step 1: Declare the window.api type**

Add to `src/renderer/main.tsx` before the `ReactDOM.createRoot` call (or in a new `src/renderer/env.d.ts`):

Create `src/renderer/env.d.ts`:

```typescript
import type { AppSettings } from '../main/settings'
import type { Message } from '../main/providers/llm/interface'

interface Window {
  api: {
    transcribe(audioBuffer: ArrayBuffer, mimeType: string): Promise<string>
    chat(messages: Message[]): Promise<string>
    onLLMToken(callback: (token: string) => void): () => void
    speak(text: string): Promise<void>
    stopSpeaking(): Promise<void>
    cancelLLM(): Promise<void>
    getSettings(): Promise<AppSettings>
    saveSettings(settings: AppSettings): Promise<void>
  }
}
```

- [ ] **Step 2: Implement App.tsx**

Replace `src/renderer/App.tsx` with:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatHistory } from './components/ChatHistory'
import { StatusBar } from './components/StatusBar'
import { SettingsPanel } from './components/SettingsPanel'
import { useVAD } from './hooks/useVAD'
import type { ChatMessage } from './types'
import type { AppSettings } from '../main/settings'
import type { Message } from '../main/providers/llm/interface'
import { DEFAULT_SETTINGS } from '../main/settings'

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const conversationRef = useRef<Message[]>([])

  useEffect(() => {
    window.api.getSettings().then(setSettings).catch(console.error)
  }, [])

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  const updateLastAssistantMessage = useCallback((token: string, done = false) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      return [
        ...prev.slice(0, -1),
        { ...last, content: last.content + token, isStreaming: !done },
      ]
    })
  }, [])

  const handleAudioReady = useCallback(async (audioBuffer: ArrayBuffer) => {
    // Barge-in: if TTS is playing, stop it before transcribing
    if (isPlaying) {
      await window.api.stopSpeaking()
      await window.api.cancelLLM()
      setIsPlaying(false)
    }

    const userMsgId = crypto.randomUUID()
    let transcript = ''

    try {
      transcript = await window.api.transcribe(audioBuffer, 'audio/wav')
    } catch (err) {
      addMessage({ id: userMsgId, role: 'user', content: 'Transcription failed', isError: true })
      return
    }

    if (!transcript.trim()) return

    addMessage({ id: userMsgId, role: 'user', content: transcript })
    conversationRef.current = [
      ...conversationRef.current,
      { role: 'user', content: transcript },
    ].slice(-(settings.conversationWindowSize * 2))

    const assistantMsgId = crypto.randomUUID()
    addMessage({ id: assistantMsgId, role: 'assistant', content: '', isStreaming: true })

    let fullResponse = ''
    const removeListener = window.api.onLLMToken((token) => {
      fullResponse += token
      updateLastAssistantMessage(token)
    })

    try {
      await window.api.chat(conversationRef.current)
    } catch (err) {
      updateLastAssistantMessage('', true)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, content: `Error: ${(err as Error).message}`, isError: true, isStreaming: false }]
      })
      removeListener()
      return
    }

    removeListener()
    updateLastAssistantMessage('', true)

    if (fullResponse.trim()) {
      conversationRef.current = [
        ...conversationRef.current,
        { role: 'assistant', content: fullResponse },
      ].slice(-(settings.conversationWindowSize * 2))

      setIsPlaying(true)
      try {
        await window.api.speak(fullResponse)
      } catch {
        // TTS failure is silent — text already shown
      }
      setIsPlaying(false)
    }
  }, [isPlaying, settings.conversationWindowSize, addMessage, updateLastAssistantMessage])

  const { status } = useVAD({
    isPlaying,
    onAudioReady: handleAudioReady,
    onError: (err) => console.error('VAD error:', err),
  })

  async function handleSaveSettings(newSettings: AppSettings) {
    await window.api.saveSettings(newSettings)
    setSettings(newSettings)
    setSettingsOpen(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e0e0e0' }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>AI Chatbot</span>
        <button
          onClick={() => setSettingsOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
          aria-label="Settings"
        >
          ⚙
        </button>
      </div>

      <ChatHistory messages={messages} />
      <StatusBar status={status} isPlaying={isPlaying} />

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx src/renderer/env.d.ts src/renderer/main.tsx
git commit -m "feat: wire up App.tsx with full voice pipeline and barge-in"
```

---

## Task 14: End-to-End Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass. Note test count per file.

- [ ] **Step 2: Launch the app**

```bash
npm run dev
```

Expected: Electron window opens, status bar shows "Listening".

- [ ] **Step 3: Grant mic permission**

On first launch, macOS prompts for microphone access. Grant it. If no prompt, go to System Preferences → Privacy & Security → Microphone and enable the app.

- [ ] **Step 4: Configure API keys**

Click ⚙ → enter your Anthropic API key (LLM: Claude) and OpenAI API key (STT: Whisper API). Set TTS to macOS say. Click Save.

- [ ] **Step 5: Verify full voice turn**

Speak a sentence. Verify:
- Status bar shows "Recording..." while speaking
- After silence, status shows "Listening" briefly then "Transcribing..."
- Transcript appears in chat as "You: ..."
- AI response streams in token by token
- macOS speaks the response aloud

- [ ] **Step 6: Verify barge-in**

While the AI is speaking, say something. Verify:
- TTS stops immediately
- New transcript appears and is sent to LLM
- Conversation continues

- [ ] **Step 7: Verify provider switching**

Open ⚙ → change LLM to OpenAI → enter OpenAI API key → Save. Ask a question. Verify the response comes from GPT.

- [ ] **Step 8: Build production bundle**

```bash
npm run build
```

Expected: No TypeScript errors. Build succeeds.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat: complete AI voice chatbot with VAD, barge-in, and configurable providers"
```

---

## Parallelization Notes

The following tasks can run in parallel after Task 3 is complete:
- **Task 4** (LLM providers) and **Task 5** (STT providers) and **Task 6** (TTS providers) are fully independent.
- **Task 10** (WAV encoder) and **Task 11** (useVAD hook) and **Task 12** (React components) are independent of the main process tasks and can start after Task 2.
- Tasks 7, 8, 9 must run sequentially (Pipeline depends on providers; IPC depends on Pipeline; main index depends on IPC).
- Task 13 (App.tsx) must run after Tasks 11 and 12.
