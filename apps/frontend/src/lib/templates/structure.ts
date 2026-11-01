/**
 * Pure helpers for template structures and written documents. No React, no I/O, so they
 * run in API routes, client components and unit tests alike.
 */
import {
  FIELD_TYPE_VALUES,
  type ContentData,
  type FieldType,
  type FieldValue,
  type TemplateField,
  type TemplateSection,
  type TemplateStructure,
} from './types'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function snakeCase(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

export function slugify(input: string): string {
  return snakeCase(input).replace(/_/g, '-') || 'document'
}

export function newField(partial: Partial<TemplateField> = {}): TemplateField {
  const label = partial.label ?? 'New field'
  return {
    id: partial.id ?? uid(),
    key: partial.key ?? snakeCase(label) ?? 'field',
    label,
    type: partial.type ?? 'text',
    ...(partial.help_text ? { help_text: partial.help_text } : {}),
    ...(partial.placeholder ? { placeholder: partial.placeholder } : {}),
    ...(partial.options ? { options: partial.options } : {}),
    ...(partial.required ? { required: true } : {}),
  }
}

export function newSection(title = 'New section'): TemplateSection {
  return { id: uid(), title, fields: [] }
}

export function emptyStructure(): TemplateStructure {
  return {
    template_meta: { standard: '', type: '', version: '1.0' },
    sections: [newSection('General information')],
  }
}

/** True when the JSON stored in `json_schema` is a sections-and-fields structure. */
export function isStructuredTemplate(json: unknown): json is TemplateStructure {
  if (!json || typeof json !== 'object') return false
  const sections = (json as { sections?: unknown }).sections
  return Array.isArray(sections)
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback
}

/**
 * Coerce loosely shaped JSON (model output, hand-edited JSON, older templates) into a valid
 * structure: every section and field gets an id, keys are snake_case and unique, unknown
 * field types fall back to text, options become string arrays.
 */
export function normalizeStructure(json: unknown): TemplateStructure {
  const src = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const metaSrc = (src.template_meta && typeof src.template_meta === 'object' ? src.template_meta : {}) as Record<string, unknown>
  const rawSections = Array.isArray(src.sections) ? src.sections : []
  const seenKeys = new Set<string>()

  const sections: TemplateSection[] = rawSections.map((s, si) => {
    const sec = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
    const rawFields = Array.isArray(sec.fields) ? sec.fields : []
    const fields: TemplateField[] = rawFields.map((f, fi) => {
      const fld = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>
      const label = asString(fld.label, `Field ${fi + 1}`) || `Field ${fi + 1}`
      let key = snakeCase(asString(fld.key) || label) || `field_${fi + 1}`
      let candidate = key
      let n = 2
      while (seenKeys.has(candidate)) candidate = `${key}_${n++}`
      key = candidate
      seenKeys.add(key)
      const typeRaw = asString(fld.type, 'text')
      const type: FieldType = (FIELD_TYPE_VALUES as string[]).includes(typeRaw)
        ? (typeRaw as FieldType)
        : typeRaw === 'input'
          ? 'text'
          : 'text'
      const options = Array.isArray(fld.options)
        ? fld.options.map((o) => asString(o)).filter(Boolean)
        : undefined
      return newField({
        id: asString(fld.id) || undefined,
        key,
        label,
        type,
        help_text: asString(fld.help_text) || undefined,
        placeholder: asString(fld.placeholder) || undefined,
        options: options && options.length ? options : undefined,
        required: fld.required === true,
      })
    })
    return {
      id: asString(sec.id) || uid(),
      title: asString(sec.title, `Section ${si + 1}`) || `Section ${si + 1}`,
      ...(asString(sec.description) ? { description: asString(sec.description) } : {}),
      fields,
    }
  })

  return {
    template_meta: {
      standard: asString(metaSrc.standard),
      type: asString(metaSrc.type),
      version: asString(metaSrc.version, '1.0') || '1.0',
    },
    sections,
  }
}

/** Human-readable problems that block saving. Empty array means valid. */
export function validateStructure(s: TemplateStructure): string[] {
  const errors: string[] = []
  if (!s.sections.length) errors.push('Add at least one section.')
  const keys = new Map<string, number>()
  s.sections.forEach((sec, si) => {
    if (!sec.title.trim()) errors.push(`Section ${si + 1} has no title.`)
    sec.fields.forEach((f) => {
      const where = `"${f.label || f.key}" in "${sec.title || `section ${si + 1}`}"`
      if (!f.label.trim()) errors.push(`A field in "${sec.title}" has no label.`)
      if (!/^[a-z][a-z0-9_]*$/.test(f.key)) errors.push(`Key of ${where} must be snake_case (letters, digits, underscores).`)
      keys.set(f.key, (keys.get(f.key) ?? 0) + 1)
      if ((f.type === 'select' || f.type === 'checklist') && !(f.options && f.options.length)) {
        errors.push(`${where} needs at least one option.`)
      }
    })
  })
  keys.forEach((count, key) => {
    if (count > 1) errors.push(`Field key "${key}" is used ${count} times; keys must be unique.`)
  })
  return errors
}

export function emptyData(s: TemplateStructure): ContentData {
  const data: ContentData = {}
  for (const sec of s.sections) {
    data[sec.id] = {}
    for (const f of sec.fields) {
      data[sec.id][f.key] = f.type === 'list' || f.type === 'checklist' ? [] : ''
    }
  }
  return data
}

/** Merge stored data onto the template so new fields appear and removed ones are dropped. */
export function mergeData(s: TemplateStructure, stored: ContentData | undefined): ContentData {
  const base = emptyData(s)
  if (!stored) return base
  for (const sec of s.sections) {
    const storedSec = stored[sec.id] ?? {}
    for (const f of sec.fields) {
      if (f.key in storedSec) base[sec.id][f.key] = storedSec[f.key]
    }
  }
  return base
}

export function isEmptyValue(v: FieldValue | undefined): boolean {
  if (v === null || v === undefined) return true
  if (Array.isArray(v)) return v.filter((x) => String(x).trim()).length === 0
  return String(v).trim() === ''
}

/** Required fields without a value, as "Section › Field" labels. */
export function missingRequired(s: TemplateStructure, data: ContentData): string[] {
  const missing: string[] = []
  for (const sec of s.sections) {
    for (const f of sec.fields) {
      if (f.required && isEmptyValue(data[sec.id]?.[f.key])) missing.push(`${sec.title} › ${f.label}`)
    }
  }
  return missing
}

function renderValue(f: TemplateField, v: FieldValue | undefined): string {
  if (isEmptyValue(v)) return '_Not provided_'
  if (f.type === 'checklist') {
    const selected = new Set((Array.isArray(v) ? v : [String(v)]).map(String))
    const options = f.options ?? Array.from(selected)
    return options.map((o) => `- [${selected.has(o) ? 'x' : ' '}] ${o}`).join('\n')
  }
  if (Array.isArray(v)) {
    return v.map((item) => `- ${String(item).trim()}`).filter((l) => l !== '- ').join('\n')
  }
  return String(v).trim()
}

/**
 * Render a written document as Markdown. This is what is stored in `artefacts.content`,
 * so everything that reads artefacts (chat, Q&A, publishing) sees a normal document.
 */
export function renderMarkdown(title: string, s: TemplateStructure, data: ContentData): string {
  const lines: string[] = [`# ${title.trim() || 'Untitled document'}`, '']
  const meta = [
    s.template_meta.standard ? `Standard: ${s.template_meta.standard}` : '',
    s.template_meta.type ? `Type: ${s.template_meta.type}` : '',
    s.template_meta.version ? `Template version: ${s.template_meta.version}` : '',
  ].filter(Boolean)
  if (meta.length) lines.push(`_${meta.join(' · ')}_`, '')
  for (const sec of s.sections) {
    lines.push(`## ${sec.title}`, '')
    if (sec.description) lines.push(`_${sec.description}_`, '')
    for (const f of sec.fields) {
      lines.push(`**${f.label}**`, '', renderValue(f, data[sec.id]?.[f.key]), '')
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

/**
 * Convert a legacy draft-07 style JSON Schema (top-level `properties`) into a one-section
 * structure so older templates open in the Studio. Unknown shapes yield an empty section.
 */
export function fromLegacySchema(json: unknown): TemplateStructure {
  const src = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const props = (src.properties && typeof src.properties === 'object' ? src.properties : {}) as Record<string, unknown>
  const required = new Set(Array.isArray(src.required) ? src.required.map(String) : [])
  const fields: TemplateField[] = Object.entries(props).map(([key, def]) => {
    const d = (def && typeof def === 'object' ? def : {}) as Record<string, unknown>
    const jsonType = asString(d.type)
    const format = asString(d.format)
    let type: FieldType = 'text'
    let options: string[] | undefined
    if (Array.isArray(d.enum)) {
      type = 'select'
      options = d.enum.map((o) => asString(o)).filter(Boolean)
    } else if (jsonType === 'number' || jsonType === 'integer') type = 'number'
    else if (jsonType === 'array') type = 'list'
    else if (format === 'date' || format === 'date-time') type = 'date'
    else if (jsonType === 'string' && (asString(d.description).length > 80 || /description|summary|notes|details|body/i.test(key))) type = 'textarea'
    return newField({
      key: snakeCase(key) || 'field',
      label: asString(d.title) || key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      type,
      help_text: asString(d.description) || undefined,
      options,
      required: required.has(key),
    })
  })
  return normalizeStructure({
    template_meta: { standard: '', type: asString(src.title), version: '1.0' },
    sections: [{ title: asString(src.title) || 'Content', fields }],
  })
}
