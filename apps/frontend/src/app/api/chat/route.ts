import { NextRequest, NextResponse } from 'next/server'

const CONFIG_API = process.env.CONFIG_API_URL || 'http://localhost:8090'

export async function POST(req: NextRequest) {
  const { employee_id, message } = await req.json()

  try {
    const res = await fetch(`${CONFIG_API}/chat/${employee_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ response: 'Agent unavailable.' }, { status: 503 })
  }
}
