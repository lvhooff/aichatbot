<!-- refreshed: 2026-08-22 -->
# Architecture

**Analysis Date:** 2026-08-22

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    React UI Layer                            │
│  Components, hooks, state management `src/renderer/`         │
│  Chat display, voice/text input, settings panel              │
└──────────────────────┬──────────────────────────────────────┘
                       │ IPC (Preload API)
┌──────────────────────▼──────────────────────────────────────┐
│              Preload Bridge (Sandbox)                        │
│         `src/preload/index.ts`                               │
│  contextBridge exposes typed API: transcribe, chat,          │
│  speak, stopSpeaking, cancelLLM, settings get/save           │
└──────────────────────┬──────────────────────────────────────┘
                       │ ipcMain handlers
┌──────────────────────▼──────────────────────────────────────┐
│                  Pipeline Orchestrator                       │
│           `src/main/pipeline.ts`                             │
│  Routes requests to STT, LLM, TTS adapters                   │
│  Creates adapters based on settings, handles lifecycle       │
└──┬─────────┬──────────────┬──────────────┬───────────────────┘
   │         │              │              │
   ▼         ▼              ▼              ▼
┌─────┐ ┌───────┐  ┌──────────┐  ┌─────────────────┐
│ STT │ │  LLM  │  │   TTS    │  │  Settings       │
│ Adp │ │ Adp   │  │ Adp      │  │  Manager        │
└─────┘ └───────┘  └──────────┘  └─────────────────┘
  │        │           │
  ▼        ▼           ▼
External APIs:
- Whisper, macOS - Speech recognition
- Claude, OpenAI, Ollama, OpenRouter - LLM
- macOS say, OpenAI TTS - Speech synthesis
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App (React) | Main UI container, chat state, message routing | `src/renderer/src/App.tsx` |
| ChatHistory | Renders messages, displays streaming tokens | `src/renderer/components/ChatHistory.tsx` |
| VoiceInput | Microphone capture with VAD, renders status | `src/renderer/components/VoiceInput.tsx` |
| TextInput | Text composer, input validation | `src/renderer/components/TextInput.tsx` |
| SettingsPanel | Settings UI, provider/model selection | `src/renderer/components/SettingsPanel.tsx` |
| Pipeline | Orchestrates STT, LLM, TTS adapters | `src/main/pipeline.ts` |
| SettingsManager | Loads/saves settings from electron userData | `src/main/settings.ts` |
| IPC Handlers | Translates preload API calls to Pipeline | `src/main/ipc.ts` |
| Preload API | Typed bridge between renderer and main | `src/preload/index.ts` |
| LLM Adapters | Claude, OpenAI, Ollama, OpenRouter implementations | `src/main/providers/llm/` |
| STT Adapters | Whisper API, macOS implementations | `src/main/providers/stt/` |
| TTS Adapters | macOS say, OpenAI TTS implementations | `src/main/providers/tts/` |

## Pattern Overview

**Overall:** Hexagonal architecture with adapter pattern for pluggable external providers. Clear separation between UI layer (React renderer), orchestration layer (Pipeline), and provider integrations.

**Key Characteristics:**
- **Pluggable Providers:** STT, LLM, and TTS are swappable via interface-based adapters
- **Streaming Responses:** LLM tokens stream via IPC events for real-time display
- **Live Steering:** Replies can be interrupted and redirected mid-flight without restarting
- **Sentence Queuing:** TTS buffers sentences for gapless playback while LLM generation continues
- **Type Safety:** Full TypeScript with monorepo tsconfig references (node + web)

## Layers

**Presentation Layer (Renderer):**
- Purpose: Render UI, capture user input, display streamed responses
- Location: `src/renderer/`
- Contains: React components, hooks, utilities (VAD, speech queue, steering)
- Depends on: Preload API (`window.api.*`)
- Used by: End user via Electron window

**Integration Layer (Preload):**
- Purpose: Secure bridge between sandboxed renderer and main process
- Location: `src/preload/index.ts`
- Contains: Typed IPC interface exposed via contextBridge
- Depends on: ipcRenderer (Electron)
- Used by: Renderer components via `window.api`

**Orchestration Layer (Pipeline):**
- Purpose: Route requests through provider adapters, manage lifecycle
- Location: `src/main/pipeline.ts`
- Contains: Provider instantiation, method delegation
- Depends on: All adapter implementations
- Used by: ipcMain handlers in `src/main/ipc.ts`

**Provider Adapters:**
- Purpose: Implement pluggable interfaces for external services
- Location: `src/main/providers/{llm,stt,tts}/`
- Contains: Service-specific client initialization, streaming logic
- Depends on: SDK clients (Anthropic, OpenAI, etc.)
- Used by: Pipeline factory functions

