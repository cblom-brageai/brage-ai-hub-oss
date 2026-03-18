CREATE TABLE IF NOT EXISTS publish_channels (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    name          TEXT        NOT NULL,
    type          TEXT        NOT NULL CHECK (type IN ('linkedin','hubspot','word_slack','slack')),
    config        JSONB       DEFAULT '{}',
    available_to  TEXT[]      DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publish_rules (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id  TEXT        NOT NULL,
    channel_id   UUID        REFERENCES publish_channels(id) ON DELETE CASCADE,
    trigger      TEXT        NOT NULL DEFAULT 'approved' CHECK (trigger IN ('approved','manual')),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publish_logs (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    artefact_id  UUID        REFERENCES artefacts(id) ON DELETE CASCADE,
    channel_id   UUID        REFERENCES publish_channels(id) ON DELETE SET NULL,
    status       TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
    error        TEXT,
    published_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER publish_channels_updated_at
    BEFORE UPDATE ON publish_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_publish_rules_employee ON publish_rules(employee_id);
CREATE INDEX idx_publish_logs_artefact  ON publish_logs(artefact_id);
