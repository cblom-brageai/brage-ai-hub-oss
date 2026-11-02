import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('publish_channels')
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
    if ('name' in body) updates.name = body.name
    if ('type' in body) updates.type = body.type
    if ('config' in body) updates.config = body.config
    if ('available_to' in body) updates.available_to = body.available_to

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('publish_channels')
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

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('publish_channels').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ deleted: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
