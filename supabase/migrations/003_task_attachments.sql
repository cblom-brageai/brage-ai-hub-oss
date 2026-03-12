-- Attachments for tasks (text extracted from uploaded files)
CREATE TABLE IF NOT EXISTS task_attachments (
    id           UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id      UUID  NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    filename     TEXT  NOT NULL,
    content_type TEXT  NOT NULL DEFAULT 'text/plain',
    text_content TEXT  NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id);