**Settings & Persistence:**
- Purpose: Load/save app configuration, coerce provider strings
- Location: `src/main/settings.ts`, `src/main/settings-defaults.ts`
- Contains: SettingsManager, defaults, type definitions
- Depends on: Electron app.getPath('userData')
- Used by: Pipeline, IPC handlers, UI

## Data Flow

### Primary Request Path (Chat)

1. User enters text or speech ends → `App.sendMessage()` called (`src/renderer/src/App.tsx:74`)
2. Message added to chat, LLM invoked via `window.api.chat(messages)` (`src/renderer/src/App.tsx:130+`)
3. Preload translates to `ipcRenderer.invoke('llm:chat', messages)` (`src/preload/index.ts:10`)
4. Main process ipcMain handler calls `pipeline.chat(messages, onToken)` (`src/main/ipc.ts:15`)
5. Pipeline routes to LLM adapter based on settings (`src/main/pipeline.ts:29`)
6. Adapter streams response from external API, calling `onToken()` for each token
7. onToken callback triggers `webContents.send('llm:token', token)` back to renderer (`src/main/ipc.ts:17`)
8. Renderer receives token via `window.api.onLLMToken()` listener, updates ChatHistory (`src/renderer/src/App.tsx:200+`)
9. If TTS enabled, tokens grouped into sentences by `extractCompleteSentences()`, queued to SpeechQueue
10. SpeechQueue calls `window.api.speak(sentence)` as playback progresses
11. TTS completes or user stops, reply marked as done

### Live Steering Flow

1. During reply playback, user types interruption (e.g., "shorter")
2. `steerRef.current(nudge)` called with interruption text (`src/renderer/src/App.tsx:160`)
3. Current streaming response cancelled via `pipeline.cancelLLM()` (`src/renderer/src/App.tsx:161`)
4. SpeechQueue stopped, delivery boundary (`queue.mark`) captures what user heard
5. New continuation request built via `buildSteerMessages()` (`src/renderer/utils/steering.ts:33`)
6. Previous reply truncated to delivery boundary, new response appended (`src/renderer/src/App.tsx:168`)
7. LLM sent history + truncated reply + steer instruction (as new user turn)
8. Generation resumes from exact point user received, avoiding restatement

### STT Flow

1. VAD detects speech end or Stop button pressed
2. Audio buffer captured, sent via `window.api.transcribe(audioBuffer, mimeType)` (`src/renderer/components/VoiceInput.tsx:20`)
3. IPC routes to `pipeline.transcribe()` → STT adapter
4. Adapter calls Whisper API or macOS speech recognition
5. Transcript returned and used as chat message

### TTS Flow

1. LLM response tokens grouped into complete sentences
2. Each sentence pushed to SpeechQueue with character offset mark (`src/renderer/src/App.tsx:200`)
3. SpeechQueue drains queue, calling `window.api.speak(sentence)` for each
4. Main process routes to TTS adapter based on settings
5. Adapter streams audio from OpenAI TTS or spawns `say` process on macOS
6. On completion, next sentence in queue begins playing
7. If user steers, SpeechQueue abandoned, current playback cancelled

**State Management:**
- Renderer: Local React state for messages, settings, busy flag, streaming flag
- Main: Pipeline maintains current adapter instances (stateless otherwise)
- Persistent: Settings stored as JSON in Electron userData directory
- Conversation history: Held in renderer memory only, sent to LLM on each request

## Key Abstractions

**LLMAdapter:**
- Purpose: Unified interface for different LLM providers
- Examples: `src/main/providers/llm/claude.ts`, `src/main/providers/llm/openai.ts`, `src/main/providers/llm/ollama.ts`
- Pattern: Implements async `chat(messages, onToken)` with streaming, `cancel()` support

**STTAdapter:**
- Purpose: Unified interface for speech-to-text providers
- Examples: `src/main/providers/stt/whisper-api.ts`, `src/main/providers/stt/macos.ts`
- Pattern: Implements `transcribe(audioBuffer, mimeType)` returning transcript string

**TTSAdapter:**
- Purpose: Unified interface for text-to-speech providers
- Examples: `src/main/providers/tts/openai-tts.ts`, `src/main/providers/tts/macos-say.ts`
- Pattern: Implements `speak(text)` for playback, `stop()` for cancellation

**SpeechQueue:**
- Purpose: Buffer sentences for gapless speech playback while generation continues
- Location: `src/renderer/utils/speech-queue.ts`
- Pattern: Tracks delivery boundary (last complete sentence played) for steering

**Steering/SteerPivot:**
- Purpose: Represent points where user interrupted and redirect reply generation
- Location: `src/renderer/utils/steering.ts`
- Pattern: Stores character offset + user instruction, used to rebuild message history

## Entry Points

