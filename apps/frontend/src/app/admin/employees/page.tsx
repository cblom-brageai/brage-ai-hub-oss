'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Users, FileText, CheckSquare, BarChart2, Save, RefreshCw, ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

const CONFIG_API = process.env.NEXT_PUBLIC_CONFIG_API_URL || 'http://localhost:8090'

const PERMITTED_MODELS = [
  { id: 'gemini-3-flash-preview', label: 'Gemini Flash (default)' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini Pro (reasoning)' },
]

interface Employee {
  id: string
  name: string
}

interface LlmConfig {
  write: string
  reason: string
}

interface RowState {
  config: LlmConfig
  dirty: boolean
  saving: boolean
  status: string
  error: string
}

// ── INI helpers ───────────────────────────────────────────────────────────────

function parseLlmOverrides(content: string): LlmConfig {
  const section = content.match(/\[llm_overrides\]([\s\S]*?)(?=\[|$)/)?.[1] ?? ''
  const write = section.match(/write\s*=\s*(.+)/)?.[1]?.trim() ?? 'gemini-3-flash-preview'
  const reason = section.match(/reason\s*=\s*(.+)/)?.[1]?.trim() ?? 'gemini-3.1-pro-preview'
  return { write, reason }
}

function updateLlmOverrides(content: string, cfg: LlmConfig): string {
  const newSection = `[llm_overrides]\nreason = ${cfg.reason}\nwrite = ${cfg.write}`
  if (content.includes('[llm_overrides]')) {
    return content.replace(/\[llm_overrides\][\s\S]*?(?=\n\[|$)/, newSection)
  }
  return content.trimEnd() + '\n\n' + newSection + '\n'
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [loadingEmployees, setLoadingEmployees] = useState(true)

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true)
    const res = await fetch('/api/employees')
    if (!res.ok) { setLoadingEmployees(false); return }
    const data: { id: string }[] = await res.json()
    const emps: Employee[] = data.map((e) => ({
      id: e.id,
      name: e.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
    }))
    setEmployees(emps)
    setLoadingEmployees(false)

    // Fetch agent.config.md for each employee
    for (const emp of emps) {
      loadConfig(emp.id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadConfig = async (empId: string) => {
    try {
      const res = await fetch(`${CONFIG_API}/config/${empId}/file/agent.config.md`)
      const data = await res.json()
      const content: string = data.content ?? ''
      const config = parseLlmOverrides(content)
      setRows((prev) => ({
        ...prev,
        [empId]: {
          config,
          dirty: false,
          saving: false,
          status: '',
          error: '',
        },
      }))
    } catch {
      setRows((prev) => ({
        ...prev,
        [empId]: {
          config: { write: 'gemini-3-flash-preview', reason: 'gemini-3.1-pro-preview' },
          dirty: false,
          saving: false,
          status: '',
          error: 'Failed to load config',
        },
      }))
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const updateModel = (empId: string, field: 'write' | 'reason', value: string) => {
    setRows((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        config: { ...prev[empId].config, [field]: value },
        dirty: true,
        status: '',
      },
    }))
  }

  const saveConfig = async (empId: string) => {
    setRows((prev) => ({ ...prev, [empId]: { ...prev[empId], saving: true, error: '' } }))
    try {
      // Get current full file content first
      const getRes = await fetch(`${CONFIG_API}/config/${empId}/file/agent.config.md`)
      const getData = await getRes.json()
      const current: string = getData.content ?? ''

      const updated = updateLlmOverrides(current, rows[empId].config)

      const putRes = await fetch(`${CONFIG_API}/config/${empId}/file/agent.config.md`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: updated, reload: true }),
      })

      if (!putRes.ok) throw new Error(`HTTP ${putRes.status}`)

      setRows((prev) => ({
        ...prev,
        [empId]: { ...prev[empId], saving: false, dirty: false, status: 'Saved' },
      }))
      setTimeout(() => {
        setRows((prev) => ({ ...prev, [empId]: { ...prev[empId], status: '' } }))
      }, 3000)
    } catch (e) {
      setRows((prev) => ({
        ...prev,
        [empId]: { ...prev[empId], saving: false, error: String(e) },
      }))
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
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
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[rgb(var(--muted))] text-[rgb(var(--foreground))]"
          >
            <BarChart2 size={13} />
            Admin
          </Link>
        </nav>

        <ThemeToggle />
      </header>

      {/* Sub-header */}
      <div className="px-6 py-4 flex items-center gap-3 border-b border-[rgb(var(--border))]">
        <Link href="/admin" className="p-1.5 rounded-lg hover:bg-[rgb(var(--muted))] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold">LLM Config</h1>
          <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
            Set write and reasoning models per employee
          </p>
        </div>
      </div>

      <main className="flex-1 p-6">
        {loadingEmployees ? (
          <div className="flex items-center justify-center h-40 text-sm text-[rgb(var(--muted-foreground))]">
            <RefreshCw size={14} className="animate-spin mr-2" />
            Loading employees…
          </div>
        ) : (
          <div className="rounded-xl border border-[rgb(var(--border))] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--muted))]/50">
                  <th className="text-left px-4 py-3 font-medium text-[rgb(var(--muted-foreground))]">
                    Employee
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[rgb(var(--muted-foreground))]">
                    Write model
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[rgb(var(--muted-foreground))]">
                    Reasoning model
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => {
                  const row = rows[emp.id]
                  return (
                    <tr
                      key={emp.id}
                      className={`border-b border-[rgb(var(--border))] last:border-0 ${
                        i % 2 === 0 ? '' : 'bg-[rgb(var(--muted))]/20'
                      }`}
                    >
                      {/* Employee name */}
                      <td className="px-4 py-3 font-medium">{emp.name}</td>

                      {/* Write model dropdown */}
                      <td className="px-4 py-3">
                        {row ? (
                          <select
                            value={row.config.write}
                            onChange={(e) => updateModel(emp.id, 'write', e.target.value)}
                            className="px-2 py-1.5 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
                          >
                            {PERMITTED_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[rgb(var(--muted-foreground))]">—</span>
                        )}
                      </td>

                      {/* Reasoning model dropdown */}
                      <td className="px-4 py-3">
                        {row ? (
                          <select
                            value={row.config.reason}
                            onChange={(e) => updateModel(emp.id, 'reason', e.target.value)}
                            className="px-2 py-1.5 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
                          >
                            {PERMITTED_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[rgb(var(--muted-foreground))]">—</span>
                        )}
                      </td>

                      {/* Save / status */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {row?.error && (
                            <span className="text-xs text-red-500 truncate max-w-[120px]" title={row.error}>
                              {row.error}
                            </span>
                          )}
                          {row?.status && (
                            <span className="text-xs text-[rgb(var(--primary))]">{row.status}</span>
                          )}
                          {row && (
                            <button
                              onClick={() => saveConfig(emp.id)}
                              disabled={!row.dirty || row.saving}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 disabled:opacity-40 transition-opacity"
                            >
                              {row.saving ? (
                                <RefreshCw size={11} className="animate-spin" />
                              ) : (
                                <Save size={11} />
                              )}
                              Save
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {employees.length === 0 && (
              <div className="text-center py-12 text-sm text-[rgb(var(--muted-foreground))]">
                No employees found.
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-xs text-[rgb(var(--muted-foreground))]">
          Changes take effect on the next agent invocation (SIGHUP sent automatically).
          The full <code className="font-mono">agent.config.md</code> can be edited in each employee&apos;s Config tab.
        </p>
      </main>
    </div>
  )
}
