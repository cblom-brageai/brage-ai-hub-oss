import { NextRequest, NextResponse } from 'next/server'

const MEETING_AGENT_URL = process.env.MEETING_AGENT_URL || 'http://localhost:8010'

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const res = await fetch(`${MEETING_AGENT_URL}/meetings/${params.id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