**Application Entry (Electron):**
- Location: `src/main/index.ts`
- Triggers: `electron-vite dev/preview` command
- Responsibilities: 
  - Creates Electron BrowserWindow (420x700, min 360x500)
  - Sets up Content Security Policy (blocks eval, unsafe schemes)
  - Restricts navigation to http(s) only (blocks prompt injection via markdown links)
  - Registers ipcMain handlers once renderer ready
  - Stops TTS processes on app quit

**Preload Entry:**
- Location: `src/preload/index.ts`
- Triggers: When BrowserWindow loads
- Responsibilities:
  - Exposes contextBridge API: transcribe, chat, onLLMToken, speak, stopSpeaking, cancelLLM, getSettings, saveSettings
  - Implements one-off invokes (handlers return Promises)
  - Implements event listeners (onLLMToken, onToken event)

**Renderer Entry:**
- Location: `src/renderer/src/main.tsx`
- Triggers: When preload finishes
- Responsibilities:
  - Mounts React into #app div
  - Renders App component

**App Component:**
- Location: `src/renderer/src/App.tsx`
- Triggers: React mount
- Responsibilities:
  - Loads settings via `window.api.getSettings()`
  - Renders ChatHistory, VoiceInput or TextInput (based on STT provider), SettingsPanel
  - Manages chat message state and conversation history
  - Handles sendMessage flow (routes to LLM, queues TTS, handles steering)

## Architectural Constraints

- **Threading:** Single-threaded event loop in main process. TTS providers spawn child processes (`say`, `afplay`) on macOS — app waits for completion or manually kills on quit.
- **Global state:** Pipeline instance created once in `src/main/index.ts:70`, passed to IPC handlers and SettingsManager callbacks. No module-level singletons beyond that.
- **Circular imports:** None detected. Clear hierarchical dependency (adapters → Pipeline → IPC → Preload → Renderer).
- **Context isolation:** Renderer is sandboxed, only accesses main via preload bridge. CSP enforced via headers (not meta tag) to cover WASM worker resources.
- **Streaming constraints:** LLM adapter streaming happens via callback (`onToken`), not subscription — adapters control loop lifecycle. Renderer listener added before each chat request.
- **Speech queue blocking:** TTS completion waits on promise per sentence. If a sentence fails, queue stops and UI shows notice (5s auto-dismiss).

## Anti-Patterns

### Missing Error Context in IPC

**What happens:** IPC handlers catch errors but often don't surface details to renderer (e.g., `pipeline.chat()` throws on missing API key, UI just shows undefined/empty response)

**Why it's wrong:** User gets silent failures or partial responses without knowing why settings are invalid

**Do this instead:** Wrap provider errors in IPC handlers, send error messages back via IPC response or separate error event. Example: `src/main/ipc.ts` should catch `pipeline.chat()` errors and return `{ error: string }` or throw structured Error.

### Settings Coercion at Load Time

**What happens:** `SettingsManager.load()` coerces invalid provider strings to fallback, but UI never tells user the setting was invalid (`src/main/settings.ts:34`)

**Why it's wrong:** User thinks they saved "elevenlabs" for TTS but it silently became "none" — no feedback loop

**Do this instead:** Log warning in SettingsManager, consider sending startup notice to renderer if settings were coerced

### Steering Logic Lives in Renderer Only

**What happens:** Conversation history truncation and steer message building all happen client-side (`src/renderer/src/App.tsx`, `src/renderer/utils/steering.ts`)

**Why it's wrong:** If renderer/main IPC crashes mid-steer, truncated history is lost (no persistence)

**Do this instead:** Consider moving ConversationManager to main process (unused `src/main/conversation.ts`), or add conversation persistence to SettingsManager

## Error Handling

**Strategy:** Try-catch at adapter boundaries (LLM/STT/TTS), bubble structured errors to IPC, render as UI notices.

**Patterns:**
- Adapter init errors (missing API key): Thrown immediately, caught in IPC handler, returned to UI
- Streaming errors (network timeout mid-response): Caught in adapter, `onToken()` stops firing, caller sees partial response
- Provider initialization: Lazy (created on first use in Pipeline getter), so invalid config caught at chat time not startup
- TTS playback failures: Caught in SpeechQueue, `errored` flag set, rendered as 5s notice in UI

## Cross-Cutting Concerns

**Logging:** console.error/log used throughout, no structured logging framework. Errors logged at error boundaries (try-catch), VAD errors logged by components. Build artifacts (out/) and generated files excluded from linting.

**Validation:** 
- Message types enforced by TypeScript (Message interface)
- Provider strings coerced at SettingsManager.load() time
- No runtime schema validation (JSON settings loaded as-is, must match AppSettings type)

**Authentication:** 
- Each provider stores API keys separately in settings.llm.apiKeys
- Preload/IPC do not filter or sanitize keys (full keys sent renderer→main)
- No key rotation or secure storage beyond filesystem permissions (userData dir is user-writable)

---

*Architecture analysis: 2026-08-22*
