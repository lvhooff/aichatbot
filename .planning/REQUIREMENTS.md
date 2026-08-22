# Requirements: aichatbot

**Defined:** 2026-08-22
**Core Value:** A user can have a natural, hands-free spoken conversation with the AI — speak,
hear it reply, and interrupt it by talking — reliably, in the real packaged app, not just in
`npm run dev`.

## v1 Requirements

Requirements for this hardening milestone. The core chat/LLM/STT/TTS pipeline already exists
(see PROJECT.md "Validated"); these are the outstanding gaps blocking a reliable voice loop.

### VAD (Mic Pipeline in Packaged Builds)

- [ ] **VAD-01**: VAD's ONNX/WASM assets load correctly in a packaged production build (`file://` protocol), not only under the Vite dev server
- [ ] **VAD-02**: CSP required for VAD's blob worker and WASM fetches is correctly applied in a packaged production build, verified outside of Vite dev middleware

### BARGE (Voice Barge-In)

- [ ] **BARGE-01**: User can interrupt the AI's spoken reply by talking, and the app detects real user speech as speech during playback (rather than staying fully paused for the whole reply)
- [ ] **BARGE-02**: The app does not self-trigger on its own TTS audio output during playback, across at least the macOS `say` and OpenAI TTS providers

### ERR (Voice Pipeline Error Visibility)

- [ ] **ERR-01**: If STT, LLM, or TTS calls fail (invalid API key, network error, provider error), the user sees a clear, human-readable error message in the chat UI instead of a silent or empty response
- [ ] **ERR-02**: User sees a visible "Transcribing…" (or equivalent) status while STT is processing captured audio

## v2 Requirements

Deferred to a future milestone. Drawn from `.planning/codebase/CONCERNS.md` but not required for
this milestone's reliability goal.

### Diagnostics

- **DIAG-01**: User can test provider connectivity (API key validity) from Settings before starting a conversation
- **DIAG-02**: Settings coercion of an invalid/removed provider warns the user instead of silently falling back to a default

### Persistence

- **PERSIST-01**: Conversation history persists across app restarts

### Security Hardening

- **SEC-01**: API keys encrypted at rest (e.g., via Electron `safeStorage`) instead of plaintext `settings.json`
- **SEC-02**: Preload sandbox re-enabled (`sandbox: true`) with renderer compatibility verified

## Out of Scope

| Feature | Reason |
|---------|--------|
| API key encryption at rest | Security hardening beyond this milestone's reliability focus; local single-user desktop app — see v2 SEC-01 |
| Preload sandbox re-enablement | Needs its own compatibility pass; not required to make the voice loop reliable — see v2 SEC-02 |
| Conversation persistence | Not required for a reliable voice loop — see v2 PERSIST-01 |
| Provider "Test Connection" / health-check UI | Nice-to-have diagnostics, not blocking reliability — see v2 DIAG-01 |
| Automatic retry/backoff for failed provider calls | ERR-01/ERR-02 cover making failures visible; automated retry is separate scope |
| `App.tsx` architecture refactor (state machine / hook extraction) | Internal code-quality improvement, not a user-observable requirement |
| Windows/Linux voice-feature parity | This milestone's "packaged build" verification targets macOS, the only fully-supported platform today |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VAD-01 | Phase 1 | Pending |
| VAD-02 | Phase 1 | Pending |
| BARGE-01 | Phase 2 | Pending |
| BARGE-02 | Phase 2 | Pending |
| ERR-01 | Phase 3 | Pending |
| ERR-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-22*
*Last updated: 2026-08-22 after initial ingest (new-project-from-ingest)*
