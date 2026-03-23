/**
 * Subscribes to Supabase Realtime for all agent outputs of a meeting.
 * Returns live-updated lists of decisions, Q&A pairs, and agenda status.
 */

import { useState, useEffect } from 'react'
import { getSupabase } from '../lib/supabase'
import type {
  MeetingDecision, MeetingQAPair, MeetingAgendaStatus, MeetingTranscription,
} from '../../types'

export function useMeetingRealtime(meetingId: string | null) {
  const [transcriptions, setTranscriptions] = useState<MeetingTranscription[]>([])
  const [decisions, setDecisions] = useState<MeetingDecision[]>([])
  const [qaPairs, setQaPairs] = useState<MeetingQAPair[]>([])
  const [agendaStatus, setAgendaStatus] = useState<MeetingAgendaStatus[]>([])

  // Clear state when meeting changes
  useEffect(() => {
    setTranscriptions([])
    setDecisions([])
    setQaPairs([])
    setAgendaStatus([])
  }, [meetingId])

  useEffect(() => {
    if (!meetingId) return

    const db = getSupabase()

    const channel = db
      .channel(`ext-meeting:${meetingId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'meeting_transcriptions',
        filter: `meeting_id=eq.${meetingId}`,
      }, (payload) => {
        setTranscriptions((prev) => [...prev, payload.new as MeetingTranscription])
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'meeting_decisions',
        filter: `meeting_id=eq.${meetingId}`,
      }, (payload) => {
        setDecisions((prev) => [payload.new as MeetingDecision, ...prev])
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'meeting_qa_pairs',
        filter: `meeting_id=eq.${meetingId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setQaPairs((prev) => [...prev, payload.new as MeetingQAPair])
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as MeetingQAPair
          setQaPairs((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
        }
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'meeting_agenda_status',
        filter: `meeting_id=eq.${meetingId}`,
      }, (payload) => {
        const updated = payload.new as MeetingAgendaStatus
        setAgendaStatus((prev) => {
          const exists = prev.some((a) => a.agenda_sequence === updated.agenda_sequence)
          return exists
            ? prev.map((a) => (a.agenda_sequence === updated.agenda_sequence ? updated : a))
            : [...prev, updated].sort((a, b) => a.agenda_sequence - b.agenda_sequence)
        })
      })
      .subscribe()

    return () => { db.removeChannel(channel) }
  }, [meetingId])

  return { transcriptions, decisions, qaPairs, agendaStatus }
}
