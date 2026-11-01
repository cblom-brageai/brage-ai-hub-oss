import { useState, useEffect } from 'react'
import { Calendar, Radio, Clock, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { CreateMeetingForm } from './CreateMeetingForm'
import type { Meeting } from '../../types'

interface Props {
  onSelect: (meeting: Meeting) => void
}

export function MeetingSelector({ onSelect }: Props) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  function fetchMeetings() {
    setLoading(true)
    Promise.all([
      api.meetings.list('active'),
      api.meetings.list('scheduled'),
    ])
      .then(([active, scheduled]) => setMeetings([...active, ...scheduled]))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchMeetings() }, [])

  if (showCreate) {
    return (
      <CreateMeetingForm
        onSave={onSelect}
        onScheduled={() => { setShowCreate(false); fetchMeetings() }}
        onBack={() => setShowCreate(false)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[rgb(var(--border))] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Meetings</h2>
          <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
            {loading ? 'Loading…' : `${meetings.length} active or upcoming`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={12} />
          Add Meeting
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[rgb(var(--muted-foreground))] text-xs">
            Loading meetings…
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-[rgb(var(--muted-foreground))]">
            <Calendar size={28} className="opacity-30" />
            <p className="text-xs text-center">No active or scheduled meetings.</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="text-xs text-[rgb(var(--primary))] hover:underline"
            >
              Create one now
            </button>
          </div>
        ) : (
          meetings.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              className="w-full text-left rounded-xl border border-[rgb(var(--border))] p-3 hover:border-[rgb(var(--primary))]/60 hover:bg-[rgb(var(--muted))]/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium line-clamp-1">{m.title}</span>
                {m.status === 'active' ? (
                  <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full shrink-0">
                    <Radio size={9} />
                    Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-[rgb(var(--muted-foreground))] shrink-0">
                    <Clock size={9} />
                    Scheduled
                  </span>
                )}
              </div>
              {m.scheduled_at && (
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  {new Date(m.scheduled_at).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
              {m.agenda.length > 0 && (
                <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
                  {m.agenda.length} agenda item{m.agenda.length !== 1 ? 's' : ''}
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
