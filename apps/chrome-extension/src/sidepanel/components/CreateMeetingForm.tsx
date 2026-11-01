import { useState, useEffect } from 'react'
import { ChevronLeft, Plus, X, Check } from 'lucide-react'
import { api } from '../lib/api'
import type { Employee } from '../lib/api'
import type { Meeting } from '../../types'

const AGENTS = [
  { id: 'decision-logger',  label: 'Decision Logger',  description: 'Logs decisions made during the meeting' },
  { id: 'qa-agent',         label: 'Q&A Agent',        description: 'Answers questions from transcript and chat' },
  { id: 'meetings-monitor', label: 'Meetings Monitor', description: 'Tracks agenda progress and meeting status' },
]

interface Props {
  onSave: (meeting: Meeting) => void   // meeting started — enter live view
  onScheduled: () => void              // meeting saved but not started — back to list
  onBack: () => void
}

export function CreateMeetingForm({ onSave, onScheduled, onBack }: Props) {
  const [startNow, setStartNow] = useState(true)
  const [scheduledAt, setScheduledAt] = useState('')
  const [title, setTitle] = useState('')
  const [agendaItems, setAgendaItems] = useState<string[]>([''])
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(
    new Set(AGENTS.map((a) => a.id)),
  )
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => {})
  }, [])

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

  function addAgendaItem() {
    setAgendaItems((prev) => [...prev, ''])
  }

  function updateAgendaItem(index: number, value: string) {
    setAgendaItems((prev) => prev.map((item, i) => (i === index ? value : item)))
  }

  function removeAgendaItem(index: number) {
    setAgendaItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setError(null)
    setSaving(true)

    try {
      const agenda = agendaItems
        .map((text, i) => ({ sequence: i + 1, text: text.trim() }))
        .filter((item) => item.text.length > 0)

      const meeting = await api.meetings.create({
        title: title.trim(),
        scheduled_at: startNow ? undefined : scheduledAt || undefined,
        agenda,
      })

      // Add participants in parallel
      const participantCalls = [
        ...Array.from(selectedAgents).map((agentId) =>
          api.meetings.addParticipant(meeting.id, 'agent', agentId).catch(() => {}),
        ),
        ...Array.from(selectedEmployees).map((empId) =>
          api.meetings.addParticipant(meeting.id, 'employee', empId).catch(() => {}),
        ),
      ]
      await Promise.all(participantCalls)

      if (startNow) {
        await api.meetings.start(meeting.id).catch(() => {})
        onSave(meeting)
      } else {
        onScheduled()
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create meeting')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgb(var(--border))]">
        <button
          type="button"
          onClick={onBack}
          className="p-1 rounded hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]"
        >
          <ChevronLeft size={15} />
        </button>
        <h2 className="text-sm font-semibold">New Meeting</h2>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* When */}
        <div>
          <p className="text-xs font-medium text-[rgb(var(--muted-foreground))] uppercase tracking-wide mb-2">
            When
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStartNow(true)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                startNow
                  ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] border-transparent'
                  : 'border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))]'
              }`}
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => setStartNow(false)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                !startNow
                  ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] border-transparent'
                  : 'border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))]'
              }`}
            >
              Schedule
            </button>
          </div>
          {!startNow && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-2 w-full px-2 py-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/30 text-xs outline-none focus:border-[rgb(var(--primary))]/60 [color-scheme:dark]"
            />
          )}
        </div>

        {/* Title */}
        <div>
          <p className="text-xs font-medium text-[rgb(var(--muted-foreground))] uppercase tracking-wide mb-2">
            Title
          </p>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting title"
            className="w-full px-2 py-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/30 text-xs outline-none focus:border-[rgb(var(--primary))]/60"
          />
        </div>

        {/* Agenda */}
        <div>
          <p className="text-xs font-medium text-[rgb(var(--muted-foreground))] uppercase tracking-wide mb-2">
            Agenda <span className="normal-case font-normal">(optional)</span>
          </p>
          <div className="space-y-1.5">
            {agendaItems.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-xs text-[rgb(var(--muted-foreground))] w-4 shrink-0 text-right">
                  {i + 1}.
                </span>
                <input
                  value={item}
                  onChange={(e) => updateAgendaItem(i, e.target.value)}
                  placeholder={`Item ${i + 1}`}
                  className="flex-1 px-2 py-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/30 text-xs outline-none focus:border-[rgb(var(--primary))]/60"
                />
                {agendaItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAgendaItem(i)}
                    className="p-1 rounded hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] shrink-0"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addAgendaItem}
              className="flex items-center gap-1 text-xs text-[rgb(var(--primary))] hover:underline mt-1 ml-5"
            >
              <Plus size={10} /> Add item
            </button>
          </div>
        </div>

        {/* Agents */}
        <div>
          <p className="text-xs font-medium text-[rgb(var(--muted-foreground))] uppercase tracking-wide mb-2">
            Agents
          </p>
          <div className="space-y-1.5">
            {AGENTS.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => toggleAgent(agent.id)}
                className={`w-full flex items-start gap-2 p-2 rounded-lg border text-left transition-colors ${
                  selectedAgents.has(agent.id)
                    ? 'border-[rgb(var(--primary))]/40 bg-[rgb(var(--primary))]/5'
                    : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))]/30'
                }`}
              >
                <span
                  className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${
                    selectedAgents.has(agent.id)
                      ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                      : 'border border-[rgb(var(--border))]'
                  }`}
                >
                  {selectedAgents.has(agent.id) && <Check size={9} />}
                </span>
                <div>
                  <p className="text-xs font-medium">{agent.label}</p>
                  <p className="text-xs text-[rgb(var(--muted-foreground))]">{agent.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Employees */}
        {employees.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[rgb(var(--muted-foreground))] uppercase tracking-wide mb-2">
              Employees <span className="normal-case font-normal">(optional)</span>
            </p>
            <div className="space-y-1.5">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => toggleEmployee(emp.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                    selectedEmployees.has(emp.id)
                      ? 'border-[rgb(var(--primary))]/40 bg-[rgb(var(--primary))]/5'
                      : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))]/30'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${
                      selectedEmployees.has(emp.id)
                        ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                        : 'border border-[rgb(var(--border))]'
                    }`}
                  >
                    {selectedEmployees.has(emp.id) && <Check size={9} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{emp.name}</p>
                    <p className="text-xs text-[rgb(var(--muted-foreground))] truncate">{emp.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{error}</p>
        )}
      </div>

      {/* Save */}
      <div className="px-3 py-3 border-t border-[rgb(var(--border))]">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="w-full py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Creating…' : startNow ? 'Start Meeting' : 'Save Meeting'}
        </button>
      </div>
    </div>
  )
}
