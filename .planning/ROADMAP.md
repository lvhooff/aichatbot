# Roadmap: aichatbot

## Overview

The core voice-chat pipeline (multi-provider LLM chat, STT, TTS, live steering, settings) is
already built and working in dev — this is a brownfield hardening milestone, not a greenfield
build. Three gaps stand between the current app and the stated success metric ("barge-in, VAD,
and TTS/STT work reliably end-to-end without the mic/CSP bugs"): the VAD/mic pipeline has never
been verified in a packaged production build (only `npm run dev`), barge-in was implemented once
and then removed because it self-triggered on the app's own TTS output, and voice-pipeline
failures currently fail silently instead of surfacing to the user. The roadmap addresses these in
foundation → feature → reliability order: first make the packaged app's mic pipeline trustworthy,
then rebuild barge-in on that solid foundation without repeating its known failure mode, then
close the loop by making failures visible instead of silent.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Packaged-Build Voice Pipeline Reliability** - VAD's mic pipeline and CSP work correctly in a real packaged build, not only in dev
- [ ] **Phase 2: Reliable Barge-In** - User can interrupt the AI by talking, without the app self-triggering on its own voice
- [ ] **Phase 3: Voice Pipeline Error Visibility** - STT/LLM/TTS failures are surfaced to the user instead of failing silently

## Phase Details

### Phase 1: Packaged-Build Voice Pipeline Reliability
**Goal**: The VAD/mic pipeline (ONNX WASM asset loading + CSP) works in a packaged production
build (`file://` protocol via `npm run build` / `electron-builder`), not only under the Vite dev
server — closing the debug handoff's one explicitly-unverified follow-up.
**Depends on**: Nothing (first phase)
**Requirements**: VAD-01, VAD-02
**Success Criteria** (what must be TRUE):
  1. Launching the packaged app reaches the "Listening" VAD status without a mic error, matching current dev behavior
  2. No CSP violation or failed asset load occurs when the packaged app fetches VAD's ONNX/WASM/worker resources (verified via console/devtools on the built app, not the dev server)
  3. A user can speak into the mic in the packaged app and see a transcript appear — the full capture → VAD → STT round trip works outside of dev
**Plans**: TBD

### Phase 2: Reliable Barge-In
**Goal**: A user can interrupt the AI's spoken reply by talking, the way voice assistants
normally work, without the app mistaking its own TTS audio for the user's voice — replacing the
threshold-only approach that was tried and reverted (commit `7d1ee19`).
**Depends on**: Phase 1
**Requirements**: BARGE-01, BARGE-02
**Success Criteria** (what must be TRUE):
  1. While the AI is speaking, a user can start talking and the app detects it as real speech instead of staying fully paused for the whole reply
  2. On detecting user speech during playback, TTS playback stops and any in-flight LLM generation is cancelled immediately — no overlap between the AI's voice and the new recording
  3. Across a full AI reply played through both the macOS `say` and OpenAI TTS providers, the app does not falsely trigger on its own output when the user stays silent
  4. After a barge-in, the user's new utterance is transcribed and sent as the next conversational turn, reusing the existing live-steering mechanics
**Plans**: TBD

### Phase 3: Voice Pipeline Error Visibility
**Goal**: When STT, LLM, or TTS calls fail, the user immediately understands what went wrong and
can retry, instead of experiencing a silent or confusing failure.
**Depends on**: Phase 2
**Requirements**: ERR-01, ERR-02
**Success Criteria** (what must be TRUE):
  1. If the configured LLM, STT, or TTS provider is misconfigured (e.g., invalid API key) or a call errors, the user sees a clear, human-readable error message in the chat UI rather than a blank or missing response
  2. While captured audio is being transcribed, the user sees a visible "Transcribing…" (or equivalent) status instead of the UI appearing unresponsive
  3. After a provider call fails, the app returns to a usable state immediately (mic/input are not left stuck) so the user can retry without restarting the app
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|-----------------|--------|-----------|
| 1. Packaged-Build Voice Pipeline Reliability | 0/TBD | Not started | - |
| 2. Reliable Barge-In | 0/TBD | Not started | - |
| 3. Voice Pipeline Error Visibility | 0/TBD | Not started | - |
