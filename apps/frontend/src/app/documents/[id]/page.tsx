'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, FileText, CheckSquare, CheckCircle } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { marked } from 'marked'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArtefactMetadata {
  tags?: string[]
  summary?: string
  sources?: string[]
  [key: string]: unknown
}

interface Artefact {
  id: string
  employee_id: string
  filename: string
  title: string
  content: string
  content_type: string
  task_id?: string
  source?: string
  metadata?: ArtefactMetadata
  template_id?: string
  schema_version?: string
  created_at: string
  updated_at: string
}

interface PublishChannel {
  id: string
  name: string
  type: 'linkedin' | 'hubspot' | 'word_slack' | 'slack'
  config: Record<string, unknown>
  available_to: string[]
}

interface PublishLog {
  id: string
  artefact_id: string
  channel_id: string
  status: 'pending' | 'success' | 'failed'
  error?: string
  published_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function employeeName(id: string) {
  return id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium', timeStyle: 'short' } as Intl.DateTimeFormatOptions)
}

const TYPE_LABEL: Record<string, string> = {
  linkedin: 'LinkedIn',
  hubspot: 'HubSpot',
  word_slack: 'Word + Slack',
  slack: 'Slack',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const [artefact, setArtefact] = useState<Artefact | null>(null)
  const [channels, setChannels] = useState<PublishChannel[]>([])
  const [publishLogs, setPublishLogs] = useState<PublishLog[]>([])
  const [loading, setLoading] = useState(true)

  // Edit mode state
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Publish state
  const [publishingChannel, setPublishingChannel] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [params.id])

  async function loadData() {
    setLoading(true)
    await Promise.all([
      fetch(`/api/artefacts/${params.id}`).then((r) => r.json()).then((data) => {
        setArtefact(data)
        setEditTitle(data.title ?? '')
        setEditContent(data.content ?? '')
        setEditTags((data.metadata?.tags ?? []).join(', '))
        setEditSummary(data.metadata?.summary ?? '')
      }).catch(() => {}),
      fetch('/api/publish/channels').then((r) => r.json()).then(setChannels).catch(() => {}),
      fetch(`/api/publish?artefact_id=${params.id}`).then((r) => r.json()).then(setPublishLogs).catch(() => {}),
    ])
    setLoading(false)
  }

