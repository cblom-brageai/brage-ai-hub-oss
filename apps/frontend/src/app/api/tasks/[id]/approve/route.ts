import { NextRequest, NextResponse } from 'next/server'
import { supabaseTaskProvider } from '@/lib/tasks/supabase-adapter'

export async function POST(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    // Call config-api which handles status update + auto-publish
    const configApiUrl = process.env.CONFIG_API_URL || 'http://localhost:8090'
    const res = await fetch(`${configApiUrl}/tasks/${params.id}/approve`, { method: 'POST' })
    if (!res.ok) {
      // Fallback: just update status directly
      const task = await supabaseTaskProvider.update(params.id, { status: 'done' })
      return NextResponse.json(task)
    }
    // Return updated task from Supabase
    const task = await supabaseTaskProvider.get(params.id)
    return NextResponse.json(task)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
