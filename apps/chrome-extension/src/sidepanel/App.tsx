'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Mic, MicOff, Square, LogOut, ChevronLeft,
  Sun, Moon, Radio, MessageSquare, CheckCircle, ListChecks,
} from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useSoniox } from './hooks/useSoniox'
import { useMeetingRealtime } from './hooks/useMeetingRealtime'
import { LoginForm } from './components/LoginForm'
import { MeetingSelector } from './components/MeetingSelector'
import { TranscriptFeed } from './components/TranscriptFeed'
import { AgentActivity } from './components/AgentActivity'
import { ChatInterface } from './components/ChatInterface'
import { api } from './lib/api'
import type { Meeting, UtterancePayload } from '../types'

// ── Theme ─────────────────────────────────────────────────────────────────────

function useTheme() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    return stored ? stored === 'dark' : true // default dark
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark((d) => !d) }
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'live',      label: 'Live',      icon: Radio },
  { id: 'chat',      label: 'Chat',      icon: MessageSquare },
  { id: 'decisions', label: 'Decisions', icon: CheckCircle },
  { id: 'agenda',    label: 'Agenda',    icon: ListChecks },
] as const

type TabId = typeof TABS[number]['id']

// ── App ───────────────────────────────────────────────────────────────────────

export function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth()
  const { dark, toggle: toggleTheme } = useTheme()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [tab, setTab] = useState<TabId>('live')
  const [localTranscriptions, setLocalTranscriptions] = useState<UtterancePayload[]>([])

  const realtimeData = useMeetingRealtime(meeting?.id ?? null)

  const handleUtterance = useCallback((u: UtterancePayload) => {
    setLocalTranscriptions((prev) => [...prev, u])
  }, [])

  const soniox = useSoniox({
    meetingId: meeting?.id ?? '',
    languageHints: meeting?.language_hints ?? ['en'],
    onUtterance: handleUtterance,
  })

  // Merge local utterances (created on this device) with Realtime transcriptions
  // Realtime already includes the persisted ones — deduplicate by sequence_number
  const realtimeSeqs = new Set(realtimeData.transcriptions.map((t) => t.sequence_number))
  const pendingLocal = localTranscriptions.filter((u) => !realtimeSeqs.has(u.sequence_number))
  const allTranscriptions = [
    ...realtimeData.transcriptions,
    // Show pending local utterances as "transcriptions" with synthetic id
    ...pendingLocal.map((u) => ({
      id: `local-${u.sequence_number}`,
      meeting_id: meeting?.id ?? '',
      speaker_id: u.speaker_id,
      speaker_label: u.speaker_label,
      text: u.text,
      language: u.language,
      sequence_number: u.sequence_number,
      created_at: new Date().toISOString(),
    })),
  ].sort((a, b) => a.sequence_number - b.sequence_number)

  async function handleSelectMeeting(m: Meeting) {
    setMeeting(m)
    setLocalTranscriptions([])
    setTab('live')
    // Auto-start if already active
    if (m.status !== 'active') {
      await api.meetings.start(m.id).catch(console.error)
    }
  }

  async function handleStopMeeting() {
    soniox.stop()
    if (meeting) {
      await api.meetings.end(meeting.id).catch(console.error)
    }
    setMeeting(null)
    setLocalTranscriptions([])
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-xs text-[rgb(var(--muted-foreground))]">
        Loading…
      </div>
    )
  }

  // ── Not authed ───────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex justify-end p-2">
          <button onClick={toggleTheme} className="p-1.5 rounded-lg hover:bg-[rgb(var(--muted))]">
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
        <div className="flex-1">
          <LoginForm onSignIn={signIn} />
        </div>
      </div>
    )
  }

  // ── No meeting selected ───────────────────────────────────────────────────────

  if (!meeting) {
    return (
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[rgb(var(--primary))] flex items-center justify-center">
              <span className="text-[rgb(var(--primary-foreground))] font-bold text-xs">B</span>
            </div>
            <span className="text-xs font-semibold">Meeting Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="p-1.5 rounded-lg hover:bg-[rgb(var(--muted))]">
              {dark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            <button
              onClick={signOut}
              className="p-1.5 rounded-lg hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <MeetingSelector onSelect={handleSelectMeeting} />
        </div>
      </div>
    )
  }

  // ── Meeting active ────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col">
      {/* Meeting header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[rgb(var(--border))] gap-2">
        <button
          onClick={() => { soniox.stop(); setMeeting(null) }}
          className="p-1 rounded hover:bg-[rgb(var(--muted))] shrink-0"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{meeting.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {soniox.recording ? (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Recording
              </span>
            ) : (
              <span className="text-xs text-[rgb(var(--muted-foreground))]">Ready</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={toggleTheme} className="p-1.5 rounded hover:bg-[rgb(var(--muted))]">
            {dark ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          {soniox.recording ? (
            <button
              onClick={soniox.stop}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600 transition-colors"
            >
              <Square size={11} /> Stop
            </button>
          ) : (
            <button
              onClick={soniox.start}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-xs hover:opacity-90 transition-opacity"
            >
              <Mic size={11} /> Record
            </button>
          )}
          <button
            onClick={handleStopMeeting}
            className="p-1.5 rounded-lg border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] text-xs text-[rgb(var(--muted-foreground))]"
            title="End meeting"
          >
            <MicOff size={13} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {soniox.error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">
          {soniox.error}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-[rgb(var(--border))] px-1 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1 px-3 py-2 text-xs border-b-2 whitespace-nowrap transition-colors ${
              tab === id
                ? 'border-[rgb(var(--primary))] text-[rgb(var(--primary))] font-medium'
                : 'border-transparent text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]'
            }`}
          >
            <Icon size={11} />
            {label}
            {id === 'decisions' && realtimeData.decisions.length > 0 && (
              <span className="ml-1 px-1 rounded-full bg-[rgb(var(--primary))]/20 text-[rgb(var(--primary))] text-xs leading-4">
                {realtimeData.decisions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'live' && (
          <div className="h-full overflow-y-auto p-3">
            <p className="text-xs font-semibold text-[rgb(var(--muted-foreground))] mb-2 uppercase tracking-wide">
              Transcript
            </p>
            <TranscriptFeed
              transcriptions={allTranscriptions}
              liveText={soniox.liveText}
              recording={soniox.recording}
            />
            {(realtimeData.decisions.length > 0 ||
              realtimeData.qaPairs.filter((q) => q.answered).length > 0 ||
              realtimeData.agendaStatus.length > 0) && (
              <>
                <div className="border-t border-[rgb(var(--border))] my-3" />
                <p className="text-xs font-semibold text-[rgb(var(--muted-foreground))] mb-2 uppercase tracking-wide">
                  Agent Activity
                </p>
                <AgentActivity
                  decisions={realtimeData.decisions}
                  qaPairs={realtimeData.qaPairs}
                  agendaStatus={realtimeData.agendaStatus}
                />
              </>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <ChatInterface
            meetingId={meeting.id}
            qaPairs={realtimeData.qaPairs}
          />
        )}

        {tab === 'decisions' && (
          <div className="h-full overflow-y-auto p-3 space-y-2">
            {realtimeData.decisions.length === 0 ? (
              <p className="text-xs text-[rgb(var(--muted-foreground))] text-center py-6">
                No decisions logged yet.
              </p>
            ) : (
              realtimeData.decisions.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3 space-y-1.5"
                >
                  <p className="text-xs font-medium">{d.decision_text}</p>
                  {d.context_quote && (
                    <p className="text-xs text-[rgb(var(--muted-foreground))] italic line-clamp-2">
                      "{d.context_quote}"
                    </p>
                  )}
                  {d.confidence !== null && (
                    <p className="text-xs text-[rgb(var(--muted-foreground))]">
                      {Math.round(d.confidence * 100)}% confidence
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'agenda' && (
          <div className="h-full overflow-y-auto p-3 space-y-1.5">
            {meeting.agenda.length === 0 ? (
              <p className="text-xs text-[rgb(var(--muted-foreground))] text-center py-6">
                No agenda defined for this meeting.
              </p>
            ) : (
              meeting.agenda.map((item) => {
                const status = realtimeData.agendaStatus.find(
                  (a) => a.agenda_sequence === item.sequence,
                )?.status ?? 'pending'
                return (
                  <div
                    key={item.sequence}
                    className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-3 py-2"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        status === 'completed' ? 'bg-green-400'
                        : status === 'in_progress' ? 'bg-blue-400'
                        : 'bg-[rgb(var(--muted-foreground))] opacity-40'
                      }`}
                    />
                    <span
                      className={`text-xs flex-1 ${
                        status === 'completed'
                          ? 'line-through text-[rgb(var(--muted-foreground))]'
                          : status === 'in_progress'
                          ? 'text-blue-400'
                          : ''
                      }`}
                    >
                      {item.text}
                    </span>
                    <span className="text-xs text-[rgb(var(--muted-foreground))] shrink-0 capitalize">
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
