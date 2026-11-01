'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Calendar, Plus, Clock, CheckCircle, XCircle, Radio, ChevronRight } from 'lucide-react'
import { NavHeader } from '@/components/nav-header'
import type { Meeting, MeetingStatus } from '@/lib/meetings/types'

const STATUS_FILTERS: { label: string; value: MeetingStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Ended', value: 'ended' },
]

function StatusBadge({ status }: { status: MeetingStatus }) {
  const map: Record<MeetingStatus, { label: string; icon: React.ElementType; classes: string }> = {
    scheduled: { label: 'Scheduled', icon: Clock,        classes: 'bg-blue-500/10 text-blue-500' },
    active:    { label: 'Live',      icon: Radio,        classes: 'bg-green-500/10 text-green-500' },
    ended:     { label: 'Ended',     icon: CheckCircle,  classes: 'bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]' },
    cancelled: { label: 'Cancelled', icon: XCircle,      classes: 'bg-red-500/10 text-red-400' },
  }
  const { label, icon: Icon, classes } = map[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      <Icon size={11} />
      {label}
    </span>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const AGENT_LABELS: Record<string, string> = {
  'decision-logger': 'Decision Logger',
  'qa-agent': 'Q&A Agent',
  'meetings-monitor': 'Meetings Monitor',
}

function formatParticipantId(id: string) {
  return AGENT_LABELS[id] ?? id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function ParticipantList({ meeting }: { meeting: Meeting }) {
  const ps = meeting.meeting_participants
  if (!ps || ps.length === 0) return <span className="text-[rgb(var(--muted-foreground))]">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {ps.map((p) => (
        <span
          key={p.participant_id}
          className={`inline-flex px-1.5 py-0.5 rounded text-xs ${
            p.participant_type === 'agent'
              ? 'bg-blue-500/10 text-blue-400'
              : 'bg-teal-500/10 text-teal-400'
          }`}
        >
          {formatParticipantId(p.participant_id)}
        </span>
      ))}
    </div>
  )
}

export default function MeetingsListPage() {
  const [filter, setFilter] = useState<MeetingStatus | 'all'>('all')
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const url = filter === 'all' ? '/api/meetings' : `/api/meetings?status=${filter}`
    fetch(url)
      .then((r) => r.json())
      .then((data) => setMeetings(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />

      {/* Toolbar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-[rgb(var(--border))]">
        <div>
          <h1 className="text-xl font-bold">Meetings</h1>
          <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
            Create and manage AI-assisted meetings
          </p>
        </div>
        <Link
          href="/admin/meetings/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          New Meeting
        </Link>
      </div>

      {/* Status filter */}
      <div className="px-6 pt-4 flex items-center gap-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f.value
                ? 'bg-[rgb(var(--muted))] text-[rgb(var(--foreground))] font-medium'
                : 'text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <main className="flex-1 px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[rgb(var(--muted-foreground))] text-sm">
            Loading…
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-[rgb(var(--muted-foreground))]">
            <Calendar size={32} className="opacity-30" />
            <p className="text-sm">No meetings found.</p>
            <Link
              href="/admin/meetings/new"
              className="text-sm text-[rgb(var(--primary))] hover:underline"
            >
              Create your first meeting
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-[rgb(var(--border))] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--muted))]/40">
                  <th className="text-left px-4 py-3 font-medium text-[rgb(var(--muted-foreground))]">Meeting</th>
                  <th className="text-left px-4 py-3 font-medium text-[rgb(var(--muted-foreground))]">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-[rgb(var(--muted-foreground))] hidden sm:table-cell">Scheduled</th>
                  <th className="text-left px-4 py-3 font-medium text-[rgb(var(--muted-foreground))] hidden md:table-cell">Agents/Employees</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {meetings.map((m, i) => (
                  <tr
                    key={m.id}
                    className={`border-b border-[rgb(var(--border))] last:border-0 hover:bg-[rgb(var(--muted))]/30 transition-colors ${
                      i % 2 === 0 ? '' : 'bg-[rgb(var(--muted))]/10'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{m.title}</p>
                      {m.description && (
                        <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5 line-clamp-1">
                          {m.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3 text-[rgb(var(--muted-foreground))] hidden sm:table-cell">
                      {formatDate(m.scheduled_at)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <ParticipantList meeting={m} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/meetings/${m.id}`}
                        className="inline-flex items-center gap-1 text-[rgb(var(--primary))] hover:underline text-xs"
                      >
                        View <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
