'use client'

import type { ContentData, FieldValue, TemplateStructure } from '@/lib/templates/types'
import { DynamicField, type PersonOption } from './dynamic-field'

interface DocumentFormProps {
  structure: TemplateStructure
  data: ContentData
  onChange?: (data: ContentData) => void
  disabled?: boolean
  people?: PersonOption[]
}

/** Renders every section and field of a template as a form over `data`. */
export function DocumentForm({ structure, data, onChange, disabled, people }: DocumentFormProps) {
  function setValue(sectionId: string, key: string, value: FieldValue) {
    if (!onChange) return
    onChange({ ...data, [sectionId]: { ...(data[sectionId] ?? {}), [key]: value } })
  }

  if (structure.sections.length === 0) {
    return (
      <p className="text-sm text-[rgb(var(--muted-foreground))] italic py-8 text-center">
        This template has no sections yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {structure.sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-4">
          <div className="border-b border-[rgb(var(--border))] pb-2">
            <h2 className="text-base font-semibold">{section.title || 'Untitled section'}</h2>
            {section.description && (
              <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">{section.description}</p>
            )}
          </div>
          {section.fields.length === 0 ? (
            <p className="text-xs text-[rgb(var(--muted-foreground))] italic">No fields in this section.</p>
          ) : (
            section.fields.map((field) => (
              <DynamicField
                key={field.id}
                field={field}
                value={data[section.id]?.[field.key]}
                onChange={(v) => setValue(section.id, field.key, v)}
                disabled={disabled}
                people={people}
              />
            ))
          )}
        </section>
      ))}
    </div>
  )
}
