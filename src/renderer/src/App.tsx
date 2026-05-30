import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatHistory } from '../components/ChatHistory'
import { VoiceInput } from '../components/VoiceInput'
import { TextInput } from '../components/TextInput'
import { SettingsPanel } from '../components/SettingsPanel'
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
  const [busy, setBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const conversationRef = useRef<Message[]>([])

  const textMode = settings.stt.provider === 'none'

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

  // Shared by the voice and text paths: run a user message through the LLM and,
  // if TTS is enabled, speak the reply. With TTS set to "none", speak() is a
  // no-op so the reply is simply displayed as text.
  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content) return
      setBusy(true)
      try {
        addMessage({ id: crypto.randomUUID(), role: 'user', content })
        conversationRef.current = [
          ...conversationRef.current,
          { role: 'user' as const, content },
        ].slice(-(settings.conversationWindowSize * 2))

        addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', isStreaming: true })

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
      } finally {
        setBusy(false)
      }
    },
    [settings.conversationWindowSize, addMessage, updateLastAssistantMessage]
  )

  const handleAudioReady = useCallback(
    async (audioBuffer: ArrayBuffer) => {
      // Barge-in: if TTS is playing, stop it before transcribing
      if (isPlaying) {
        await window.api.stopSpeaking()
        await window.api.cancelLLM()
        setIsPlaying(false)
      }

      let transcript = ''
      try {
        transcript = await window.api.transcribe(audioBuffer, 'audio/wav')
      } catch (err) {
        const detail = (err as Error)?.message?.replace(/^Error invoking remote method '[^']*':\s*/, '')
        addMessage({
          id: crypto.randomUUID(),
          role: 'user',
          content: detail ? `Transcription failed — ${detail}` : 'Transcription failed',
          isError: true,
        })
        return
      }

      await sendMessage(transcript)
    },
    [isPlaying, sendMessage, addMessage]
  )

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
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'none',
            border: '1px solid #ccc',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            padding: '4px 10px',
            color: '#555',
          }}
          aria-label="Settings"
        >
          ⚙ Settings
        </button>
      </div>

      <ChatHistory messages={messages} />
      {textMode ? (
        <TextInput onSubmit={sendMessage} disabled={busy} />
      ) : (
        <VoiceInput isPlaying={isPlaying} onAudioReady={handleAudioReady} />
      )}

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
