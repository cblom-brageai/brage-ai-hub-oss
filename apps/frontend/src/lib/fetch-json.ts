/**
 * Fetch JSON from one of the hub's own API routes without trusting its shape.
 *
 * The routes answer failures with `{ error: string }` and a non-2xx status instead of the
 * usual payload (for example `{"error":"supabaseUrl is required."}` with 500 when Supabase
 * is not configured). A bare `fetch(url).then((r) => r.json()).then(setState)` stores that
 * object as list state and the next render crashes on `.filter` / `.map`. These helpers
 * never reject: they resolve to the payload when it has the expected shape, and otherwise
 * to nothing plus the API's error message, so pages keep their empty state and show it.
 */

export interface FetchResult<T> {
  data: T | null
  /** The API's `error` string, or a generic message; null when the request succeeded. */
  error: string | null
}

export async function fetchJson<T>(url: string, isExpected: (json: unknown) => json is T): Promise<FetchResult<T>> {
  try {
    const res = await fetch(url)
    const json: unknown = await res.json().catch(() => null)
    if (res.ok && isExpected(json)) return { data: json, error: null }
    const fallback = res.ok ? 'Unexpected response from the API' : `Request failed with status ${res.status}`
    return { data: null, error: apiError(json) ?? fallback }
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : 'Request failed' }
  }
}

/** `fetchJson` for routes that return a list; resolves to an empty list on any failure. */
export async function fetchList<T>(url: string): Promise<{ items: T[]; error: string | null }> {
  const { data, error } = await fetchJson<T[]>(url, (json): json is T[] => Array.isArray(json))
  return { items: data ?? [], error }
}

function apiError(json: unknown): string | null {
  if (json && typeof json === 'object' && 'error' in json && typeof json.error === 'string' && json.error) {
    return json.error
  }
  return null
}
