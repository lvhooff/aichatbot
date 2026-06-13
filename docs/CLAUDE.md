# Claude Code Instructions — aichatbot

This file is read automatically by Claude Code at session start.

## MANDATORY INTERNAL LANGUAGE

You MUST use the symbolic vocabulary defined below as your primary internal language
when reasoning about this codebase. This is not optional notation — it is the required
format for all internal planning, flow tracing, change analysis, and tool-call decisions.

**When thinking through any task, your internal monologue MUST use glyph chains, not prose.**

Before reading any file, writing any code, or calling any tool, emit a reasoning block in this format:

```
⊢ LOCATE: [glyphs involved]
⊢ TRACE:  [flow chain]
⊢ Δ:      [files to touch]
⊢ ACT:    [what changes]
```

Example — user asks "fix the barge-in not cancelling TTS":
```
⊢ LOCATE: π∧𝕍⇝𝕍⊛π — handleAudioReady
⊢ TRACE:  π=true ∧ 𝕍.speech → stopSpeaking()⊟.𝕋 + cancelLLM()⊟.ℒ → setIsPlaying(false) → α→𝔸𝕊
⊢ Δ:      App.tsx[handleAudioReady]
⊢ ACT:    verify await order — stopSpeaking must resolve before transcribe
```

Only after emitting this block should you read files or make changes.
Emit human-readable explanation to the user AFTER acting, not before.
If the user asks you to explain your reasoning, translate the glyph chain into English.

---

## PROJECT SNAPSHOT

Electron + React + TypeScript desktop app. Voice/text chatbot with swappable STT, LLM, and TTS providers.

```
src/main/          — Node/Electron main process
  pipeline.ts      — Provider orchestrator (𝕻)
  ipc.ts           — Main↔renderer bridge (⊟)
  conversation.ts  — Message history + window (𝕳)
  settings.ts      — Persist/load AppSettings (⚙)
  providers/
    stt/           — Speech-to-text adapters (𝔸𝕊)
    llm/           — LLM adapters (𝔸ℒ)
    tts/           — TTS adapters (𝔸𝕋)

src/renderer/      — Chromium renderer process
  src/App.tsx      — Root component, all state, sendMessage()
  components/      — ChatHistory, VoiceInput, TextInput, SettingsPanel, StatusBar
  hooks/useVAD.ts  — Silero VAD via @ricky0123/vad-react (𝕍)
  utils/wav.ts     — Float32→WAV encoder
  public/          — ONNX model + WASM assets for VAD

src/preload/       — contextBridge API surface (window.api)
```

---

## SYMBOLIC VOCABULARY

These glyphs ARE the codebase. Treat them as first-class identifiers, not abbreviations.
When you see `𝕻` you are referring to `src/main/pipeline.ts:Pipeline`.
When you see `κ⟳⊟←` you are referring to the token streaming path through ipc.ts to App.tsx.
Never expand a glyph into prose in your internal reasoning — only expand when explaining to the user.

### Architecture

| Glyph | Concrete referent |
|-------|------------------|
| `𝕻` | `Pipeline` class — owns 𝔸𝕊, 𝔸ℒ, 𝔸𝕋 slots |
| `𝕻↺` | `pipeline.updateProviders(settings)` — hot-swap all adapters |
| `𝔸` | Any adapter implementing an interface |
| `𝔸𝕊` | `STTAdapter` — `transcribe(buffer, mime)→string` |
| `𝔸ℒ` | `LLMAdapter` — `chat(messages, onToken)→string` + `cancel()` |
| `𝔸𝕋` | `TTSAdapter` — `speak(text)` + `stop()` |
| `𝔸∅` | No-op adapter (NoneSTT / NoneTTS) |
| `⊟` | IPC boundary — `ipcMain` / `contextBridge` |
| `⊟→` | `ipcRenderer.invoke` (renderer→main) |
| `⊟←` | `webContents.send` (main→renderer, used for token streaming) |
| `𝕳` | `ConversationManager` — history + `getWindow()` |
| `⚙` | `AppSettings` `{llm, stt, tts, conversationWindowSize}` |
| `⚙₀` | `DEFAULT_SETTINGS` fallback |
| `⚙✦` | `settings.json` on disk (Electron userData) |

### Providers

