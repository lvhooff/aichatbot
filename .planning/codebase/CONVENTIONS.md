# Coding Conventions

**Analysis Date:** 2026-08-22

## Naming Patterns

**Files:**
- kebab-case with TypeScript extension: `text-input.tsx`, `speech-queue.ts`
- PascalCase for component files reflects their export: `TextInput.tsx` exports `TextInput` component
- Test files follow source name with `.test` suffix: `TextInput.test.tsx`

**Functions:**
- camelCase for all functions: `submit()`, `onKeyDown()`, `createSTTAdapter()`, `handleScroll()`
- Handler functions prefixed with `on`: `onSubmit`, `onStopSpeaking`, `onSteer`, `onSave`
- Private methods prefixed with underscore: `_client` (property), `drain()` (private)

**Variables:**
- camelCase for all variables: `text`, `isPlaying`, `steering`, `canSteer`, `inert`
- Refs suffixed with `Ref`: `bottomRef`, `containerRef`, `stickToBottom`
- State variables from `useState`: `text`, `setText`

**Types & Interfaces:**
- PascalCase for all type names: `Props`, `Message`, `VADStatus`, `UseVADOptions`, `AppSettings`
- `interface Props` for component props
- Type imports with `import type`: `import type { Message } from './providers/llm/interface'`

**Constants:**
- UPPER_SNAKE_CASE for module-level constants: `STEER_ACCENT = '#7a5cc4'`, `TYPING_ANIMATION` (CSS string)
- Embedded in component definitions when specific to that component

**React Components:**
- PascalCase: `TextInput`, `ChatHistory`, `SettingsPanel`, `SteerMarker`, `TypingIndicator`
- Exported as named functions: `export function ComponentName({ props }: Props) { ... }`

## Code Style

**Formatting:**
- Tool: Prettier 3.7.4
- Single quotes: `'string'` not `"string"`
- No semicolons at statement ends
- Print width: 100 characters
- No trailing commas: `{ a, b, c }` not `{ a, b, c, }`
- Files follow `.prettierrc.yaml` settings

**Linting:**
- Tool: ESLint 9.39.1
- Config: `.eslintrc.config.mjs` with `@electron-toolkit` configs
- Rules extended: TypeScript recommended, React recommended, jsx-runtime
- Special rules for test files: `@typescript-eslint/no-explicit-any` disabled in `tests/**`
- React hooks validation enforced: `eslint-plugin-react-hooks` recommended rules active
- React refresh enforced: `eslint-plugin-react-refresh` vite rules active

**TypeScript:**
- Target: Separate configs for node (`tsconfig.node.json`) and web (`tsconfig.web.json`)
- Strict mode implied by `@electron-toolkit/eslint-config-ts`
- Type inference used; return type annotations omitted for React components and hooks
- Exception: Return types needed for class methods with complex logic like `SpeechQueue.drain()`

## Import Organization

**Order (top to bottom):**
1. React and core libraries: `import { useState, KeyboardEvent } from 'react'`
2. External packages: `import Anthropic from '@anthropic-ai/sdk'`, `import { useMicVAD } from '@ricky0123/vad-react'`
3. Type imports: `import type { Message } from './providers/llm/interface'`
4. Local utilities: `import { encodeWAV } from '../utils/wav'`
5. Local components: `import { StopButton } from './StopButton'`

**Path Style:**
- Relative imports with explicit paths: `'./StopButton'`, `'../../src/renderer/components/TextInput'`
- No barrel exports (no `index.ts` re-exports); files imported directly
- Type namespace separation: `import type { Props }` distinct from `import { Component }`

**Grouping:**
- Blank line between library imports and local imports
- Type imports can appear inline with regular imports but grouped together

## Error Handling

**Patterns:**
- Throws descriptive Error objects with user-facing messages:
  ```typescript
  if (!this.apiKey) throw new Error('Anthropic API key not configured — open Settings')
  if (value is invalid) throw new Error(`Unknown STT provider: ${settings.provider}`)
  ```
