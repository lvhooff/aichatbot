# Codebase Concerns

**Analysis Date:** 2026-08-22

## Tech Debt

**Complex streaming state management in App.tsx:**
- Issue: `src/renderer/src/App.tsx` (425 lines) contains highly intricate stateful logic for LLM streaming, TTS sentence queuing, steering (mid-flight reply redirection), and token buffering. The component manages multiple overlapping async operations (generation, TTS playback, voice capture) with manual ref-based coordination (`steerRef`, `ttsCancelRef`, `conversationRef`).
- Files: `src/renderer/src/App.tsx` (lines 32-240)
- Impact: Difficult to test, maintain, and reason about. Changes to steering or streaming behavior risk introducing subtle state-related bugs. Future feature additions (e.g., retry logic, error recovery) become harder to implement without careful refactoring.
- Fix approach: Extract streaming orchestration into a custom hook or state machine (e.g., using `useReducer` or a library like XState). Separate concerns: sentence extraction → TTS queuing → steering pivot logic.

**Hardcoded provider configuration values:**
- Issue: Provider adapters have hardcoded limits and configuration: Claude adapter uses `max_tokens: 1024` (line 26 in `src/main/providers/llm/claude.ts`), OpenAI TTS defaults to model `tts-1` (line 28), VAD sensitivity presets are fixed in settings.
- Files: `src/main/providers/llm/claude.ts`, `src/main/providers/tts/openai-tts.ts`, `src/main/settings-defaults.ts`
- Impact: Cannot tune performance without code changes. Users with rate-limited accounts or specific voice quality needs cannot configure these values.
- Fix approach: Move `max_tokens` into settings, add provider-specific configuration UI in SettingsPanel.

**Manual ref-based state coordination:**
- Issue: Multiple refs used for state outside React render cycle: `conversationRef`, `steerRef`, `ttsCancelRef` in App.tsx. This pattern bypasses React's state system and makes race conditions harder to detect.
- Files: `src/renderer/src/App.tsx` (lines 39, 42, 63)
- Impact: If a steer arrives while generation is ending and TTS is mid-sentence, the ref-based handoff may miss events or leave hanging promises.
- Fix approach: Use a state machine or event emitter to coordinate async operations. Make state transitions explicit and testable.

## Known Bugs

**Orphaned temporary files in OpenAI TTS on crash:**
- Symptoms: Temp MP3 files may accumulate in the system temp directory if the application crashes while TTS is playing (the cleanup unlink never executes).
- Files: `src/main/providers/tts/openai-tts.ts` (lines 35-45)
- Trigger: Run TTS playback and forcefully kill the Electron process before the `afplay` callback completes.
- Workaround: Manually clean `tempdir()` or rely on OS temp cleanup. Monitor disk usage if running continuously.

**Settings coercion silently accepts invalid providers:**
- Symptoms: If an old settings file references a provider that no longer exists (e.g., a removed STT provider), the coercion logic silently falls back to the default instead of warning the user.
- Files: `src/main/settings.ts` (lines 16-18, 34-42)
- Trigger: Downgrade to an older version, then upgrade back. Invalid provider in settings.json is masked.
- Workaround: None; user loses their configuration. No warning appears.

**IPC handlers lack explicit error transmission:**
- Symptoms: If an LLM provider throws an error (e.g., invalid API key), the error is logged in the main process but may not reach the renderer as a user-facing message. Some errors (like Whisper API failures) resolve as caught errors in the catch block at App.tsx line 180, but not all paths are covered.
- Files: `src/main/ipc.ts`, `src/renderer/src/App.tsx` (lines 178-186)
- Trigger: Use an invalid Claude API key and send a message. Check console for error propagation.
- Workaround: Check DevTools console; errors are printed but not shown to the user.

## Security Considerations

**Preload sandbox disabled:**
- Risk: `webPreferences.sandbox` is set to `false` in `src/main/index.ts` (line 34). This disables the Chromium sandbox for the renderer process, giving it direct access to Node.js APIs via the preload context.
- Files: `src/main/index.ts` (line 34)
- Current mitigation: The preload only exposes a narrow contextBridge API, and untrusted content (LLM replies) is rendered in a separate iframe-like context (not actually an iframe; links open externally).
- Recommendations: Re-enable sandbox (`sandbox: true`) and test compatibility. If sandbox must be disabled, limit what the preload exposes and add a Content Security Policy directive to prevent unauthorized code execution.

