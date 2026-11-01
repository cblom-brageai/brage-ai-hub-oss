import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '30', 10)

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

  try {
    const supabase = getSupabase()

    const [tasksRes, artefactsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, assigned_to, created_by, recurrence, created_at')
        .gte('created_at', sinceIso),
      supabase
        .from('artefacts')
        .select('id, employee_id, source, created_at')
        .gte('created_at', sinceIso),
    ])

    const tasks = tasksRes.data ?? []
    const artefacts = artefactsRes.data ?? []

    const tasksByEmployee: Record<string, {
      chat: number; slack: number; scheduled: number; total: number
    }> = {}

    for (const t of tasks) {
      const emp: string = t.assigned_to ?? 'unassigned'
      if (!tasksByEmployee[emp]) {
        tasksByEmployee[emp] = { chat: 0, slack: 0, scheduled: 0, total: 0 }
      }
      tasksByEmployee[emp].total++
      if (t.recurrence) tasksByEmployee[emp].scheduled++
      else if (t.created_by === 'slack') tasksByEmployee[emp].slack++
      else tasksByEmployee[emp].chat++
    }

    const artefactsByEmployee: Record<string, number> = {}
    for (const a of artefacts) {
      const emp: string = a.employee_id ?? 'unknown'
      artefactsByEmployee[emp] = (artefactsByEmployee[emp] ?? 0) + 1
    }

    return NextResponse.json({
      tasksByEmployee,
      artefactsByEmployee,
      totalTasks: tasks.length,
      totalArtefacts: artefacts.length,
    })
  } catch {
    return NextResponse.json({
      tasksByEmployee: {},
      artefactsByEmployee: {},
      totalTasks: 0,
      totalArtefacts: 0,
    })
  }
}
