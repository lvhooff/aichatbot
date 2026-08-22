# Testing Patterns

**Analysis Date:** 2026-08-22

## Test Framework

**Runner:**
- Vitest 4.1.6
- Config: `vitest.config.ts`
- Environment: jsdom for browser APIs
- Globals: true (describe, it, expect, etc. available without imports)
- Setup file: `tests/setup.ts` loaded before each test

**Assertion Library:**
- Vitest built-in assertions (expect)
- @testing-library/jest-dom for extended matchers

**Run Commands:**
```bash
npm test              # Run all tests once
npm run test:watch   # Watch mode, re-run on change
```

**Test Suites:**
- Unit tests: utility functions, classes, hooks (pure logic)
- Component tests: React components with @testing-library/react
- No integration tests (each test isolated via mocks)
- No E2E tests

## Test File Organization

**Location:**
- Tests co-located with source in separate `tests/` directory
- Mirror directory structure: `src/main/...` → `tests/main/...`, `src/renderer/...` → `tests/renderer/...`

**Naming:**
- Pattern: `[SourceFileName].test.tsx` for components, `[SourceFileName].test.ts` for utilities
- Examples: `TextInput.test.tsx`, `conversation.test.ts`, `wav.test.ts`

**Structure:**
```
tests/
├── setup.ts                          # Global test configuration
├── main/
│   ├── conversation.test.ts
│   ├── settings.test.ts
│   └── providers/
│       ├── llm/
│       │   ├── claude.test.ts
│       │   ├── ollama.test.ts
│       │   └── openai.test.ts
│       └── stt/
│           └── whisper-api.test.ts
└── renderer/
    ├── ChatHistory.test.tsx
    ├── SettingsPanel.test.tsx
    ├── StatusBar.test.tsx
    ├── TextInput.test.tsx
    ├── speech-queue.test.ts
    ├── steering.test.ts
    ├── wav.test.ts
    └── sentences.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Component } from '../../src/...'

describe('ComponentName', () => {
  let instance: SomeClass

  beforeEach(() => {
    instance = new SomeClass()
  })

  it('describes what should happen', () => {
    // Arrange, Act, Assert
    const result = instance.method()
    expect(result).toBe(expectedValue)
  })

  describe('nested feature', () => {
    it('tests a specific scenario', () => {
      // ...
    })
  })
})
```

**Patterns:**
- `beforeEach()` creates fresh instances before each test
- Nested `describe()` blocks for related features (e.g., `describe('steering mode', ...)`)
- One assertion or group of related assertions per test
- Test names describe the behavior: `'returns empty window initially'`, `'clears all messages'`

**Example Test (Unit):**
```typescript
describe('ConversationManager', () => {
  let mgr: ConversationManager

  beforeEach(() => {
    mgr = new ConversationManager(2)
  })

  it('returns empty window initially', () => {
    expect(mgr.getWindow()).toEqual([])
  })

  it('trims to last N turns (2 turns = 4 messages)', () => {
    for (let i = 0; i < 3; i++) {
      mgr.add({ role: 'user', content: `msg ${i}` })
      mgr.add({ role: 'assistant', content: `reply ${i}` })
    }
    const window = mgr.getWindow()
    expect(window).toHaveLength(4)
    expect(window[0].content).toBe('msg 1')
  })
})
```

## Mocking

**Framework:** Vitest's `vi` module

**Patterns - Mocking Modules:**
```typescript
vi.mock('@anthropic-ai/sdk', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } }
      yield { type: 'message_stop' }
    }
  }
  const MockAnthropic = function (this: any) {
    this.messages = {
      stream: vi.fn().mockReturnValue(mockStream)
    }
  }
  return { default: MockAnthropic }
})
```

**Patterns - Mocking Callbacks:**
```typescript
const onStopSpeaking = vi.fn()
const onSteer = vi.fn()
render(<TextInput onSubmit={() => {}} isPlaying={true} onStopSpeaking={onStopSpeaking} />)
fireEvent.click(screen.getByRole('button', { name: /stop/i }))
expect(onStopSpeaking).toHaveBeenCalledOnce()
expect(onSteer).toHaveBeenCalledWith('shorter')
```

