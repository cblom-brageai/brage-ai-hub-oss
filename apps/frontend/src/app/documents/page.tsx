'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  FileText, Plus, X, Search, Trash2, Edit2,
  ChevronRight, RefreshCw,
} from 'lucide-react'
import { NavHeader } from '@/components/nav-header'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Artefact {
  id: string
  employee_id: string
  filename: string
  title: string
  content: string
  content_type: string
  task_id?: string
  source?: string
  metadata?: {
    tags?: string[]
    summary?: string
    sources?: string[]
    [key: string]: unknown
  }
  template_id?: string
  schema_version?: string
  created_at: string
  updated_at: string
}

interface Template {
  id: string
  name: string
  description?: string
  employee_ids: string[]
  json_schema: Record<string, unknown>
  created_at: string
}

interface PublishChannel {
  id: string
  name: string
  type: 'linkedin' | 'hubspot' | 'word_slack' | 'slack'
  config: Record<string, unknown>
  available_to: string[]
  created_at: string
}

interface PublishRule {
  id: string
  employee_id: string
  channel_id: string
  trigger: 'approved' | 'manual'
  created_at: string
}

interface Employee {
  id: string
  name: string
}

type Tab = 'documents' | 'templates' | 'publishers'

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPLOYEE_DISPLAY_NAMES: Record<string, string> = {
  'omengineer': 'O&M Engineer',
}

