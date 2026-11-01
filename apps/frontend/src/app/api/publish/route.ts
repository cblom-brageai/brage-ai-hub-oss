import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { artefact_id, channel_id } = await req.json()
    if (!artefact_id || !channel_id) {
      return NextResponse.json({ error: 'artefact_id and channel_id are required' }, { status: 400 })
    }

    const configApiUrl = process.env.CONFIG_API_URL || 'http://localhost:8090'
    const res = await fetch(`${configApiUrl}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artefact_id, channel_id }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }

    const log = await res.json()
    return NextResponse.json(log)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const artefactId = searchParams.get('artefact_id')

    const supabase = getSupabase()
    let query = supabase
      .from('publish_logs')
      .select('*')
      .order('published_at', { ascending: false })

    if (artefactId) {
      query = query.eq('artefact_id', artefactId)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
