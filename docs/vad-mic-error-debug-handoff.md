# VAD "Mic error" Debug Handoff

## Status
**RESOLVED** (2026-05-30) — app renders and VAD reaches "Listening" in dev.

### What actually fixed it
1. **CSP via HTTP header, dev-aware** (`src/main/index.ts`): the strict
   `script-src 'self' 'wasm-unsafe-eval'` blocked Vite's React Fast Refresh
   inline preamble script in dev, so React never mounted (blank screen,
   `@vitejs/plugin-react can't detect preamble`). Dev now also allows
   `'unsafe-inline'`; production stays strict. The redundant CSP `<meta>` tag
   was removed from `index.html` (browsers enforce meta + header together, and
   meta doesn't honour `worker-src` anyway).
2. **Bundle onnxruntime-web, don't exclude it** (`electron.vite.config.ts`):
   vad-web is CommonJS and does `require("onnxruntime-web/wasm")` at load.
   Excluding it externalised the require into an unsupported dynamic-require
   shim that threw `Dynamic require ... is not supported`, crashing module load.
   Moved `onnxruntime-web` from `exclude` to `include`.
3. **Dev middleware to serve the ORT worker `.mjs`** (`electron.vite.config.ts`,
   `serveOrtWorkerAssets`): onnxruntime does a runtime
   `import('/ort-wasm-simd-threaded.mjs')`; Vite's dev server returns 500 for
   public/ files requested through the module pipeline. The middleware serves
   those `.mjs` files as raw static JS. (`.wasm`/`.onnx` are `fetch`ed, so they
   load from public/ unaided.)

### Known follow-up (not blocking dev)
The dev middleware is `apply: 'serve'` only. For a **packaged production build**
(`file://`), `wasmPaths = '/'` resolves to the filesystem root and will need a
relative/base-aware path. Not yet verified against `npm run build`.

---

## The Problem
The app shows **"Mic error"** in the status bar. The `useVAD` hook reports an error immediately on startup.

---

## Root Causes (Both Confirmed)

### 1. CSP `worker-src` — Blob Worker Blocked
**Error:** `Creating a worker from 'blob:...' violates Content Security Policy directive: "script-src 'self'". Note that 'worker-src' was not explicitly set.`

We added `worker-src blob: 'self'` to `src/renderer/index.html`, and confirmed via `agent-browser eval` that the meta tag IS in the DOM with the correct content. However, Chromium (Electron) **does not honour `worker-src` from a CSP meta tag** — it only applies `worker-src` from HTTP response headers. The meta tag approach is insufficient for workers.

**Fix needed:** Set the CSP via Electron's `session.webRequest.onHeadersReceived` in `src/main/index.ts`, not via the HTML meta tag.

```typescript
// In src/main/index.ts, inside app.whenReady():
win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src blob: 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' blob:"
      ]
    }
  })
})
```

### 2. ONNX Runtime WASM Module Path Wrong
**Error:** `Failed to fetch dynamically imported module: http://localhost:5173/@fs/.../node_modules/.vite/deps/ort-wasm-simd-threaded.mjs?import`

The file `node_modules/.vite/deps/ort-wasm-simd-threaded.mjs` does not exist. ONNX Runtime's `.mjs` worker loader is being resolved to the Vite deps cache folder instead of its actual location in `node_modules/onnxruntime-web/dist/`.

**Why:** `@ricky0123/vad-web/dist/real-time-vad.js` uses `require("onnxruntime-web/wasm")`. The `onnxruntime-web/wasm` entry resolves to `dist/ort.wasm.bundle.min.mjs` (ES) or `dist/ort.wasm.min.js` (CJS). Inside that bundle, it dynamically imports `ort-wasm-simd-threaded.mjs` using a relative URL. When Vite processes this, the `import.meta.url` resolves incorrectly to the `.vite/deps/` folder.

**Fix needed:** Tell ONNX Runtime explicitly where to find its WASM/MJS files by setting `wasmPaths` before the VAD initialises. This should be done in `useVAD.ts` via the `ortConfig` option:

```typescript
// In src/renderer/hooks/useVAD.ts
const vad = useMicVAD({
  startOnLoad: true,
  baseAssetPath: '/',
  onnxWASMBasePath: '/',
  ortConfig: (ort) => {
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/'
    // OR serve from local public dir — but .mjs files must also be present
  },
  ...
})
```

**OR** copy the missing `.mjs` files to `src/renderer/public/` alongside the `.wasm` file that's already there:

```bash
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs src/renderer/public/
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs src/renderer/public/
```

Then set `ort.env.wasm.wasmPaths = '/'` in `ortConfig` so ONNX Runtime loads them from the Vite public dir.

---

## What Was Already Tried (Don't Repeat)
- `optimizeDeps.exclude: ['onnxruntime-web', '@ricky0123/vad-web', '@ricky0123/vad-react']` in `electron.vite.config.ts` — confirmed working (ort not in deps cache), but doesn't fix path resolution because the CJS `require()` path in vad-web bypasses Vite's module graph.
- `baseAssetPath: '/'` and `onnxWASMBasePath: '/'` added to `useMicVAD` in `useVAD.ts` — necessary but not sufficient alone.
- Clearing `node_modules/.vite` cache — confirmed the exclude works but path error persists.
- CSP meta tag update — doesn't work for `worker-src` in Chromium/Electron.

---

## Files Changed So Far (All Committed)
- `src/renderer/index.html` — CSP updated (meta tag, insufficient for workers)
- `electron.vite.config.ts` — `optimizeDeps.exclude` added
- `src/renderer/hooks/useVAD.ts` — `baseAssetPath: '/'`, `onnxWASMBasePath: '/'` added

---

## Recommended Fix Order
1. **Copy ONNX `.mjs` files to public:**
   ```bash
   cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs src/renderer/public/
   ```
2. **Add `ortConfig` to `useMicVAD`** in `src/renderer/hooks/useVAD.ts` to set `ort.env.wasm.wasmPaths = '/'`
3. **Set CSP via HTTP headers** in `src/main/index.ts` using `session.webRequest.onHeadersReceived`
4. Restart Electron, verify "Mic error" is gone and status bar shows "Listening"

---

## Key Files
- `src/renderer/hooks/useVAD.ts` — VAD hook, needs `ortConfig`
- `src/renderer/public/` — static assets served at `/`, needs `.mjs` files
- `src/main/index.ts` — needs `session.webRequest` CSP header
- `electron.vite.config.ts` — `optimizeDeps.exclude` already set

## Running the App
```bash
npm run dev   # starts Electron with CDP on port 9222
# agent-browser --cdp 9222 console  # to check for VAD errors
```
