import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SYSTEM_PROMPT =
  'You are a JSON Schema generator. Given a document type description, produce a JSON Schema object (draft-07 compliant) that defines the structure of that document. Include relevant fields with titles, descriptions, and types. Also suggest a name and description for the template. Reply with a JSON object only: {"name": "...", "description": "...", "json_schema": {...}}. No markdown code fences.'

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 })
    }

    const genai = new GoogleGenerativeAI(apiKey)
    const model = genai.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nDocument type description:\n${prompt}`)
    const text = result.response.text().trim()

    const parsed = JSON.parse(text)
    return NextResponse.json(parsed)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
