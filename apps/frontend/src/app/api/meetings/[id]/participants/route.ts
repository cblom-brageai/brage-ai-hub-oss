import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const db = getSupabase()
    const { data, error } = await db
      .from('meeting_participants')
      .select('id, participant_type, participant_id, active, joined_at')
      .eq('meeting_id', params.id)
      .order('joined_at')

    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const body = await req.json()
    const { participant_type, participant_id } = body

    if (!participant_type || !participant_id) {
      return NextResponse.json(
        { error: 'participant_type and participant_id are required' },
        { status: 400 },
      )
    }
    if (!['agent', 'employee'].includes(participant_type)) {
      return NextResponse.json(
        { error: "participant_type must be 'agent' or 'employee'" },
        { status: 400 },
      )
    }

    const db = getSupabase()
    const { data, error } = await db
      .from('meeting_participants')
      .upsert(
        { meeting_id: params.id, participant_type, participant_id, active: true },
        { onConflict: 'meeting_id,participant_id' },
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const { searchParams } = new URL(req.url)
    const participant_id = searchParams.get('participant_id')
    if (!participant_id) {
      return NextResponse.json({ error: 'participant_id query param required' }, { status: 400 })
    }

    const db = getSupabase()
    const { error } = await db
      .from('meeting_participants')
      .delete()
      .eq('meeting_id', params.id)
      .eq('participant_id', participant_id)

    if (error) throw error
    return NextResponse.json({ deleted: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
