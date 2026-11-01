'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import MarkdownIt from 'markdown-it'
import { AlertCircle, ArrowLeft, Check, ExternalLink, FileText, Loader2, Save } from 'lucide-react'
import { NavHeader } from '@/components/nav-header'
import { DocumentForm } from '@/components/document-form/document-form'
import {
  emptyData,
  isStructuredTemplate,
  mergeData,
  missingRequired,
  normalizeStructure,
  renderMarkdown,
  slugify,
} from '@/lib/templates/structure'
import type { ContentData, FormDocument, TemplateStructure } from '@/lib/templates/types'

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

interface TemplateRecord {
  id: string
  name: string
  description?: string
  employee_ids: string[]
  json_schema: unknown
}

interface ArtefactRecord {
  id: string
  employee_id: string
  title: string
  template_id?: string
  metadata?: { form?: FormDocument; [key: string]: unknown }
}

interface Employee {
  id: string
  name: string
}

const HUB_USER = 'hub-user'

function employeeName(id: string) {
  if (id === HUB_USER) return 'Hub user'
  return id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

const fieldInput =
  'px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors'

function WriterInner() {
  const params = useSearchParams()
  const templateParam = params.get('template')
  const artefactParam = params.get('artefact')

  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [template, setTemplate] = useState<TemplateRecord | null>(null)
  const [structure, setStructure] = useState<TemplateStructure | null>(null)
  const [data, setData] = useState<ContentData>({})
  const [title, setTitle] = useState('')
  const [onBehalfOf, setOnBehalfOf] = useState(HUB_USER)
  const [artefactId, setArtefactId] = useState<string | null>(artefactParam)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [showPreviewOnMobile, setShowPreviewOnMobile] = useState(false)

  function selectTemplate(t: TemplateRecord, existing?: ArtefactRecord) {
    const s = normalizeStructure(t.json_schema)
    setTemplate(t)
    setStructure(s)
    if (existing) {
      setData(mergeData(s, existing.metadata?.form?.data))
      setTitle(existing.title)
      setOnBehalfOf(existing.employee_id)
      setArtefactId(existing.id)
    } else {
      setData(emptyData(s))
      setTitle(`New ${t.name}`)
      setOnBehalfOf(t.employee_ids?.[0] ?? HUB_USER)
      setArtefactId(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [tplRes, empRes] = await Promise.all([fetch('/api/templates'), fetch('/api/employees')])
        const tplJson = (await tplRes.json()) as TemplateRecord[] | { error?: string }
        if (!tplRes.ok || !Array.isArray(tplJson)) {
          throw new Error((tplJson as { error?: string }).error ?? 'Could not load templates. Is Supabase configured?')
        }
        const tpls = tplJson.filter((t) => isStructuredTemplate(t.json_schema))
        const empJson = (await empRes.json()) as { id: string }[] | { error?: string }
        const emps = (Array.isArray(empJson) ? empJson : []).map((e) => ({ id: e.id, name: employeeName(e.id) }))
        if (cancelled) return
        setTemplates(tpls)
        setEmployees(emps)

        if (artefactParam) {
          const res = await fetch(`/api/artefacts/${artefactParam}`)
          const art = (await res.json()) as ArtefactRecord & { error?: string }
          if (!res.ok) throw new Error(art.error ?? 'Document not found')
          const tpl = tpls.find((t) => t.id === art.template_id)
          if (!tpl) throw new Error('The template this document was written from is no longer available.')
          if (!cancelled) selectTemplate(tpl, art)
        } else if (templateParam) {
          const tpl = tpls.find((t) => t.id === templateParam)
          if (!tpl) throw new Error('Template not found or not a structured template.')
          if (!cancelled) selectTemplate(tpl)
        }
      } catch (e: unknown) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [templateParam, artefactParam])

  const markdown = useMemo(
    () => (structure ? renderMarkdown(title, structure, data) : ''),
    [structure, title, data]
  )
  const missing = useMemo(() => (structure ? missingRequired(structure, data) : []), [structure, data])

  async function save() {
    if (!structure || !template || !title.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const form: FormDocument = { template_meta: structure.template_meta, data }
      const metadata = { form, template_name: template.name, summary: template.description ?? '' }
      const res = await fetch(artefactId ? `/api/artefacts/${artefactId}` : '/api/artefacts', {
        method: artefactId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          artefactId
            ? { title: title.trim(), content: markdown, metadata }
            : {
                employee_id: onBehalfOf,
                title: title.trim(),
                content: markdown,
                filename: `${slugify(title)}.md`,
                source: 'document-writer',
                template_id: template.id,
                metadata,
              }
        ),
      })
      const saved = await res.json()
      if (!res.ok) throw new Error(saved.error ?? 'Save failed')
      setArtefactId(saved.id)
      setSavedAt(Date.now())
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-[rgb(var(--muted-foreground))]">Loading…</div>
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />

      <div className="border-b border-[rgb(var(--border))] px-6 py-3 flex flex-wrap items-center gap-3">
        <Link href="/documents" className="flex items-center gap-1.5 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors">
          <ArrowLeft size={14} /> Documents
        </Link>
        <span className="text-[rgb(var(--border))]">/</span>
        <span className="text-sm text-[rgb(var(--muted-foreground))]">Write from template</span>
        {template && (
          <>
            <span className="text-[rgb(var(--border))]">/</span>
            <span className="text-sm font-medium">{template.name}</span>
          </>
        )}
        <div className="flex-1" />
        {artefactId && (
          <Link href={`/documents/${artefactId}`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors">
            <ExternalLink size={13} /> Open document
          </Link>
        )}
        {template && (
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : savedAt && Date.now() - savedAt < 2500 ? <Check size={13} /> : <Save size={13} />}
            {artefactId ? 'Save' : 'Save as document'}
          </button>
        )}
      </div>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full flex flex-col gap-5">
        {loadError && (
          <div className="flex items-start gap-2 text-xs rounded-lg border border-red-300 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 dark:border-red-700 p-3">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> {loadError}
          </div>
        )}

        {!template && !loadError && (
          <div>
            <h1 className="text-lg font-semibold mb-1">Choose a template</h1>
            <p className="text-sm text-[rgb(var(--muted-foreground))] mb-5">
              Documents written here are saved as artefacts, so employees, meetings and publishing see them like any other document.
            </p>
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[rgb(var(--muted-foreground))]">
                <FileText size={40} className="mb-3 opacity-30" />
                <p className="text-sm mb-3">No structured templates yet</p>
                <Link href="/documents/studio" className="text-sm text-[rgb(var(--primary))] hover:underline">Create one in the Template Studio</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className="text-left rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 hover:border-[rgb(var(--primary))] transition-colors"
                  >
                    <h3 className="text-sm font-semibold mb-1">{t.name}</h3>
                    {t.description && <p className="text-xs text-[rgb(var(--muted-foreground))] line-clamp-2">{t.description}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {template && structure && (
          <>
            <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title *" className={`${fieldInput} text-base font-semibold`} />
              <label className="flex items-center gap-2 text-xs text-[rgb(var(--muted-foreground))]">
                <span className="shrink-0">On behalf of</span>
                <select value={onBehalfOf} onChange={(e) => setOnBehalfOf(e.target.value)} disabled={Boolean(artefactId)} className={`${fieldInput} flex-1`}>
                  <option value={HUB_USER}>Hub user</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {(missing.length > 0 || saveError) && (
              <div className="flex flex-col gap-1 text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700 p-3">
                {saveError && <span className="text-red-600 dark:text-red-300">{saveError}</span>}
                {missing.length > 0 && <span>Still empty: {missing.join(', ')}</span>}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className={`${showPreviewOnMobile ? 'hidden md:block' : 'block'} rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted-foreground))]">Form</span>
                  <button onClick={() => setShowPreviewOnMobile(true)} className="md:hidden text-xs text-[rgb(var(--primary))]">Preview →</button>
                </div>
                <DocumentForm structure={structure} data={data} onChange={setData} people={employees} />
              </div>
              <div className={`${showPreviewOnMobile ? 'block' : 'hidden md:block'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted-foreground))]">Preview</span>
                  <button onClick={() => setShowPreviewOnMobile(false)} className="md:hidden text-xs text-[rgb(var(--primary))]">← Form</button>
                </div>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6"
                  dangerouslySetInnerHTML={{ __html: md.render(markdown) }}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default function WritePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-[rgb(var(--muted-foreground))]">Loading…</div>}>
      <WriterInner />
    </Suspense>
  )
}
