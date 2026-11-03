import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('artefacts')
      .select('*')
      .eq('id', params.id)
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const body = await req.json()
    const updates: Record<string, unknown> = {}
    if ('content' in body) updates.content = body.content
    if ('title' in body) updates.title = body.title
    if ('metadata' in body) updates.metadata = body.metadata

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('artefacts')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
