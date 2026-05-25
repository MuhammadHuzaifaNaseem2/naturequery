/**
 * Unified AI client with automatic Groq → Cerebras fallback.
 *
 * Groq is primary (fast, cheap when available).
 * Cerebras is fallback (kicks in when all Groq keys are rate-limited).
 *
 * Both providers support the same Llama models and use OpenAI-compatible APIs,
 * so callers get the same response shape regardless of which provider served the request.
 */

import { withKeyRotation, isRateLimitError } from './groq-keys'

type ChatRole = 'system' | 'user' | 'assistant'
export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ChatCompletionArgs {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
}

interface ChatCompletionChoice {
  message: { role: string; content: string | null }
  finish_reason?: string | null
}

export interface ChatCompletionResponse {
  choices: ChatCompletionChoice[]
}

interface StreamChunkChoice {
  delta: { content?: string }
  finish_reason?: string | null
}

export interface ChatCompletionChunk {
  choices: StreamChunkChoice[]
}

// Groq model names → Cerebras model names. Cerebras uses slightly different ids.
const MODEL_MAP: Record<string, string> = {
  'llama-3.1-8b-instant': 'llama3.1-8b',
  'llama-3.3-70b-versatile': 'llama-3.3-70b',
}

function cerebrasModel(groqModel: string): string {
  return MODEL_MAP[groqModel] ?? groqModel
}

function cerebrasEnabled(): boolean {
  return Boolean(process.env.CEREBRAS_API_KEY)
}

// ---------------------------------------------------------------------------
// Cerebras: non-streaming
// ---------------------------------------------------------------------------

async function cerebrasChatCompletion(args: ChatCompletionArgs): Promise<ChatCompletionResponse> {
  const apiKey = process.env.CEREBRAS_API_KEY
  if (!apiKey) throw new Error('CEREBRAS_API_KEY not configured')

  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cerebrasModel(args.model),
      messages: args.messages,
      max_tokens: args.max_tokens,
      temperature: args.temperature,
      top_p: args.top_p,
      stream: false,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Cerebras API error: ${res.status} ${body.slice(0, 500)}`)
  }

  return (await res.json()) as ChatCompletionResponse
}

// ---------------------------------------------------------------------------
// Cerebras: streaming via SSE parsed into an async iterable
// ---------------------------------------------------------------------------

async function* cerebrasStreamChatCompletion(
  args: ChatCompletionArgs
): AsyncGenerator<ChatCompletionChunk, void, unknown> {
  const apiKey = process.env.CEREBRAS_API_KEY
  if (!apiKey) throw new Error('CEREBRAS_API_KEY not configured')

  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cerebrasModel(args.model),
      messages: args.messages,
      max_tokens: args.max_tokens,
      temperature: args.temperature,
      top_p: args.top_p,
      stream: true,
    }),
  })

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '')
    throw new Error(`Cerebras stream error: ${res.status} ${body.slice(0, 500)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by blank lines
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)

      // Each frame may contain multiple "data: ..." lines
      for (const rawLine of frame.split('\n')) {
        const line = rawLine.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          yield JSON.parse(payload) as ChatCompletionChunk
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API: non-streaming chat completion with automatic fallback
// ---------------------------------------------------------------------------

export async function aiChatCompletion(args: ChatCompletionArgs): Promise<ChatCompletionResponse> {
  try {
    return await withKeyRotation(async (groq) => {
      const res = await groq.chat.completions.create({
        model: args.model,
        messages: args.messages,
        max_tokens: args.max_tokens,
        temperature: args.temperature,
        top_p: args.top_p,
        stream: false,
      })
      return res as unknown as ChatCompletionResponse
    })
  } catch (err) {
    if (isRateLimitError(err) && cerebrasEnabled()) {
      console.log('[AI] Groq exhausted, falling back to Cerebras (non-streaming)')
      return await cerebrasChatCompletion(args)
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Public API: streaming chat completion with automatic fallback
// ---------------------------------------------------------------------------

export async function aiChatCompletionStream(
  args: ChatCompletionArgs
): Promise<AsyncIterable<ChatCompletionChunk>> {
  try {
    return await withKeyRotation(async (groq) => {
      const stream = await groq.chat.completions.create({
        model: args.model,
        messages: args.messages,
        max_tokens: args.max_tokens,
        temperature: args.temperature,
        top_p: args.top_p,
        stream: true,
      })
      return stream as unknown as AsyncIterable<ChatCompletionChunk>
    })
  } catch (err) {
    if (isRateLimitError(err) && cerebrasEnabled()) {
      console.log('[AI] Groq exhausted, falling back to Cerebras (streaming)')
      return cerebrasStreamChatCompletion(args)
    }
    throw err
  }
}