**Markdown link handling relies on target="_blank":**
- Risk: Assistant replies contain untrusted LLM output that may include crafted markdown links. While links open externally (`target="_blank" rel="noopener"` in `src/renderer/components/ChatHistory.tsx` line 13), an XSS in link rendering could bypass this if React-Markdown has vulnerabilities.
- Files: `src/renderer/components/ChatHistory.tsx` (lines 11-16)
- Current mitigation: Links are forced to open in the system browser via `shell.openExternal()` (filtered to http(s) only in `src/main/index.ts` lines 16-24).
- Recommendations: Keep react-markdown up-to-date. Consider sanitizing markdown input with a library like `DOMPurify` or rendering markdown in an isolated iframe with restricted permissions.

**API keys stored in plaintext in settings.json:**
- Risk: API keys (Claude, OpenAI, Ollama Cloud) are stored in the user's settings file without encryption. The file lives in `app.getPath('userData')`, typically `~/.config/aichatbot/` or similar.
- Files: `src/main/settings.ts`, `src/main/settings-defaults.ts`
- Current mitigation: File permissions on the user's home directory are filesystem-dependent. On macOS/Linux, `~/.config/` is user-readable by default.
- Recommendations: Encrypt API keys at rest using Node.js `crypto` module or Electron's `safeStorage` API. Requires a master key or system keychain integration.

**No validation of API keys before use:**
- Risk: Invalid API keys are only caught at runtime when the first API call is made. No early validation occurs. A typo in settings could silently fail.
- Files: All provider adapters (claude.ts, openai.ts, ollama.ts, etc.)
- Current mitigation: None.
- Recommendations: Add an optional `validateApiKey()` method to each adapter. Call it when settings are saved, or on-demand via a "Test Connection" button in SettingsPanel.

## Performance Bottlenecks

**Large App.tsx with no code splitting:**
- Problem: `src/renderer/src/App.tsx` is 425 lines and handles all orchestration. The component re-renders on every token, message, or state change. No memoization of sub-components or splitting into smaller containers.
- Files: `src/renderer/src/App.tsx`
- Cause: Growing feature set (steering, TTS, voice capture, settings) has accumulated in one component.
- Improvement path: Split into separate context providers or custom hooks (e.g., `useConversation`, `useSteering`, `useTTS`). Memoize ChatHistory and message renderers. Move streaming logic to a separate service or hook.

**Sentence extraction and buffering during stream:**
- Problem: On every LLM token, the App runs `extractCompleteSentences()` to identify sentence boundaries. For long multi-sentence responses, this re-parses the entire token buffer repeatedly.
- Files: `src/renderer/src/App.tsx` (line 149), `src/renderer/utils/sentences.ts`
- Cause: Token buffering happens inline during stream rendering. No incremental or lazy evaluation.
- Improvement path: Implement incremental sentence extraction (only scan the new token, not the full buffer). Cache parsed boundaries.

**React re-render on every message update:**
- Problem: Every incoming token updates message state via `setMessages()`, triggering a full ChatHistory re-render. With fast-streaming replies, this can cause frame drops on slower machines.
- Files: `src/renderer/src/App.tsx` (lines 100-105), `src/renderer/components/ChatHistory.tsx`
- Cause: No batching or throttling of state updates. React 18's automatic batching helps, but high-frequency updates still cause reflows.
- Improvement path: Debounce or batch token updates (render once per 50-100ms instead of per-token). Use `useDeferredValue` for non-critical renders.

**No streaming cancellation on cleanup:**
- Problem: If the user closes the app while a reply is streaming, the LLM provider's abort is signalled, but the generation is still billed by the API. Ollama's abort is efficient (line 70 in ollama.ts), but for cloud providers this is wasteful.
- Files: `src/main/providers/llm/claude.ts`, `src/main/providers/llm/openai.ts`
- Cause: abortController is created per-chat but cleaned up only when the browser window closes or navigation happens.
- Improvement path: Implement explicit connection pooling and request lifecycle management. Add a "cancel stream" endpoint that both aborts locally and notifies the provider.

## Fragile Areas

**Steering logic and its timing assumptions:**
- Files: `src/renderer/src/App.tsx` (lines 131-220), `src/renderer/utils/steering.ts`
- Why fragile: The steering feature relies on precise coordination between generation, TTS playback, and user input. The "delivered" boundary is determined by `SpeechQueue.mark` (the last sentence that finished playing). If TTS playback is delayed or interrupted, the mark may not reflect actual delivery, causing steers to rewind to the wrong point. Edge cases include:
  - Steer arrives before first sentence completes playing
  - TTS adapter crashes mid-sentence but doesn't reject the promise
  - Multiple concurrent steers (the code prevents this with `pendingSteer` check, but race conditions are possible)
- Safe modification: Add comprehensive logging of steering events (generation → delivery → steer). Write integration tests that mock TTS delays and validate that the delivered boundary is correct. Document the invariants (e.g., "marks are always monotonically increasing").
- Test coverage: Steering tests exist in `tests/renderer/steering.test.ts` but focus on string overlap and message building, not the timing of delivery boundaries.

