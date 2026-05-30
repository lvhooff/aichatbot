import { createReadStream } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// onnxruntime-web loads its worker glue at runtime via a dynamic
// `import('/ort-wasm-simd-threaded*.mjs')`. Vite's dev server refuses to serve
// files from public/ through its module pipeline (returns 500), which breaks
// the VAD. This middleware serves those .mjs files as raw static JS modules,
// bypassing the transform pipeline. The .wasm/.onnx assets are fetched (not
// imported) so they load fine from public/ unaided.
function serveOrtWorkerAssets(): Plugin {
  const publicDir = resolve(__dirname, 'src/renderer/public')
  return {
    name: 'serve-ort-worker-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (/^\/ort-wasm-[\w.-]+\.mjs$/.test(url)) {
          res.setHeader('Content-Type', 'text/javascript')
          const stream = createReadStream(resolve(publicDir, '.' + url))
          stream.on('error', () => {
            res.statusCode = 404
            res.end()
          })
          stream.pipe(res)
          return
        }
        next()
      })
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } } }
  },
  renderer: {
    plugins: [react(), serveOrtWorkerAssets()],
    optimizeDeps: {
      // onnxruntime-web must be pre-bundled (not excluded): vad-web is CommonJS
      // and does `require("onnxruntime-web/wasm")` at load. Externalizing it
      // turns that into an unsupported dynamic-require shim that throws. The
      // worker `.mjs`/`.wasm` files are loaded at runtime from public/ via
      // `ort.env.wasm.wasmPaths = '/'` (see src/renderer/hooks/useVAD.ts).
      include: ['@ricky0123/vad-react', '@ricky0123/vad-web', 'onnxruntime-web']
    },
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } } }
  }
})
