import { useEffect, useState } from 'react'
import type { AppSettings } from '../../main/settings'

type LLMProvider = AppSettings['llm']['provider']

// Suggested models per provider. The dropdown also allows a custom value, so
// these are convenient starting points rather than an exhaustive list.
const LLM_MODEL_PRESETS: Record<LLMProvider, string[]> = {
  claude: [
    'claude-opus-4-8',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-5',
    'claude-opus-4-1-20250805'
  ],
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
  openrouter: [
    'anthropic/claude-sonnet-4.6',
    'anthropic/claude-opus-4.8',
    'openai/gpt-5',
    'google/gemini-2.5-pro',
    'meta-llama/llama-3.3-70b-instruct'
  ],
  ollama: ['llama3.2', 'llama3.1', 'qwen2.5', 'gemma3', 'mistral'],
  'ollama-cloud': [
    'gpt-oss:120b',
    'gpt-oss:20b',
    'qwen3-coder-next:cloud',
    'deepseek-v4-pro:cloud',
    'kimi-k2.6:cloud',
    'glm-5.1:cloud',
    'minimax-m3:cloud'
  ]
}

// Ollama Cloud gates its larger flagship models behind a paid subscription; the
// request still resolves but returns "this model requires a subscription". We
// flag these so the dropdown can warn before the user picks one. gpt-oss models
// are available on the free tier.
const SUBSCRIPTION_MODELS = new Set<string>([
  'deepseek-v4-pro:cloud',
  'kimi-k2.6:cloud',
  'glm-5.1:cloud',
  'minimax-m3:cloud',
  'qwen3-coder-next:cloud'
])

const CUSTOM_MODEL = '__custom__'

// Password input with a reveal toggle so a pasted API key can be verified.
function SecretInput({
  id,
  value,
  onChange,
  placeholder
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, paddingRight: 52 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide API key' : 'Show API key'}
        style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          color: '#0070f3'
        }}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

interface Props {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  onClose: () => void
}

