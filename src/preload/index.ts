import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings } from '../main/settings'
import type { Message } from '../main/providers/llm/interface'

contextBridge.exposeInMainWorld('api', {
  transcribe: (audioBuffer: ArrayBuffer, mimeType: string): Promise<string> =>
    ipcRenderer.invoke('stt:transcribe', audioBuffer, mimeType),

  chat: (messages: Message[]): Promise<string> =>
    ipcRenderer.invoke('llm:chat', messages),

  onLLMToken: (callback: (token: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, token: string) => callback(token)
    ipcRenderer.on('llm:token', handler)
    return () => ipcRenderer.removeListener('llm:token', handler)
  },

  speak: (text: string): Promise<void> =>
    ipcRenderer.invoke('tts:speak', text),

  stopSpeaking: (): Promise<void> =>
    ipcRenderer.invoke('tts:stop'),

  cancelLLM: (): Promise<void> =>
    ipcRenderer.invoke('llm:cancel'),

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:get'),

  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke('settings:save', settings),
})
