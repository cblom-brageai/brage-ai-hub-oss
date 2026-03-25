import { NextResponse } from 'next/server'

/**
 * Returns the org-level Soniox API key to authenticated extension clients.
 * The key is stored as SONIOX_API_KEY on the server — never exposed in the browser bundle.
 */
export async function GET() {
  const apiKey = process.env.SONIOX_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'SONIOX_API_KEY is not configured on the server.' },
      { status: 503 },
    )
  }
  return NextResponse.json({ api_key: apiKey })
}
