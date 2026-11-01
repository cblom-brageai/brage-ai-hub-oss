# Documentation Hub: templates and the document writer

The Documentation Hub turns a document type into a structured template and lets people and employees produce documents from it. It lives entirely in the frontend plus the existing `document_templates` and `artefacts` tables.

## The template structure

A template is JSON stored in `document_templates.json_schema`:

```json
{
  "template_meta": { "standard": "ISO 9001", "type": "Report", "version": "1.0" },
  "sections": [
    {
      "id": "…",
      "title": "Overview",
      "description": "Optional guidance shown under the section title",
      "fields": [
        { "id": "…", "key": "project_name", "label": "Project name", "type": "text", "required": true },
        { "id": "…", "key": "risks", "label": "Key risks", "type": "list", "help_text": "One per line" },
        { "id": "…", "key": "checks", "label": "Pre-flight checks", "type": "checklist", "options": ["Safety", "Budget"] }
      ]
    }
  ]
}
```

Field types: `text`, `textarea`, `number`, `date`, `select` (one of `options`), `checklist` (any of `options`), `list` (free-form bullet list), `user_picker` (a person, with employees offered as suggestions). Keys are unique, lowercase `snake_case`; ids are generated. The types and the pure helpers that normalise, validate and render a structure are in `apps/frontend/src/lib/templates/` and covered by unit tests (`pnpm test`).

Templates saved by the earlier JSON-Schema editor (top-level `properties`) still open: the Studio converts them to one section of fields and replaces the old schema when you save.

## Template Studio (`/documents/studio`)

- **Builder**: add, rename, reorder and delete sections and fields; set type, key, required flag, options, help text and placeholder. Keys follow the label until you edit them by hand.
- **JSON**: edit the raw structure; "Apply JSON" normalises it (missing ids, duplicate keys, unknown types are fixed).
- **Live preview**: the form exactly as a writer will see it.
- **Generate**: describe the document in a sentence; the configured model drafts the sections and fields through the LLM gateway (`/api/templates/generate`, see docs/observability.md for how such calls are traced). Edit the result before saving.
- **Employees**: tick the employees allowed to use the template; the Tasks board offers those templates when delegating to them.

Validation blocks saving on empty section titles, non-snake_case or duplicate keys, and select or checklist fields without options.

## Document writer (`/documents/write`)

Pick a template (or follow a "Write" link from the Templates tab), fill in the form and watch the Markdown preview. Saving creates an artefact:

- `content`: the rendered Markdown, so chat, the meeting Q&A agent, publishing and the document page all see a normal document;
- `metadata.form`: the template meta plus `data` (`{ "<section id>": { "<field key>": value } }`), which lets the document reopen in the form ("Edit in form" on the document page);
- `template_id`, `source: "document-writer"`, and `employee_id` set to the employee the document is written on behalf of (or `hub-user`). The employee determines which publish channels are offered.

Required fields that are still empty are listed above the form but do not block saving a draft.

## Employees and templates

When a task with a template is delegated (`apps/config-api/main.py`, `_run_delegated_task`), the structure is injected into the employee's prompt with instructions to write one `##` heading per section and one bold label per field, and to call `store_result` with `template_id` and the same `metadata.form` shape. Documents employees produce this way open in the form editor too.

## Files

```
apps/frontend/src/lib/templates/            types.ts, structure.ts, __tests__/
apps/frontend/src/components/template-studio/  template-studio.tsx, use-template-state.ts, section-card.tsx, field-card.tsx, generate-modal.tsx
apps/frontend/src/components/document-form/   document-form.tsx, dynamic-field.tsx
apps/frontend/src/app/documents/studio/     new template, [id] edit
apps/frontend/src/app/documents/write/      writer (?template=… or ?artefact=…)
apps/frontend/src/app/api/templates/generate/route.ts   structure generator
apps/frontend/src/app/api/artefacts/route.ts            POST used by the writer
```
