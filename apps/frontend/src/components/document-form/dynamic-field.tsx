'use client'

import { Plus, X } from 'lucide-react'
import type { FieldValue, TemplateField } from '@/lib/templates/types'

export interface PersonOption {
  id: string
  name: string
}

interface DynamicFieldProps {
  field: TemplateField
  value: FieldValue | undefined
  onChange: (value: FieldValue) => void
  disabled?: boolean
  people?: PersonOption[]
}

const inputClass =
  'w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] placeholder-[rgb(var(--muted-foreground))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors disabled:opacity-60'

function asText(v: FieldValue | undefined): string {
  if (v === null || v === undefined) return ''
  return Array.isArray(v) ? v.join(', ') : String(v)
}

function asList(v: FieldValue | undefined): string[] {
  if (Array.isArray(v)) return v
  if (v === null || v === undefined || v === '') return []
  return [String(v)]
}

/** One form control for a template field. Controlled; the parent owns the data. */
export function DynamicField({ field, value, onChange, disabled, people = [] }: DynamicFieldProps) {
  const listId = `people-${field.id}`

  let control: JSX.Element
  switch (field.type) {
    case 'textarea':
      control = (
        <textarea
          value={asText(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={4}
          className={inputClass}
        />
      )
      break
    case 'number':
      control = (
        <input
          type="number"
          value={asText(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={inputClass}
        />
      )
      break
    case 'date':
      control = (
        <input
          type="date"
          value={asText(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputClass}
        />
      )
      break
    case 'select':
      control = (
        <select value={asText(value)} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputClass}>
          <option value="">Select…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )
      break
    case 'checklist': {
      const selected = new Set(asList(value))
      control = (
        <div className="flex flex-col gap-1.5">
          {(field.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(o)}
                disabled={disabled}
                onChange={(e) => {
                  const next = new Set(selected)
                  if (e.target.checked) next.add(o)
                  else next.delete(o)
                  onChange((field.options ?? []).filter((opt) => next.has(opt)))
                }}
                className="rounded"
              />
              {o}
            </label>
          ))}
          {(field.options ?? []).length === 0 && (
            <span className="text-xs text-[rgb(var(--muted-foreground))] italic">No options defined</span>
          )}
        </div>
      )
      break
    }
    case 'list': {
      const items = asList(value)
      control = (
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                disabled={disabled}
                placeholder={`Item ${i + 1}`}
                onChange={(e) => onChange(items.map((it, j) => (j === i ? e.target.value : it)))}
                className={inputClass}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  className="p-2 rounded-lg text-[rgb(var(--muted-foreground))] hover:text-red-500 hover:bg-[rgb(var(--muted))] transition-colors"
                  aria-label="Remove item"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange([...items, ''])}
              className="self-start flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))] transition-colors"
            >
              <Plus size={12} /> Add item
            </button>
          )}
          {disabled && items.length === 0 && (
            <span className="text-xs text-[rgb(var(--muted-foreground))] italic">List items appear here</span>
          )}
        </div>
      )
      break
    }
    case 'user_picker':
      control = (
        <>
          <input
            type="text"
            list={listId}
            value={asText(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? 'Name or employee'}
            disabled={disabled}
            className={inputClass}
          />
          <datalist id={listId}>
            {people.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </>
      )
      break
    default:
      control = (
        <input
          type="text"
          value={asText(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={inputClass}
        />
      )
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {control}
      {field.help_text && (
        <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">{field.help_text}</p>
      )}
    </div>
  )
}
