import { NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import path from 'path'

const EMPLOYEE_META: Record<string, string> = {
  'marketing-manager': 'Content creation, LinkedIn campaigns, and publishing strategy',
  'bid-manager': 'EPC tender responses, technical proposals, and bid win strategy',
  'project-manager': 'PRINCE2 project governance for PV and BESS installations',
}

export async function GET() {
  const dir = process.env.EMPLOYEES_DIR || path.resolve(process.cwd(), '../../docker/employees')
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const ids = entries.filter((e) => e.isDirectory()).map((e) => e.name)

    const employees = await Promise.all(
      ids.map(async (id) => {
        const skillsDir = path.join(dir, id, 'config', 'skills')
        let skills: string[] = []
        try {
          const skillFiles = await readdir(skillsDir)
          skills = skillFiles.filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''))
        } catch {}

        const name = id
          .split('-')
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(' ')

        return {
          id,
          name,
          description: EMPLOYEE_META[id] ?? 'AI virtual employee',
          skills,
          initials: name
            .split(' ')
            .map((w) => w[0])
            .join(''),
        }
      })
    )
    return NextResponse.json(employees)
  } catch {
    return NextResponse.json([])
  }
}
