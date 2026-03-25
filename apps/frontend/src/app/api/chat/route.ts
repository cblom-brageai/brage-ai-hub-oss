import { NextRequest, NextResponse } from 'next/server'

// Allow up to 120s for agent responses (first call builds the agent)
export const maxDuration = 120

// Resolve employee agent URL dynamically from env (e.g. quality-manager → QUALITY_MANAGER_URL)
// Falls back to Docker service naming convention: http://employee-{id}:8000
function agentUrl(employee_id: string): string {
  const envKey = employee_id.toUpperCase().replace(/-/g, '_') + '_URL'
  return process.env[envKey] ?? `http://employee-${employee_id}:8000`
}

export async function POST(req: NextRequest) {
  const { employee_id, message } = await req.json()

  try {
    const res = await fetch(`${agentUrl(employee_id)}/chat/${employee_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(115_000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ response: 'Agent unavailable.' }, { status: 503 })
  }
}
