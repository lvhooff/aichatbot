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
import { SpeechQueue } from '../utils/speech-queue'
import { buildSteerMessages, joinContinuation, type SteerPivot } from '../utils/steering'

// How much of a steered continuation to buffer before showing it, so a word the
// model restates from the sentence it was cut off in can be stripped once rather
// than flashing on screen. Matches the window stripOverlap() examines.
const LEAD_IN_CHARS = 120

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

  // Held while a reply is in flight so the composer can redirect it. See
  // utils/steering.ts for what "steering" means here.
  const steerRef = useRef<((nudge: string) => void) | null>(null)

  // Shared by the voice and text paths: run a user message through the LLM and,
  // if TTS is enabled, speak the reply sentence-by-sentence as tokens arrive.
  // With TTS set to "none", nothing is queued and the reply is simply displayed.
  //
  // A reply can also be *steered* while it is still in flight: the stream is
  // abandoned, the reply is rewound to the point the user actually received, and
  // a fresh stream continues the very same message under the new instruction.
  // Each pass of the loop below is one such leg — the first pass is the original
  // question, every later pass a continuation. See utils/steering.ts.
  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || busy) return
      setBusy(true)

      const speaks = settings.tts.provider !== 'none'
      const windowLimit = settings.conversationWindowSize * 2

      addMessage({ id: crypto.randomUUID(), role: 'user', content })
      const historyWithQuestion = [
        ...conversationRef.current,
        { role: 'user' as const, content }
      ].slice(-windowLimit)
      conversationRef.current = historyWithQuestion

      const replyId = crypto.randomUUID()
      addMessage({ id: replyId, role: 'assistant', content: '', isStreaming: true })

      const queue = new SpeechQueue((sentence) => window.api.speak(sentence))
      // Text the user has already received on earlier legs, kept across steers.
      let delivered = ''
      const pivots: SteerPivot[] = []
      let pendingSteer: string | null = null
      let failure: string | null = null

      const paint = (body: string, extra?: Partial<ChatMessage>): void =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyId ? { ...m, content: body, steers: [...pivots], ...extra } : m
          )
        )

      // Lets the turn wait for a steer that may arrive after generating has
      // finished but while the voice is still working through the backlog.
      let notifySteer: (() => void) | null = null
      const steerArrived = (): Promise<void> =>
        new Promise<void>((resolve) => {
          notifySteer = resolve
        })

      steerRef.current = (nudge: string) => {
        if (pendingSteer) return
        pendingSteer = nudge
        notifySteer?.()
        // Drop the queued lookahead, silence the sentence mid-flight, and stop
        // paying for a generation whose replacement is about to start.
        queue.cancel()
        void window.api.stopSpeaking().catch(() => {})
        void window.api.cancelLLM().catch(() => {})
      }
      // The Stop button only silences playback; generation is left to finish.
      ttsCancelRef.current = () => queue.cancel()

      let messagesForCall: Message[] = historyWithQuestion

      try {
        for (;;) {
          let segment = ''
          let tokenBuffer = ''
          let queuedUpTo = delivered.length
          // A continuation tends to restate the last words of the sentence it was
          // cut off in, so its head is held back just long enough to strip that
          // overlap once — rather than letting a duplicated word show up on
          // screen and get spoken. The opening leg has nothing to overlap with.
          let leadIn = ''
          let leadSettled = delivered.length === 0

          const commit = (chunk: string): void => {
            if (!chunk) return
            segment += chunk
            const full = delivered + segment
            paint(full)
            if (!speaks) return
            tokenBuffer += chunk
            const { sentences, remainder } = extractCompleteSentences(tokenBuffer)
            tokenBuffer = remainder
            if (sentences.length > 0) setIsPlaying(true)
            for (const sentence of sentences) {
              const at = full.indexOf(sentence, queuedUpTo)
              if (at >= 0) queuedUpTo = at + sentence.length
              queue.push(sentence, queuedUpTo)
            }
          }

          // Release the held-back head of a continuation, overlap stripped.
          const settleLeadIn = (): void => {
            if (leadSettled) return
            leadSettled = true
            const joined = joinContinuation(delivered, leadIn)
            leadIn = ''
            commit(joined.slice(delivered.length))
          }

          const removeListener = window.api.onLLMToken((token) => {
            if (pendingSteer) return
            if (leadSettled) {
              commit(token)
              return
            }
            leadIn += token
            if (leadIn.length >= LEAD_IN_CHARS) settleLeadIn()
          })

          try {
            await window.api.chat(messagesForCall)
          } catch (err) {
            // Our own steer aborts the stream, so a rejection is only a real
            // failure when no steer is waiting to take over.
            if (!pendingSteer) failure = (err as Error).message
          } finally {
            removeListener()
          }
          if (failure) break

          if (!pendingSteer) {
            // Generating is done. Flush whatever never reached a sentence boundary
            // (a reply that ends without punctuation) as the last chunk.
            settleLeadIn()
            const trailing = tokenBuffer.trim()
            if (speaks && trailing) {
              setIsPlaying(true)
              queue.push(trailing, (delivered + segment).length)
            }
            // Done generating is not done talking: the voice is usually minutes
            // behind a reply that streamed in seconds, and that gap is exactly when
            // a listener wants to cut in. Stay open to a steer until the voice
            // actually catches up.
            if (speaks && !queue.idle) await Promise.race([queue.idleWait(), steerArrived()])
            if (!pendingSteer) {
              delivered += segment
              break
            }
          }

          const nudge = pendingSteer
          pendingSteer = null
          const full = delivered + segment
          // Rewind to what the user actually got. While speaking, generation runs
          // ahead of the voice, so everything past the last fully spoken sentence
          // was never heard — it is retracted and re-generated in the new
          // direction. On screen there is no such gap: every token has been read.
          delivered = speaks ? full.slice(0, queue.mark) : full
          pivots.push({ at: delivered.length, nudge })
          paint(delivered)
          queue.resume()
          messagesForCall = buildSteerMessages(historyWithQuestion, delivered, nudge)
        }

        // Let the voice catch up with the text before the turn is declared over.
        if (speaks) await queue.idleWait()

        if (failure) {
          paint(delivered ? `${delivered}\n\nError: ${failure}` : `Error: ${failure}`, {
            isStreaming: false,
            isError: true
          })
        } else {
          paint(delivered, { isStreaming: false })
        }

        // Record the assistant turn so context stays role-alternating — Claude
        // rejects a history where a user message has no paired reply. The steers
        // are deliberately not turns of their own: the model is told only what it
        // ended up saying. If nothing at all was delivered, the unpaired question
        // is dropped instead.
        conversationRef.current = delivered
          ? [...historyWithQuestion, { role: 'assistant' as const, content: delivered }].slice(
              -windowLimit
            )
          : historyWithQuestion.slice(0, -1)
      } finally {
        setBusy(false)
        setIsPlaying(false)
        steerRef.current = null
        ttsCancelRef.current = null
        if (queue.errored) setNotice('Voice playback failed — check your Text-to-Speech settings.')
      }
    },
    [busy, settings.conversationWindowSize, settings.tts.provider, addMessage]
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

  const handleSteer = useCallback((nudge: string) => {
    steerRef.current?.(nudge)
  }, [])

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
          steering={busy}
          onSteer={handleSteer}
        />
      ) : (
        <>
          {/* Voice mode pauses the mic while the reply plays, so a steer is typed.
              VoiceInput stays mounted either way — unmounting it releases the mic. */}
          {busy && <TextInput onSubmit={sendMessage} disabled steering onSteer={handleSteer} />}
          <VoiceInput
            isPlaying={isPlaying}
            sensitivity={settings.vadSensitivity}
            onAudioReady={handleAudioReady}
            onStopSpeaking={handleStopSpeaking}
          />
        </>
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