export function SettingsPanel({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<AppSettings>(structuredClone(settings))

  // Close on Escape, matching standard modal behaviour.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function set<K extends 'llm' | 'stt' | 'tts'>(section: K, updates: Partial<AppSettings[K]>) {
    setDraft((prev) => ({ ...prev, [section]: { ...prev[section], ...updates } }))
  }

  const modelPresets = LLM_MODEL_PRESETS[draft.llm.provider]
  const modelIsCustom = !modelPresets.includes(draft.llm.model)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          color: '#1b1b1f',
          borderRadius: 12,
          padding: 24,
          width: 360,
          maxHeight: '80vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Settings</h2>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#333' }}>LLM</p>
          <label htmlFor="llm-provider" style={{ fontSize: 13 }}>
            LLM Provider
          </label>
          <select
            id="llm-provider"
            value={draft.llm.provider}
            onChange={(e) => {
              const provider = e.target.value as LLMProvider
              // Reset the model to a valid default for the new provider.
              set('llm', { provider, model: LLM_MODEL_PRESETS[provider][0] })
            }}
          >
            <option value="claude">Claude (Anthropic)</option>
            <option value="openai">OpenAI GPT</option>
            <option value="openrouter">OpenRouter</option>
            <option value="ollama">Ollama (local)</option>
            <option value="ollama-cloud">Ollama (cloud)</option>
          </select>

          <label htmlFor="llm-model" style={{ fontSize: 13 }}>
            Model
          </label>
          <select
            id="llm-model"
            value={modelIsCustom ? CUSTOM_MODEL : draft.llm.model}
            onChange={(e) =>
              set('llm', { model: e.target.value === CUSTOM_MODEL ? '' : e.target.value })
            }
          >
            {modelPresets.map((m) => (
              <option key={m} value={m}>
                {SUBSCRIPTION_MODELS.has(m) ? `${m} — subscription` : m}
              </option>
            ))}
            <option value={CUSTOM_MODEL}>Custom…</option>
          </select>
          {modelIsCustom && (
            <input
              id="llm-model-custom"
              value={draft.llm.model}
              onChange={(e) => set('llm', { model: e.target.value })}
              placeholder={
                draft.llm.provider === 'openrouter'
                  ? 'e.g. anthropic/claude-opus-4.8'
                  : 'e.g. model name'
              }
              autoFocus
            />
          )}

          {draft.llm.provider !== 'ollama' && (
            <>
              <label htmlFor="llm-key" style={{ fontSize: 13 }}>
                API Key
              </label>
              <SecretInput
                id="llm-key"
                value={draft.llm.apiKey}
                onChange={(apiKey) => set('llm', { apiKey })}
                placeholder={
                  draft.llm.provider === 'ollama-cloud' ? 'Ollama Cloud API key' : 'sk-...'
                }
              />
            </>
          )}
          {draft.llm.provider === 'ollama' && (
            <>
              <label htmlFor="ollama-url" style={{ fontSize: 13 }}>
                Ollama Base URL
              </label>
              <input
                id="ollama-url"
                value={draft.llm.baseUrl ?? ''}
                onChange={(e) => set('llm', { baseUrl: e.target.value })}
                placeholder="http://localhost:11434"
              />
            </>
          )}
        </div>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#333' }}>Speech-to-Text</p>
          <label htmlFor="stt-provider" style={{ fontSize: 13 }}>
            STT Provider
          </label>
          <select
            id="stt-provider"
            value={draft.stt.provider}
            onChange={(e) =>
              set('stt', { provider: e.target.value as AppSettings['stt']['provider'] })
            }
          >
            <option value="whisper-api">OpenAI Whisper API</option>
            <option value="macos">macOS (on-device, free)</option>
            <option value="none">None (type messages)</option>
          </select>
          {draft.stt.provider === 'whisper-api' && (
            <>
              <label htmlFor="stt-key" style={{ fontSize: 13 }}>
                OpenAI API Key
              </label>
              <SecretInput
                id="stt-key"
                value={draft.stt.apiKey}
                onChange={(apiKey) => set('stt', { apiKey })}
                placeholder="sk-..."
              />
            </>
          )}
        </div>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#333' }}>Text-to-Speech</p>
          <label htmlFor="tts-provider" style={{ fontSize: 13 }}>
            TTS Provider
          </label>
          <select
            id="tts-provider"
            value={draft.tts.provider}
            onChange={(e) =>
              set('tts', { provider: e.target.value as AppSettings['tts']['provider'] })
            }
          >
            <option value="macos-say">macOS say (free)</option>
            <option value="openai-tts">OpenAI TTS</option>
            <option value="none">None (text only)</option>
          </select>
          {draft.tts.provider === 'openai-tts' && (
            <>
              <label htmlFor="tts-key" style={{ fontSize: 13 }}>
                OpenAI API Key
              </label>
              <SecretInput
                id="tts-key"
                value={draft.tts.apiKey}
                onChange={(apiKey) => set('tts', { apiKey })}
                placeholder="sk-..."
              />
              <label htmlFor="tts-voice" style={{ fontSize: 13 }}>
                Voice
              </label>
              <select
                id="tts-voice"
                value={draft.tts.voice ?? 'alloy'}
                onChange={(e) => set('tts', { voice: e.target.value })}
              >
                <option value="alloy">Alloy</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
                <option value="shimmer">Shimmer</option>
              </select>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="window-size" style={{ fontSize: 13 }}>
            Conversation Window (turns)
          </label>
          <input
            id="window-size"
            type="number"
            min={1}
            max={50}
            value={draft.conversationWindowSize}
            onChange={(e) => {
              const n = Number(e.target.value)
              // Keep the previous value while the field is empty/invalid mid-edit;
              // onBlur clamps to the allowed range.
              setDraft((prev) => ({
                ...prev,
                conversationWindowSize: Number.isFinite(n) ? n : prev.conversationWindowSize
              }))
            }}
            onBlur={(e) => {
              const n = Number(e.target.value)
              const clamped = Number.isFinite(n) ? Math.min(50, Math.max(1, Math.round(n))) : 10
              setDraft((prev) => ({ ...prev, conversationWindowSize: clamped }))
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #ddd',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              background: '#0070f3',
              color: '#fff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
