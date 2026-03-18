export const dynamic = 'force-dynamic'

import { readdir } from 'fs/promises'
import path from 'path'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { MessageSquare, Settings, Brain, Zap, Plus, Users, FileText, CheckSquare } from 'lucide-react'

const EMPLOYEE_META: Record<string, string> = {
  'marketing-manager': 'Content creation, LinkedIn campaigns, and publishing strategy',
  'bid-manager': 'EPC tender responses, technical proposals, and bid win strategy',
  'project-manager': 'PRINCE2 project governance for PV and BESS installations',
}

interface Employee {
  id: string
  name: string
  description: string
  skills: string[]
  initials: string
}

async function getEmployees(): Promise<Employee[]> {
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
    return employees
  } catch {
    return []
  }
}

export default async function Home() {
  const employees = await getEmployees()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[rgb(var(--border))] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
            <span className="text-[rgb(var(--primary-foreground))] font-bold text-sm">B</span>
          </div>
          <span className="font-semibold text-lg">Brage AI Hub</span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[rgb(var(--muted))] text-[rgb(var(--foreground))]"
          >
            <Users size={13} />
            Employees
          </Link>
          <Link
            href="/documents"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
          >
            <FileText size={13} />
            Documents
          </Link>
          <Link
            href="/tasks"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
          >
            <CheckSquare size={13} />
            Tasks
          </Link>
        </nav>

        <ThemeToggle />
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Virtual Employees</h1>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              {employees.length} team member{employees.length !== 1 ? 's' : ''} configured
            </p>
          </div>
          <Link
            href="/employees/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            New Employee
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5 flex flex-col gap-4 hover:border-[rgb(var(--primary))] transition-colors"
            >
              {/* Card header */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-teal-600 dark:bg-teal-400 flex items-center justify-center text-white dark:text-teal-950 font-bold text-sm flex-shrink-0">
                  {emp.initials}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm leading-tight">{emp.name}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-[rgb(var(--muted-foreground))]">Active</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-[rgb(var(--muted-foreground))] leading-relaxed flex-1">
                {emp.description}
              </p>

              {/* Skills */}
              {emp.skills.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {emp.skills.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]"
                    >
                      {s}
                    </span>
                  ))}
                  {emp.skills.length > 3 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]">
                      +{emp.skills.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-[rgb(var(--border))]">
                <Link
                  href={`/employees/${emp.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  <MessageSquare size={12} />
                  Chat
                </Link>
                <Link
                  href={`/employees/${emp.id}/config?tab=strategy`}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[rgb(var(--border))] text-xs hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))] transition-colors"
                  title="Edit Strategy"
                >
                  <Brain size={12} />
                  Strategy
                </Link>
                <Link
                  href={`/employees/${emp.id}/config?tab=skills`}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[rgb(var(--border))] text-xs hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))] transition-colors"
                  title="Manage Skills"
                >
                  <Zap size={12} />
                  Skills
                </Link>
                <Link
                  href={`/employees/${emp.id}/config`}
                  className="flex items-center justify-center px-3 py-2 rounded-lg border border-[rgb(var(--border))] text-xs hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))] transition-colors"
                  title="All Settings"
                >
                  <Settings size={12} />
                </Link>
              </div>
            </div>
          ))}

          {/* Add employee card */}
          <Link
            href="/employees/new"
            className="rounded-xl border-2 border-dashed border-[rgb(var(--border))] bg-transparent p-5 flex flex-col items-center justify-center gap-3 hover:border-[rgb(var(--primary))] hover:bg-[rgb(var(--muted))] transition-colors min-h-[200px] group"
          >
            <div className="w-11 h-11 rounded-full border-2 border-dashed border-[rgb(var(--border))] group-hover:border-[rgb(var(--primary))] flex items-center justify-center transition-colors">
              <Plus size={18} className="text-[rgb(var(--muted-foreground))] group-hover:text-[rgb(var(--primary))] transition-colors" />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-[rgb(var(--muted-foreground))] group-hover:text-[rgb(var(--foreground))] transition-colors">
                Add Employee
              </div>
              <div className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5 opacity-70">
                Chat-based setup
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}
