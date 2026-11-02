import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchJson, fetchList } from './fetch-json'

function respondWith(body: string, status = 200, contentType = 'application/json') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status, headers: { 'content-type': contentType } }))
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchList', () => {
  it('returns the list when the API answers with an array', async () => {
    respondWith(JSON.stringify([{ id: 'a' }, { id: 'b' }]))
    expect(await fetchList<{ id: string }>('/api/artefacts')).toEqual({
      items: [{ id: 'a' }, { id: 'b' }],
      error: null,
    })
  })

  it('keeps the list empty and surfaces the API error on a failed request', async () => {
    respondWith(JSON.stringify({ error: 'supabaseUrl is required.' }), 500)
    expect(await fetchList('/api/artefacts')).toEqual({ items: [], error: 'supabaseUrl is required.' })
  })

  it('rejects a successful response that is not a list', async () => {
    respondWith(JSON.stringify({ detail: 'Not found' }))
    expect(await fetchList('/api/tasks/1/attachments')).toEqual({
      items: [],
      error: 'Unexpected response from the API',
    })
  })

  it('falls back to the status when the body is not JSON', async () => {
    respondWith('Internal Server Error', 500, 'text/plain')
    expect(await fetchList('/api/tasks/1/attachments')).toEqual({
      items: [],
      error: 'Request failed with status 500',
    })
  })

  it('never rejects when fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )
    expect(await fetchList('/api/artefacts')).toEqual({ items: [], error: 'Failed to fetch' })
  })
})

describe('fetchJson', () => {
  const isDocument = (json: unknown): json is { id: string } =>
    typeof json === 'object' && json !== null && typeof (json as { id?: unknown }).id === 'string'

  it('returns the payload when it has the expected shape', async () => {
    respondWith(JSON.stringify({ id: 'doc-1', title: 'Hello' }))
    expect(await fetchJson('/api/artefacts/doc-1', isDocument)).toEqual({
      data: { id: 'doc-1', title: 'Hello' },
      error: null,
    })
  })

  it('returns the API error instead of an error payload', async () => {
    respondWith(JSON.stringify({ error: 'JSON object requested, multiple (or no) rows returned' }), 500)
    expect(await fetchJson('/api/artefacts/missing', isDocument)).toEqual({
      data: null,
      error: 'JSON object requested, multiple (or no) rows returned',
    })
  })

  it('rejects a successful response with the wrong shape', async () => {
    respondWith('null')
    expect(await fetchJson('/api/artefacts/doc-1', isDocument)).toEqual({
      data: null,
      error: 'Unexpected response from the API',
    })
  })
})
