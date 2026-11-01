import { NextRequest, NextResponse } from 'next/server'

// Allow up to 120s for agent responses (first call builds the agent)
export const maxDuration = 120

// Resolve employee agent URL dynamically from env (e.g. quality-manager → QUALITY_MANAGER_URL)
// Falls back to Docker service naming convention: http://employee-{id}:8000
function agentUrl(employee_id: string): string {
  const envKey = employee_id.toUpperCase().replace(/-/g, '_') + '_URL'
  return process.env[envKey] ?? `http://employee-${employee_id}:8000`
}

/**
 * Chat with an employee agent.
 *
 * Body: { employee_id, message, thread_id? }            — send a message on a thread
 *       { employee_id, resume: true, thread_id, approved?, feedback? } — answer a pending approval gate
 *
 * The agent returns { response, thread_id, pending_approval, interrupt? }. Reuse thread_id to keep
 * the conversation; when pending_approval is true, call again with resume: true.
 */
export async function POST(req: NextRequest) {
  const { employee_id, message, thread_id, resume, approved, feedback } = await req.json()
  const base = agentUrl(employee_id)
  const url = resume ? `${base}/resume/${employee_id}` : `${base}/chat/${employee_id}`
  const body = resume
    ? { thread_id, approved: approved ?? true, feedback: feedback ?? '' }
    : { message, thread_id }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(115_000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ response: 'Agent unavailable.', pending_approval: false, thread_id }, { status: 503 })
  }
}