  async function handleSave() {
    if (!artefact) return
    setSaving(true)
    try {
      const tags = editTags.split(',').map((t) => t.trim()).filter(Boolean)
      const metadata: ArtefactMetadata = {
        ...(artefact.metadata ?? {}),
        tags,
        summary: editSummary,
      }
      const res = await fetch(`/api/artefacts/${artefact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent, metadata }),
      })
      if (res.ok) {
        const updated = await res.json()
        setArtefact(updated)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish(channelId: string) {
    if (!artefact) return
    setPublishingChannel(channelId)
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artefact_id: artefact.id, channel_id: channelId }),
      })
      if (res.ok) {
        const log = await res.json()
        setPublishLogs((prev) => [log, ...prev])
      }
    } finally {
      setPublishingChannel(null)
    }
  }

  function reloadLogs() {
    fetch(`/api/publish?artefact_id=${params.id}`).then((r) => r.json()).then(setPublishLogs).catch(() => {})
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[rgb(var(--muted-foreground))] text-sm">
        Loading…
      </div>
    )
  }

  if (!artefact) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-[rgb(var(--muted-foreground))]">Document not found</p>
        <Link href="/documents" className="text-sm text-[rgb(var(--primary))] hover:underline">
          Back to Documents
        </Link>
      </div>
    )
  }

  const availableChannels = channels.filter((ch) =>
    ch.available_to.includes(artefact.employee_id)
  )

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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[rgb(var(--muted))] text-[rgb(var(--foreground))]"
          >
            <FileText size={13} />
            Documents
          </Link>
          <Link
            href="/tasks"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
          >
            <CheckSquare size={13} />
            Tasks
          </Link>
        </nav>

        <ThemeToggle />
      </header>

      {/* Sub-header */}
      <div className="border-b border-[rgb(var(--border))] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/documents"
            className="flex items-center gap-1.5 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors"
          >
            <ArrowLeft size={14} />
            Documents
          </Link>
          <span className="text-[rgb(var(--border))]">/</span>
          {mode === 'edit' ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-sm font-medium bg-transparent border-b border-[rgb(var(--border))] focus:border-[rgb(var(--primary))] focus:outline-none px-1 py-0.5 min-w-0 w-64"
            />
          ) : (
            <span className="text-sm font-medium truncate max-w-xs">{artefact.title}</span>
          )}
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
            {employeeName(artefact.employee_id)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[rgb(var(--border))] overflow-hidden">
            {(['preview', 'edit'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === m
                    ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                    : 'text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))]'
                }`}
              >
                {m === 'preview' ? 'Preview' : 'Edit'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex gap-6">
          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {mode === 'preview' ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6"
                dangerouslySetInnerHTML={{ __html: marked(artefact.content) as string }}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-mono rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors resize-none min-h-[400px]"
                  style={{ minHeight: '400px' }}
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  {saved && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle size={13} />
                      Saved
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-64 shrink-0 flex flex-col gap-4">
            {/* Metadata panel */}
            <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4">
              <h3 className="text-xs font-semibold text-[rgb(var(--muted-foreground))] uppercase tracking-wide mb-3">
                Metadata
              </h3>

              {mode === 'edit' ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">
                      Tags (comma-separated)
                    </label>
                    <input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="Q1, campaign, draft"
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1 block">
                      Summary
                    </label>
                    <textarea
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      rows={3}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs text-[rgb(var(--muted-foreground))] mb-1">Type</p>
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]">
                      {artefact.content_type}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-[rgb(var(--muted-foreground))] mb-1">Created</p>
                    <p className="text-xs">{formatDate(artefact.created_at)}</p>
                  </div>
                  {artefact.metadata?.tags && artefact.metadata.tags.length > 0 && (
                    <div>
                      <p className="text-xs text-[rgb(var(--muted-foreground))] mb-1">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {artefact.metadata.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {artefact.metadata?.summary && (
                    <div>
                      <p className="text-xs text-[rgb(var(--muted-foreground))] mb-1">Summary</p>
                      <p className="text-xs leading-relaxed">{artefact.metadata.summary}</p>
                    </div>
                  )}
                  {artefact.metadata?.sources && artefact.metadata.sources.length > 0 && (
                    <div>
                      <p className="text-xs text-[rgb(var(--muted-foreground))] mb-1">Sources</p>
                      <ul className="flex flex-col gap-0.5">
                        {artefact.metadata.sources.map((src, i) => (
                          <li key={i} className="text-xs text-[rgb(var(--muted-foreground))] truncate">{src}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Publish section */}
        <div className="mt-8 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          <h2 className="text-sm font-semibold mb-4">Publish</h2>

          {availableChannels.length === 0 ? (
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              No publish channels available for this employee.{' '}
              <Link href="/documents?tab=publishers" className="text-[rgb(var(--primary))] hover:underline">
                Configure channels
              </Link>
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {availableChannels.map((ch) => {
                const latestLog = publishLogs.find((l) => l.channel_id === ch.id)
                return (
                  <div key={ch.id} className="flex items-center justify-between gap-3 py-2 border-b border-[rgb(var(--border))] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{ch.name}</span>
                      <span className="px-1.5 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]">
                        {TYPE_LABEL[ch.type]}
                      </span>
                      {latestLog && (
                        <span className={`px-1.5 py-0.5 text-xs rounded-full ${STATUS_STYLE[latestLog.status]}`}>
                          {latestLog.status}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handlePublish(ch.id)}
                      disabled={publishingChannel === ch.id}
                      className="px-3 py-1.5 text-xs rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      {publishingChannel === ch.id ? 'Publishing…' : 'Publish'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Publish history */}
          {publishLogs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[rgb(var(--border))]">
              <h3 className="text-xs font-semibold text-[rgb(var(--muted-foreground))] uppercase tracking-wide mb-3">
                Publish History
              </h3>
              <div className="flex flex-col gap-2">
                {publishLogs.map((log) => {
                  const ch = channels.find((c) => c.id === log.channel_id)
                  return (
                    <div key={log.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded-full ${STATUS_STYLE[log.status]}`}>
                          {log.status}
                        </span>
                        <span className="text-[rgb(var(--muted-foreground))]">
                          {ch?.name ?? 'Unknown channel'}
                        </span>
                        {log.error && (
                          <span className="text-red-500 truncate max-w-[200px]">{log.error}</span>
                        )}
                      </div>
                      <span className="text-[rgb(var(--muted-foreground))] shrink-0">
                        {formatDate(log.published_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
