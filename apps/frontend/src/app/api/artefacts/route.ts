import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

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
