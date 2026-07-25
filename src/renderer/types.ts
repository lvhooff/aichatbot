import type { SteerPivot } from './utils/steering'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  isError?: boolean
  /** Points where the user redirected this reply while it was still in flight. */
  steers?: SteerPivot[]
}
