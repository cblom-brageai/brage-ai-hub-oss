'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { TemplateSection } from '@/lib/templates/types'
import { FieldCard } from './field-card'
import type { TemplateStateApi } from './use-template-state'

interface SectionCardProps {
  section: TemplateSection
  index: number
  count: number
  api: TemplateStateApi
}

export function SectionCard({ section, index, count, api }: SectionCardProps) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/40 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-[rgb(var(--muted-foreground))] w-6">{index + 1}.</span>
        <input
          value={section.title}
          onChange={(e) => api.updateSection(section.id, { title: e.target.value })}
          placeholder="Section title"
          className="flex-1 min-w-0 bg-transparent text-base font-semibold border-b border-transparent hover:border-[rgb(var(--border))] focus:border-[rgb(var(--primary))] focus:outline-none px-1 py-0.5"
        />
        <div className="flex items-center">
          <button type="button" onClick={() => api.moveSection(section.id, -1)} disabled={index === 0} title="Move section up" className="p-1.5 rounded text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] disabled:opacity-30">
            <ArrowUp size={14} />
          </button>
          <button type="button" onClick={() => api.moveSection(section.id, 1)} disabled={index === count - 1} title="Move section down" className="p-1.5 rounded text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] disabled:opacity-30">
            <ArrowDown size={14} />
          </button>
          <button type="button" onClick={() => api.deleteSection(section.id)} title="Delete section" className="p-1.5 rounded text-[rgb(var(--muted-foreground))] hover:text-red-500 hover:bg-[rgb(var(--muted))]">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <input
        value={section.description ?? ''}
        onChange={(e) => api.updateSection(section.id, { description: e.target.value })}
        placeholder="Optional guidance for this section"
        className="bg-transparent text-xs text-[rgb(var(--muted-foreground))] border-b border-transparent hover:border-[rgb(var(--border))] focus:border-[rgb(var(--primary))] focus:outline-none px-1 py-0.5"
      />

      <div className="flex flex-col gap-2">
        {section.fields.map((field, i) => (
          <FieldCard key={field.id} sectionId={section.id} field={field} index={i} count={section.fields.length} api={api} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => api.addField(section.id)}
        className="flex items-center justify-center gap-1 py-2 text-xs font-medium rounded-lg border border-dashed border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))] transition-colors"
      >
        <Plus size={13} /> Add field
      </button>
    </div>
  )
}