**Speech queue and delivery boundary tracking:**
- Files: `src/renderer/utils/speech-queue.ts`
- Why fragile: The queue's `mark` (delivered boundary) is updated only when `this.stopped` is false (line 73). If a cancel lands mid-sentence, the mark doesn't advance even though the sentence started playing. This is intentional (a half-heard sentence should not be considered delivered), but it's implicit and hard to verify. If the TTS adapter's error handling changes, the semantics could break.
- Safe modification: Add explicit tests verifying that cancelling mid-playback does not advance the mark. Document the invariant in the class JSDoc. Add a `hasPendingPlayback()` method to make the state more visible.
- Test coverage: Limited; tests exist in `tests/renderer/speech-queue.test.ts` but don't cover cancel-during-playback scenarios.

**Settings migration and schema evolution:**
- Files: `src/main/settings.ts` (lines 30-59)
- Why fragile: The settings load function uses a loose merge strategy (`{ ...DEFAULT_SETTINGS, ...saved, ... }`) without schema validation. If a future version adds a required field to `AppSettings`, old settings files won't have it and will silently use the default. If a field is removed but still present in old settings, it persists and could cause unexpected behavior.
- Safe modification: Implement a schema versioning system (e.g., `settings.version = 2`) and explicit migration functions. Validate loaded settings against the current schema using a library like `zod` or `yup`.
- Test coverage: `tests/main/settings.test.ts` exists but doesn't test migration or invalid schema scenarios.

**Conversation window size and message history:**
- Files: `src/main/conversation.ts`, `src/renderer/src/App.tsx` (line 81)
- Why fragile: The conversation manager applies a sliding window based on `maxTurns` (default 10), which becomes 20 messages (`maxTurns * 2`). But the renderer also applies its own window limit in App.tsx line 81. If these become out of sync, the LLM sees a different history than the renderer displays.
- Safe modification: Consolidate window-size logic into one place. Add invariant checks to ensure the renderer and main process agree on what's in the conversation history.
- Test coverage: `tests/main/conversation.test.ts` tests the ConversationManager, but doesn't validate synchronization with the renderer state.

## Scaling Limits

**Single-threaded event loop blocks on TTS:**
- Current capacity: Electron's main process is single-threaded. While TTS playback happens asynchronously, provider setup and cleanup are synchronous. A slow TTS provider (e.g., local Ollama over a slow network) can block IPC handlers.
- Limit: If TTS takes >1 second per sentence, the UI becomes noticeably laggy. User interactions (typing, clicking settings) may feel sluggish during playback.
- Scaling path: Move TTS and STT to a separate Worker or child process. Use a thread pool for I/O-bound operations. Implement request queueing in IPC handlers.

**Conversation history unbounded in memory:**
- Current capacity: ConversationManager stores all messages in an array. With the default window size of 10 turns, that's 20 messages in memory. Over hours of conversation, this grows. Full memory consumption depends on message length (unknown).
- Limit: A very long conversation (hundreds of turns) could consume significant memory. No explicit limit is enforced.
- Scaling path: Implement a configurable max message count or memory limit. Archive old conversations to disk. Prune on app start or periodically.

**No rate limiting on API calls:**
- Current capacity: Each message sent to the LLM, STT, or TTS provider immediately makes an API call. No batching, queuing, or rate limiting.
- Limit: Rapid-fire messages (e.g., user spamming Enter or programmatic testing) could trigger provider rate limits or hit billing thresholds unexpectedly.
- Scaling path: Add a request queue with configurable concurrency and rate limits. Implement exponential backoff for retries. Surface rate-limit errors to the user with a clear message.

## Dependencies at Risk

**@anthropic-ai/sdk version ^0.96.0:**
- Risk: The package uses a caret range (`^0.96.0`), which allows minor and patch upgrades but not major versions. The Anthropic API evolves; a future breaking change in the SDK (e.g., streaming format change) will only be caught after a manual major-version bump. No version pinning means reproducible builds are not guaranteed across installs.
- Impact: New developers or deployments could pull a different SDK version with incompatible streaming behavior or missing methods.
- Migration plan: Evaluate a full version pin (e.g., `0.96.5`) or a stricter range (e.g., `0.96.*`). Use `npm ci` in CI/CD to lock versions. Monitor SDK releases and test upgrades before committing.

**electron-builder version ^26.0.12:**
- Risk: Electron Builder is critical for packaging. Version ^26 is recent and relatively untested. A breaking change in dist configuration could break builds for Linux or macOS.
- Impact: If a new electron-builder version changes its output format, the app may not package correctly or miss dependencies.
- Migration plan: Pin the version or use a stricter range. Document the build process in README. Test packaging on all target platforms during CI.

