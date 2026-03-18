-- Add structured metadata and template link to artefacts
ALTER TABLE artefacts
    ADD COLUMN IF NOT EXISTS metadata      JSONB,
    ADD COLUMN IF NOT EXISTS template_id   UUID REFERENCES document_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT '1.0';

-- Add template selector to tasks
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS template_id   UUID REFERENCES document_templates(id) ON DELETE SET NULL;
