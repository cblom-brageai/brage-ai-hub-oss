import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile, access } from 'fs/promises'
import path from 'path'

const VALID_ID = /^[a-z][a-z0-9-]{1,48}[a-z0-9]$/

const DEFAULT_AGENT_CONFIG = `[llm_overrides]
reason = gemini-3.1-pro-preview
write = gemini-3-flash-preview

[human_gate]
approve_before = publish_external, send_email

[mcp_servers]
# Add MCP server configurations here
`

export async function POST(req: NextRequest) {
  const { id, name, description, strategy, personality, agentConfig, skills } = await req.json()

  if (!id || !VALID_ID.test(id)) {
    return NextResponse.json({ error: 'Invalid employee ID. Use lowercase letters, numbers, and hyphens.' }, { status: 400 })
  }

  const employeesDir = process.env.EMPLOYEES_DIR || path.resolve(process.cwd(), '../../docker/employees')
  const baseDir = path.join(employeesDir, id, 'config')

  // Check if employee already exists
  try {
    await access(baseDir)
    return NextResponse.json({ error: `Employee "${id}" already exists.` }, { status: 409 })
  } catch {
    // Directory doesn't exist — proceed
  }

  try {
    await mkdir(path.join(baseDir, 'skills'), { recursive: true })
    await mkdir(path.join(baseDir, 'artefacts'), { recursive: true })

    await writeFile(path.join(baseDir, 'Strategy.md'), strategy || `# Strategy\n\n## Goals\n\n- To be defined.\n`)
    await writeFile(path.join(baseDir, 'Personality.md'), personality || `# Personality\n\nProfessional and helpful.\n`)
    await writeFile(path.join(baseDir, 'agent.config.md'), agentConfig || DEFAULT_AGENT_CONFIG)

    for (const skill of skills ?? []) {
      const filename = skill.name.endsWith('.md') ? skill.name : `${skill.name}.md`
      await writeFile(path.join(baseDir, 'skills', filename), skill.content || `# ${skill.name}\n\n`)
    }

    return NextResponse.json({ success: true, id, name })
  } catch (err) {
    console.error('Failed to create employee:', err)
    return NextResponse.json({ error: 'Failed to create employee files.' }, { status: 500 })
  }
}
