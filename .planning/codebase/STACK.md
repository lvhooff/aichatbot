# Technology Stack

**Analysis Date:** 2026-08-22

## Languages

**Primary:**
- TypeScript 5.9.3 - Full codebase (main process, preload, renderer)

## Runtime

**Environment:**
- Node.js (version not pinned via .nvmrc; uses system Node)
- Electron 39.2.6 - Desktop application framework

**Package Manager:**
- npm (npm workspaces used for monorepo-like structure)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Electron 39.2.6 - Desktop app framework with main process, preload, and renderer separation
- React 19.2.1 - UI framework for renderer process (`src/renderer/src/`, `src/renderer/components/`)
- Electron Vite 5.0.0 - Build orchestrator for Electron + Vite development

**Testing:**
- Vitest 4.1.6 - Unit test runner with jsdom for React component testing
- @testing-library/react 16.3.2 - React component test utilities
- @testing-library/jest-dom 6.9.1 - DOM matchers for assertions
- jsdom 29.1.1 - Virtual DOM for testing

**Build/Dev:**
- Vite 7.2.6 - Frontend build tool (via electron-vite)
- @vitejs/plugin-react 5.2.0 - JSX/React support in Vite
- Electron Builder 26.0.12 - Cross-platform app packaging (Windows, macOS, Linux)
- TypeScript compiler integration (tsc for type checking only)

**Code Quality:**
- ESLint 9.39.1 - Linting configuration via `eslint.config.mjs`
  - @electron-toolkit/eslint-config-ts - TypeScript rules
  - @electron-toolkit/eslint-config-prettier - Prettier integration
  - eslint-plugin-react 7.37.5 - React-specific rules
  - eslint-plugin-react-hooks 7.0.1 - React hooks linting
  - eslint-plugin-react-refresh 0.4.24 - Vite React Fast Refresh detection
- Prettier 3.7.4 - Code formatting (singleQuote: true, semi: false, printWidth: 100)

## Key Dependencies

**Critical (API/LLM):**
- @anthropic-ai/sdk 0.96.0 - Claude AI API client
- openai 6.38.0 - OpenAI API client (GPT, Whisper, TTS)
- ollama 0.6.3 - Ollama LLM client (local or cloud)

**Audio/Voice Activity Detection:**
- @ricky0123/vad-react 0.0.36 - React wrapper for VAD
- @ricky0123/vad-web 0.0.30 - Web-based VAD (uses onnxruntime-web)
- onnxruntime-web (via vad-web) - ML runtime for VAD inference using WASM

**UI/Rendering:**
- react-markdown 10.1.0 - Markdown to React components (for rendering LLM responses)
- remark-gfm 4.0.1 - GitHub-flavored Markdown plugin for react-markdown

**Electron Utilities:**
- @electron-toolkit/utils 4.0.0 - Common Electron utilities (optimizer, electronApp helpers)
- @electron-toolkit/preload 3.0.2 - Preload utilities for context bridge setup

## Configuration Files

**TypeScript:**
- `tsconfig.json` - Root config with composite references
- `tsconfig.node.json` - Node.js side (main/preload processes)
- `tsconfig.web.json` - Web side (renderer process) with path alias `@renderer/*`

**Build:**
- `electron.vite.config.ts` - Electron + Vite configuration
  - Main process: externalizeDepsPlugin (no bundling)
  - Preload: externalizeDepsPlugin (no bundling)
  - Renderer: React plugin + custom ORT worker asset middleware
  - Pre-bundled: @ricky0123/vad-react, @ricky0123/vad-web, onnxruntime-web

**Code Quality:**
- `.prettierrc.yaml` - Prettier config (singleQuote: true, semi: false, printWidth: 100)
- `eslint.config.mjs` - ESLint flat config with TS, React, hooks, prettier integration

**App Packaging:**
- `electron-builder.yml` - Cross-platform build targets
  - macOS: with camera/microphone/folder permissions
  - Windows: NSIS installer
  - Linux: AppImage, snap, deb packages
  - Publish: Generic URL-based auto-updates

**Testing:**
- `vitest.config.ts` - jsdom environment, globals enabled, setup file at `tests/setup.ts`

## Platform Requirements

**Development:**
- Node.js (no specific version pinned)
- npm
- TypeScript compiler (via npm scripts)
- ESLint, Prettier (dev dependencies)

**Production:**
- macOS 10.13+ (app runs via Electron)
- Windows 7+ (via Electron + NSIS)
- Linux (via Electron + AppImage/snap/deb)
- Microphone access (required for voice input)
- Speaker access (required for TTS playback)

**Special Permissions:**
- Camera (declared via NSCameraUsageDescription in macOS entitlements, unused currently)
- Microphone (NSMicrophoneUsageDescription in macOS entitlements)
- Documents folder (NSDocumentsFolderUsageDescription)
- Downloads folder (NSDownloadsFolderUsageDescription)

## Build Artifacts

- `out/` - Compiled output (main/preload/renderer bundles after `npm run build`)
- `build/` - Assets for electron-builder (icons, entitlements)

## Environment & Security

**Content Security Policy:**
- Development: Allows `'self'`, `'unsafe-inline'`, blob, localhost (for Vite HMR)
- Production: Strict policy with `'self'`, blob, no external resources except data URIs
- Worker support: blob and self for VAD web worker

**Sandbox:**
- Preload sandbox disabled (`sandbox: false` in BrowserWindow webPreferences)
- Preload script provides IPC bridge to main process

**External Resource Filtering:**
- Links from LLM responses restricted to http(s) protocol only (prevent prompt injection attacks)

---

*Stack analysis: 2026-08-22*