**react-markdown rendering untrusted LLM output:**
- Risk: `react-markdown` is responsible for rendering assistant replies. A vulnerability in markdown parsing or rendering (e.g., JS injection via HTML attributes) could expose the app to XSS.
- Impact: Compromised markdown handling could allow an LLM response (or MITM'd response) to execute arbitrary code in the app.
- Migration plan: Keep react-markdown up-to-date. Consider an alternative like `marked` with explicit XSS prevention. Audit the markdown rendering pipeline regularly.

## Missing Critical Features

**No error recovery or retry logic:**
- Problem: If an API call fails (network timeout, rate limit, server error), the user sees an error and must retry manually. No automatic retry with exponential backoff.
- Blocks: Users on unstable networks experience frequent failures. Rate-limited accounts cannot recover gracefully.
- Suggested implementation: Wrap provider chat/transcribe calls with a retry wrapper. Offer a "Retry" button in the UI for recoverable errors. Distinguish between client errors (bad API key) and transient errors (network timeout).

**No conversation persistence:**
- Problem: Chat history is stored only in memory (ConversationManager). Closing the app loses all messages.
- Blocks: Users cannot resume conversations or archive transcripts.
- Suggested implementation: Persist messages to a local database (SQLite via `better-sqlite3`) or JSON file. Implement a basic session management UI (load/save/delete conversations).

**No streaming indicator for STT:**
- Problem: When Whisper API transcribes audio, there's no visual feedback. The user doesn't know if the app is processing.
- Blocks: UX feels unresponsive during transcription.
- Suggested implementation: Show a "Transcribing…" indicator in StatusBar. Hide the message input until transcription completes.

**No provider health check or diagnostics:**
- Problem: If an API key is invalid or a service is down, the error only appears when a chat is attempted. There's no upfront validation.
- Blocks: Users can open the app, think everything is working, and then discover a missing API key only after composing a message.
- Suggested implementation: Add a "Test Connection" button in SettingsPanel for each provider. Show provider status in the UI (green/red indicator).

**No support for custom system prompts:**
- Problem: The system message sent to LLM providers is hardcoded implicitly (no explicit system message in the current code; the provider uses its default behavior).
- Blocks: Users cannot customize the AI's personality or behavior.
- Suggested implementation: Add a "System Prompt" field to SettingsPanel. Prepend it to the first user message or send it as a dedicated system role (if the provider supports it).

## Test Coverage Gaps

**Untested app streaming orchestration:**
- What's not tested: The main streaming logic in `src/renderer/src/App.tsx` (the core sendMessage function, steering, TTS queuing) has no tests. The function is complex (100+ lines) and handles many state transitions.
- Files: `src/renderer/src/App.tsx` (lines 74-240)
- Risk: Regressions in steering, TTS timing, or error handling go undetected. A stray refactor could silently break mid-flight replies.
- Priority: High — this is the app's core feature.

**Untested provider implementations:**
- What's not tested: Claude, OpenAI, Ollama, and OpenRouter adapters have no tests. Only the macos-impl STT provider has a test file.
- Files: `src/main/providers/llm/claude.ts`, `src/main/providers/llm/openai.ts`, `src/main/providers/llm/ollama.ts`, `src/main/providers/llm/openrouter.ts`, `src/main/providers/tts/openai-tts.ts`, `src/main/providers/tts/macos-say.ts`
- Risk: If a provider changes its error handling or request format, the app breaks silently. Mocking the HTTP layer is complex, but integration tests against a mock server would catch issues.
- Priority: Medium — requires external API mocking, but critical for reliability.

**Untested IPC handlers:**
- What's not tested: The main process IPC handlers in `src/main/ipc.ts` are not tested. Error paths (invalid audio, API failures) are not covered.
- Files: `src/main/ipc.ts`
- Risk: A crash in an IPC handler could freeze the app or leave it in an inconsistent state.
- Priority: Medium — IPC is the bridge between renderer and main process.

**Untested SettingsPanel:**
- What's not tested: The Settings UI component `src/renderer/components/SettingsPanel.tsx` (407 lines) is partially tested in `tests/renderer/SettingsPanel.test.tsx`, but not all features are covered (e.g., model switching, API key visibility toggle, validation errors).
- Files: `src/renderer/components/SettingsPanel.tsx`
- Risk: Settings changes could silently fail or corrupt the settings file.
- Priority: Medium — settings are critical for app functionality.

**Untested error boundaries:**
- What's not tested: React Error Boundaries are not implemented. If a component crashes, the entire app UI fails.
- Files: `src/renderer/src/App.tsx`
- Risk: A single uncaught error cascades to a broken UI.
- Priority: Medium — add error boundaries around major sections (ChatHistory, input, settings).

---

*Concerns audit: 2026-08-22*
