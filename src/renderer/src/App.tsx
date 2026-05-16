import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatHistory } from '../components/ChatHistory'
import { StatusBar } from '../components/StatusBar'
import { SettingsPanel } from '../components/SettingsPanel'
import { useVAD } from '../hooks/useVAD'
import type { ChatMessage } from '../types'
import type { AppSettings } from '../../main/settings'
import type { Message } from '../../main/providers/llm/interface'

const DEFAULT_SETTINGS: AppSettings = {
  llm: { provider: 'claude', model: 'claude-sonnet-4-6', apiKey: '' },
  stt: { provider: 'whisper-api', apiKey: '' },
  tts: { provider: 'macos-say', apiKey: '' },
  conversationWindowSize: 10,
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const conversationRef = useRef<Message[]>([])

  useEffect(() => {
    window.api.getSettings().then(setSettings).catch(console.error)
  }, [])

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  const updateLastAssistantMessage = useCallback((token: string, done = false) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      return [
        ...prev.slice(0, -1),
        { ...last, content: last.content + token, isStreaming: !done },
      ]
    })
  }, [])

  const handleAudioReady = useCallback(
    async (audioBuffer: ArrayBuffer) => {
      // Barge-in: if TTS is playing, stop it before transcribing
      if (isPlaying) {
        await window.api.stopSpeaking()
        await window.api.cancelLLM()
        setIsPlaying(false)
      }

      const userMsgId = crypto.randomUUID()
      let transcript = ''

      try {
        transcript = await window.api.transcribe(audioBuffer, 'audio/wav')
      } catch (err) {
        addMessage({ id: userMsgId, role: 'user', content: 'Transcription failed', isError: true })
        return
      }

      if (!transcript.trim()) return

      addMessage({ id: userMsgId, role: 'user', content: transcript })
      conversationRef.current = [
        ...conversationRef.current,
        { role: 'user' as const, content: transcript },
      ].slice(-(settings.conversationWindowSize * 2))

      const assistantMsgId = crypto.randomUUID()
      addMessage({ id: assistantMsgId, role: 'assistant', content: '', isStreaming: true })

      let fullResponse = ''
      const removeListener = window.api.onLLMToken((token) => {
        fullResponse += token
        updateLastAssistantMessage(token)
      })

      try {
        await window.api.chat(conversationRef.current)
      } catch (err) {
        updateLastAssistantMessage('', true)
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (!last || last.role !== 'assistant') return prev
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: `Error: ${(err as Error).message}`,
              isError: true,
              isStreaming: false,
            },
          ]
        })
        removeListener()
        return
      }

      removeListener()
      updateLastAssistantMessage('', true)

      if (fullResponse.trim()) {
        conversationRef.current = [
          ...conversationRef.current,
          { role: 'assistant' as const, content: fullResponse },
        ].slice(-(settings.conversationWindowSize * 2))

        setIsPlaying(true)
        try {
          await window.api.speak(fullResponse)
        } catch {
          // TTS failure is silent — text already shown
        }
        setIsPlaying(false)
      }
    },
    [isPlaying, settings.conversationWindowSize, addMessage, updateLastAssistantMessage]
  )

  const { status } = useVAD({
    isPlaying,
    onAudioReady: handleAudioReady,
    onError: (err) => console.error('VAD error:', err),
  })

  async function handleSaveSettings(newSettings: AppSettings) {
    await window.api.saveSettings(newSettings)
    setSettings(newSettings)
    setSettingsOpen(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15 }}>AI Chatbot</span>
        <button
          onClick={() => setSettingsOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
          aria-label="Settings"
        >
          ⚙
        </button>
      </div>

      <ChatHistory messages={messages} />
      <StatusBar status={status} isPlaying={isPlaying} />

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
