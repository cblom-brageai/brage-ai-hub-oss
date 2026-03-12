import { NextRequest, NextResponse } from 'next/server'
import { supabaseTaskProvider } from '@/lib/tasks/supabase-adapter'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const task = await supabaseTaskProvider.update(params.id, { status: 'done' })
    return NextResponse.json(task)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
