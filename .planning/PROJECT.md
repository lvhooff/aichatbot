# aichatbot

## What This Is

aichatbot is a Mac-first Electron desktop app for talking to an AI assistant by voice. It listens
continuously via VAD, transcribes speech, sends it to a configurable LLM (Claude, OpenAI, or
Ollama), and speaks the reply back via TTS — with the ability to interrupt or redirect a reply
while it's still being generated. Most of the original build plan is already implemented; this
milestone focuses on making the voice loop reliable rather than building new surface area.

## Core Value

A user can have a natural, hands-free spoken conversation with the AI — speak, hear it reply, and
interrupt it by talking — reliably, in the real packaged app, not just in `npm run dev`.

## Requirements

### Validated

<!-- Already implemented in the existing codebase (brownfield baseline). Confirmed via
     .planning/codebase/ analysis, not this milestone's work. -->

- ✓ Multi-provider streaming LLM chat (Claude, OpenAI, Ollama, OpenRouter) — `src/main/providers/llm/*`
- ✓ Speech-to-text via Whisper API and macOS native STT — `src/main/providers/stt/*`
- ✓ Text-to-speech via macOS `say` and OpenAI TTS, with gapless sentence-queue playback — `src/main/providers/tts/*`, `src/renderer/utils/speech-queue.ts`
- ✓ Continuous mic listening via VAD (`@ricky0123/vad-react`) reaching "Listening" state in dev — `src/renderer/hooks/useVAD.ts`
- ✓ Live steering — user can redirect an in-progress reply mid-flight via text, resuming generation from the exact delivery boundary — `src/renderer/utils/steering.ts`
- ✓ Manual Stop control to interrupt TTS playback — `src/renderer/components/StopButton.tsx`, `StatusBar.tsx`
- ✓ Settings panel for choosing/configuring LLM, STT, TTS providers, persisted to `userData/settings.json` — `src/renderer/components/SettingsPanel.tsx`, `src/main/settings.ts`
- ✓ CSP hardened via HTTP response headers (not a meta tag) so VAD's blob worker loads in dev — `src/main/index.ts`
- ✓ Text-only fallback input when STT provider is set to "none" — `src/renderer/components/TextInput.tsx`
- ✓ Markdown rendering of AI replies with external links restricted to http(s) — `src/renderer/components/ChatHistory.tsx`

### Active

<!-- This milestone's scope. See REQUIREMENTS.md for full IDs and ROADMAP.md for phase mapping. -->

- [ ] VAD/mic pipeline (ONNX WASM assets + CSP) verified working in a packaged production build, not only under `npm run dev`
- [ ] Barge-in re-implemented: user can interrupt the AI's spoken reply by talking, without the app self-triggering on its own TTS audio
- [ ] STT/LLM/TTS failures surfaced to the user as clear in-UI messages instead of silent or empty responses
- [ ] Visible "Transcribing…" feedback while STT is processing captured audio

### Out of Scope

- API key encryption at rest — security hardening beyond this milestone's reliability focus; local single-user desktop app, deferred to v2
- Preload sandbox re-enablement (`sandbox: true`) — needs its own compatibility pass; not required to make the voice loop reliable
- Conversation persistence across restarts — not required for a reliable voice loop; explicitly deferred
- Provider "Test Connection" / health-check UI — nice-to-have diagnostics, not blocking reliability
- Automatic retry/backoff for failed provider calls — ERR-01/ERR-02 cover making failures visible; automated retry is separate scope
- `App.tsx` architecture refactor (state machine / hook extraction) — internal code-quality improvement, not a user-observable requirement for this milestone

## Context

**Origin:** Built from `docs/superpowers/plans/2026-05-16-ai-voice-chatbot.md` (14-task TDD plan:
scaffolding → provider interfaces → conversation manager → LLM/STT/TTS adapters → pipeline → IPC →
main entry → WAV encoder → useVAD hook → React components → App wiring → E2E verification). Git
history shows nearly all 14 tasks landed, plus follow-on hardening (live steering, TTS animation
fixes, markdown table rendering, CSP/navigation restrictions).

