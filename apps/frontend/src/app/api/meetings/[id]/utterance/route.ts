import { NextRequest, NextResponse } from 'next/server'

const MEETING_AGENT_URL = process.env.MEETING_AGENT_URL || 'http://localhost:8010'

/**
 * Receives a finalized Soniox utterance from the Chrome extension and
 * forwards it to the meeting-agent service for agent fan-out.
 *
 * The meeting-agent also persists the utterance to meeting_transcriptions,
 * which triggers Supabase Realtime directly to the extension — so the
 * transcript feed does not depend on this response.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const body = await req.json()
    const res = await fetch(`${MEETING_AGENT_URL}/meetings/${params.id}/utterance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
