# Codebase Structure

**Analysis Date:** 2026-08-22

## Directory Layout

```
aichatbot/
├── .claude/                    # Claude Code configuration and skills
│   └── skills/
│       └── driving-app-over-cdp/  # Skill for testing app via CDP
├── .planning/                  # GSD planning directory (created by gsd tools)
│   └── codebase/              # Analysis documents (ARCHITECTURE.md, STRUCTURE.md)
├── .vscode/                    # VS Code workspace settings
├── docs/                       # Documentation
│   └── superpowers/           # GSD superpowers docs
│       └── plans/             # Saved plans
├── resources/                  # App resources (icons, etc.)
├── src/
│   ├── main/                  # Main process (Node.js backend)
│   │   ├── providers/         # Pluggable provider adapters
│   │   │   ├── llm/          # LLM providers (Claude, OpenAI, Ollama, OpenRouter)
│   │   │   ├── stt/          # Speech-to-text providers (Whisper, macOS)
│   │   │   └── tts/          # Text-to-speech providers (OpenAI TTS, macOS say)
│   │   ├── index.ts          # Electron app entry, window creation, CSP
│   │   ├── ipc.ts            # IPC handler registration
│   │   ├── pipeline.ts       # Orchestrates STT, LLM, TTS adapters
│   │   ├── conversation.ts   # Conversation history manager (unused)
│   │   ├── settings.ts       # Settings persistence (load/save)
│   │   └── settings-defaults.ts  # Default settings and provider enums
│   ├── preload/               # Preload script (sandbox bridge)
│   │   ├── index.ts          # contextBridge API exposed to renderer
│   │   └── index.d.ts        # TypeScript types for renderer-side `window.api`
│   └── renderer/              # Renderer process (React UI)
│       ├── src/
│       │   ├── App.tsx        # Main React app, chat logic, steering
│       │   ├── main.tsx       # React mount point
│       │   └── env.d.ts       # Vite env types
│       ├── components/        # React UI components
│       │   ├── ChatHistory.tsx    # Displays messages, streaming tokens
│       │   ├── VoiceInput.tsx     # Microphone + VAD status
│       │   ├── TextInput.tsx      # Text composer
│       │   ├── SettingsPanel.tsx  # Settings UI
│       │   ├── StatusBar.tsx      # VAD/recording status
│       │   └── StopButton.tsx     # Stop current operation
│       ├── hooks/             # React hooks
│       │   └── useVAD.ts      # Voice Activity Detection hook (onnxruntime-web)
│       ├── utils/             # Utility functions
│       │   ├── steering.ts    # Live steering logic (mid-flight redirection)
│       │   ├── speech-queue.ts    # Sentence queue for gapless TTS
│       │   ├── sentences.ts   # Split text into sentences
│       │   └── wav.ts         # WAV audio encoding
│       ├── public/            # Static assets and WASM
│       │   └── ort-wasm-*.mjs, *.wasm  # ONNX Runtime VAD files
│       ├── index.html         # Renderer entry HTML
│       └── types.ts           # Shared renderer types (ChatMessage, etc.)
├── tests/                      # Test files (mirror src/ structure)
│   ├── setup.ts               # Vitest setup (jsdom environment)
│   ├── main/
│   │   ├── conversation.test.ts
│   │   ├── settings.test.ts
│   │   └── providers/
│   │       ├── llm/           # LLM provider tests (Claude, OpenAI, etc.)
│   │       └── stt/           # STT provider tests (Whisper API, macOS)
│   └── renderer/              # React component tests
│       ├── ChatHistory.test.tsx
│       ├── VoiceInput.test.tsx (not present, only .test files exist)
│       ├── SettingsPanel.test.tsx
│       ├── sentences.test.ts
│       ├── speech-queue.test.ts
│       ├── steering.test.ts
│       ├── TextInput.test.tsx
│       ├── StatusBar.test.tsx
│       └── wav.test.ts
├── out/                        # Build output (generated)
│   ├── main/                  # Compiled main process
│   ├── preload/               # Compiled preload script
│   └── renderer/              # Compiled React app
├── node_modules/              # Dependencies (generated)
├── .git/                       # Git repository
├── .gitignore                  # Git ignore rules
├── .prettierrc.yaml            # Prettier formatter config
├── CLAUDE.md                   # Project instructions for Claude Code
├── README.md                   # Project README
├── package.json                # npm dependencies and scripts
├── package-lock.json           # Locked dependency versions
├── tsconfig.json               # Root TypeScript config (references node + web)
├── tsconfig.node.json          # TypeScript config for main/preload (Node.js)
├── tsconfig.web.json           # TypeScript config for renderer (React/Browser)
├── electron.vite.config.ts     # Build config (electron-vite, Vite, React plugin)
├── vitest.config.ts            # Test runner config (jsdom, globals, setup)
├── eslint.config.mjs           # Linter config (TypeScript, React, Prettier)
└── electron-builder.yml        # Electron app packaging config
```

