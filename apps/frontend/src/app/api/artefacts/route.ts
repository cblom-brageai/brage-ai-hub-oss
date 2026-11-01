import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employee_id')
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)

    const supabase = getSupabase()
    let query = supabase
      .from('artefacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Create an artefact. Used by the document writer; employees create theirs through the
 * store_result tool. Body: { employee_id, title, content, filename?, content_type?, source?,
 * metadata?, template_id?, task_id? }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employee_id, title, content } = body
    if (!employee_id || !title || typeof content !== 'string') {
      return NextResponse.json({ error: 'employee_id, title and content are required' }, { status: 400 })
    }
    const filename: string =
      body.filename ||
      `${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document'}.md`

    const row: Record<string, unknown> = {
      employee_id,
      title,
      content,
      filename,
      content_type: body.content_type ?? 'markdown',
      source: body.source ?? 'document-writer',
      metadata: body.metadata ?? null,
      template_id: body.template_id ?? null,
      task_id: body.task_id ?? null,
      schema_version: body.schema_version ?? '1.0',
    }

    const supabase = getSupabase()
    const { data, error } = await supabase.from('artefacts').insert(row).select().single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
