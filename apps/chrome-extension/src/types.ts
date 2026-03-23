// Shared types for the extension (mirrors apps/frontend/src/lib/meetings/types.ts)

export type MeetingStatus = 'scheduled' | 'active' | 'ended' | 'cancelled'

export interface AgendaItem {
  sequence: number
  text: string
}

export interface Meeting {
  id: string
  title: string
  description: string | null
  status: MeetingStatus
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  agenda: AgendaItem[]
  language_hints: string[]
}

export interface MeetingTranscription {
  id: string
  meeting_id: string
  speaker_id: number | null
  speaker_label: string | null
  text: string
  language: string | null
  sequence_number: number
  created_at: string
}

export interface MeetingDecision {
  id: string
  meeting_id: string
  decision_text: string
  context_quote: string | null
  confidence: number | null
  logged_at: string
}

export interface MeetingQAPair {
  id: string
  meeting_id: string
  question_text: string
  question_source: 'transcript' | 'chat'
  answer_text: string | null
  answered: boolean
  asked_at: string
  answered_at: string | null
}

export interface MeetingAgendaStatus {
  id: string
  meeting_id: string
  agenda_sequence: number
  agenda_item_text: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  first_addressed_at: string | null
}

// A finalized utterance ready to POST to the backend
export interface UtterancePayload {
  speaker_id: number | null
  speaker_label: string | null
  text: string
  language: string | null
  timestamp_ms: number
  sequence_number: number
}

// A live (partial) token from Soniox, shown before the utterance is finalized
export interface LiveToken {
  text: string
  is_final: boolean
  speaker: number
  language: string
}
