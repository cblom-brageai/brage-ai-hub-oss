import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const { data, error } = await getSupabase()
      .from('meeting_mom')
      .select('*')
      .eq('meeting_id', params.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
