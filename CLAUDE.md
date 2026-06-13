# aichatbot

AI voice/text chatbot — electron-vite + React + TypeScript.
`src/main/` (Electron main: window, IPC, settings, LLM/STT/TTS providers),
`src/preload/`, `src/renderer/` (React UI).

## Commands

- `npm run dev` — run the app (Vite HMR + Electron).
- `npm run typecheck` — main + renderer (`typecheck:web` = renderer only).
- `npm test` — Vitest.

## Driving the app over CDP (for testing)

`npm run dev` already enables remote debugging on port 9222 (`src/main/index.ts`,
gated on `is.dev`). Connect agent-browser to the live renderer:

```bash
agent-browser connect 9222     # renderer page is served at http://localhost:5173
agent-browser snapshot -i      # @refs; then fill/click/eval against the real app
```

IPC (LLM calls, settings) works for real since you're attached to the actual renderer.

Gotchas:
- A configured LLM provider is required for real responses; settings + API keys live in
  `~/Library/Application Support/aichatbot/settings.json`.
- TTS defaults to macOS `say` (reads replies aloud). Silence during tests with
  `while sleep 0.3; do pkill -x say; done`, or set TTS to `none` in Settings.
- Stop the app with `pkill -f "electron-vite dev"`.