## Directory Purposes

**`src/main/`:**
- Purpose: Node.js backend for Electron app
- Contains: App entry, IPC handlers, provider orchestration
- Key files: `index.ts` (app setup), `pipeline.ts` (provider routing), `settings.ts` (persistence)

**`src/main/providers/`:**
- Purpose: Pluggable adapters for external services
- Contains: LLM, STT, TTS implementations
- Pattern: Each provider implements typed interface (LLMAdapter, STTAdapter, TTSAdapter)

**`src/renderer/`:**
- Purpose: React UI and client-side logic
- Contains: Components, hooks, utilities for voice/text chat
- Key files: `App.tsx` (main component), `components/` (UI), `utils/` (steering, TTS queue)

**`src/renderer/components/`:**
- Purpose: React UI components
- Contains: ChatHistory, VoiceInput, TextInput, SettingsPanel, StatusBar, StopButton
- Pattern: Props-driven, use preload API via `window.api`

**`src/renderer/utils/`:**
- Purpose: Shared utilities for chat logic and audio handling
- Contains: Steering (mid-flight redirection), SpeechQueue (TTS buffering), sentence splitting, WAV encoding
- Pattern: Pure functions and simple classes (SpeechQueue)

**`tests/`:**
- Purpose: Test files for main and renderer code
- Contains: Unit tests for providers, utilities, components
- Pattern: `*.test.ts` or `*.test.tsx`, mirror structure of `src/`

**`out/`:**
- Purpose: Build output (do not commit)
- Contains: Compiled main, preload, renderer
- Generated by: `npm run build`

**`.claude/skills/`:**
- Purpose: Custom skills for Claude Code automation
- Contains: `driving-app-over-cdp/` for CDP-based app testing

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents
- Contains: ARCHITECTURE.md, STRUCTURE.md (this file)
- Generated by: `/gsd-map-codebase arch`

## Key File Locations

**Entry Points:**
- Main: `src/main/index.ts` — Electron window creation, CSP, IPC registration
- Preload: `src/preload/index.ts` — contextBridge API definition
- Renderer: `src/renderer/src/main.tsx` — React mount, `src/renderer/src/App.tsx` — App component

**Configuration:**
- TypeScript: `tsconfig.json` (references), `tsconfig.node.json` (main), `tsconfig.web.json` (renderer)
- Build: `electron.vite.config.ts` (Vite + Electron), `vitest.config.ts` (tests)
- Linting: `eslint.config.mjs` (ESLint), `.prettierrc.yaml` (Prettier)
- App: `package.json` (npm scripts), `electron-builder.yml` (packaging)
- Project: `CLAUDE.md` (Claude Code instructions), `.gitignore`

**Core Logic:**
- Chat orchestration: `src/main/pipeline.ts` (routes STT/LLM/TTS)
- Chat UI: `src/renderer/src/App.tsx` (state, message flow, steering)
- Live steering: `src/renderer/utils/steering.ts` (mid-flight redirection)
- Speech queue: `src/renderer/utils/speech-queue.ts` (gapless TTS)
- Settings: `src/main/settings.ts` (load/save), `src/main/settings-defaults.ts` (defaults)

**Provider Adapters:**
- LLM: `src/main/providers/llm/{claude,openai,ollama,openrouter}.ts`
- STT: `src/main/providers/stt/{whisper-api,macos,none}.ts`
- TTS: `src/main/providers/tts/{openai-tts,macos-say,none}.ts`

**Testing:**
- Setup: `tests/setup.ts` (Vitest config)
- Providers: `tests/main/providers/{llm,stt}/` (mock API tests)
- Utils: `tests/renderer/{steering,speech-queue,sentences,wav}.test.ts`
- Components: `tests/renderer/{ChatHistory,TextInput,SettingsPanel,StatusBar}.test.tsx`

## Naming Conventions

