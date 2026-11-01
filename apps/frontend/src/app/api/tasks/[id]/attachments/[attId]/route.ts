import { NextRequest, NextResponse } from 'next/server'

const CONFIG_API = process.env.CONFIG_API_URL ?? 'http://localhost:8090'

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string; attId: string } }
) {
  const res = await fetch(
    `${CONFIG_API}/tasks/${params.id}/attachments/${params.attId}`,
    { method: 'DELETE' }
  )
  return NextResponse.json(await res.json(), { status: res.status })
}
