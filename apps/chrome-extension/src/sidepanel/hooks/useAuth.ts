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

  async function signOut() {
    await getSupabase().auth.signOut()
  }

  return { user, loading, signIn, signOut }
}
