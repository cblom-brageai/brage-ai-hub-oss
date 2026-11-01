'use client'

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { FIELD_TYPES, type FieldType, type TemplateField } from '@/lib/templates/types'
import type { TemplateStateApi } from './use-template-state'

interface FieldCardProps {
  sectionId: string
  field: TemplateField
  index: number
  count: number
  api: TemplateStateApi
}

const smallInput =
  'px-2 py-1 text-xs rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--muted))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors'

export function FieldCard({ sectionId, field, index, count, api }: FieldCardProps) {
  const needsOptions = field.type === 'select' || field.type === 'checklist'
  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={field.label}
          onChange={(e) => api.relabelField(sectionId, field.id, e.target.value)}
          placeholder="Field label"
          className="flex-1 min-w-0 bg-transparent text-sm font-medium border-b border-transparent hover:border-[rgb(var(--border))] focus:border-[rgb(var(--primary))] focus:outline-none px-1 py-0.5"
        />
        <select
          value={field.type}
          onChange={(e) => api.updateField(sectionId, field.id, { type: e.target.value as FieldType })}
          className={smallInput}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div className="flex items-center">
          <button type="button" onClick={() => api.moveField(sectionId, field.id, -1)} disabled={index === 0} title="Move up" className="p-1 rounded text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] disabled:opacity-30">
            <ArrowUp size={13} />
          </button>
          <button type="button" onClick={() => api.moveField(sectionId, field.id, 1)} disabled={index === count - 1} title="Move down" className="p-1 rounded text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] disabled:opacity-30">
            <ArrowDown size={13} />
          </button>
          <button type="button" onClick={() => api.deleteField(sectionId, field.id)} title="Delete field" className="p-1 rounded text-[rgb(var(--muted-foreground))] hover:text-red-500 hover:bg-[rgb(var(--muted))]">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-xs text-[rgb(var(--muted-foreground))]">
          <span className="shrink-0">key</span>
          <input
            value={field.key}
            onChange={(e) => api.updateField(sectionId, field.id, { key: e.target.value })}
            placeholder="snake_case_key"
            className={`${smallInput} font-mono flex-1 min-w-0`}
          />
        </label>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) => api.updateField(sectionId, field.id, { required: e.target.checked })}
            className="rounded"
          />
          Required
        </label>
      </div>

      {needsOptions && (
        <label className="flex flex-col gap-1 text-xs text-[rgb(var(--muted-foreground))]">
          Options (comma separated)
          <input
            value={(field.options ?? []).join(', ')}
            onChange={(e) =>
              api.updateField(sectionId, field.id, {
                options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })
            }
            placeholder="Option A, Option B"
            className={smallInput}
          />
        </label>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={field.help_text ?? ''}
          onChange={(e) => api.updateField(sectionId, field.id, { help_text: e.target.value })}
          placeholder="Help text shown under the field"
          className={smallInput}
        />
        <input
          value={field.placeholder ?? ''}
          onChange={(e) => api.updateField(sectionId, field.id, { placeholder: e.target.value })}
          placeholder="Placeholder / example value"
          className={smallInput}
        />
      </div>
    </div>
  )
}
