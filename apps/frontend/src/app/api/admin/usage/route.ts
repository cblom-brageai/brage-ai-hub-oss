import { NextRequest, NextResponse } from 'next/server'

const LANGCHAIN_API_KEY = process.env.LANGCHAIN_API_KEY ?? ''
const LANGCHAIN_PROJECT = process.env.LANGCHAIN_PROJECT ?? 'Brage-AI-Hub'
const LANGCHAIN_ENDPOINT = process.env.LANGCHAIN_ENDPOINT ?? 'https://eu.api.smith.langchain.com'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Run = Record<string, any>

const EMPTY_RESPONSE = {
  totalRuns: 0,
  totalTokens: 0,
  totalCost: 0,
  byEmployee: {} as Record<string, unknown>,
  byDay: {} as Record<string, number>,
  byEmployeeByDay: {} as Record<string, Record<string, number>>,
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '30', 10)

  const startTime = new Date()
  startTime.setDate(startTime.getDate() - days)

  if (!LANGCHAIN_API_KEY) {
    return NextResponse.json({
      totalRuns: 0,
      totalTokens: 0,
      totalCost: 0,
      byEmployee: {},
      byDay: {},
      byEmployeeByDay: {},
    })
  }

  try {
    const body = {
      project_name: LANGCHAIN_PROJECT,
      run_type: 'chain',
      start_time: startTime.toISOString(),
      limit: 1000,
      select: [
        'id',
        'run_type',
        'start_time',
        'total_tokens',
        'prompt_tokens',
        'completion_tokens',
        'total_cost',
        'metadata',
        'extra',
      ],
    }

    const res = await fetch(`${LANGCHAIN_ENDPOINT}/api/v1/runs/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LANGCHAIN_API_KEY,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      return NextResponse.json(EMPTY_RESPONSE)
    }

    const data = await res.json()
    const runs: Run[] = data.runs ?? []

    // Aggregate by employee
    const byEmployee: Record<string, {
      runs: number
      inputTokens: number
      outputTokens: number
      cost: number
      models: Record<string, number>
    }> = {}

    // Aggregate by day (total)
    const byDay: Record<string, number> = {}

    // Aggregate by employee + day
    const byEmployeeByDay: Record<string, Record<string, number>> = {}

    for (const run of runs) {
      const employeeId: string = run.metadata?.employee_id ?? 'unknown'
      const model: string =
        run.extra?.invocation_params?.model ??
        run.extra?.invocation_params?.model_name ??
        'unknown'
      const day: string = (run.start_time as string)?.slice(0, 10) ?? 'unknown'

      if (!byEmployee[employeeId]) {
        byEmployee[employeeId] = { runs: 0, inputTokens: 0, outputTokens: 0, cost: 0, models: {} }
      }
      byEmployee[employeeId].runs++
      byEmployee[employeeId].inputTokens += (run.prompt_tokens as number) ?? 0
      byEmployee[employeeId].outputTokens += (run.completion_tokens as number) ?? 0
      byEmployee[employeeId].cost += (run.total_cost as number) ?? 0
      byEmployee[employeeId].models[model] = (byEmployee[employeeId].models[model] ?? 0) + 1

      byDay[day] = (byDay[day] ?? 0) + 1

      if (!byEmployeeByDay[employeeId]) byEmployeeByDay[employeeId] = {}
      byEmployeeByDay[employeeId][day] = (byEmployeeByDay[employeeId][day] ?? 0) + 1
    }

    const totalRuns = runs.length
    const totalTokens = runs.reduce((s, r) => s + ((r.total_tokens as number) ?? 0), 0)
    const totalCost = runs.reduce((s, r) => s + ((r.total_cost as number) ?? 0), 0)

    return NextResponse.json({
      totalRuns,
      totalTokens,
      totalCost,
      byEmployee,
      byDay,
      byEmployeeByDay,
    })
  } catch {
    return NextResponse.json(EMPTY_RESPONSE)
  }
}
