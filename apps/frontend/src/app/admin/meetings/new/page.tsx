'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import { NavHeader } from '@/components/nav-header'
import type { AgendaItem } from '@/lib/meetings/types'

// ── Built-in meeting agents ───────────────────────────────────────────────────

const BUILT_IN_AGENTS = [
  {
    id: 'decision-logger',
    name: 'Decision Logger',
    description: 'Identifies and logs decisions as they are made in the meeting.',
  },
  {
    id: 'qa-agent',
    name: 'Q&A Agent',
    description: 'Detects questions, searches company knowledge, and answers them live.',
  },
  {
    id: 'meetings-monitor',
    name: 'Meetings Monitor',
    description: 'Tracks agenda progress and writes Minutes of Meeting at the end.',
  },
]

interface Employee {
  id: string
  name: string
  description: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewMeetingPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [languageHints, setLanguageHints] = useState('en')
  const [agenda, setAgenda] = useState<AgendaItem[]>([{ sequence: 1, text: '' }])
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(
    new Set(BUILT_IN_AGENTS.map((a) => a.id)),
  )
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((data) => setEmployees(data ?? []))
      .catch(() => setEmployees([]))
  }, [])

  // ── Agenda helpers ──────────────────────────────────────────────────────────

  function addAgendaItem() {
    setAgenda((prev) => [
      ...prev,
      { sequence: prev.length + 1, text: '' },
    ])
  }

  function removeAgendaItem(seq: number) {
    setAgenda((prev) => {
      const next = prev.filter((i) => i.sequence !== seq)
      return next.map((item, idx) => ({ ...item, sequence: idx + 1 }))
    })
  }

  function updateAgendaItem(seq: number, text: string) {
    setAgenda((prev) => prev.map((i) => (i.sequence === seq ? { ...i, text } : i)))
  }

  function moveAgendaItem(seq: number, direction: 'up' | 'down') {
    setAgenda((prev) => {
      const idx = prev.findIndex((i) => i.sequence === seq)
      if (direction === 'up' && idx === 0) return prev
      if (direction === 'down' && idx === prev.length - 1) return prev
      const next = [...prev]
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next.map((item, i) => ({ ...item, sequence: i + 1 }))
    })
  }

  // ── Participant toggles ─────────────────────────────────────────────────────

  function toggleAgent(id: string) {
    setSelectedAgents((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleEmployee(id: string) {
    setSelectedEmployees((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanAgenda = agenda.filter((i) => i.text.trim())
    if (!title.trim()) {
      setError('Meeting title is required.')
      return
    }
    if (selectedAgents.size === 0) {
      setError('Select at least one agent.')
      return
    }

    const hints = languageHints
      .split(/[\s,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    setSaving(true)
    try {
      // 1. Create meeting
      const createRes = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          scheduled_at: scheduledAt || null,
          agenda: cleanAgenda,
          language_hints: hints.length ? hints : ['en'],
          created_by: 'admin',
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error || 'Failed to create meeting')
      }
      const meeting = await createRes.json()

      // 2. Add participants (agents + employees) in parallel
      const participantRequests = [
        ...[...selectedAgents].map((id) =>
          fetch(`/api/meetings/${meeting.id}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participant_type: 'agent', participant_id: id }),
          }),
        ),
        ...[...selectedEmployees].map((id) =>
          fetch(`/api/meetings/${meeting.id}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participant_type: 'employee', participant_id: id }),
          }),
        ),
      ]
      await Promise.all(participantRequests)

      router.push(`/admin/meetings/${meeting.id}`)
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />

      <div className="px-6 py-4 border-b border-[rgb(var(--border))]">
        <h1 className="text-xl font-bold">New Meeting</h1>
        <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
          Configure agents, agenda, and participants
        </p>
      </div>

      <main className="flex-1 p-6">
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">

          {/* Basic details */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--muted-foreground))]">
              Details
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1.5">Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q2 Planning Meeting"
                  className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-sm focus:outline-none focus:border-[rgb(var(--primary))]"
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional meeting description"
                  className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-sm resize-none focus:outline-none focus:border-[rgb(var(--primary))]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1.5">Scheduled at</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-sm focus:outline-none focus:border-[rgb(var(--primary))]"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5">Languages</label>
                  <input
                    type="text"
                    value={languageHints}
                    onChange={(e) => setLanguageHints(e.target.value)}
                    placeholder="en no de"
                    className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-sm focus:outline-none focus:border-[rgb(var(--primary))]"
                  />
                  <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
                    Space-separated language codes (Soniox hints)
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Agenda */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--muted-foreground))]">
              Agenda
            </h2>
            <div className="space-y-2">
              {agenda.map((item, idx) => (
                <div key={item.sequence} className="flex items-center gap-2">
                  <GripVertical size={14} className="text-[rgb(var(--muted-foreground))] shrink-0" />
                  <span className="text-xs text-[rgb(var(--muted-foreground))] w-5 shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => updateAgendaItem(item.sequence, e.target.value)}
                    placeholder={`Agenda item ${idx + 1}`}
                    className="flex-1 px-3 py-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-sm focus:outline-none focus:border-[rgb(var(--primary))]"
                  />
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveAgendaItem(item.sequence, 'up')}
                      disabled={idx === 0}
                      className="p-0.5 text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] disabled:opacity-20"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveAgendaItem(item.sequence, 'down')}
                      disabled={idx === agenda.length - 1}
                      className="p-0.5 text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] disabled:opacity-20"
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAgendaItem(item.sequence)}
                    disabled={agenda.length === 1}
                    className="p-1.5 text-[rgb(var(--muted-foreground))] hover:text-red-400 disabled:opacity-20 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addAgendaItem}
              className="flex items-center gap-2 text-sm text-[rgb(var(--primary))] hover:underline"
            >
              <Plus size={13} /> Add item
            </button>
          </section>

          {/* Agents */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--muted-foreground))]">
              Agents
            </h2>
            <div className="grid gap-3">
              {BUILT_IN_AGENTS.map((agent) => {
                const active = selectedAgents.has(agent.id)
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAgent(agent.id)}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      active
                        ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/5'
                        : 'border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{agent.name}</span>
                      <div
                        className={`w-4 h-4 rounded-full border-2 transition-colors ${
                          active
                            ? 'bg-[rgb(var(--primary))] border-[rgb(var(--primary))]'
                            : 'border-[rgb(var(--muted-foreground))]'
                        }`}
                      />
                    </div>
                    <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">{agent.description}</p>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Employees */}
          {employees.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--muted-foreground))]">
                Employees (optional)
              </h2>
              <p className="text-xs text-[rgb(var(--muted-foreground))]">
                Selected employees will join the meeting and respond when directly addressed by name.
              </p>
              <div className="grid gap-2">
                {employees.map((emp) => {
                  const active = selectedEmployees.has(emp.id)
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleEmployee(emp.id)}
                      className={`text-left rounded-xl border p-3 transition-colors flex items-center justify-between ${
                        active
                          ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/5'
                          : 'border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-semibold">
                            {emp.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm font-medium">{emp.name}</span>
                          {emp.description && (
                            <p className="text-xs text-[rgb(var(--muted-foreground))]">{emp.description}</p>
                          )}
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                          active
                            ? 'bg-[rgb(var(--primary))] border-[rgb(var(--primary))]'
                            : 'border-[rgb(var(--muted-foreground))]'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Error + submit */}
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-2">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Creating…' : 'Create Meeting'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg border border-[rgb(var(--border))] text-sm hover:bg-[rgb(var(--muted))] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
