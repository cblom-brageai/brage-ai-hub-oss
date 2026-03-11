import { NextRequest, NextResponse } from 'next/server'

// Allow up to 120s for agent responses (first call builds the agent)
export const maxDuration = 120

// Employee agents are addressed by ID — default maps to marketing-manager
const AGENT_URLS: Record<string, string> = {
  'marketing-manager': process.env.MARKETING_MANAGER_URL || 'http://localhost:8001',
}

function agentUrl(employee_id: string): string {
  return AGENT_URLS[employee_id] ?? process.env.DEFAULT_AGENT_URL ?? 'http://localhost:8001'
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