function employeeName(id: string) {
  return EMPLOYEE_DISPLAY_NAMES[id] ?? id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

const TYPE_LABEL: Record<string, string> = {
  linkedin: 'LinkedIn',
  hubspot: 'HubSpot',
  word_slack: 'Word + Slack',
  slack: 'Slack',
}

const CONFIG_PLACEHOLDER: Record<string, string> = {
  linkedin: '{"access_token": "...", "person_urn": "urn:li:person:XXXXX"}',
  hubspot: '{"access_token": "...", "blog_id": "..."}',
  word_slack: '{"bot_token": "xoxb-...", "channel": "#general"}',
  slack: '{"bot_token": "xoxb-...", "channel": "#general"}',
}

// ── Documents tab ─────────────────────────────────────────────────────────────

function DocumentsTab({
  artefacts,
  employees,
}: {
  artefacts: Artefact[]
  employees: Employee[]
}) {
  const [search, setSearch] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')

  const filtered = artefacts.filter((a) => {
    const matchSearch =
      !search || a.title.toLowerCase().includes(search.toLowerCase())
    const matchEmployee = !filterEmployee || a.employee_id === filterEmployee
    return matchSearch && matchEmployee
  })

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-foreground))]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
          />
        </div>
        <select
          value={filterEmployee}
          onChange={(e) => setFilterEmployee(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
        >
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[rgb(var(--muted-foreground))]">
          <FileText size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No documents found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((art) => (
            <Link
              key={art.id}
              href={`/documents/${art.id}`}
              className="block rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 hover:border-[rgb(var(--primary))] transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium leading-snug group-hover:text-[rgb(var(--primary))] transition-colors line-clamp-2">
                  {art.title}
                </h3>
                <ChevronRight size={14} className="shrink-0 mt-0.5 text-[rgb(var(--muted-foreground))]" />
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
                  {employeeName(art.employee_id)}
                </span>
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]">
                  {art.content_type}
                </span>
                {art.metadata?.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <p className="text-xs text-[rgb(var(--muted-foreground))]">{formatDate(art.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Templates tab ─────────────────────────────────────────────────────────────

interface TemplateFormData {
  name: string
  description: string
  employee_ids: string[]
  json_schema: string
}

function TemplateModal({
  initial,
  employees,
  onClose,
  onSave,
}: {
  initial?: Template
  employees: Employee[]
  onClose: () => void
  onSave: (data: TemplateFormData) => Promise<void>
}) {
  const [step, setStep] = useState<1 | 2>(initial ? 2 : 1)
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(initial?.employee_ids ?? [])
  const [schemaText, setSchemaText] = useState(
    initial ? JSON.stringify(initial.json_schema, null, 2) : ''
  )

  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch('/api/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setName(data.name ?? '')
      setDescription(data.description ?? '')
      setSchemaText(JSON.stringify(data.json_schema ?? {}, null, 2))
      setStep(2)
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : 'Failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(schemaText) } catch { parsed = {} }
      await onSave({ name, description, employee_ids: selectedEmployees, json_schema: schemaText })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function toggleEmployee(id: string) {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">
            {initial ? 'Edit Template' : step === 1 ? 'New Template — Step 1' : 'New Template — Step 2'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--muted))] transition-colors">
            <X size={16} />
          </button>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Describe the document type and we&apos;ll generate a JSON Schema for it.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. PRINCE2 Project Initiation Document for solar PV installations"
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors resize-none"
            />
            {generateError && (
              <p className="text-xs text-red-500">{generateError}</p>
            )}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 px-4 py-2 text-sm rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || generating}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {generating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-2 block">
                Assign to employees
              </label>
              <div className="flex flex-col gap-1">
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                      className="rounded"
                    />
                    {emp.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">
                JSON Schema
              </label>
              <textarea
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors resize-none"
              />
            </div>
            <div className="flex gap-2">
              {!initial && (
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors"
                >
                  Back
                </button>
              )}
              <button onClick={onClose} className="flex-1 px-4 py-2 text-sm rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || saving}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save Template'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TemplatesTab({
  templates,
  employees,
  onRefresh,
}: {
  templates: Template[]
  employees: Employee[]
  onRefresh: () => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)

  async function handleCreate(data: TemplateFormData) {
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(data.json_schema) } catch { parsed = {} }
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, json_schema: parsed }),
    })
    onRefresh()
  }

  async function handleEdit(data: TemplateFormData) {
    if (!editTemplate) return
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(data.json_schema) } catch { parsed = {} }
    await fetch(`/api/templates/${editTemplate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, json_schema: parsed }),
    })
    onRefresh()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[rgb(var(--muted-foreground))]">
          <FileText size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No templates yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold">{tmpl.name}</h3>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEditTemplate(tmpl)}
                    className="p-1 rounded hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(tmpl.id)}
                    className="p-1 rounded hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {tmpl.description && (
                <p className="text-xs text-[rgb(var(--muted-foreground))] mb-3 line-clamp-2">
                  {tmpl.description}
                </p>
              )}
              {tmpl.employee_ids.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tmpl.employee_ids.map((eid) => (
                    <span
                      key={eid}
                      className="px-1.5 py-0.5 text-xs rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200"
                    >
                      {employeeName(eid)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <TemplateModal
          employees={employees}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}
      {editTemplate && (
        <TemplateModal
          initial={editTemplate}
          employees={employees}
          onClose={() => setEditTemplate(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  )
}

// ── Publishers tab ─────────────────────────────────────────────────────────────

function ChannelModal({
  initial,
  employees,
  onClose,
  onSave,
}: {
  initial?: PublishChannel
  employees: Employee[]
  onClose: () => void
  onSave: (data: {
    name: string
    type: string
    config: string
    available_to: string[]
  }) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<string>(initial?.type ?? 'linkedin')
  const [config, setConfig] = useState(
    initial ? JSON.stringify(initial.config, null, 2) : CONFIG_PLACEHOLDER['linkedin']
  )
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(initial?.available_to ?? [])
  const [saving, setSaving] = useState(false)

  function toggleEmployee(id: string) {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ name, type, config, available_to: selectedEmployees })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">{initial ? 'Edit Channel' : 'Add Channel'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--muted))] transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">
              Channel name <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Company LinkedIn"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">Type</label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                if (!initial) setConfig(CONFIG_PLACEHOLDER[e.target.value] ?? '{}')
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
            >
              <option value="linkedin">LinkedIn</option>
              <option value="hubspot">HubSpot Blog</option>
              <option value="word_slack">Word + Slack</option>
              <option value="slack">Slack</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-2 block">
              Available to employees
            </label>
            <div className="flex flex-col gap-1">
              {employees.map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(emp.id)}
                    onChange={() => toggleEmployee(emp.id)}
                    className="rounded"
                  />
                  {emp.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">
              Config (JSON)
            </label>
            <textarea
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 text-sm rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RuleModal({
  channelId,
  employees,
  onClose,
  onSave,
}: {
  channelId: string
  employees: Employee[]
  onClose: () => void
  onSave: (employeeId: string, trigger: string) => Promise<void>
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '')
  const [trigger, setTrigger] = useState('approved')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(employeeId, trigger)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">Add Publish Rule</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--muted))] transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">Trigger</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
            >
              <option value="approved">On Approval</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 text-sm rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!employeeId || saving}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Add Rule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PublishersTab({
  channels,
  rules,
  employees,
  onRefresh,
}: {
  channels: PublishChannel[]
  rules: PublishRule[]
  employees: Employee[]
  onRefresh: () => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [editChannel, setEditChannel] = useState<PublishChannel | null>(null)
  const [addRuleChannel, setAddRuleChannel] = useState<string | null>(null)

  async function handleCreateChannel(data: { name: string; type: string; config: string; available_to: string[] }) {
    let parsedConfig: Record<string, unknown> = {}
    try { parsedConfig = JSON.parse(data.config) } catch { parsedConfig = {} }
    await fetch('/api/publish/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, config: parsedConfig }),
    })
    onRefresh()
  }

  async function handleEditChannel(data: { name: string; type: string; config: string; available_to: string[] }) {
    if (!editChannel) return
    let parsedConfig: Record<string, unknown> = {}
    try { parsedConfig = JSON.parse(data.config) } catch { parsedConfig = {} }
    await fetch(`/api/publish/channels/${editChannel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, config: parsedConfig }),
    })
    onRefresh()
  }

  async function handleDeleteChannel(id: string) {
    await fetch(`/api/publish/channels/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  async function handleAddRule(channelId: string, employeeId: string, trigger: string) {
    await fetch('/api/publish/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employeeId, channel_id: channelId, trigger }),
    })
    onRefresh()
  }

  async function handleDeleteRule(ruleId: string) {
    await fetch(`/api/publish/rules/${ruleId}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Add Channel
        </button>
      </div>

      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[rgb(var(--muted-foreground))]">
          <RefreshCw size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No publish channels configured</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {channels.map((ch) => {
            const channelRules = rules.filter((r) => r.channel_id === ch.id)
            return (
              <div
                key={ch.id}
                className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{ch.name}</h3>
                      <span className="px-1.5 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]">
                        {TYPE_LABEL[ch.type]}
                      </span>
                    </div>
                    {ch.available_to.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ch.available_to.map((eid) => (
                          <span
                            key={eid}
                            className="px-1.5 py-0.5 text-xs rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200"
                          >
                            {employeeName(eid)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditChannel(ch)}
                      className="p-1 rounded hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteChannel(ch.id)}
                      className="p-1 rounded hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Rules */}
                <div className="border-t border-[rgb(var(--border))] pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[rgb(var(--muted-foreground))]">
                      Publish Rules
                    </span>
                    <button
                      onClick={() => setAddRuleChannel(ch.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors"
                    >
                      <Plus size={10} />
                      Add Rule
                    </button>
                  </div>
                  {channelRules.length === 0 ? (
                    <p className="text-xs text-[rgb(var(--muted-foreground))] opacity-60">No rules configured</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {channelRules.map((rule) => {
                        const emp = employees.find((e) => e.id === rule.employee_id)
                        return (
                          <li key={rule.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[rgb(var(--muted))] text-xs">
                            <span>
                              <span className="font-medium">{emp?.name ?? rule.employee_id}</span>
                              {' — '}
                              <span className="text-[rgb(var(--muted-foreground))]">
                                {rule.trigger === 'approved' ? 'On Approval' : 'Manual'}
                              </span>
                            </span>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="text-[rgb(var(--muted-foreground))] hover:text-red-500 transition-colors"
                            >
                              <X size={11} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <ChannelModal
          employees={employees}
          onClose={() => setShowCreate(false)}
          onSave={handleCreateChannel}
        />
      )}
      {editChannel && (
        <ChannelModal
          initial={editChannel}
          employees={employees}
          onClose={() => setEditChannel(null)}
          onSave={handleEditChannel}
        />
      )}
      {addRuleChannel && (
        <RuleModal
          channelId={addRuleChannel}
          employees={employees}
          onClose={() => setAddRuleChannel(null)}
          onSave={(empId, trigger) => handleAddRule(addRuleChannel, empId, trigger)}
        />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('documents')
  const [artefacts, setArtefacts] = useState<Artefact[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [channels, setChannels] = useState<PublishChannel[]>([])
  const [rules, setRules] = useState<PublishRule[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    await Promise.all([
      fetch('/api/employees').then((r) => r.json()).then((data) => {
        setEmployees(
          (data as { id: string }[]).map((e) => ({
            id: e.id,
            name: employeeName(e.id),
          }))
        )
      }).catch(() => {}),
      fetch('/api/artefacts').then((r) => r.json()).then(setArtefacts).catch(() => {}),
      fetch('/api/templates').then((r) => r.json()).then(setTemplates).catch(() => {}),
      fetch('/api/publish/channels').then((r) => r.json()).then(setChannels).catch(() => {}),
      fetch('/api/publish/rules').then((r) => r.json()).then(setRules).catch(() => {}),
    ])
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'documents', label: 'Documents' },
    { key: 'templates', label: 'Templates' },
    { key: 'publishers', label: 'Publishers' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />

      {/* Sub-header tabs */}
      <div className="border-b border-[rgb(var(--border))] px-6">
        <div className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[rgb(var(--primary))] text-[rgb(var(--primary))]'
                  : 'border-transparent text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {activeTab === 'documents' && (
          <DocumentsTab artefacts={artefacts} employees={employees} />
        )}
        {activeTab === 'templates' && (
          <TemplatesTab
            templates={templates}
            employees={employees}
            onRefresh={() => fetch('/api/templates').then((r) => r.json()).then(setTemplates).catch(() => {})}
          />
        )}
        {activeTab === 'publishers' && (
          <PublishersTab
            channels={channels}
            rules={rules}
            employees={employees}
            onRefresh={loadAll}
          />
        )}
      </main>
    </div>
  )
}
