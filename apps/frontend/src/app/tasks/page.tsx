'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, X, Clock, RefreshCw, Send, CheckCircle, Trash2,
  Users, FileText, CheckSquare, Paperclip, Upload, BarChart2,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Task, TaskStatus } from '@/lib/tasks/types'

interface Attachment {
  id: string
  task_id: string
  filename: string
  content_type: string
  text_content: string
  created_at: string
}

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog',           label: 'Backlog',            color: 'text-slate-500'  },
  { status: 'in_progress',      label: 'In Progress',        color: 'text-blue-500'   },
  { status: 'awaiting_approval', label: 'Awaiting Approval', color: 'text-amber-500'  },
  { status: 'done',             label: 'Done',               color: 'text-emerald-500'},
]

const RECURRENCE_PRESETS = [
  { label: 'Daily at 9am',           value: '0 9 * * *'   },
  { label: 'Weekdays at 9am',        value: '0 9 * * 1-5' },
  { label: 'Weekly — Monday 9am',    value: '0 9 * * 1'   },
  { label: 'Monthly — 1st at 9am',   value: '0 9 1 * *'   },
  { label: 'Custom cron…',           value: '__custom__'   },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function employeeName(id?: string) {
  if (!id) return null
  return id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function formatDate(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onDragStart,
  onEdit,
  onDelegate,
  onApprove,
  onDelete,
  attachmentCount = 0,
}: {
  task: Task
  onDragStart: (e: React.DragEvent, task: Task) => void
  onEdit: (task: Task) => void
  onDelegate: (task: Task) => void
  onApprove: (task: Task) => void
  onDelete: (task: Task) => void
  attachmentCount?: number
}) {
  const name = employeeName(task.assigned_to)

  const isWorking = task.status === 'in_progress' && !!task.assigned_to

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      className={`rounded-lg border bg-[rgb(var(--card))] p-3 cursor-grab active:cursor-grabbing transition-colors select-none ${
        isWorking
          ? 'border-blue-400 dark:border-blue-500'
          : 'border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]'
      }`}
    >
      {/* Working indicator */}
      {isWorking && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-blue-500 dark:text-blue-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          Working…
        </div>
      )}

      {/* Clickable body — opens edit modal */}
      <div onClick={() => onEdit(task)} className="cursor-pointer mb-2">
        <p className="text-sm font-medium leading-snug mb-1">{task.title}</p>

        {task.description && (
          <p className="text-xs text-[rgb(var(--muted-foreground))] leading-relaxed line-clamp-2">
            {task.description}
          </p>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mb-2">
        {name && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
            {name}
          </span>
        )}
        {task.recurrence && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]">
            <RefreshCw size={9} />
            {task.recurrence}
          </span>
        )}
        {task.scheduled_at && !task.recurrence && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]">
            <Clock size={9} />
            {formatDate(task.scheduled_at)}
          </span>
        )}
        {task.created_by === 'slack' && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]">
            Slack
          </span>
        )}
        {attachmentCount != null && attachmentCount > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]">
            <Paperclip size={9} />
            {attachmentCount}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 border-t border-[rgb(var(--border))]">
        {task.status === 'backlog' && task.assigned_to && (
          <button
            onClick={() => onDelegate(task)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            <Send size={10} />
            Delegate
          </button>
        )}
        {task.status === 'awaiting_approval' && (
          <button
            onClick={() => onApprove(task)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            <CheckCircle size={10} />
            Approve
          </button>
        )}
        <button
          onClick={() => onDelete(task)}
          className="ml-auto p-1 text-[rgb(var(--muted-foreground))] hover:text-red-500 transition-colors rounded"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

interface TemplateOption {
  id: string
  name: string
}

// ── Shared task form fields ───────────────────────────────────────────────────

function TaskForm({
  title, setTitle,
  description, setDescription,
  assignedTo, setAssignedTo,
  scheduleType, setScheduleType,
  scheduledAt, setScheduledAt,
  recurrencePreset, setRecurrencePreset,
  customCron, setCustomCron,
  employees,
  statusField,
  templateId, setTemplateId,
  templates,
}: {
  title: string; setTitle: (v: string) => void
  description: string; setDescription: (v: string) => void
  assignedTo: string; setAssignedTo: (v: string) => void
  scheduleType: 'none' | 'once' | 'recurring'; setScheduleType: (v: 'none' | 'once' | 'recurring') => void
  scheduledAt: string; setScheduledAt: (v: string) => void
  recurrencePreset: string; setRecurrencePreset: (v: string) => void
  customCron: string; setCustomCron: (v: string) => void
  employees: { id: string; name: string }[]
  statusField?: React.ReactNode
  templateId?: string; setTemplateId?: (v: string) => void
  templates?: TemplateOption[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details or instructions for the employee"
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors resize-none"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">Assign to</label>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
        >
          <option value="">Unassigned</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      {statusField}

      {setTemplateId !== undefined && (
        <div>
          <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">
            Document Template (optional)
          </label>
          <select
            value={templateId ?? ''}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
          >
            <option value="">No template</option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">Schedule</label>
        <div className="flex gap-2 mb-2">
          {(['none', 'once', 'recurring'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setScheduleType(t)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                scheduleType === t
                  ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                  : 'border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]'
              }`}
            >
              {t === 'none' ? 'No schedule' : t === 'once' ? 'One-off' : 'Recurring'}
            </button>
          ))}
        </div>
        {scheduleType === 'once' && (
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
          />
        )}
        {scheduleType === 'recurring' && (
          <div className="flex flex-col gap-2">
            <select
              value={recurrencePreset}
              onChange={(e) => setRecurrencePreset(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
            >
              {RECURRENCE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {recurrencePreset === '__custom__' && (
              <input
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="cron expression — e.g. 0 9 * * 1"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] font-mono transition-colors"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Attachments panel (used inside edit modal) ────────────────────────────────

function AttachmentsPanel({ taskId }: { taskId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/attachments`)
      .then((r) => r.json())
      .then(setAttachments)
      .catch(() => {})
  }, [taskId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: form })
    if (res.ok) {
      const att = await res.json()
      setAttachments((prev) => [...prev, att])
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tasks/${taskId}/attachments/${id}`, { method: 'DELETE' })
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-[rgb(var(--muted-foreground))]">
          Attachments
        </label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors disabled:opacity-40"
        >
          <Upload size={10} />
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-[rgb(var(--muted-foreground))] opacity-60">
          No attachments — upload a PDF or text file
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[rgb(var(--muted))] text-xs">
              <Paperclip size={11} className="shrink-0 text-[rgb(var(--muted-foreground))]" />
              <span className="flex-1 truncate">{att.filename}</span>
              <button
                type="button"
                onClick={() => handleDelete(att.id)}
                className="text-[rgb(var(--muted-foreground))] hover:text-red-500 transition-colors"
              >
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Edit task modal ───────────────────────────────────────────────────────────

function EditTaskModal({
  task,
  employees,
  templates,
  onClose,
  onSave,
}: {
  task: Task
  employees: { id: string; name: string }[]
  templates: TemplateOption[]
  onClose: () => void
  onSave: (id: string, updates: Partial<Task>) => void
}) {
  const existingPreset = task.recurrence
    ? (RECURRENCE_PRESETS.find((p) => p.value === task.recurrence)?.value ?? '__custom__')
    : RECURRENCE_PRESETS[0].value

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ?? '')
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [templateId, setTemplateId] = useState(task.template_id ?? '')
  const [scheduleType, setScheduleType] = useState<'none' | 'once' | 'recurring'>(
    task.recurrence ? 'recurring' : task.scheduled_at ? 'once' : 'none'
  )
  const [scheduledAt, setScheduledAt] = useState(
    task.scheduled_at ? task.scheduled_at.slice(0, 16) : ''
  )
  const [recurrencePreset, setRecurrencePreset] = useState(existingPreset)
  const [customCron, setCustomCron] = useState(
    existingPreset === '__custom__' ? (task.recurrence ?? '') : ''
  )

  const recurrence = scheduleType === 'recurring'
    ? (recurrencePreset === '__custom__' ? customCron : recurrencePreset)
    : undefined

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSave(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      assigned_to: assignedTo || undefined,
      status,
      template_id: templateId || undefined,
      scheduled_at: scheduleType === 'once' ? scheduledAt || undefined : undefined,
      recurrence: recurrence || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">Edit Task</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--muted))] transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <TaskForm
            title={title} setTitle={setTitle}
            description={description} setDescription={setDescription}
            assignedTo={assignedTo} setAssignedTo={setAssignedTo}
            scheduleType={scheduleType} setScheduleType={setScheduleType}
            scheduledAt={scheduledAt} setScheduledAt={setScheduledAt}
            recurrencePreset={recurrencePreset} setRecurrencePreset={setRecurrencePreset}
            customCron={customCron} setCustomCron={setCustomCron}
            employees={employees}
            templateId={templateId} setTemplateId={setTemplateId}
            templates={templates}
            statusField={
              <div>
                <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
                >
                  <option value="backlog">Backlog</option>
                  <option value="in_progress">In Progress</option>
                  <option value="awaiting_approval">Awaiting Approval</option>
                  <option value="done">Done</option>
                </select>
              </div>
            }
          />

          <AttachmentsPanel taskId={task.id} />

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Create task modal ─────────────────────────────────────────────────────────

function CreateTaskModal({
  employees,
  templates,
  onClose,
  onCreate,
}: {
  employees: { id: string; name: string }[]
  templates: TemplateOption[]
  onClose: () => void
  onCreate: (task: Partial<Task>) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [scheduleType, setScheduleType] = useState<'none' | 'once' | 'recurring'>('none')
  const [scheduledAt, setScheduledAt] = useState('')
  const [recurrencePreset, setRecurrencePreset] = useState(RECURRENCE_PRESETS[0].value)
  const [customCron, setCustomCron] = useState('')

  const recurrence = scheduleType === 'recurring'
    ? (recurrencePreset === '__custom__' ? customCron : recurrencePreset)
    : undefined

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      assigned_to: assignedTo || undefined,
      template_id: templateId || undefined,
      scheduled_at: scheduleType === 'once' ? scheduledAt || undefined : undefined,
      recurrence: recurrence || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">New Task</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--muted))] transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TaskForm
            title={title} setTitle={setTitle}
            description={description} setDescription={setDescription}
            assignedTo={assignedTo} setAssignedTo={setAssignedTo}
            scheduleType={scheduleType} setScheduleType={setScheduleType}
            scheduledAt={scheduledAt} setScheduledAt={setScheduledAt}
            recurrencePreset={recurrencePreset} setRecurrencePreset={setRecurrencePreset}
            customCron={customCron} setCustomCron={setCustomCron}
            employees={employees}
            templateId={templateId} setTemplateId={setTemplateId}
            templates={templates}
          />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!title.trim()}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40">
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [dragging, setDragging] = useState<Task | null>(null)
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    loadTasks()
    loadEmployees()
    loadTemplates()
  }, [])

  // Auto-poll every 8s while any task is in_progress (to catch completion)
  useEffect(() => {
    const hasActive = tasks.some((t) => t.status === 'in_progress' && t.assigned_to)
    if (!hasActive) return
    const id = setInterval(loadTasks, 8_000)
    return () => clearInterval(id)
  }, [tasks])

  // Load attachment counts whenever tasks change
  useEffect(() => {
    if (tasks.length === 0) return
    Promise.all(
      tasks.map((t) =>
        fetch(`/api/tasks/${t.id}/attachments`)
          .then((r) => r.json())
          .then((atts: Attachment[]) => [t.id, atts.length] as [string, number])
          .catch(() => [t.id, 0] as [string, number])
      )
    ).then((entries) => setAttachmentCounts(Object.fromEntries(entries)))
  }, [tasks.length])

  async function loadTasks() {
    setLoading(true)
    const res = await fetch('/api/tasks')
    if (res.ok) setTasks(await res.json())
    setLoading(false)
  }

  async function loadEmployees() {
    const res = await fetch('/api/employees')
    if (res.ok) {
      const data = await res.json()
      setEmployees(data.map((e: { id: string }) => ({
        id: e.id,
        name: e.id.split('-').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' '),
      })))
    }
  }

  async function loadTemplates() {
    const res = await fetch('/api/templates')
    if (res.ok) {
      const data = await res.json()
      setTemplates(data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })))
    }
  }

  async function createTask(partial: Partial<Task>) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    })
    if (res.ok) {
      const task = await res.json()
      setTasks((prev) => [task, ...prev])
    }
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
    }
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)))
    }
  }

  async function delegateTask(task: Task) {
    const res = await fetch(`/api/tasks/${task.id}/delegate`, { method: 'POST' })
    if (res.ok) {
      const updated = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    }
  }

  async function approveTask(task: Task) {
    const res = await fetch(`/api/tasks/${task.id}/approve`, { method: 'POST' })
    if (res.ok) {
      const updated = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    }
  }

  async function deleteTask(task: Task) {
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, task: Task) {
    setDragging(task)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(status)
  }

  function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault()
    setDragOver(null)
    if (dragging && dragging.status !== status) {
      if (status === 'in_progress' && dragging.assigned_to) {
        delegateTask(dragging)
      } else {
        moveTask(dragging.id, status)
      }
    }
    setDragging(null)
  }

  function handleDragEnd() {
    setDragging(null)
    setDragOver(null)
  }

  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[rgb(var(--border))] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
            <span className="text-[rgb(var(--primary-foreground))] font-bold text-sm">B</span>
          </div>
          <span className="font-semibold text-lg">Brage AI Hub</span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
          >
            <Users size={13} />
            Employees
          </Link>
          <Link
            href="/documents"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
          >
            <FileText size={13} />
            Documents
          </Link>
          <Link
            href="/tasks"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[rgb(var(--muted))] text-[rgb(var(--foreground))]"
          >
            <CheckSquare size={13} />
            Tasks
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
          >
            <BarChart2 size={13} />
            Admin
          </Link>
        </nav>

        <ThemeToggle />
      </header>

      {/* Toolbar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-[rgb(var(--border))]">
        <div>
          <h1 className="text-xl font-bold">Tasks</h1>
          <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadTasks}
            className="p-2 rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            New Task
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <main className="flex-1 p-6 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-[rgb(var(--muted-foreground))] text-sm">
            Loading…
          </div>
        ) : (
          <div className="flex gap-4 min-w-max h-full">
            {COLUMNS.map((col) => {
              const colTasks = byStatus(col.status)
              const isDropTarget = dragOver === col.status
              return (
                <div
                  key={col.status}
                  onDragOver={(e) => handleDragOver(e, col.status)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => handleDrop(e, col.status)}
                  className={`w-72 flex flex-col rounded-xl border-2 transition-colors ${
                    isDropTarget
                      ? 'border-[rgb(var(--primary))] bg-[rgb(var(--muted))]'
                      : 'border-transparent'
                  }`}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${col.color}`}>
                        {col.label}
                      </span>
                      <span className="text-xs text-[rgb(var(--muted-foreground))] bg-[rgb(var(--muted))] px-1.5 py-0.5 rounded-full">
                        {colTasks.length}
                      </span>
                    </div>
                    {col.status === 'backlog' && (
                      <button
                        onClick={() => setShowCreate(true)}
                        className="p-1 rounded hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--primary))] transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 px-1 flex-1 min-h-[120px]">
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onDragStart={handleDragStart}
                        onEdit={setEditingTask}
                        onDelegate={delegateTask}
                        onApprove={approveTask}
                        onDelete={deleteTask}
                        attachmentCount={attachmentCounts[task.id]}
                      />
                    ))}
                    {colTasks.length === 0 && !isDropTarget && (
                      <div className="flex-1 flex items-center justify-center text-xs text-[rgb(var(--muted-foreground))] opacity-50 border-2 border-dashed border-[rgb(var(--border))] rounded-lg py-8">
                        Drop here
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateTaskModal
          employees={employees}
          templates={templates}
          onClose={() => setShowCreate(false)}
          onCreate={createTask}
        />
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          employees={employees}
          templates={templates}
          onClose={() => setEditingTask(null)}
          onSave={(id, updates) => updateTask(id, updates)}
        />
      )}
    </div>
  )
}
