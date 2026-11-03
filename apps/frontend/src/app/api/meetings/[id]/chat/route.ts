import { NextRequest, NextResponse } from 'next/server'

const MEETING_AGENT_URL = process.env.MEETING_AGENT_URL || 'http://localhost:8010'

/**
 * Receives a chat message typed in the extension and forwards it to the
 * meeting-agent Q&A agent. The answer will appear via Supabase Realtime
 * on the meeting_qa_pairs table.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const body = await req.json()
    const res = await fetch(`${MEETING_AGENT_URL}/meetings/${params.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: body.message }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