**Debug handoff (resolved in dev, 2026-05-30):** `docs/vad-mic-error-debug-handoff.md` documents
two root causes behind a "Mic error" that blocked VAD from reaching "Listening": (1) Chromium does
not honor `worker-src` set via an HTML `<meta>` CSP tag, only HTTP response headers — fixed via
`session.webRequest.onHeadersReceived` in `src/main/index.ts`; (2) `@ricky0123/vad-web`'s CommonJS
`require("onnxruntime-web/wasm")` resolves its `.mjs`/`.wasm` assets incorrectly under Vite's dev
server — fixed via `optimizeDeps.include` plus dev-only static-serving middleware in
`electron.vite.config.ts`. **Explicitly flagged as unverified:** the dev middleware only applies in
`serve` mode; for a packaged build (`file://` protocol), `baseAssetPath`/`onnxWASMBasePath` /
`wasm.wasmPaths` are hardcoded to `'/'`, which resolves to filesystem root under `file://` and has
not been tested against `npm run build`. This is the most concrete known gap blocking "reliable
VAD in production."

**Barge-in regression (git history, commit `7d1ee19`):** The original plan's barge-in design raised
`positiveSpeechThreshold` to 0.90 during TTS playback (vs. 0.50 idle) so the AI's own voice
wouldn't trigger a false speech-start. That approach was later **removed** — commit message: "removed
barge in as it was lisening to itself" — because the mic still picked up the AI's own TTS output
through the speakers and self-triggered. In its place, `useVAD.ts` now fully pauses VAD
(`vad.pause()`) whenever `isPlaying` is true, and a manual Stop button was added instead
(`StopButton.tsx`). Barge-in as a hands-free interrupt does not currently exist in the app. Any
new barge-in work should account for this specific failure mode (e.g., `getUserMedia`
`echoCancellation` constraints, per-provider threshold tuning, output ducking) rather than
reapplying the threshold-only approach that already failed once.

**Codebase map:** `.planning/codebase/` (STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md,
TESTING.md, INTEGRATIONS.md, CONCERNS.md) has the full current-state analysis. CONCERNS.md
catalogs a broader set of tech debt, known bugs, and missing features (settings coercion,
conversation persistence, API key encryption, `App.tsx` complexity, etc.) — most are deliberately
out of scope here; only the items tied to the voice loop's reliability were pulled into this
milestone's Active requirements.

## Constraints

- **Tech stack**: Electron 39 + React 19 + TypeScript via electron-vite; hexagonal adapter pattern
  for LLM/STT/TTS providers is established — extend it, don't replace it.
- **Platform**: macOS is the only fully-supported platform today (TTS depends on the `say` /
  `afplay` CLIs, the macOS STT provider is OS-only). Windows/Linux packaging exists via
  electron-builder but voice features are unproven there — this milestone's "packaged build"
  verification targets macOS.
- **Security/CSP**: Production CSP must stay strict (`script-src 'self' 'wasm-unsafe-eval'`); any
  dev-only relaxation (e.g., `'unsafe-inline'` for Fast Refresh) must not leak into packaged
  builds.
- **Solo developer + Claude workflow**: no team process, no sprint ceremonies — phases are buckets
  of work for one person + one implementer.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Debug handoff is authoritative over the original plan's code snippets for CSP headers (`src/main/index.ts`), dev middleware (`electron.vite.config.ts`), and `useVAD` asset-path config | Same-scope supersession noted during ingest synthesis — the debug handoff documents fixes applied after the plan was written | ✓ Good — already implemented, dev VAD confirmed working |
| Barge-in threshold-only approach (raise VAD sensitivity during playback) is not retried as-is | Already tried and reverted (commit `7d1ee19`) because it self-triggered on the app's own TTS audio | ⚠️ Revisit during Phase 2 planning — needs a different mechanism |

---
*Last updated: 2026-08-22 after initial ingest (new-project-from-ingest)*
