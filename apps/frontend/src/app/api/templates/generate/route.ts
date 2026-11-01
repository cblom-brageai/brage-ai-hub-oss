import { NextRequest, NextResponse } from 'next/server'
import { llmGenerate } from '@/lib/llm'

const SYSTEM_PROMPT =
  'You are a JSON Schema generator. Given a document type description, produce a JSON Schema object (draft-07 compliant) that defines the structure of that document. Include relevant fields with titles, descriptions, and types. Also suggest a name and description for the template. Reply with a JSON object only: {"name": "...", "description": "...", "json_schema": {...}}. No markdown code fences.'

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    const result = await llmGenerate({
      system: SYSTEM_PROMPT,
      prompt: `Document type description:\n${prompt}`,
      role: 'write',
      json_mode: true,
      run_name: 'template-generate',
      metadata: { feature: 'templates' },
    })
    return NextResponse.json(result.json)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
