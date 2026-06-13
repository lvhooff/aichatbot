import OpenAI from 'openai'
import { OpenAIAdapter } from './openai'

// OpenRouter speaks the OpenAI wire protocol, so it reuses the OpenAI adapter's
// streaming/chat logic and only swaps in its own client (custom baseURL + key,
// with an OPENROUTER_API_KEY env fallback).
export class OpenRouterAdapter extends OpenAIAdapter {
  protected createClient(): OpenAI {
    const key = this.apiKey || process.env['OPENROUTER_API_KEY'] || ''
    if (!key)
      throw new Error('OpenRouter API key not configured — open Settings or set OPENROUTER_API_KEY')
    return new OpenAI({ apiKey: key, baseURL: 'https://openrouter.ai/api/v1' })
  }
}
