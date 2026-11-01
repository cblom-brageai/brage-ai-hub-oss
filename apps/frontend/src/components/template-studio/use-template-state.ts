'use client'

import { useCallback, useState } from 'react'
import { newField, newSection, snakeCase } from '@/lib/templates/structure'
import type { TemplateField, TemplateMeta, TemplateSection, TemplateStructure } from '@/lib/templates/types'

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** All edits to a template structure, as immutable updates. */
export function useTemplateState(initial: TemplateStructure) {
  const [structure, setStructure] = useState<TemplateStructure>(initial)

  const updateMeta = useCallback((key: keyof TemplateMeta, value: string) => {
    setStructure((s) => ({ ...s, template_meta: { ...s.template_meta, [key]: value } }))
  }, [])

  const addSection = useCallback(() => {
    setStructure((s) => ({ ...s, sections: [...s.sections, newSection()] }))
  }, [])

  const updateSection = useCallback((id: string, patch: Partial<TemplateSection>) => {
    setStructure((s) => ({
      ...s,
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)),
    }))
  }, [])

  const deleteSection = useCallback((id: string) => {
    setStructure((s) => ({ ...s, sections: s.sections.filter((sec) => sec.id !== id) }))
  }, [])

  const moveSection = useCallback((id: string, direction: -1 | 1) => {
    setStructure((s) => {
      const index = s.sections.findIndex((sec) => sec.id === id)
      return index < 0 ? s : { ...s, sections: move(s.sections, index, direction) }
    })
  }, [])

  const addField = useCallback((sectionId: string) => {
    setStructure((s) => ({
      ...s,
      sections: s.sections.map((sec) => {
        if (sec.id !== sectionId) return sec
        const n = sec.fields.length + 1
        return { ...sec, fields: [...sec.fields, newField({ label: `Field ${n}`, key: `field_${n}` })] }
      }),
    }))
  }, [])

  const updateField = useCallback((sectionId: string, fieldId: string, patch: Partial<TemplateField>) => {
    setStructure((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id !== sectionId
          ? sec
          : { ...sec, fields: sec.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) }
      ),
    }))
  }, [])

  /** Change a label and keep the key in sync unless it was edited by hand. */
  const relabelField = useCallback((sectionId: string, fieldId: string, label: string) => {
    setStructure((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id !== sectionId
          ? sec
          : {
              ...sec,
              fields: sec.fields.map((f) => {
                if (f.id !== fieldId) return f
                const autoKey = snakeCase(f.label)
                const keyFollowsLabel = !f.key || f.key === autoKey || /^field_\d+$/.test(f.key)
                return { ...f, label, ...(keyFollowsLabel ? { key: snakeCase(label) || f.key } : {}) }
              }),
            }
      ),
    }))
  }, [])

  const deleteField = useCallback((sectionId: string, fieldId: string) => {
    setStructure((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id !== sectionId ? sec : { ...sec, fields: sec.fields.filter((f) => f.id !== fieldId) }
      ),
    }))
  }, [])

  const moveField = useCallback((sectionId: string, fieldId: string, direction: -1 | 1) => {
    setStructure((s) => ({
      ...s,
      sections: s.sections.map((sec) => {
        if (sec.id !== sectionId) return sec
        const index = sec.fields.findIndex((f) => f.id === fieldId)
        return index < 0 ? sec : { ...sec, fields: move(sec.fields, index, direction) }
      }),
    }))
  }, [])

  return {
    structure,
    setStructure,
    updateMeta,
    addSection,
    updateSection,
    deleteSection,
    moveSection,
    addField,
    updateField,
    relabelField,
    deleteField,
    moveField,
  }
}

export type TemplateStateApi = ReturnType<typeof useTemplateState>
