/**
 * Canonical document template structure (the "Documentation Hub" format).
 *
 * Stored as-is in `document_templates.json_schema`. A template is a list of sections, each
 * with typed fields; a document written from it stores one value per field under
 * `artefacts.metadata.form` and the rendered Markdown in `artefacts.content`.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'select'
  | 'checklist'
  | 'list'
  | 'user_picker'

export interface TemplateField {
  id: string
  /** snake_case key used in the stored document data */
  key: string
  label: string
  type: FieldType
  help_text?: string
  placeholder?: string
  /** choices for select and checklist fields */
  options?: string[]
  required?: boolean
}

export interface TemplateSection {
  id: string
  title: string
  description?: string
  fields: TemplateField[]
}

export interface TemplateMeta {
  standard?: string
  type?: string
  version?: string
}

export interface TemplateStructure {
  template_meta: TemplateMeta
  sections: TemplateSection[]
}

/** Value of one field in a written document. */
export type FieldValue = string | number | string[] | null

/** sectionId -> fieldKey -> value */
export type ContentData = Record<string, Record<string, FieldValue>>

/** What the writer stores under `artefacts.metadata.form`. */
export interface FormDocument {
  template_meta: TemplateMeta
  data: ContentData
}

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'list', label: 'Bullet list' },
  { value: 'user_picker', label: 'Person' },
]

export const FIELD_TYPE_VALUES: FieldType[] = FIELD_TYPES.map((t) => t.value)
