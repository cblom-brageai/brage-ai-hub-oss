'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Square, RefreshCw, CheckCircle,
  MessageSquare, ListChecks, FileText, Mic, Radio,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { NavHeader } from '@/components/nav-header'
import { getSupabase } from '@/lib/supabase'
import type {
  Meeting, MeetingDecision, MeetingQAPair,
  MeetingAgendaStatus, MeetingTranscription, MeetingMoM,
} from '@/lib/meetings/types'

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview',   icon: Radio },
  { id: 'transcript',label: 'Transcript', icon: Mic },
  { id: 'decisions', label: 'Decisions',  icon: CheckCircle },
  { id: 'qa',        label: 'Q&A',        icon: MessageSquare },
  { id: 'agenda',    label: 'Agenda',     icon: ListChecks },
  { id: 'mom',       label: 'MoM',        icon: FileText },
] as const

type TabId = typeof TABS[number]['id']

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Meeting['status'] }) {
  const cls: Record<string, string> = {
    scheduled: 'bg-blue-500/10 text-blue-400',
    active:    'bg-green-500/10 text-green-400',
    ended:     'bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]',
    cancelled: 'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[status] ?? ''}`}>
      {status === 'active' ? 'LIVE' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function confidence(n: number | null) {
  if (n === null) return ''
  return `${Math.round(n * 100)}%`
}

const AGENDA_STATUS_CLASS: Record<string, string> = {
  pending:     'text-[rgb(var(--muted-foreground))]',
  in_progress: 'text-blue-400',
  completed:   'text-green-400',
  skipped:     'text-[rgb(var(--muted-foreground))] line-through',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [tab, setTab] = useState<TabId>('overview')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Realtime-updated data
  const [transcriptions, setTranscriptions] = useState<MeetingTranscription[]>([])
  const [decisions, setDecisions] = useState<MeetingDecision[]>([])
  const [qaPairs, setQaPairs] = useState<MeetingQAPair[]>([])
  const [agendaStatus, setAgendaStatus] = useState<MeetingAgendaStatus[]>([])
  const [mom, setMom] = useState<MeetingMoM | null>(null)

  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    loadAll()
  }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      const [mRes, tRes, dRes, qRes, aRes, momRes] = await Promise.all([
        fetch(`/api/meetings/${id}`),
        fetch(`/api/meetings/${id}/transcriptions`),
        fetch(`/api/meetings/${id}/decisions`),
        fetch(`/api/meetings/${id}/qa`),
        fetch(`/api/meetings/${id}/agenda-status`),
        fetch(`/api/meetings/${id}/mom`),
      ])
      if (mRes.ok) setMeeting(await mRes.json())
      if (tRes.ok) setTranscriptions(await tRes.json())
      if (dRes.ok) setDecisions(await dRes.json())
      if (qRes.ok) setQaPairs(await qRes.json())
      if (aRes.ok) setAgendaStatus(await aRes.json())
      if (momRes.ok) setMom(await momRes.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── Supabase Realtime ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    const db = getSupabase()

    const channel = db
      .channel(`meeting-detail:${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'meeting_transcriptions',
        filter: `meeting_id=eq.${id}`,
      }, (payload) => {
        setTranscriptions((prev) => [...prev, payload.new as MeetingTranscription])
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'meeting_decisions',
        filter: `meeting_id=eq.${id}`,
      }, (payload) => {
        setDecisions((prev) => [payload.new as MeetingDecision, ...prev])
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'meeting_qa_pairs',
        filter: `meeting_id=eq.${id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setQaPairs((prev) => [...prev, payload.new as MeetingQAPair])
        } else if (payload.eventType === 'UPDATE') {
          setQaPairs((prev) =>
            prev.map((q) => (q.id === (payload.new as MeetingQAPair).id ? payload.new as MeetingQAPair : q)),
          )
        }
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'meeting_agenda_status',
        filter: `meeting_id=eq.${id}`,
      }, (payload) => {
        const updated = payload.new as MeetingAgendaStatus
        setAgendaStatus((prev) => {
          const exists = prev.find((a) => a.agenda_sequence === updated.agenda_sequence)
          return exists
            ? prev.map((a) => (a.agenda_sequence === updated.agenda_sequence ? updated : a))
            : [...prev, updated]
        })
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'meeting_mom',
        filter: `meeting_id=eq.${id}`,
      }, (payload) => {
        setMom(payload.new as MeetingMoM)
        setTab('mom')
      })
      .subscribe()

    return () => { db.removeChannel(channel) }
  }, [id])

  // Auto-scroll transcript
  useEffect(() => {
    if (tab === 'transcript') {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [transcriptions, tab])

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleEnd() {
    if (!confirm('End this meeting? This will generate Minutes of Meeting.')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/meetings/${id}/end`, { method: 'POST' })
      if (res.ok) {
        setMeeting((prev) => prev ? { ...prev, status: 'ended' } : prev)
        setTab('mom')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavHeader />
        <div className="flex-1 flex items-center justify-center text-[rgb(var(--muted-foreground))] text-sm">
          Loading…
        </div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavHeader />
        <div className="flex-1 flex items-center justify-center text-[rgb(var(--muted-foreground))] text-sm">
          Meeting not found.
        </div>
      </div>
    )
  }

  const agenda = meeting.agenda ?? []
  const agendaStatusMap = Object.fromEntries(
    agendaStatus.map((a) => [a.agenda_sequence, a]),
  )

  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />

      {/* Meeting header */}
      <div className="px-6 py-4 border-b border-[rgb(var(--border))] flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold">{meeting.title}</h1>
            <StatusBadge status={meeting.status} />
          </div>
          {meeting.description && (
            <p className="text-sm text-[rgb(var(--muted-foreground))]">{meeting.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadAll}
            className="p-2 rounded-lg border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {meeting.status === 'active' && (
            <button
              onClick={handleEnd}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              <Square size={13} />
              End Meeting
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-[rgb(var(--border))] flex items-center gap-1 overflow-x-auto">
        {TABS.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`flex items-center gap-1.5 px-3 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
              tab === tabId
                ? 'border-[rgb(var(--primary))] text-[rgb(var(--primary))] font-medium'
                : 'border-transparent text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]'
            }`}
          >
            <Icon size={13} />
            {label}
            {tabId === 'decisions' && decisions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))] text-xs">
                {decisions.length}
              </span>
            )}
            {tabId === 'qa' && qaPairs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))] text-xs">
                {qaPairs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <main className="flex-1 p-6 overflow-auto">

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="max-w-2xl space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Utterances', value: transcriptions.length },
                { label: 'Decisions', value: decisions.length },
                { label: 'Q&A Pairs', value: qaPairs.length },
                { label: 'Agenda Items', value: agenda.length },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 text-center">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">{label}</p>
                </div>
              ))}
            </div>

            {meeting.meeting_participants && meeting.meeting_participants.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Participants</h3>
                <div className="space-y-2">
                  {meeting.meeting_participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg border border-[rgb(var(--border))] px-3 py-2">
                      <span className={`w-2 h-2 rounded-full ${p.active ? 'bg-green-400' : 'bg-[rgb(var(--muted-foreground))]'}`} />
                      <span className="text-sm capitalize">{p.participant_id.replace(/-/g, ' ')}</span>
                      <span className="text-xs text-[rgb(var(--muted-foreground))] ml-auto">{p.participant_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {agenda.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Agenda</h3>
                <div className="space-y-1">
                  {agenda.map((item) => {
                    const status = agendaStatusMap[item.sequence]?.status ?? 'pending'
                    return (
                      <div key={item.sequence} className="flex items-center gap-3 text-sm">
                        <span className="text-[rgb(var(--muted-foreground))] w-5 shrink-0">{item.sequence}.</span>
                        <span className={AGENDA_STATUS_CLASS[status]}>{item.text}</span>
                        <span className="text-xs text-[rgb(var(--muted-foreground))] ml-auto capitalize">{status.replace('_', ' ')}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Transcript ── */}
        {tab === 'transcript' && (
          <div className="max-w-3xl space-y-1 font-mono text-sm">
            {transcriptions.length === 0 ? (
              <p className="text-[rgb(var(--muted-foreground))] text-sm py-8 text-center">
                {meeting.status === 'active' ? 'Waiting for audio…' : 'No transcript available.'}
              </p>
            ) : (
              transcriptions.map((t) => (
                <div key={t.id} className="flex gap-3 py-1 group">
                  <span className="text-xs text-[rgb(var(--muted-foreground))] w-16 shrink-0 pt-0.5 tabular-nums">
                    {ts(t.created_at)}
                  </span>
                  <span className="w-28 shrink-0 text-[rgb(var(--primary))] text-xs pt-0.5 font-sans">
                    {t.speaker_label ?? `Speaker ${t.speaker_id ?? '?'}`}
                  </span>
                  <span>{t.text}</span>
                  {t.language && t.language !== 'en' && (
                    <span className="text-xs text-[rgb(var(--muted-foreground))] ml-auto">[{t.language}]</span>
                  )}
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* ── Decisions ── */}
        {tab === 'decisions' && (
          <div className="max-w-2xl space-y-3">
            {decisions.length === 0 ? (
              <p className="text-[rgb(var(--muted-foreground))] text-sm py-8 text-center">No decisions logged yet.</p>
            ) : (
              decisions.map((d) => (
                <div key={d.id} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{d.decision_text}</p>
                    {d.confidence !== null && (
                      <span className="text-xs text-[rgb(var(--muted-foreground))] shrink-0">{confidence(d.confidence)}</span>
                    )}
                  </div>
                  {d.context_quote && (
                    <blockquote className="border-l-2 border-[rgb(var(--primary))]/40 pl-3 text-xs text-[rgb(var(--muted-foreground))] italic">
                      &quot;{d.context_quote}&quot;
                    </blockquote>
                  )}
                  <p className="text-xs text-[rgb(var(--muted-foreground))]">{ts(d.logged_at)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Q&A ── */}
        {tab === 'qa' && (
          <div className="max-w-2xl space-y-4">
            {qaPairs.length === 0 ? (
              <p className="text-[rgb(var(--muted-foreground))] text-sm py-8 text-center">No questions logged yet.</p>
            ) : (
              qaPairs.map((qa) => (
                <div key={qa.id} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs bg-[rgb(var(--muted))] px-2 py-0.5 rounded-full shrink-0 mt-0.5">
                      {qa.question_source}
                    </span>
                    <p className="font-medium text-sm">{qa.question_text}</p>
                  </div>
                  {qa.answered ? (
                    <div className="pl-3 border-l-2 border-[rgb(var(--primary))]/40">
                      <p className="text-sm text-[rgb(var(--muted-foreground))]">{qa.answer_text}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-[rgb(var(--muted-foreground))] italic pl-3">Answering…</p>
                  )}
                  <p className="text-xs text-[rgb(var(--muted-foreground))]">{ts(qa.asked_at)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Agenda ── */}
        {tab === 'agenda' && (
          <div className="max-w-2xl space-y-3">
            {agenda.length === 0 ? (
              <p className="text-[rgb(var(--muted-foreground))] text-sm py-8 text-center">No agenda defined.</p>
            ) : (
              agenda.map((item) => {
                const status = agendaStatusMap[item.sequence]?.status ?? 'pending'
                const addressedAt = agendaStatusMap[item.sequence]?.first_addressed_at
                return (
                  <div key={item.sequence} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 flex items-center gap-4">
                    <span className="text-lg font-bold text-[rgb(var(--muted-foreground))] w-6 shrink-0">
                      {item.sequence}
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${AGENDA_STATUS_CLASS[status]}`}>{item.text}</p>
                      {addressedAt && (
                        <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
                          First addressed {ts(addressedAt)}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      status === 'completed' ? 'bg-green-500/10 text-green-400'
                      : status === 'in_progress' ? 'bg-blue-500/10 text-blue-400'
                      : status === 'skipped' ? 'bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]'
                      : 'bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]'
                    }`}>
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── MoM ── */}
        {tab === 'mom' && (
          <div className="max-w-2xl">
            {!mom ? (
              <p className="text-[rgb(var(--muted-foreground))] text-sm py-8 text-center">
                {meeting.status === 'ended'
                  ? 'Minutes of Meeting are being generated…'
                  : 'Minutes of Meeting will be generated when the meeting ends.'}
              </p>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-[rgb(var(--muted-foreground))]">
                    Version {mom.version} · Generated {ts(mom.generated_at)}
                  </p>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
                  <ReactMarkdown>{mom.content}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
