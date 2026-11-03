import { NextRequest, NextResponse } from 'next/server'
import { supabaseTaskProvider } from '@/lib/tasks/supabase-adapter'

export async function GET(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const task = await supabaseTaskProvider.get(params.id)
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(task)
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const body = await req.json()
    const task = await supabaseTaskProvider.update(params.id, body)
    return NextResponse.json(task)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    await supabaseTaskProvider.remove(params.id)
    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