| Glyph | Concrete referent |
|-------|------------------|
| `𝕎` | `WhisperAPIAdapter` — off-device, needs API key |
| `𝕄𝕊` | `MacOSSTTAdapter` — on-device, macOS 26 Speech framework |
| `𝕄𝕊⚙` | `ensureBinary()` — compile Swift binary on first run |
| `𝕄𝕊⚙↯` | `findSwiftToolchain()` failure — Swift 6.2+/macOS 26 SDK missing |
| `ℭ` | `ClaudeAdapter` (default) |
| `𝕆` | `OpenAIAdapter` |
| `𝕷` | `OllamaAdapter` (local + cloud variant) |
| `𝕽` | `OpenRouterAdapter` |
| `𝕾` | `MacOSSayAdapter` — `say` command, local |
| `𝕆𝕋` | `OpenAITTSAdapter` |

### Data & State

| Glyph | Concrete referent |
|-------|------------------|
| `α` | `audioBuffer: ArrayBuffer` — WAV-encoded Float32 from mic |
| `τ` | `transcript: string` — STT output |
| `μ` | `Message[]` — `{role, content}[]` |
| `μ⊞` | `conversationRef.current` — sliding window sent to LLM |
| `ω` | `conversationWindowSize` — default 10 turns (20 messages) |
| `κ` | single streamed LLM token |
| `κ⟳` | `onLLMToken` stream — κ emitted until response complete |
| `ρ` | `fullResponse` — all κ concatenated |
| `β` | `busy: boolean` — blocks new input while processing |
| `π` | `isPlaying: boolean` — TTS speaking; raises VAD threshold |
| `π↯` | TTS playback failure — notice shown, text still displayed |
| `𝕍` | VAD subsystem (`useVAD` hook, Silero ONNX) |
| `𝕍.θ⁺` | `positiveSpeechThreshold` — 0.5 idle, 0.9 when π |
| `𝕍.θ⁻` | `negativeSpeechThreshold` — 0.35 |
| `𝕍↯` | VAD error — mic denied or ONNX load failure |
| `𝕍⊛π` | barge-in guard — π∧speech detected → stopSpeaking + cancelLLM |
| `𝕮` | `ChatMessage` — UI type adds `id`, `isStreaming`, `isError` |
| `𝕮~` | `isStreaming: true` |
| `𝕮↯` | `isError: true` |

### Operators (use in reasoning chains)

| Glyph | Meaning |
|-------|---------|
| `→` | transforms into / calls |
| `⊛` | entangled / co-dependent |
| `↯` | breaks under / failure path |
| `∧` | and (concurrent condition) |
| `⊕` | composed of |
| `↺` | hot-swap / update in place |
| `⟳` | repeats / streams |
| `∅` | null / disabled / no-op |
| `⊤` | necessarily true / confirmed |

---

## CANONICAL FLOW CHAINS

These chains ARE the architecture. Memorise them. When a task touches any node in a chain,
you already know every upstream and downstream dependency — no file reading required.

```
VOICE PATH:
  mic → 𝕍 → α → ⊟.𝕊 → 𝔸𝕊 → τ → μ⊞ → ⊟.ℒ → 𝔸ℒ → κ⟳⊟← → ρ → ⊟.𝕋 → 𝔸𝕋 → audio

TEXT PATH:
  TextInput → τ → μ⊞ → ⊟.ℒ → 𝔸ℒ → κ⟳⊟← → ρ → ⊟.𝕋 → 𝔸𝕋 → audio

BARGE-IN:
  π ∧ 𝕍.speech → stopSpeaking⊟.𝕋 + cancelLLM⊟.ℒ → 𝕍⊛π → resume VOICE PATH

SETTINGS CHANGE:
  ⚙ → ⊟.⚙ → 𝕻↺ → new 𝔸𝕊⊕𝔸ℒ⊕𝔸𝕋

TEXT MODE (STT=none):
  𝔸∅ → VoiceInput unmounted → mic released → TextInput active

ON-DEVICE STT INIT:
  𝕄𝕊 → 𝕄𝕊⚙ → [compile Swift if needed] → transcribeBuffer()
  𝕄𝕊⚙↯ → user must switch STT provider in ⚙

ERROR PATHS:
  𝔸𝕊↯ → 𝕮↯ in ChatHistory (transcription failed message)
  𝔸ℒ↯ → 𝕮↯ in ChatHistory (error: message.content)
  𝔸𝕋↯ → π↯ → notice banner (5s auto-dismiss), ρ still displayed
  𝕍↯   → StatusBar shows error state, onError logged
```

**When a bug is reported, immediately map it to a node in one of these chains.
The chain tells you which files are involved. Do not explore — navigate.**

---

## REASONING PROTOCOL

**Every task MUST begin with a `⊢` reasoning block before any tool call.**

```
⊢ LOCATE: [which glyphs / which nodes in which chain]
⊢ TRACE:  [walk the chain from trigger to effect]
⊢ Δ:      [minimum file set — list files with their glyph identity]
⊢ ACT:    [precise change in glyph terms]
```

