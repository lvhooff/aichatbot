# AI Voice Chatbot 🤖🎤

A desktop application that brings conversational AI to your fingertips with seamless voice and text interaction. Built with Electron, React, and TypeScript, this chatbot supports multiple AI providers and can work entirely offline with local models.

## Features

✨ **Multi-AI Support**
- Claude (Anthropic)
- OpenAI (GPT)
- Ollama (local & cloud)
- OpenRouter
- Extensible provider architecture

🎙️ **Voice Capabilities**
- Real-time speech-to-text transcription
- Multiple STT providers (Whisper API, macOS Speech, none)
- Voice activity detection (VAD) with configurable sensitivity (High / Normal / Low)
- Text-to-speech playback with manual stop control
- Multiple TTS providers (OS native, OpenAI TTS, none)
- Mic automatically pauses during TTS playback to prevent feedback

💬 **Chat Features**
- Persistent conversation history with sliding window
- Streaming token responses with animated typing indicator while waiting
- Markdown rendering with GitHub-flavored extensions
- Text and voice input modes
- Per-provider API key storage (each LLM provider remembers its own key)
- Settings persistence

🎯 **Desktop-First Design**
- Native Electron app (Windows, macOS, Linux)
- Fast startup and responsive UI
- Works offline with local LLMs and STT/TTS

## Quick Start

### Prerequisites
- Node.js 16+ and npm/yarn
- For macOS STT (optional): Swift 6.2+ and macOS 14+ SDK
- API keys (if using cloud providers)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd aichatbot

# Install dependencies
npm install
```

### Running in Development

```bash
npm run dev
```

The app will start in development mode with hot reload enabled.

### Building for Distribution

```bash
# Build for your current platform
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux

# Build without installer (for testing)
npm run build:unpack
```

## Configuration

### API Keys

The app stores settings in your Electron user data directory (platform-dependent):
- **macOS**: `~/Library/Application Support/aichatbot/settings.json`
- **Linux**: `~/.config/aichatbot/settings.json`
- **Windows**: `%APPDATA%\aichatbot\settings.json`

On first run, you can configure providers via the Settings panel (⚙️ gear icon).

### Provider Setup

#### LLM API Keys
Each LLM provider stores its API key independently. You can configure keys for multiple providers and switch between them freely — the correct key is restored automatically when you select a provider.

#### Claude (Anthropic)
1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Select Claude as LLM provider
3. Enter your API key in Settings

#### OpenAI
1. Get an API key from [platform.openai.com](https://platform.openai.com/account/api-keys)
2. Select OpenAI as LLM provider
3. Configure in Settings

#### Ollama Local
1. Install [Ollama](https://ollama.ai)
2. Run `ollama serve` to start the server (listens on http://localhost:11434 by default)
3. Select Ollama as LLM provider
4. Leave API key empty (local Ollama requires no authentication)

#### Ollama Cloud
1. Sign up at [ollama.com](https://ollama.com)
2. Generate an API key from your account settings
3. Select Ollama as LLM provider
4. Enable "Cloud" toggle in settings
5. Enter your Ollama Cloud API key
6. Alternatively, set `OLLAMA_API_KEY` environment variable

#### Whisper API (Speech-to-Text)
1. Get an OpenAI API key
2. Select Whisper API as STT provider
3. Enter your API key

#### macOS Speech (Speech-to-Text)
- Built-in macOS Speech framework (on-device, no API key needed)
- First run compiles a native Swift binary automatically
- Requires Swift 6.2+ and macOS 14+ SDK if you modify it

#### macOS Say (Text-to-Speech)
- Built-in macOS `say` command
- No API key needed, fully local

#### OpenAI TTS
1. Get an OpenAI API key
2. Select OpenAI TTS as provider

### Mic Sensitivity
- Controls how aggressively the VAD detects speech
- **High**: Picks up quiet or distant speech — good for quiet rooms
- **Normal**: Balanced default
- **Low**: Close mic only — filters out background voices, TV, etc.
- Configurable in Settings under Speech-to-Text

### Conversation Window Size
- Controls how many messages are sent to the LLM
- Default: 10 turns (20 messages including assistant responses)
- Adjust to balance context vs. token cost

## Testing

### Run Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm test:watch
```

### Type Checking
```bash
npm run typecheck
```

Run full type checking across both main and renderer processes:

### Code Quality
```bash
npm run lint       # Check ESLint violations
npm run format     # Auto-format with Prettier
```

## Project Structure

```
src/
├── main/                 # Electron main process
│   ├── index.ts         # App initialization, window creation
│   ├── pipeline.ts      # Provider orchestrator (handles STT→LLM→TTS flow)
│   ├── ipc.ts          # IPC handlers for renderer communication
│   ├── settings.ts     # Settings manager with persistence
│   ├── conversation.ts # Conversation history with sliding window
│   └── providers/      # Pluggable provider adapters
│       ├── stt/        # Speech-to-text adapters
│       ├── llm/        # LLM adapters
│       └── tts/        # Text-to-speech adapters
│
├── renderer/            # Electron renderer process (browser)
│   ├── src/
│   │   └── App.tsx     # Root component, conversation state, sendMessage logic
│   ├── components/      # Reusable UI components
│   │   ├── ChatHistory.tsx
│   │   ├── VoiceInput.tsx  # Microphone & VAD UI
│   │   ├── TextInput.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── StatusBar.tsx
│   ├── hooks/
│   │   └── useVAD.ts   # Voice Activity Detection (Silero ONNX)
│   ├── utils/
│   │   └── wav.ts      # Float32 to WAV encoding
│   ├── public/         # ONNX model + WASM assets for VAD
│   └── index.html
│
└── preload/            # Secure context bridge
    └── index.ts        # IPC API surface for renderer
```

