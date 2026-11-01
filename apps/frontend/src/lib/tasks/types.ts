export type TaskStatus = 'backlog' | 'in_progress' | 'awaiting_approval' | 'done'

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  assigned_to?: string    // employee_id
  created_by?: string     // 'slack' | 'web' | 'scheduled'
  artefact_id?: string
  template_id?: string
  scheduled_at?: string   // ISO datetime — one-off run
  recurrence?: string     // cron expression — recurring run
  next_run_at?: string
  last_run_at?: string
  slack_channel?: string
  slack_ts?: string
  created_at: string
  updated_at: string
}

export type TaskCreate = Pick<Task, 'title'> & Partial<Omit<Task, 'id' | 'created_at' | 'updated_at'>>
export type TaskUpdate = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at'>>

export interface TaskProvider {
  list(filters?: { status?: TaskStatus; assigned_to?: string }): Promise<Task[]>
  get(id: string): Promise<Task | null>
  create(task: TaskCreate): Promise<Task>
  update(id: string, updates: TaskUpdate): Promise<Task>
  remove(id: string): Promise<void>
}
