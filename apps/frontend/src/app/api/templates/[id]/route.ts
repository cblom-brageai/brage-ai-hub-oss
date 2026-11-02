import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('document_templates')
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
    if ('description' in body) updates.description = body.description
    if ('employee_ids' in body) updates.employee_ids = body.employee_ids
    if ('json_schema' in body) updates.json_schema = body.json_schema

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('document_templates')
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
    const { error } = await supabase.from('document_templates').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ deleted: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
