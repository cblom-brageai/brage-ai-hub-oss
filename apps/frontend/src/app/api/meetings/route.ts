import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  try {
    const db = getSupabase()
    let query = db
      .from('meetings')
      .select('id, title, description, status, scheduled_at, started_at, ended_at, agenda, language_hints, created_by, created_at')
      .order('scheduled_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, scheduled_at, agenda, language_hints, created_by } = body

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const db = getSupabase()
    const { data, error } = await db
      .from('meetings')
      .insert({
        title,
        description: description ?? null,
        scheduled_at: scheduled_at ?? null,
        agenda: agenda ?? [],
        language_hints: language_hints ?? ['en'],
        created_by: created_by ?? 'admin',
        status: 'scheduled',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
