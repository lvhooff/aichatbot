import type { SteerPivot } from './utils/steering'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  /** A failure unrelated to what the model said, rendered separately from `content`. */
  error?: string
  /** Points where the user redirected this reply while it was still in flight. */
  steers?: SteerPivot[]
}