- Try-catch with fallback returns (no re-throw unless critical):
  ```typescript
  try {
    const saved = JSON.parse(readFileSync(this.filePath, 'utf-8'))
    // ... process
    return result
  } catch {
    return structuredClone(DEFAULT_SETTINGS)  // Fallback to defaults
  }
  ```
- Silent catch in async loops that continue draining:
  ```typescript
  catch {
    // Keep draining so the mic isn't left paused, but remember the failure
    this.errored = true
  }
  ```
- AbortController used for cancellation (LLM streaming, TTS):
  ```typescript
  this.abortController = new AbortController()
  // ... use signal: this.abortController.signal
  // Later: this.abortController?.abort()
  ```

**Error States:**
- Flags for error conditions: `errored = false` property tracks failure in `SpeechQueue`
- Error display in React: `error?: string` field on message objects, rendered as its own block separate from the speaker's content
- Provider-level validation: coerce invalid settings back to known-good defaults

## Logging

**Framework:** No structured logging; uses component-level error tracking

**Patterns:**
- No console.log in production code
- Errors surfaced via UI flags: `error?: string` on ChatMessage, error boundaries via props
- Comments explain complex behavior instead of console traces
- Test files may use vi.fn() to track calls instead of logging

**Debugging Aids:**
- JSDoc/TSDoc comments on public methods explain behavior
- Inline comments explain complex branching (e.g., scroll detection, state transitions)
- Title attributes on interactive elements provide user feedback: `title={...}`

## Comments

**When to Comment:**
- Public API methods: JSDoc describing purpose, parameters, and return value
- Complex logic blocks: explain the why, not the what (see `ChatHistory` scroll logic)
- Non-obvious branching: explain conditions (e.g., "Steer on Enter" vs "Send on Enter")
- Implementation notes: explain trade-offs (see "Assistant replies are untrusted" comment in `ChatHistory`)

**JSDoc/TSDoc Style:**
```typescript
/**
 * Queue a sentence that ends at `mark` in the reply text.
 */
push(text: string, mark: number): void { ... }

/**
 * Offset up to which the listener has heard whole sentences.
 */
get mark(): number { ... }
```

**Block Comments:**
```typescript
// Explain multi-line logic
// Line 2 of explanation
function complexFunction() { ... }
```

## Function Design

**Size:** Functions keep to single responsibility; max ~20–30 lines typical

**Parameters:**
- Destructured props for components: `function TextInput({ onSubmit, disabled, ... }: Props)`
- Named parameters for clarity: prefer `{ isPlaying, sensitivity, onAudioReady }` over positional args
- Callbacks last in parameter list

**Return Values:**
- Consistent return types: functions either return a value or void
- Async functions return Promise<T>
- React components return JSX.Element implicitly

**Handler Functions:**
- Event handlers typed with React event types: `KeyboardEvent<HTMLTextAreaElement>`, `ChangeEvent<HTMLInputElement>`
- Handlers stored in variables for reuse: `const handleScroll = () => { ... }`
- Pass handlers as props: `onSubmit`, `onClick`, `onKeyDown`

## Module Design

**Exports:**
- Named exports for components: `export function TextInput({ ... }: Props) { ... }`
- Named exports for classes: `export class ConversationManager { ... }`
- Type exports with `export type`: `export type VADStatus = 'idle' | 'listening' | 'recording' | 'error'`
- Default exports avoided; use named exports throughout

**Barrel Files:**
- Not used; files imported directly by path
- Re-exports in type definition files (`.d.ts`) for preload bridge only

**Class Organization:**
- Private properties start with `private`: `private history: Message[]`, `private _client?: Anthropic`
- Lazy initialization via getter: `private get client(): Anthropic { ... }`
- Public methods listed before private methods

**Constants:**
- Module-level constants for strings, numbers, objects that don't change
- Color constants and animation strings stored at module level (e.g., `STEER_ACCENT`, `TYPING_ANIMATION`)
- Settings defaults in separate dedicated file: `settings-defaults.ts`

---

*Convention analysis: 2026-08-22*
