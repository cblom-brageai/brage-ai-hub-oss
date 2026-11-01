'use client'

import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

const CHART_COLORS = ['#14b8a6', '#3b82f6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6']

function employeeName(id: string) {
  return id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export interface ChartsProps {
  employees: string[]
  requestsByDayData: Record<string, string | number>[]
  tokenData: { name: string; Input: number; Output: number }[]
  costData: { name: string; Cost: number }[]
  taskTypeData: { name: string; Chat: number; Slack: number; Scheduled: number }[]
}

export function AdminCharts({
  employees,
  requestsByDayData,
  tokenData,
  costData,
  taskTypeData,
}: ChartsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Requests per day */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5">
        <h3 className="text-sm font-semibold mb-4">Requests / day</h3>
        {requestsByDayData.length === 0 ? (
          <p className="text-sm text-[rgb(var(--muted-foreground))] text-center py-8">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={requestsByDayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {employees.map((emp, i) => (
                <Line
                  key={emp}
                  type="monotone"
                  dataKey={emp}
                  name={employeeName(emp)}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Token usage by employee */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5">
        <h3 className="text-sm font-semibold mb-4">Token usage by employee</h3>
        {tokenData.every((d) => d.Input === 0 && d.Output === 0) ? (
          <p className="text-sm text-[rgb(var(--muted-foreground))] text-center py-8">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tokenData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatTokens(v as number)} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatTokens(v as number)} />
              <Legend />
              <Bar dataKey="Input" stackId="a" fill="#14b8a6" />
              <Bar dataKey="Output" stackId="a" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Cost by employee */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5">
        <h3 className="text-sm font-semibold mb-4">Cost by employee (USD)</h3>
        {costData.every((d) => d.Cost === 0) ? (
          <p className="text-sm text-[rgb(var(--muted-foreground))] text-center py-8">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={costData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `$${(v as number).toFixed(4)}`} />
              <Bar dataKey="Cost" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Task type distribution */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5">
        <h3 className="text-sm font-semibold mb-4">Task origin by employee</h3>
        {taskTypeData.every((d) => d.Chat === 0 && d.Slack === 0 && d.Scheduled === 0) ? (
          <p className="text-sm text-[rgb(var(--muted-foreground))] text-center py-8">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={taskTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Chat" stackId="a" fill="#14b8a6" />
              <Bar dataKey="Slack" stackId="a" fill="#6366f1" />
              <Bar dataKey="Scheduled" stackId="a" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