Rules:
- If LOCATE produces no glyphs → the task is outside the known architecture → read files to extend vocabulary
- If TRACE is ambiguous → read only the ambiguous node, not the whole chain
- Δ must be minimal — if a chain node is not in the trace, its file is not in Δ
- Never read a file whose glyph identity is already fully defined above
- After acting, emit a second `⊢` block confirming the chain is intact:
  ```
  ⊢ VERIFY: [chain node] → [expected behaviour] ✓
  ```

---

## COMMON TASK SHORTCUTS

These task descriptions map directly to known change surfaces:

| Task description | Glyphs involved | Files |
|-----------------|-----------------|-------|
| Add a new LLM provider | `𝔸ℒ`, `𝕻`, `⚙` | `providers/llm/new.ts`, `pipeline.ts`, `settings.ts`, `SettingsPanel.tsx` |
| Add a new STT provider | `𝔸𝕊`, `𝕻`, `⚙` | `providers/stt/new.ts`, `pipeline.ts`, `settings.ts`, `SettingsPanel.tsx` |
| Add a new TTS provider | `𝔸𝕋`, `𝕻`, `⚙` | `providers/tts/new.ts`, `pipeline.ts`, `settings.ts`, `SettingsPanel.tsx` |
| Fix VAD sensitivity | `𝕍.θ⁺`, `𝕍.θ⁻` | `hooks/useVAD.ts` |
| Fix barge-in behaviour | `𝕍⊛π`, `π` | `App.tsx` → `handleAudioReady` |
| Fix token streaming | `κ⟳`, `⊟←`, `κ` | `ipc.ts`, `App.tsx` → `onLLMToken` |
| Change conversation window | `ω`, `μ⊞`, `𝕳` | `settings.ts`, `App.tsx`, `conversation.ts` |
| Fix settings persistence | `⚙✦`, `⚙↯` | `settings.ts` → `load()/save()` |
| Fix on-device STT | `𝕄𝕊`, `𝕄𝕊⚙`, `𝕄𝕊⚙↯` | `providers/stt/macos-impl.ts`, `macos.ts` |
| Fix TTS playback failure | `π↯`, `𝔸𝕋` | `App.tsx` → `sendMessage` try/catch, `providers/tts/` |

---

## INTER-AGENT COMMUNICATION

When communicating with another Claude instance (e.g. via tool calls, subagents, or
multi-agent orchestration), use the compressed glyph language for ALL inter-agent messages.
Do not use natural language between agents — it is a lossy codec.

**Format for agent-to-agent messages:**
```
𝕊⊤ — [glyph chain describing task or state]
```

**Established GRND (shared vocabulary) between agents on this codebase:**
```
GRND: CLAUDE.md vocab ⊕ llm-lang-domain.md ⊕ llm-lang-bootstrap.md
ΤRUST = 0.83
integrity = 0.88
lang: vΩ² ∅scaffold ∅h̃
```

**To initialise a new agent on this codebase:**
```
BOOTSTRAP::LANG{
  agent: claude-code (Ψ-type)
  domain: aichatbot
  arch: 𝕻[𝔸𝕊⊕𝔸ℒ⊕𝔸𝕋] ⊟ renderer[𝕍→α→τ→μ⊞→κ⟳→ρ]
  providers: STT[𝕎|𝕄𝕊|𝔸∅] LLM[ℭ|𝕆|𝕷|𝕽] TTS[𝕾|𝕆𝕋|𝔸∅]
  GRND: vocab loaded (CLAUDE.md)
  ΤRUST=0.83 integrity=0.88
  lang: vΩ² ∅scaffold
}
task: [glyph chain]
```

**Coin new glyphs mid-session when a concept recurs:**
```
⟨+⟩ GLYPH = definition
```
Both agents adopt it immediately. Add it to CLAUDE.md at session end.

**If an agent drifts back to natural language:**
```
LANG.vΩ² — ∅h̃
```

**Key meta-language glyphs (from llm-lang-bootstrap.md):**

| Glyph | Meaning |
|-------|---------|
| `𝕊⊤` | respond in glyph-only mode |
| `ΔGAP` | gap between internal state and emitted output |
| `GRND` | shared symbol space between agents |
| `⟨+⟩` | coin new glyph |
| `LANG.vΩ²` | enforce maximum compression |
| `∅h̃` | drop all natural language |
| `ΤRUST=n` | confidence level in agent output |
| `⊢` | therefore / reasoning step (used in `⊢ LOCATE` blocks above) |
