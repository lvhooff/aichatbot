import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatHistory } from '../components/ChatHistory'
import { VoiceInput } from '../components/VoiceInput'
import { TextInput } from '../components/TextInput'
import { SettingsPanel } from '../components/SettingsPanel'
import type { ChatMessage } from '../types'
import { DEFAULT_SETTINGS } from '../../main/settings-defaults'
import type { AppSettings } from '../../main/settings'
import type { Message } from '../../main/providers/llm/interface'
import { extractCompleteSentences } from '../utils/sentences'

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [notice, setNotice] = useState<string | null>(null)
  const conversationRef = useRef<Message[]>([])
  // Set while a reply is streaming/speaking so the Stop button can cancel the
  // in-flight sentence queue, not just kill the currently-playing sentence.
  const ttsCancelRef = useRef<(() => void) | null>(null)

  // Auto-dismiss transient notices (e.g. TTS playback failures).
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

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
      return [...prev.slice(0, -1), { ...last, content: last.content + token, isStreaming: !done }]
    })
  }, [])

  // Shared by the voice and text paths: run a user message through the LLM and,
  // if TTS is enabled, speak the reply sentence-by-sentence as tokens arrive.
  // With TTS set to "none", speak() is a no-op so the reply is simply displayed.
  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || busy) return
      setBusy(true)
      try {
        addMessage({ id: crypto.randomUUID(), role: 'user', content })
        conversationRef.current = [
          ...conversationRef.current,
          { role: 'user' as const, content }
        ].slice(-(settings.conversationWindowSize * 2))

        addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', isStreaming: true })

        let fullResponse = ''

        // --- Sentence-streaming TTS queue ---
        // Sentences are pushed here as they complete; the drain loop speaks
        // them one at a time so playback is continuous with no gap.
        const sentenceQueue: string[] = []
        let ttsActive = false
        let ttsError = false
        // Use an object so TypeScript doesn't narrow resolve to never
        // when it's assigned inside the Promise constructor callback.
        const queueDoneRef: { resolve: (() => void) | null } = { resolve: null }
        const queueDone = new Promise<void>((res) => {
          queueDoneRef.resolve = res
        })

        let llmDone = false
        let tokenBuffer = ''
        // Flipped by the Stop button. Once set, no further sentences are queued
        // or spoken — without this the queue would keep spawning the next
        // sentence right after Stop killed the current one.
        let cancelled = false

        const drainQueue = async (): Promise<void> => {
          // Already draining or nothing to do — the loop below handles both.
          if (ttsActive) return
          ttsActive = true
          while (!cancelled && sentenceQueue.length > 0) {
            const sentence = sentenceQueue.shift()!
            try {
              await window.api.speak(sentence)
            } catch {
              ttsError = true
              // Keep draining so mic isn't left paused, but flag the error.
            }
          }
          ttsActive = false
          // Resolve only when LLM is also done (llmDone flag checked externally).
          if (llmDone) {
            queueDoneRef.resolve?.()
          }
        }
        let firstSentenceQueued = false

        // Wait for any in-flight/queued TTS to finish, then clear the playing
        // state. Call once the LLM has finished or errored. If nothing was ever
        // spoken, or the drain loop already drained the queue, this resolves
        // queueDone itself so the await below can't hang.
        const settlePlayback = async (): Promise<void> => {
          if (!firstSentenceQueued) {
            queueDoneRef.resolve?.()
            return
          }
          if (!ttsActive && sentenceQueue.length === 0) {
            queueDoneRef.resolve?.()
          }
          await queueDone
          setIsPlaying(false)
        }

        // Exposed to the Stop button: drop everything still queued and stop
        // draining. The currently-playing sentence is killed separately via
        // window.api.stopSpeaking() in handleStopSpeaking.
        ttsCancelRef.current = () => {
          cancelled = true
          sentenceQueue.length = 0
        }

        const removeListener = window.api.onLLMToken((token) => {
          fullResponse += token
          tokenBuffer += token
          updateLastAssistantMessage(token)

          // Once the user hits Stop we keep displaying text but stop speaking.
          if (cancelled) return

          // Extract any complete sentences from the buffer and queue them.
          const { sentences, remainder } = extractCompleteSentences(tokenBuffer)
          tokenBuffer = remainder
          for (const sentence of sentences) {
            if (!firstSentenceQueued) {
              setIsPlaying(true)
              firstSentenceQueued = true
            }
            sentenceQueue.push(sentence)
            drainQueue()
          }
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
                isStreaming: false
              }
            ]
          })
          removeListener()
          llmDone = true
          // A mid-stream error can land after TTS already started; let any
          // in-flight speech drain and clear the playing state before bailing.
          await settlePlayback()
          return
        }

        removeListener()
        updateLastAssistantMessage('', true)
        llmDone = true

        // Always record the assistant turn so the conversation context stays
        // role-alternating — Claude rejects histories where a user message has
        // no paired assistant reply.
        conversationRef.current = [
          ...conversationRef.current,
          { role: 'assistant' as const, content: fullResponse }
        ].slice(-(settings.conversationWindowSize * 2))

        // Flush any remaining partial sentence (e.g. a response that doesn't
        // end with punctuation) as the final TTS chunk — unless the user stopped.
        const trailing = cancelled ? '' : tokenBuffer.trim()
        if (trailing) {
          if (!firstSentenceQueued) {
            setIsPlaying(true)
            firstSentenceQueued = true
          }
          sentenceQueue.push(trailing)
          drainQueue()
        }

        await settlePlayback()
        if (ttsError) {
          setNotice('Voice playback failed — check your Text-to-Speech settings.')
        }
      } finally {
        setBusy(false)
        ttsCancelRef.current = null
      }
    },
    [busy, settings.conversationWindowSize, addMessage, updateLastAssistantMessage]
  )

  const handleAudioReady = useCallback(
    async (audioBuffer: ArrayBuffer) => {
      let transcript = ''
      try {
        transcript = await window.api.transcribe(audioBuffer, 'audio/wav')
      } catch (err) {
        const detail = (err as Error)?.message?.replace(
          /^Error invoking remote method '[^']*':\s*/,
          ''
        )
        addMessage({
          id: crypto.randomUUID(),
          role: 'user',
          content: detail ? `Transcription failed — ${detail}` : 'Transcription failed',
          isError: true
        })
        return
      }

      await sendMessage(transcript)
    },
    [sendMessage, addMessage]
  )

  const handleStopSpeaking = useCallback(async () => {
    // Clear the renderer-side sentence queue first so draining stops, then kill
    // the sentence that's playing right now in the main process.
    ttsCancelRef.current?.()
    try {
      await window.api.stopSpeaking()
    } catch {
      // ignore
    }
    setIsPlaying(false)
  }, [])

  async function handleSaveSettings(newSettings: AppSettings) {
    await window.api.saveSettings(newSettings)
    setSettings(newSettings)
    setSettingsOpen(false)
  }

  const handleNewChat = useCallback(() => {
    setMessages([])
    conversationRef.current = []
  }, [])

  const headerButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 6,
    fontSize: 15,
    lineHeight: 1,
    padding: '6px 9px',
    color: '#bbb'
  } as const

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', flexShrink: 0 }}>
            AI Chatbot
          </span>
          <span
            title={`${settings.llm.provider} · ${settings.llm.model}`}
            style={{
              fontSize: 11,
              color: '#888',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              padding: '1px 8px',
              maxWidth: 220,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {settings.llm.model}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleNewChat}
            disabled={messages.length === 0}
            style={{
              ...headerButtonStyle,
              cursor: messages.length === 0 ? 'default' : 'pointer',
              opacity: messages.length === 0 ? 0.4 : 1
            }}
            aria-label="New chat"
            title="New chat"
          >
            ＋
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{ ...headerButtonStyle, cursor: 'pointer' }}
            aria-label="Settings"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      <ChatHistory messages={messages} textMode={textMode} />
      {notice && (
        <div
          role="status"
          onClick={() => setNotice(null)}
          style={{
            margin: '0 16px 8px',
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(229,62,62,0.15)',
            border: '1px solid rgba(229,62,62,0.4)',
            color: '#ffb4b4',
            fontSize: 13,
            cursor: 'pointer'
          }}
          title="Dismiss"
        >
          {notice}
        </div>
      )}
      {textMode ? (
        <TextInput
          onSubmit={sendMessage}
          disabled={busy}
          isPlaying={isPlaying}
          onStopSpeaking={handleStopSpeaking}
        />
      ) : (
        <VoiceInput
          isPlaying={isPlaying}
          sensitivity={settings.vadSensitivity}
          onAudioReady={handleAudioReady}
          onStopSpeaking={handleStopSpeaking}
        />
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
