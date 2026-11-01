import { describe, expect, it } from 'vitest'
import {
  emptyData,
  isStructuredTemplate,
  mergeData,
  missingRequired,
  normalizeStructure,
  renderMarkdown,
  slugify,
  snakeCase,
  validateStructure,
} from '../structure'
import type { TemplateStructure } from '../types'

const sample: TemplateStructure = {
  template_meta: { standard: 'ISO 9001', type: 'Report', version: '1.0' },
  sections: [
    {
      id: 's1',
      title: 'Overview',
      fields: [
        { id: 'f1', key: 'project_name', label: 'Project name', type: 'text', required: true },
        { id: 'f2', key: 'risks', label: 'Risks', type: 'list' },
        { id: 'f3', key: 'checks', label: 'Checks', type: 'checklist', options: ['Safety', 'Budget'] },
      ],
    },
  ],
}

describe('structure helpers', () => {
  it('detects structured templates and normalises loose JSON', () => {
    expect(isStructuredTemplate(sample)).toBe(true)
    expect(isStructuredTemplate({ type: 'object', properties: {} })).toBe(false)

    const loose = normalizeStructure({
      sections: [
        { title: 'A', fields: [{ label: 'Start Date', type: 'date' }, { label: 'Start Date', type: 'bogus' }, { key: 'Owner', type: 'input' }] },
      ],
    })
    const keys = loose.sections[0].fields.map((f) => f.key)
    expect(keys).toEqual(['start_date', 'start_date_2', 'owner'])
    expect(loose.sections[0].fields[1].type).toBe('text')
    expect(loose.sections[0].fields[2].type).toBe('text')
    expect(loose.sections[0].id).toBeTruthy()
    expect(loose.template_meta.version).toBe('1.0')
  })

  it('validates keys, options and duplicates', () => {
    expect(validateStructure(sample)).toEqual([])
    const bad: TemplateStructure = {
      template_meta: {},
      sections: [
        { id: 'a', title: '', fields: [{ id: 'x', key: 'Bad Key', label: 'Bad', type: 'select' }, { id: 'y', key: 'dup', label: 'One', type: 'text' }, { id: 'z', key: 'dup', label: 'Two', type: 'text' }] },
      ],
    }
    const errors = validateStructure(bad)
    expect(errors.some((e) => e.includes('no title'))).toBe(true)
    expect(errors.some((e) => e.includes('snake_case'))).toBe(true)
    expect(errors.some((e) => e.includes('option'))).toBe(true)
    expect(errors.some((e) => e.includes('"dup"'))).toBe(true)
  })

  it('builds, merges and checks document data', () => {
    const data = emptyData(sample)
    expect(data.s1.project_name).toBe('')
    expect(data.s1.risks).toEqual([])
    expect(missingRequired(sample, data)).toEqual(['Overview › Project name'])

    const merged = mergeData(sample, { s1: { project_name: 'Solar park', obsolete: 'x' } })
    expect(merged.s1.project_name).toBe('Solar park')
    expect('obsolete' in merged.s1).toBe(false)
    expect(missingRequired(sample, merged)).toEqual([])
  })

  it('renders markdown with lists and checklists', () => {
    const md = renderMarkdown('Q1 report', sample, {
      s1: { project_name: 'Solar park', risks: ['Weather', 'Grid delay'], checks: ['Budget'] },
    })
    expect(md).toContain('# Q1 report')
    expect(md).toContain('_Standard: ISO 9001 · Type: Report · Template version: 1.0_')
    expect(md).toContain('## Overview')
    expect(md).toContain('**Project name**\n\nSolar park')
    expect(md).toContain('- Weather\n- Grid delay')
    expect(md).toContain('- [ ] Safety\n- [x] Budget')
    expect(md.endsWith('\n')).toBe(true)
  })

  it('makes safe keys and slugs', () => {
    expect(snakeCase('Årsrapport – Q1 2026!')).toBe('arsrapport_q1_2026')
    expect(slugify('PRINCE2 Project Brief')).toBe('prince2-project-brief')
  })
})

describe('legacy schema conversion', () => {
  it('turns top-level properties into one section of fields', async () => {
    const { fromLegacySchema } = await import('../structure')
    const s = fromLegacySchema({
      title: 'Risk Register',
      type: 'object',
      required: ['owner'],
      properties: {
        owner: { type: 'string', title: 'Owner' },
        severity: { type: 'string', enum: ['Low', 'High'] },
        due: { type: 'string', format: 'date' },
        items: { type: 'array' },
        count: { type: 'integer' },
      },
    })
    expect(s.sections).toHaveLength(1)
    const byKey = Object.fromEntries(s.sections[0].fields.map((f) => [f.key, f]))
    expect(byKey.owner.required).toBe(true)
    expect(byKey.severity.type).toBe('select')
    expect(byKey.severity.options).toEqual(['Low', 'High'])
    expect(byKey.due.type).toBe('date')
    expect(byKey.items.type).toBe('list')
    expect(byKey.count.type).toBe('number')
  })
})
