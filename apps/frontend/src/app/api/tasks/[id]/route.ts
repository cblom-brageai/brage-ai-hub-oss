import { NextRequest, NextResponse } from 'next/server'
import { supabaseTaskProvider } from '@/lib/tasks/supabase-adapter'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const task = await supabaseTaskProvider.get(params.id)
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(task)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const task = await supabaseTaskProvider.update(params.id, body)
    return NextResponse.json(task)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await supabaseTaskProvider.remove(params.id)
    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
