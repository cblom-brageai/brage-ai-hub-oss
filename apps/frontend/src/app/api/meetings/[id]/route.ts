import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const db = getSupabase()
    const { data, error } = await db
      .from('meetings')
      .select(`
        id, title, description, status, scheduled_at, started_at, ended_at,
        agenda, language_hints, created_by, created_at, updated_at,
        meeting_participants ( id, participant_type, participant_id, active, joined_at )
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const body = await req.json()
    const allowed = ['title', 'description', 'scheduled_at', 'agenda', 'language_hints', 'status']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const db = getSupabase()
    const { data, error } = await db
      .from('meetings')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const db = getSupabase()
    const { error } = await db.from('meetings').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ deleted: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
