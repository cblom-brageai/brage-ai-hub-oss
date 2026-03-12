import { NextRequest, NextResponse } from 'next/server'
import { supabaseTaskProvider } from '@/lib/tasks/supabase-adapter'

const CONFIG_API = process.env.CONFIG_API_URL ?? 'http://localhost:8090'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const task = await supabaseTaskProvider.get(params.id)
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!task.assigned_to) {
    return NextResponse.json({ error: 'Task has no assigned employee' }, { status: 400 })
  }

  try {
    const res = await fetch(`${CONFIG_API}/tasks/${params.id}/delegate`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: res.status })
    }
    // Return the updated task (config-api moved it to in_progress)
    const updated = await supabaseTaskProvider.get(params.id)
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
