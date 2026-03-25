import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const db = getSupabase()

    // Restore existing session
    db.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = db.auth.onAuthStateChange(
      (_event, session: Session | null) => {
        setUser(session?.user ?? null)
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  async function signInWithGoogle(): Promise<string | null> {
    try {
      const redirectTo = chrome.identity.getRedirectURL()
      const db = getSupabase()

      // Get the OAuth URL from Supabase (skip automatic browser redirect)
      const { data, error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error || !data.url) return error?.message ?? 'Failed to get OAuth URL'

      // Open the Google sign-in flow inside Chrome's identity popup
      const callbackUrl: string = await new Promise((resolve, reject) =>
        chrome.identity.launchWebAuthFlow(
          { url: data.url, interactive: true },
          (responseUrl) => {
            if (chrome.runtime.lastError || !responseUrl)
              reject(chrome.runtime.lastError?.message ?? 'Auth flow cancelled')
            else resolve(responseUrl)
          },
        ),
      )

      const url = new URL(callbackUrl)

      // PKCE flow: code in query params
      const code = url.searchParams.get('code')
      if (code) {
        const { error: exchangeError } = await db.auth.exchangeCodeForSession(code)
        return exchangeError?.message ?? null
      }

      // Implicit flow: tokens in URL hash fragment
      const hash = new URLSearchParams(url.hash.slice(1))
      const access_token = hash.get('access_token')
      const refresh_token = hash.get('refresh_token')
      if (!access_token) return 'No auth code or token in callback URL'

      const { error: sessionError } = await db.auth.setSession({
        access_token,
        refresh_token: refresh_token ?? '',
      })
      return sessionError?.message ?? null
    } catch (err) {
      return String(err)
    }
  }

  async function signOut() {
    await getSupabase().auth.signOut()
  }

  return { user, loading, signIn, signInWithGoogle, signOut }
}
