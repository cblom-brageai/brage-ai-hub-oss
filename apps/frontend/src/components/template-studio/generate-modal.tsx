'use client'

import { useState } from 'react'
import { Loader2, Wand2, X } from 'lucide-react'
import type { TemplateStructure } from '@/lib/templates/types'

export interface GeneratedTemplate {
  name: string
  description: string
  json_schema: TemplateStructure
}

interface GenerateModalProps {
  onClose: () => void
  onGenerate: (result: GeneratedTemplate) => void
}

/** Describe a document type; the LLM gateway returns a full sections-and-fields structure. */
export function GenerateModal({ onClose, onGenerate }: GenerateModalProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      onGenerate(data as GeneratedTemplate)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Wand2 size={16} className="text-[rgb(var(--primary))]" /> Generate a template
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--muted))] transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-[rgb(var(--muted-foreground))] mb-3">
          Describe the document type. The configured model drafts the sections and fields; you can edit everything afterwards.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="e.g. A risk register for a solar park construction project with impact and probability scoring"
          className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors"
        />
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2 text-sm rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors">
            Cancel
          </button>
          <button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
