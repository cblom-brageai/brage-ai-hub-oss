-- Artefacts produced by virtual employees
CREATE TABLE IF NOT EXISTS artefacts (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id TEXT        NOT NULL,
    filename    TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    content     TEXT        NOT NULL,
    content_type TEXT       NOT NULL DEFAULT 'markdown',
    task_id     TEXT,
    source      TEXT,           -- 'slack', 'chat', 'scheduled', etc.
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_artefacts_employee_id ON artefacts(employee_id);
CREATE INDEX idx_artefacts_created_at  ON artefacts(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artefacts_updated_at
    BEFORE UPDATE ON artefacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
