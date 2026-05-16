import { ipcMain, WebContents } from 'electron'
import type { Pipeline } from './pipeline'
import type { SettingsManager } from './settings'
import type { Message } from './providers/llm/interface'

export function registerIpcHandlers(pipeline: Pipeline, settingsManager: SettingsManager, webContents: WebContents): void {
  ipcMain.handle('stt:transcribe', async (_event, audioBuffer: ArrayBuffer, mimeType: string) => {
    return pipeline.transcribe(Buffer.from(audioBuffer), mimeType)
  })

  ipcMain.handle('llm:chat', async (_event, messages: Message[]) => {
    return pipeline.chat(messages, (token) => {
      if (!webContents.isDestroyed()) webContents.send('llm:token', token)
    })
  })

  ipcMain.handle('llm:cancel', async () => {
    pipeline.cancelLLM()
  })

  ipcMain.handle('tts:speak', async (_event, text: string) => {
    return pipeline.speak(text)
  })

  ipcMain.handle('tts:stop', async () => {
    pipeline.stopSpeaking()
  })

  ipcMain.handle('settings:get', async () => {
    return settingsManager.get()
  })

  ipcMain.handle('settings:save', async (_event, settings) => {
    settingsManager.save(settings)
    pipeline.updateProviders(settings)
  })
}
