import { NextRequest, NextResponse } from 'next/server'

const CONFIG_API = process.env.CONFIG_API_URL ?? 'http://localhost:8090'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const res = await fetch(`${CONFIG_API}/tasks/${params.id}/attachments`)
  return NextResponse.json(await res.json(), { status: res.status })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Proxy multipart upload straight to config-api
  const body = await req.arrayBuffer()
  const contentType = req.headers.get('content-type') ?? ''
  const res = await fetch(`${CONFIG_API}/tasks/${params.id}/attachments`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
