# External Integrations

**Analysis Date:** 2026-08-22

## APIs & External Services

**LLM Providers:**
- Claude (Anthropic) - Default LLM provider
  - SDK/Client: @anthropic-ai/sdk 0.96.0
  - Auth: API key via settings (no env fallback)
  - Implementation: `src/main/providers/llm/claude.ts`
  - Model: claude-sonnet-4-6 (configurable)
  - Features: Streaming via SDK's `.messages.stream()`, abort support

- OpenAI (GPT) - Alternative LLM provider
  - SDK/Client: openai 6.38.0
  - Auth: API key via settings (no env fallback)
  - Implementation: `src/main/providers/llm/openai.ts`
  - Features: Streaming completions, abort support

- Ollama (Local & Cloud) - Local or self-hosted LLM
  - SDK/Client: ollama 0.6.3
  - Auth: Local Ollama requires no key; Cloud Ollama uses API key
  - Implementation: `src/main/providers/llm/ollama.ts`
  - Endpoints:
    - Local: http://localhost:11434 (default)
    - Cloud: https://ollama.com
  - Models: llama3.2, llama3.1, qwen2.5, gemma3, mistral (configurable)
  - Features: Streaming chat, abort support, env var fallback `OLLAMA_API_KEY`

- OpenRouter - API routing layer (compatible with OpenAI protocol)
  - SDK/Client: openai 6.38.0 (via baseURL override)
  - Auth: API key via settings or env var `OPENROUTER_API_KEY`
  - Implementation: `src/main/providers/llm/openrouter.ts`
  - Endpoint: https://openrouter.ai/api/v1
  - Features: Extends OpenAIAdapter for streaming chat

**Speech-to-Text:**
- OpenAI Whisper API
  - SDK/Client: openai 6.38.0
  - Auth: API key via settings
  - Implementation: `src/main/providers/stt/whisper-api.ts`
  - Model: whisper-1 (hardcoded)
  - Features: File upload with audio.transcriptions.create()
  - Supported formats: WAV, MP3, FLAC, OGG (via MIME type detection)

- macOS Native Speech Recognition
  - SDK/Client: System framework (not npm-based)
  - Auth: None (local)
  - Implementation: `src/main/providers/stt/macos.ts`
  - Features: OS-level audio transcription

**Text-to-Speech:**
- OpenAI TTS API
  - SDK/Client: openai 6.38.0
  - Auth: API key via settings
  - Implementation: `src/main/providers/tts/openai-tts.ts`
  - Model: tts-1 (hardcoded)
  - Voice: Configurable (default: alloy)
  - Output format: MP3 (hardcoded)
  - Playback: macOS afplay command

- macOS Native TTS
  - SDK/Client: System framework (say command)
  - Auth: None (local)
  - Implementation: `src/main/providers/tts/macos-say.ts`
  - Features: System voice synthesis via `say` CLI

## Data Storage

**Databases:**
- Local JSON file only
- Storage location: `${app.getPath('userData')}/settings.json`
- Content: User settings (provider choices, model, API keys, VAD sensitivity)
- No remote database integration

**File Storage:**
- Local filesystem only
- Temporary files: `/tmp/aichatbot-tts-*.mp3` (for TTS playback)
- Resources: `resources/` directory (bundled assets, built by electron-builder)
- Public assets: `src/renderer/public/` (VAD WASM/ONNX files, ORT worker)

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- None (each LLM provider uses individual API keys)

**API Key Management:**
- Settings-based: Each LLM provider stores its API key in `settings.json` under `llm.apiKeys[provider]`
- Environment fallback: OpenRouter and Ollama Cloud check env vars if key not in settings
  - OPENROUTER_API_KEY (OpenRouter)
  - OLLAMA_API_KEY (Ollama Cloud)
- No OAuth or session-based auth

**Security:**
- API keys persisted in local `settings.json` (user's data directory)
- No encryption at rest (keys stored as plaintext JSON)
- TLS/HTTPS enforced for all external API calls

## Monitoring & Observability

**Error Tracking:**
- None (no external error tracking service)

**Logs:**
- Console-based only (no persistent logging framework detected)
- Electron's main process console output goes to stdout
- No structured logging or log aggregation

## CI/CD & Deployment

**Hosting:**
- Electron desktop app (locally installed on user's machine)
- Packaged via electron-builder for Windows, macOS, Linux

**CI Pipeline:**
- None detected (no GitHub Actions or CI config in repo)

**Auto-updates:**
- Configured in `electron-builder.yml` but provider URL is placeholder (https://example.com/auto-updates)
- Uses generic provider model (not GitHub Releases or other hosted service)

## Environment Configuration

**Required env vars (optional, fallback to settings):**
- OPENROUTER_API_KEY - OpenRouter API key (if using OpenRouter LLM without saving to settings)
- OLLAMA_API_KEY - Ollama Cloud API key (if using cloud Ollama without saving to settings)
- ELECTRON_RENDERER_URL - Dev server URL (set during npm run dev by electron-vite)

**Settings file location:**
- macOS: `~/Library/Application Support/aichatbot/settings.json`
- Windows: `%APPDATA%\aichatbot\settings.json`
- Linux: `~/.config/aichatbot/settings.json`

**Secrets location:**
- No secrets vault or external key management
- Settings stored in plaintext JSON in user's app data directory
- API keys stored alongside other settings

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Network Policies

**Allowed Connections:**
- `api.anthropic.com` - Claude API
- `api.openai.com` - OpenAI API
- `ollama.com` - Ollama Cloud
- `localhost:11434` - Local Ollama (when configured)
- `openrouter.ai` - OpenRouter API

**Blocked/Restricted:**
- LLM response links validated to http(s) only (prevent prompt injection)
- No top-level navigation allowed from LLM-rendered markdown links
- CSP restricts connect-src to 'self' and blob (production) or localhost for dev

## Audio Hardware

**Microphone:**
- Accessed via Web Audio API (MediaDevices.getUserMedia)
- VAD processes audio stream via @ricky0123/vad-react wrapper
- Requires user permission (browser + OS level)

**Speaker:**
- Playback via afplay command (macOS) for TTS output
- Child process spawned and tracked for lifecycle management

---

*Integration audit: 2026-08-22*
