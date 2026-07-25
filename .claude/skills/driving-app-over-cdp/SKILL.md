---
name: driving-app-over-cdp
description: Drive the running aichatbot Electron app over Chrome DevTools Protocol for real end-to-end testing (connect agent-browser, work around TTS/LLM gotchas, stop the app).
---

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
- TTS defaults to macOS `say` (reads replies aloud). To keep it quiet without
  changing behaviour, mute the output device (`osascript -e "set volume output
  volume 0"`) and restore it after — `pkill`ing `say` instead makes every
  sentence look like it finished playing instantly, which breaks any test that
  depends on speech timing. Setting TTS to `none` in Settings disables it fully.
- Stop the app with **`pkill -9 -f "aichatbot/node_modules/electron"`**.
  `pkill -f "electron-vite dev"` only kills the dev-server wrapper: the Electron
  app survives, keeps port 9222, and `agent-browser connect 9222` then silently
  attaches to that stale instance — so edits and settings changes appear to have
  no effect. After restarting, confirm exactly one instance:
  `pgrep -f 'aichatbot/node_modules/electron/dist/Electron.app/Contents/MacOS' | wc -l`.
- The streaming caret (`▋`) means "turn not settled", not "generation finished" —
  it stays up while the voice works through its backlog. Watch for a stable
  message length instead.
