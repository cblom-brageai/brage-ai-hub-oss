import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Persist session in chrome.storage.local so it survives service worker restarts
        storage: {
          getItem: async (key) => {
            const result = await chrome.storage.local.get(key)
            return result[key] ?? null
          },
          setItem: async (key, value) => {
            await chrome.storage.local.set({ [key]: value })
          },
          removeItem: async (key) => {
            await chrome.storage.local.remove(key)
          },
        },
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }
  return _client
}
