-- Use document_templates to avoid conflict with pre-existing 'templates' table
CREATE TABLE IF NOT EXISTS document_templates (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    name         TEXT        NOT NULL,
    description  TEXT,
    employee_ids TEXT[]      DEFAULT '{}',
    json_schema  JSONB       NOT NULL DEFAULT '{}',
    created_by   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER document_templates_updated_at
    BEFORE UPDATE ON document_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE document_templates DISABLE ROW LEVEL SECURITY;
