import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SettingsManager } from './settings'
import { Pipeline } from './pipeline'
import { registerIpcHandlers } from './ipc'

if (is.dev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 360,
    minHeight: 500,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.aichatbot')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const settingsManager = new SettingsManager()
  const pipeline = new Pipeline(settingsManager.get())
  const win = createWindow()

  // TTS providers spawn child processes (`say`, `afplay`). Kill any in-flight
  // playback on quit so audio doesn't outlive the app.
  app.on('before-quit', () => pipeline.stopSpeaking())

  // CSP must be delivered via HTTP headers (not a meta tag) because Chromium
  // only honours `worker-src` from headers — the VAD blob worker needs it.
  // Dev additionally needs `'unsafe-inline'` for Vite's React Fast Refresh
  // preamble + HMR inline scripts; production keeps the strict policy.
  const scriptSrc = is.dev
    ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
    : "script-src 'self' 'wasm-unsafe-eval'"
  const connectSrc = is.dev
    ? "connect-src 'self' blob: ws://localhost:* http://localhost:*"
    : "connect-src 'self' blob:"
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "worker-src blob: 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    connectSrc
  ].join('; ')

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Remove any existing CSP entry regardless of header-name casing (Electron
    // normalises keys to lowercase, but spread + new key would produce two
    // separate entries with different casing and let Chromium intersect them).
    const headers = { ...details.responseHeaders }
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-security-policy') delete headers[key]
    }
    headers['Content-Security-Policy'] = [csp]
    callback({ responseHeaders: headers })
  })

  win.webContents.once('did-finish-load', () => {
    registerIpcHandlers(pipeline, settingsManager, win.webContents)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
