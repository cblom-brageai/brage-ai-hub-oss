// ─── Core types ──────────────────────────────────────────────────────────────

export type MeetingStatus = 'scheduled' | 'active' | 'ended' | 'cancelled'
export type ParticipantType = 'agent' | 'employee'
export type AgendaItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type QuestionSource = 'transcript' | 'chat'

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
  created_by: string | null
  created_at: string
  updated_at: string
  meeting_participants?: MeetingParticipant[]
}

export interface MeetingParticipant {
  id: string
  meeting_id: string
  participant_type: ParticipantType
  participant_id: string
  active: boolean
  joined_at: string
}

// ─── Transcript ───────────────────────────────────────────────────────────────

export interface MeetingTranscription {
  id: string
  meeting_id: string
  speaker_id: number | null
  speaker_label: string | null
  text: string
  language: string | null
  timestamp_ms: number | null
  sequence_number: number
  created_at: string
}

// Partial utterance streamed from Soniox before is_final (for live display)
export interface LiveToken {
  text: string
  is_final: boolean
  speaker: number
  language: string
}

// Finalized utterance posted to /api/meetings/[id]/utterance
export interface UtterancePayload {
  speaker_id: number | null
  speaker_label: string | null
  text: string
  language: string | null
  timestamp_ms: number
  sequence_number: number
}

// ─── Agent outputs ────────────────────────────────────────────────────────────

export interface MeetingDecision {
  id: string
  meeting_id: string
  decision_text: string
  context_quote: string | null
  triggered_at_sequence: number | null
  confidence: number | null
  agent_id: string
  logged_at: string
}

export interface MeetingQAPair {
  id: string
  meeting_id: string
  question_text: string
  question_source: QuestionSource
  answer_text: string | null
  artefact_refs: string[]
  answered: boolean
  agent_id: string
  asked_at: string
  answered_at: string | null
}

export interface MeetingAgendaStatus {
  id: string
  meeting_id: string
  agenda_sequence: number
  agenda_item_text: string
  status: AgendaItemStatus
  first_addressed_at: string | null
  agent_id: string
  updated_at: string
}

export interface MeetingMoM {
  id: string
  meeting_id: string
  content: string
  version: number
  agent_id: string
  generated_at: string
}

// ─── Realtime event payloads ──────────────────────────────────────────────────

export type RealtimeEventType =
  | 'transcription'
  | 'decision'
  | 'qa_pair'
  | 'agenda_update'
  | 'mom'

export interface RealtimeEvent {
  type: RealtimeEventType
  payload:
    | MeetingTranscription
    | MeetingDecision
    | MeetingQAPair
    | MeetingAgendaStatus
    | MeetingMoM
}