**Files:**
- Source: `camelCase.ts` or `camelCase.tsx` (e.g., `App.tsx`, `useChatHistory.ts`)
- Tests: `*.test.ts` or `*.test.tsx` (co-located in `tests/` mirror)
- Config: `kebab-case.{json,yml,mjs,yaml}` (e.g., `tsconfig.node.json`, `electron-builder.yml`)
- Adapters: Named after service + suffix, e.g., `ClaudeAdapter`, `WhisperAPIAdapter`, `MacOSSayAdapter`

**Directories:**
- Features: `camelCase/` with logical grouping (e.g., `providers/llm`, `components`, `utils`)
- Abstractions: Plural form for adapter groups (e.g., `providers`, `components`, `hooks`)
- Build/config: Lowercase with dashes where needed (e.g., `node_modules`, `.vscode`, `.planning`)

**Functions/Variables:**
- camelCase for functions, variables, React hooks (e.g., `extractCompleteSentences`, `useVAD`, `sendMessage`)
- PascalCase for classes and React components (e.g., `Pipeline`, `ClaudeAdapter`, `ChatHistory`)
- UPPER_SNAKE_CASE for constants (e.g., `LEAD_IN_CHARS`, `DEFAULT_SETTINGS`)
- Private members prefixed with `_` (e.g., `_client`, `_settings`)

**Types/Interfaces:**
- PascalCase with `Interface` suffix optional (e.g., `Message`, `LLMAdapter`, `ChatMessage`)
- Settings types: `{Name}Settings` (e.g., `LLMSettings`, `STTSettings`, `AppSettings`)

## Where to Add New Code

**New LLM Provider:**
- Implementation: `src/main/providers/llm/mynew-llm.ts` (implement `LLMAdapter` interface)
- Export: Add to Pipeline factory in `src/main/pipeline.ts:29-48`
- Settings: Add provider name to `LLMSettings` in `src/main/settings-defaults.ts`
- Tests: `tests/main/providers/llm/mynew-llm.test.ts`
- UI: New option in `SettingsPanel` component (`src/renderer/components/SettingsPanel.tsx`)

**New STT/TTS Provider:**
- Implementation: `src/main/providers/{stt,tts}/mynew-provider.ts` (implement `STTAdapter` or `TTSAdapter`)
- Factory: Add to Pipeline in `src/main/pipeline.ts`
- Settings: Update `STTSettings` or `TTSSettings` and provider enums in `src/main/settings-defaults.ts`
- Tests: Mirror structure in `tests/main/providers/{stt,tts}/`

**New Renderer Component:**
- React component: `src/renderer/components/MyComponent.tsx`
- Types: Add to `src/renderer/types.ts` if sharing across components
- Test: `tests/renderer/MyComponent.test.tsx`
- Integration: Import and render in `App.tsx` or appropriate parent

**New Utility (renderer-side):**
- Implementation: `src/renderer/utils/my-utility.ts`
- Tests: `tests/renderer/my-utility.test.ts`
- Export: Via index or direct import

**New Utility (main-side):**
- Implementation: `src/main/my-utility.ts` (if general purpose) or `src/main/providers/*/` (if provider-specific)
- Tests: `tests/main/my-utility.test.ts`
- Usage: Import by Pipeline or IPC handlers

**Database/Persistence:**
- Currently: Settings only, stored as JSON in Electron userData via SettingsManager
- Conversation history: In-memory only (lost on app close)
- Add here: `src/main/` with new manager class, expose via IPC handlers, persist to userData

**New IPC Route:**
- Handler: Add case to `registerIpcHandlers()` in `src/main/ipc.ts`
- Preload: Add method to contextBridge in `src/preload/index.ts`
- Preload types: Add to `src/preload/index.d.ts`
- Renderer: Call via `window.api.myNewMethod()`

## Special Directories

**`out/`:**
- Purpose: Compiled build artifacts
- Generated: By `npm run build` (electron-vite)
- Committed: No (in `.gitignore`)
- Structure: Mirrors `src/` (out/main, out/preload, out/renderer)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: By `npm install`
- Committed: No (in `.gitignore`)

**`src/renderer/public/`:**
- Purpose: Static assets and third-party WASM
- Contains: ONNX Runtime VAD worker files (ort-wasm-*.mjs, *.wasm), *.onnx model files
- Linting: Excluded (third-party, minified)
- Serving: Handled by Vite dev server and bundled in production

**`.planning/codebase/`:**
- Purpose: GSD analysis documents
- Generated: By `/gsd-map-codebase` command
- Committed: Yes (for codebase reference)
- Documents: ARCHITECTURE.md, STRUCTURE.md (this file), CONVENTIONS.md, TESTING.md, CONCERNS.md (optional)

---

*Structure analysis: 2026-08-22*
