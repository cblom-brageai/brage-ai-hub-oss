-- Tasks table for virtual employee task management
CREATE TABLE IF NOT EXISTS tasks (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    title           TEXT        NOT NULL,
    description     TEXT,
    status          TEXT        NOT NULL DEFAULT 'backlog'
                                CHECK (status IN ('backlog', 'in_progress', 'awaiting_approval', 'done')),
    assigned_to     TEXT,                           -- employee_id, null = unassigned
    created_by      TEXT        DEFAULT 'web',      -- 'slack' | 'web' | 'scheduled'
    artefact_id     UUID        REFERENCES artefacts(id) ON DELETE SET NULL,
    scheduled_at    TIMESTAMPTZ,                    -- one-off: run at this datetime
    recurrence      TEXT,                           -- cron expression (e.g. '0 9 * * 1'), null = one-off
    next_run_at     TIMESTAMPTZ,                    -- next scheduled execution
    last_run_at     TIMESTAMPTZ,                    -- last execution time
    slack_channel   TEXT,                           -- originating Slack channel_id (for replies)
    slack_ts        TEXT,                           -- originating Slack message ts (for thread replies)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_status      ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_next_run_at ON tasks(next_run_at) WHERE next_run_at IS NOT NULL;

CREATE TRIGGER tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
