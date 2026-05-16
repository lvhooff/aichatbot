import { useState } from 'react'
import type { AppSettings } from '../../main/settings'

interface Props {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  onClose: () => void
}

export function SettingsPanel({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<AppSettings>(structuredClone(settings))

  function set<K extends 'llm' | 'stt' | 'tts'>(section: K, updates: Partial<AppSettings[K]>) {
    setDraft((prev) => ({ ...prev, [section]: { ...prev[section], ...updates } }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 360, maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Settings</h2>

        <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 600 }}>LLM</legend>
          <label htmlFor="llm-provider" style={{ fontSize: 13 }}>LLM Provider</label>
          <select id="llm-provider" value={draft.llm.provider} onChange={(e) => set('llm', { provider: e.target.value as AppSettings['llm']['provider'] })}>
            <option value="claude">Claude (Anthropic)</option>
            <option value="openai">OpenAI GPT</option>
            <option value="openrouter">OpenRouter</option>
            <option value="ollama">Ollama (local)</option>
          </select>
          <label htmlFor="llm-model" style={{ fontSize: 13 }}>Model</label>
          <input id="llm-model" value={draft.llm.model} onChange={(e) => set('llm', { model: e.target.value })} placeholder={draft.llm.provider === 'openrouter' ? 'e.g. anthropic/claude-opus-4' : 'e.g. claude-sonnet-4-6'} />
          {draft.llm.provider !== 'ollama' && (
            <>
              <label htmlFor="llm-key" style={{ fontSize: 13 }}>API Key</label>
              <input id="llm-key" type="password" value={draft.llm.apiKey} onChange={(e) => set('llm', { apiKey: e.target.value })} placeholder="sk-..." />
            </>
          )}
          {draft.llm.provider === 'ollama' && (
            <>
              <label htmlFor="ollama-url" style={{ fontSize: 13 }}>Ollama Base URL</label>
              <input id="ollama-url" value={draft.llm.baseUrl ?? ''} onChange={(e) => set('llm', { baseUrl: e.target.value })} placeholder="http://localhost:11434" />
            </>
          )}
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 600 }}>Speech-to-Text</legend>
          <label htmlFor="stt-provider" style={{ fontSize: 13 }}>STT Provider</label>
          <select id="stt-provider" value={draft.stt.provider} onChange={(e) => set('stt', { provider: e.target.value as AppSettings['stt']['provider'] })}>
            <option value="whisper-api">OpenAI Whisper API</option>
            <option value="macos">macOS (not yet implemented)</option>
          </select>
          {draft.stt.provider === 'whisper-api' && (
            <>
              <label htmlFor="stt-key" style={{ fontSize: 13 }}>OpenAI API Key</label>
              <input id="stt-key" type="password" value={draft.stt.apiKey} onChange={(e) => set('stt', { apiKey: e.target.value })} placeholder="sk-..." />
            </>
          )}
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 600 }}>Text-to-Speech</legend>
          <label htmlFor="tts-provider" style={{ fontSize: 13 }}>TTS Provider</label>
          <select id="tts-provider" value={draft.tts.provider} onChange={(e) => set('tts', { provider: e.target.value as AppSettings['tts']['provider'] })}>
            <option value="macos-say">macOS say (free)</option>
            <option value="openai-tts">OpenAI TTS</option>
          </select>
          {draft.tts.provider === 'openai-tts' && (
            <>
              <label htmlFor="tts-key" style={{ fontSize: 13 }}>OpenAI API Key</label>
              <input id="tts-key" type="password" value={draft.tts.apiKey} onChange={(e) => set('tts', { apiKey: e.target.value })} placeholder="sk-..." />
              <label htmlFor="tts-voice" style={{ fontSize: 13 }}>Voice</label>
              <select id="tts-voice" value={draft.tts.voice ?? 'alloy'} onChange={(e) => set('tts', { voice: e.target.value })}>
                <option value="alloy">Alloy</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
                <option value="shimmer">Shimmer</option>
              </select>
            </>
          )}
        </fieldset>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="window-size" style={{ fontSize: 13 }}>Conversation Window (turns)</label>
          <input
            id="window-size"
            type="number"
            min={1}
            max={50}
            value={draft.conversationWindowSize}
            onChange={(e) => setDraft((prev) => ({ ...prev, conversationWindowSize: Number(e.target.value) }))}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(draft)} style={{ padding: '8px 16px', borderRadius: 6, background: '#0070f3', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
        </div>
      </div>
    </div>
  )
}
