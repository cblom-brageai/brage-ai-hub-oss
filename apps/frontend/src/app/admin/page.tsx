'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users, BarChart2, RefreshCw,
  Activity, Cpu, DollarSign, TrendingUp,
} from 'lucide-react'
import { NavHeader } from '@/components/nav-header'
import dynamic from 'next/dynamic'
import type { ChartsProps } from './charts'

const AdminCharts = dynamic<ChartsProps>(
  () => import('./charts').then((m) => m.AdminCharts),
  { ssr: false, loading: () => <div className="h-[480px]" /> },
)

// ── Types ──────────────────────────────────────────────────────────────────────

interface EmployeeUsage {
  runs: number
  inputTokens: number
  outputTokens: number
  cost: number
  models: Record<string, number>
}

interface UsageData {
  totalRuns: number
  totalTokens: number
  totalCost: number
  byEmployee: Record<string, EmployeeUsage>
  byDay: Record<string, number>
  byEmployeeByDay: Record<string, Record<string, number>>
}

interface ActivityData {
  tasksByEmployee: Record<string, { chat: number; slack: number; scheduled: number; total: number }>
  artefactsByEmployee: Record<string, number>
  totalTasks: number
  totalArtefacts: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

function employeeName(id: string) {
  return id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function formatCost(cost: number) {
  return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-[rgb(var(--primary))]/10 flex items-center justify-center">
          <Icon size={18} className="text-[rgb(var(--primary))]" />
        </div>
        <span className="text-sm text-[rgb(var(--muted-foreground))]">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">{sub}</p>}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [days, setDays] = useState(30)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/admin/usage?days=${days}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/admin/activity?days=${days}`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([u, a]) => {
        setUsage(u)
        setActivity(a)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [days])

  // ── Derived chart data ────────────────────────────────────────────────────

  const employees = Array.from(new Set([
    ...Object.keys(usage?.byEmployee ?? {}),
    ...Object.keys(activity?.tasksByEmployee ?? {}),
  ]))

  // Requests per day — one entry per date, one key per employee
  const requestsByDayData = (() => {
    if (!usage?.byEmployeeByDay) return []
    const allDays = new Set<string>()
    Object.values(usage.byEmployeeByDay).forEach((d) => Object.keys(d).forEach((k) => allDays.add(k)))
    return Array.from(allDays).sort().map((date) => {
      const entry: Record<string, string | number> = { date: date.slice(5) } // MM-DD
      for (const emp of employees) {
        entry[emp] = usage.byEmployeeByDay[emp]?.[date] ?? 0
      }
      return entry
    })
  })()

  // Token usage by employee (stacked bar)
  const tokenData = employees.map((emp) => ({
    name: employeeName(emp),
    Input: usage?.byEmployee[emp]?.inputTokens ?? 0,
    Output: usage?.byEmployee[emp]?.outputTokens ?? 0,
  }))

  // Cost by employee
  const costData = employees.map((emp) => ({
    name: employeeName(emp),
    Cost: parseFloat((usage?.byEmployee[emp]?.cost ?? 0).toFixed(4)),
  }))

  // Task type breakdown by employee
  const taskTypeData = employees.map((emp) => ({
    name: employeeName(emp),
    Chat: activity?.tasksByEmployee[emp]?.chat ?? 0,
    Slack: activity?.tasksByEmployee[emp]?.slack ?? 0,
    Scheduled: activity?.tasksByEmployee[emp]?.scheduled ?? 0,
  }))

  const activeEmployeeCount = employees.filter(
    (e) => (usage?.byEmployee[e]?.runs ?? 0) > 0,
  ).length

  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />

      {/* Toolbar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-[rgb(var(--border))]">
        <div>
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
            Token usage, costs, and activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/employees"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] text-sm transition-colors"
          >
            <Cpu size={13} />
            LLM Config
          </Link>
          <div className="flex rounded-lg border border-[rgb(var(--border))] overflow-hidden">
            {DATE_RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  days === r.days
                    ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                    : 'hover:bg-[rgb(var(--muted))]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {loading && <RefreshCw size={14} className="animate-spin text-[rgb(var(--muted-foreground))]" />}
        </div>
      </div>

      <main className="flex-1 p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard
            icon={Activity}
            label="Total Runs"
            value={String(usage?.totalRuns ?? 0)}
            sub={`last ${days} days`}
          />
          <SummaryCard
            icon={TrendingUp}
            label="Total Tokens"
            value={formatTokens(usage?.totalTokens ?? 0)}
            sub="input + output"
          />
          <SummaryCard
            icon={DollarSign}
            label="Est. Cost"
            value={formatCost(usage?.totalCost ?? 0)}
            sub="LangSmith estimate"
          />
          <SummaryCard
            icon={Users}
            label="Active Employees"
            value={String(activeEmployeeCount)}
            sub={`of ${employees.length} total`}
          />
        </div>

        <AdminCharts
          employees={employees}
          requestsByDayData={requestsByDayData}
          tokenData={tokenData}
          costData={costData}
          taskTypeData={taskTypeData}
        />
      </main>
    </div>
  )
}
