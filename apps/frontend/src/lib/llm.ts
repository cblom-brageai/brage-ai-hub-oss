/**
 * Server-side client for the config-api LLM gateway (POST /llm/generate).
 * Every model call from Next.js routes goes through here so privacy mode and tracing
 * apply uniformly. See apps/config-api/main.py.
 */

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMRequest {
  prompt?: string
  system?: string
  messages?: LLMMessage[]
  role?: 'write' | 'reason'
  model?: string
  json_mode?: boolean
  run_name?: string
  metadata?: Record<string, unknown>
}

export interface LLMResponse {
  text: string
  json?: unknown
}

const CONFIG_API_URL = process.env.CONFIG_API_URL || 'http://localhost:8090'

export async function llmGenerate(req: LLMRequest, timeoutMs = 90_000): Promise<LLMResponse> {
  const res = await fetch(`${CONFIG_API_URL}/llm/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    let detail = `${res.status}`
    try {
      detail = (await res.json()).detail ?? detail
    } catch {}
    throw new Error(`LLM gateway error: ${detail}`)
  }
  return res.json()
}
