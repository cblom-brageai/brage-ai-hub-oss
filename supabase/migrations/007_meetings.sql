-- ─────────────────────────────────────────────────────────────────────────────
-- 007_meetings.sql
-- Meeting app: meetings, participants, transcriptions, agent outputs, MoM
-- ─────────────────────────────────────────────────────────────────────────────

-- Core meeting record
CREATE TABLE IF NOT EXISTS meetings (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    title           TEXT        NOT NULL,
    description     TEXT,
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    status          TEXT        NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
    -- Ordered array of agenda items: [{"sequence": 1, "text": "..."}]
    agenda          JSONB       NOT NULL DEFAULT '[]',
    -- Soniox language hints for this meeting: ["en", "no"]
    language_hints  TEXT[]      DEFAULT '{"en"}',
    created_by      TEXT,       -- employee_id or 'admin'
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meetings_status       ON meetings(status);
CREATE INDEX idx_meetings_scheduled_at ON meetings(scheduled_at);

CREATE TRIGGER meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- Participants: built-in agents or employees assigned to a meeting
CREATE TABLE IF NOT EXISTS meeting_participants (
    id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id       UUID    NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    participant_type TEXT    NOT NULL CHECK (participant_type IN ('agent', 'employee')),
    -- For agent: 'decision-logger' | 'qa-agent' | 'meetings-monitor'
    -- For employee: employee_id slug (e.g. 'marketing-manager')
    participant_id   TEXT    NOT NULL,
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (meeting_id, participant_id)
);

CREATE INDEX idx_meeting_participants_meeting ON meeting_participants(meeting_id);


-- Raw transcription stream from Soniox (one row per finalized utterance)
CREATE TABLE IF NOT EXISTS meeting_transcriptions (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id      UUID        NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    -- Speaker integer ID from Soniox diarization (1, 2, 3 ...)
    speaker_id      INTEGER,
    -- Optional human-readable label set via admin: "Speaker 1" or "John"
    speaker_label   TEXT,
    text            TEXT        NOT NULL,
    language        TEXT,       -- detected language code, e.g. 'en', 'no'
    -- Milliseconds from meeting start
    timestamp_ms    BIGINT,
    -- Monotonically increasing sequence for ordering
    sequence_number INTEGER     NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transcriptions_meeting    ON meeting_transcriptions(meeting_id);
CREATE INDEX idx_transcriptions_sequence   ON meeting_transcriptions(meeting_id, sequence_number);


-- Decisions identified and logged by the decision-logger agent
CREATE TABLE IF NOT EXISTS meeting_decisions (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id      UUID        NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    decision_text   TEXT        NOT NULL,
    -- Verbatim quote from the transcript that triggered this decision
    context_quote   TEXT,
    -- Sequence number of the triggering transcription row
    triggered_at_sequence INTEGER,
    -- 0.0–1.0 confidence from the LLM
    confidence      NUMERIC(3,2),
    agent_id        TEXT        NOT NULL DEFAULT 'decision-logger',
    logged_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decisions_meeting ON meeting_decisions(meeting_id);
CREATE INDEX idx_decisions_logged  ON meeting_decisions(meeting_id, logged_at);


-- Questions detected in transcript or chat, with agent answers
CREATE TABLE IF NOT EXISTS meeting_qa_pairs (
    id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id      UUID    NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    question_text   TEXT    NOT NULL,
    -- 'transcript': detected from live audio | 'chat': typed by user in extension
    question_source TEXT    NOT NULL DEFAULT 'transcript'
                            CHECK (question_source IN ('transcript', 'chat')),
    answer_text     TEXT,
    -- UUIDs of artefacts used to construct the answer
    artefact_refs   UUID[]  DEFAULT '{}',
    answered        BOOLEAN NOT NULL DEFAULT FALSE,
    agent_id        TEXT    NOT NULL DEFAULT 'qa-agent',
    asked_at        TIMESTAMPTZ DEFAULT NOW(),
    answered_at     TIMESTAMPTZ
);

CREATE INDEX idx_qa_meeting    ON meeting_qa_pairs(meeting_id);
CREATE INDEX idx_qa_unanswered ON meeting_qa_pairs(meeting_id, answered) WHERE answered = FALSE;


-- Per-item agenda tracking updated by the meetings-monitor agent
CREATE TABLE IF NOT EXISTS meeting_agenda_status (
    id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id          UUID    NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    -- Matches the sequence value in meetings.agenda JSONB
    agenda_sequence     INTEGER NOT NULL,
    agenda_item_text    TEXT    NOT NULL,
    status              TEXT    NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    first_addressed_at  TIMESTAMPTZ,
    agent_id            TEXT    NOT NULL DEFAULT 'meetings-monitor',
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (meeting_id, agenda_sequence)
);

CREATE INDEX idx_agenda_status_meeting ON meeting_agenda_status(meeting_id);

CREATE TRIGGER meeting_agenda_status_updated_at
    BEFORE UPDATE ON meeting_agenda_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- Minutes of Meeting produced by the meetings-monitor agent
CREATE TABLE IF NOT EXISTS meeting_mom (
    id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id   UUID    NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    content      TEXT    NOT NULL,  -- Markdown-formatted MoM
    -- Version increments on regeneration (1 = initial, 2+ = revised)
    version      INTEGER NOT NULL DEFAULT 1,
    agent_id     TEXT    NOT NULL DEFAULT 'meetings-monitor',
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mom_meeting ON meeting_mom(meeting_id);
CREATE INDEX idx_mom_version ON meeting_mom(meeting_id, version DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase Realtime
-- Enable on the tables the Chrome extension subscribes to for live agent output
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE meeting_transcriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_decisions;
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_qa_pairs;
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_agenda_status;
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_mom;