## Architecture Overview

### Data Flow

```
VOICE PATH:
  Microphone → VAD Detection → Audio Buffer (WAV) 
    → [IPC to main] → STT Adapter → Transcript 
    → Conversation History → LLM Adapter 
    → Token Stream [IPC to renderer] 
    → TTS Adapter → Audio Playback

TEXT PATH:
  Text Input → Conversation History → LLM Adapter 
    → Token Stream [IPC to renderer] 
    → TTS Adapter → Audio Playback

SETTINGS CHANGE:
  User selects providers → [IPC to main] 
    → Hot-swap all adapters in Pipeline
```

### Key Components

- **Pipeline** (`src/main/pipeline.ts`): Orchestrates the STT→LLM→TTS flow
- **App.tsx** (`src/renderer/src/App.tsx`): Central state management for the UI
- **Conversation Manager** (`src/main/conversation.ts`): Maintains message history with sliding window
- **Provider Adapters**: Pluggable interfaces for STT, LLM, and TTS
- **useVAD Hook** (`src/renderer/hooks/useVAD.ts`): Voice activity detection using Silero ONNX

### Provider Interface

All providers implement a simple interface for easy extension:

```typescript
// LLM Provider
interface LLMAdapter {
  chat(messages: Message[], onToken: (token: string) => void): Promise<string>
  cancel(): Promise<void>
}

// STT Provider
interface STTAdapter {
  transcribe(buffer: ArrayBuffer, mimeType?: string): Promise<string>
}

// TTS Provider
interface TTSAdapter {
  speak(text: string): Promise<void>
  stop(): Promise<void>
}
```

## Common Tasks

### Add a New LLM Provider

1. Create `src/main/providers/llm/myprovider.ts` implementing `LLMAdapter`
2. Update `src/main/pipeline.ts` to instantiate your provider
3. Add configuration to `src/main/settings.ts`
4. Add UI controls to `src/renderer/components/SettingsPanel.tsx`

### Add a New STT Provider

1. Create `src/main/providers/stt/myprovider.ts` implementing `STTAdapter`
2. Update `src/main/pipeline.ts` to instantiate your provider
3. Add configuration to `src/main/settings.ts`
4. Add UI controls to `src/renderer/components/SettingsPanel.tsx`

### Adjust Voice Activity Detection Sensitivity

Use the **Mic Sensitivity** dropdown in Settings (under Speech-to-Text):
- **High** — `positiveSpeechThreshold: 0.5`, `minSpeechMs: 240` — most sensitive
- **Normal** — `positiveSpeechThreshold: 0.65`, `minSpeechMs: 400` — default
- **Low** — `positiveSpeechThreshold: 0.8`, `minSpeechMs: 600` — ignores background voices

To add custom thresholds, edit `VAD_SENSITIVITY_PRESETS` in `src/main/settings-defaults.ts`.

### Debug Microphone Issues

Check `StatusBar.tsx` for VAD status. Common issues:
- Microphone permission denied: Grant access in System Preferences
- ONNX model not loading: Check browser console
- VAD crashing: Try switching to text-only mode

### Extend Conversation Window

Increase `conversationWindowSize` in Settings (default: 10 turns = 20 messages).
Higher values use more tokens but maintain more context.

## Troubleshooting

### "Transcription failed" error
- Verify Whisper API key is valid (if using Whisper)
- Check network connectivity
- Try switching to a different STT provider

### TTS audio not playing
- A notice will appear briefly — click it to dismiss
- A **■ Stop** button appears in the status bar while TTS is active; click it to stop playback early
- Check system volume
- Verify TTS provider is configured correctly
- Text will still be displayed even if playback fails

### Voice Activity Detection not working
- Check microphone permissions
- Verify microphone is working
- Check browser console for ONNX/WASM errors
- Try switching to text mode

### Settings not saving
- Check file permissions in userData directory
- Restart the app
- Try resetting to defaults

### macOS Swift compilation error
- Ensure Swift 6.2+ is installed: `swift --version`
- Install macOS SDK if building Apple Silicon: `xcode-select --install`
- Try switching to a different STT provider

## Environment Variables

### Development
- `ELECTRON_RENDERER_URL`: Vite dev server URL (auto-set by electron-vite)
- `VITE_BASE`: Public path (set in electron.vite.config.ts)

### Production
- Settings stored in Electron `userData` directory (see Configuration section)

## Dependencies

### Key Libraries
- **Electron**: Desktop application framework
- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool
- **@ricky0123/vad-react**: Voice activity detection
- **@anthropic-ai/sdk**, **openai**, **ollama**: AI provider SDKs
- **react-markdown**, **remark-gfm**: Markdown rendering

## Scripts

```bash
npm run dev              # Start dev server with hot reload
npm run build            # Build production bundle
npm start                # Run production build
npm run typecheck        # Check TypeScript types
npm run lint             # Run ESLint
npm run format           # Auto-format code
npm test                 # Run test suite
npm test:watch          # Watch mode for tests
npm run build:mac        # Build macOS .app
npm run build:win        # Build Windows .exe
npm run build:linux      # Build Linux AppImage
```

## Contributing

When making changes:
1. Ensure tests pass: `npm test`
2. Check types: `npm run typecheck`
3. Lint code: `npm run lint`
4. Format before committing: `npm run format`

## License

See LICENSE file for details.

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Anthropic Claude API](https://docs.anthropic.com)
- [OpenAI API](https://platform.openai.com/docs)
- [Ollama](https://ollama.ai)
- [Silero VAD](https://github.com/snakers4/silero-vad)
