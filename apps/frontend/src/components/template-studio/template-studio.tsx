'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, Check, Loader2, PenLine, Plus, Save, Wand2 } from 'lucide-react'
import { NavHeader } from '@/components/nav-header'
import { DocumentForm } from '@/components/document-form/document-form'
import {
  emptyData,
  emptyStructure,
  fromLegacySchema,
  isStructuredTemplate,
  normalizeStructure,
  validateStructure,
} from '@/lib/templates/structure'
import type { TemplateStructure } from '@/lib/templates/types'
import { GenerateModal, type GeneratedTemplate } from './generate-modal'
import { SectionCard } from './section-card'
import { useTemplateState } from './use-template-state'

interface Employee {
  id: string
  name: string
}

interface TemplateRecord {
  id: string
  name: string
  description?: string
  employee_ids: string[]
  json_schema: unknown
}

type BuilderTab = 'builder' | 'json'

const fieldInput =
  'px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors'

function employeeName(id: string) {
  return id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Template Studio: visual builder, raw JSON editor and live preview for one template.
 * With `templateId` it edits an existing template, otherwise it creates one.
 */
export function TemplateStudio({ templateId }: { templateId?: string }) {
  const router = useRouter()
  const api = useTemplateState(emptyStructure())
  const { structure, setStructure } = api

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(Boolean(templateId))
  const [loadError, setLoadError] = useState('')
  const [convertedFromLegacy, setConvertedFromLegacy] = useState(false)

  const [tab, setTab] = useState<BuilderTab>('builder')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [showPreviewOnMobile, setShowPreviewOnMobile] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [savedId, setSavedId] = useState<string | undefined>(templateId)

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((data: { id: string }[]) => setEmployees(data.map((e) => ({ id: e.id, name: employeeName(e.id) }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    fetch(`/api/templates/${templateId}`)
      .then(async (r) => {
        const data = (await r.json()) as TemplateRecord & { error?: string }
        if (!r.ok) throw new Error(data.error ?? 'Template not found')
        if (cancelled) return
        setName(data.name ?? '')
        setDescription(data.description ?? '')
        setEmployeeIds(data.employee_ids ?? [])
        if (isStructuredTemplate(data.json_schema)) {
          setStructure(normalizeStructure(data.json_schema))
        } else {
          setStructure(fromLegacySchema(data.json_schema))
          setConvertedFromLegacy(true)
        }
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [templateId, setStructure])

  // Keep the JSON editor in sync when switching to it
  useEffect(() => {
    if (tab === 'json') {
      setJsonText(JSON.stringify(structure, null, 2))
      setJsonError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const errors = useMemo(() => validateStructure(structure), [structure])
  const previewData = useMemo(() => emptyData(structure), [structure])
  const fieldCount = structure.sections.reduce((n, s) => n + s.fields.length, 0)

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText) as unknown
      setStructure(normalizeStructure(parsed))
      setJsonError('')
      setTab('builder')
    } catch (e: unknown) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  function applyGenerated(result: GeneratedTemplate) {
    if (!name.trim() && result.name) setName(result.name)
    if (!description.trim() && result.description) setDescription(result.description)
    setStructure(normalizeStructure(result.json_schema))
    setTab('builder')
  }

  function toggleEmployee(id: string) {
    setEmployeeIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]))
  }

  async function save() {
    if (!name.trim() || errors.length) return
    setSaving(true)
    setSaveError('')
    try {
      const payload = { name: name.trim(), description, employee_ids: employeeIds, json_schema: structure }
      const res = await fetch(savedId ? `/api/templates/${savedId}` : '/api/templates', {
        method: savedId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setSavedAt(Date.now())
      setConvertedFromLegacy(false)
      if (!savedId && data.id) {
        setSavedId(data.id)
        router.replace(`/documents/studio/${data.id}`)
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-[rgb(var(--muted-foreground))]">Loading…</div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-[rgb(var(--muted-foreground))]">{loadError}</p>
        <Link href="/documents" className="text-sm text-[rgb(var(--primary))] hover:underline">Back to Documents</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />

      {/* Sub-header */}
      <div className="border-b border-[rgb(var(--border))] px-6 py-3 flex flex-wrap items-center gap-3">
        <Link href="/documents" className="flex items-center gap-1.5 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors">
          <ArrowLeft size={14} /> Documents
        </Link>
        <span className="text-[rgb(var(--border))]">/</span>
        <span className="text-sm text-[rgb(var(--muted-foreground))]">Template Studio</span>
        <div className="flex-1" />
        <button onClick={() => setShowGenerate(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors">
          <Wand2 size={13} /> Generate
        </button>
        {savedId && (
          <Link href={`/documents/write?template=${savedId}`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors">
            <PenLine size={13} /> Write document
          </Link>
        )}
        <button
          onClick={save}
          disabled={saving || !name.trim() || errors.length > 0}
          title={errors.length ? 'Fix the problems listed below first' : undefined}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : savedAt && Date.now() - savedAt < 2500 ? <Check size={13} /> : <Save size={13} />}
          {savedId ? 'Save' : 'Create template'}
        </button>
      </div>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full flex flex-col gap-5">
        {/* Template identity */}
        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4">
          <div className="flex flex-col gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name *"
              className={`${fieldInput} text-base font-semibold`}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this document is for"
              rows={2}
              className={fieldInput}
            />
            <div className="grid grid-cols-3 gap-2">
              <input value={structure.template_meta.standard ?? ''} onChange={(e) => api.updateMeta('standard', e.target.value)} placeholder="Standard (e.g. ISO 9001)" className={`${fieldInput} text-xs`} />
              <input value={structure.template_meta.type ?? ''} onChange={(e) => api.updateMeta('type', e.target.value)} placeholder="Type (e.g. Report)" className={`${fieldInput} text-xs`} />
              <input value={structure.template_meta.version ?? ''} onChange={(e) => api.updateMeta('version', e.target.value)} placeholder="Version" className={`${fieldInput} text-xs`} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-2">Employees that may use this template</p>
            <div className="flex flex-wrap gap-2">
              {employees.map((emp) => {
                const on = employeeIds.includes(emp.id)
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggleEmployee(emp.id)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      on
                        ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] border-transparent'
                        : 'border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:border-[rgb(var(--primary))]'
                    }`}
                  >
                    {emp.name}
                  </button>
                )
              })}
              {employees.length === 0 && <span className="text-xs text-[rgb(var(--muted-foreground))]">No employees found</span>}
            </div>
            <p className="text-xs text-[rgb(var(--muted-foreground))] mt-3">
              {structure.sections.length} section{structure.sections.length === 1 ? '' : 's'}, {fieldCount} field{fieldCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {convertedFromLegacy && (
          <div className="flex items-start gap-2 text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700 p-3">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>This template was stored as a raw JSON Schema. It has been converted to sections and fields; saving replaces the old schema.</span>
          </div>
        )}

        {(errors.length > 0 || saveError) && (
          <div className="flex flex-col gap-1 text-xs rounded-lg border border-red-300 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 dark:border-red-700 p-3">
            {saveError && <span>{saveError}</span>}
            {errors.map((e) => (
              <span key={e}>{e}</span>
            ))}
          </div>
        )}

        {/* Builder + preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className={`${showPreviewOnMobile ? 'hidden md:flex' : 'flex'} flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <div className="flex rounded-lg border border-[rgb(var(--border))] overflow-hidden">
                {(['builder', 'json'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      tab === t
                        ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                        : 'text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))]'
                    }`}
                  >
                    {t === 'builder' ? 'Builder' : 'JSON'}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowPreviewOnMobile(true)} className="md:hidden text-xs text-[rgb(var(--primary))]">
                Preview →
              </button>
            </div>

            {tab === 'builder' ? (
              <div className="flex flex-col gap-4">
                {structure.sections.map((section, i) => (
                  <SectionCard key={section.id} section={section} index={i} count={structure.sections.length} api={api} />
                ))}
                <button
                  type="button"
                  onClick={api.addSection}
                  className="flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-xl border border-dashed border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))] transition-colors"
                >
                  <Plus size={16} /> Add section
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  spellCheck={false}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] focus:outline-none focus:border-[rgb(var(--primary))]"
                  style={{ minHeight: '480px' }}
                />
                {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
                <div className="flex gap-2">
                  <button onClick={applyJson} className="px-4 py-2 text-xs font-medium rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90">
                    Apply JSON
                  </button>
                  <button onClick={() => setJsonText(JSON.stringify(structure, null, 2))} className="px-4 py-2 text-xs font-medium rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]">
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={`${showPreviewOnMobile ? 'flex' : 'hidden md:flex'} flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted-foreground))]">Live preview</span>
              <button onClick={() => setShowPreviewOnMobile(false)} className="md:hidden text-xs text-[rgb(var(--primary))]">
                ← Builder
              </button>
            </div>
            <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
              <h1 className="text-2xl font-bold mb-1">{name || 'Untitled template'}</h1>
              <p className="text-sm text-[rgb(var(--muted-foreground))] mb-2">{description || 'No description yet.'}</p>
              {(structure.template_meta.standard || structure.template_meta.type) && (
                <p className="text-xs font-mono text-[rgb(var(--muted-foreground))] mb-5">
                  {[structure.template_meta.standard, structure.template_meta.type, structure.template_meta.version && `v${structure.template_meta.version}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              <DocumentForm structure={structure} data={previewData} disabled people={employees} />
            </div>
          </div>
        </div>
      </main>

      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} onGenerate={applyGenerated} />}
    </div>
  )
}
