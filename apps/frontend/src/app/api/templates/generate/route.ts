import { NextRequest, NextResponse } from 'next/server'
import { llmGenerate } from '@/lib/llm'
import { normalizeStructure } from '@/lib/templates/structure'

/**
 * Generate a document template from a one-sentence description.
 * Returns { name, description, json_schema } where json_schema is the sections-and-fields
 * structure edited by the Template Studio (see src/lib/templates/types.ts).
 */
const SYSTEM_PROMPT = `You design document templates for a company's document hub.
Given a description of a document type, output ONE JSON object and nothing else:

{
  "name": "Short template name",
  "description": "One sentence on what the document is for",
  "json_schema": {
    "template_meta": { "standard": "Governing standard or framework, or empty string", "type": "Document type", "version": "1.0" },
    "sections": [
      {
        "title": "Section title",
        "description": "Optional one-line guidance for the section",
        "fields": [
          {
            "key": "unique_snake_case_key",
            "label": "Field label",
            "type": "text | textarea | number | date | select | checklist | list | user_picker",
            "help_text": "Optional instructions shown under the field",
            "placeholder": "Optional example value",
            "options": ["Only for select and checklist"],
            "required": true
          }
        ]
      }
    ]
  }
}

Rules:
- 3 to 8 sections, 2 to 6 fields each; order them as the finished document should read.
- Use "textarea" for narrative content, "list" for enumerations, "checklist" for yes/no criteria,
  "select" for a fixed choice, "user_picker" for a responsible person, "date" for dates.
- Keys must be unique across the whole template, lowercase snake_case, ASCII only.
- Do not include ids; they are added by the system. No markdown fences.`

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

    const raw = (result.json ?? {}) as Record<string, unknown>
    // Accept either the full envelope or a bare structure
    const structureSource = raw.json_schema ?? raw.structure ?? raw
    const json_schema = normalizeStructure(structureSource)
    const name = typeof raw.name === 'string' ? raw.name : ''
    const description = typeof raw.description === 'string' ? raw.description : ''
    return NextResponse.json({ name, description, json_schema })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