**Patterns - Return Value Setup:**
```typescript
const mockFn = vi.fn()
  .mockReturnValue(someValue)
  .mockReturnValueOnce(firstValue)  // Only for first call
```

**What to Mock:**
- External SDKs: `@anthropic-ai/sdk`, `openai`
- Electron APIs: `electron.app`, `electron.ipcMain`
- Browser APIs that jsdom doesn't fully support
- File system operations (fs module) in isolation tests

**What NOT to Mock:**
- Local utility functions (test them directly)
- React components (render them; mock their props)
- Hooks (test via component that uses them, or test the hook directly)
- Native JavaScript Array/Object methods

## Fixtures and Factories

**Test Data:**
```typescript
const DEFAULT_SETTINGS = {
  llm: { provider: 'claude', model: '...', apiKeys: {...} },
  stt: { provider: 'whisper-api', apiKey: '...' },
  tts: { provider: 'macos-say' },
  conversationWindowSize: 10
}

// In tests:
render(<Component settings={DEFAULT_SETTINGS} />)
```

**Location:**
- Shared defaults: `src/main/settings-defaults.ts` imported into tests
- Ad-hoc test data created inline: `{ role: 'user', content: 'hi' }`

**No factories or builder pattern used; data created inline per test need**

## Coverage

**Requirements:** Not enforced (no coverage thresholds configured)

**View Coverage:**
- No coverage reports currently generated
- Could be added via `vitest --coverage` flag

## Test Types

**Unit Tests:**
- Scope: Single class method or function
- Approach: Create instance, call method, assert result
- Example: `ConversationManager.add()`, `encodeWAV()` utility
- No mocking of internal calls; test the whole unit

**Component Tests (React):**
- Scope: Component rendering and user interaction
- Approach: `render()` with Testing Library, simulate user actions, assert DOM
- Example: `TextInput` component with keystroke and click handling
- Mock child components' callbacks (onSubmit, onSteer, etc.)

**No E2E Tests:** Not present in this codebase

## Common Patterns

**Async Testing:**
```typescript
it('streams tokens and returns full text', async () => {
  const tokens: string[] = []
  const result = await adapter.chat([{ role: 'user', content: 'hi' }], (t) => tokens.push(t))
  expect(tokens).toEqual(['Hello', ' world'])
  expect(result).toBe('Hello world')
})
```
- `async/await` for async operations
- Vitest waits for Promise resolution automatically
- No explicit `.resolves` or manual Promise handling

**Error Testing:**
- No dedicated error tests observed
- Error paths tested implicitly (e.g., fallback behavior in settings load)
- Throw statements tested via mock setup or component error states

**React Component Testing:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react'

it('calls onSubmit when Send is clicked', () => {
  const onSubmit = vi.fn()
  render(<TextInput onSubmit={onSubmit} />)
  
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  
  expect(onSubmit).toHaveBeenCalledWith('test')
})
```

**Querying Elements:**
- Preferred: `screen.getByRole()` — accessible by default, future-proof
- Alternative: `screen.getByLabelText()` — for form inputs with labels
- Absence checks: `screen.queryByRole()` for optional elements

**Event Triggering:**
- `fireEvent.click()` for button clicks
- `fireEvent.change()` for input value changes
- `fireEvent.keyDown()` for keyboard events

**Assertion Matchers (from @testing-library/jest-dom):**
- `.toBeInTheDocument()` — element exists in DOM
- `.toHaveLength()` — array or collection length
- `.toEqual()` — deep equality
- `.toBe()` — reference/primitive equality
- `.toHaveBeenCalledOnce()` — mock called exactly once
- `.toHaveBeenCalledWith(...)` — mock called with specific args

**Test Isolation:**
- Mock modules at test file top level (before imports)
- `beforeEach()` resets state per test
- No shared mutable state between tests
- Each test is independent and can run in any order

---

*Testing analysis: 2026-08-22*
