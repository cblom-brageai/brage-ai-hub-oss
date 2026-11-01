import { useState } from 'react'

interface Props {
  onSignIn: (email: string, password: string) => Promise<string | null>
  onSignInWithGoogle: () => Promise<string | null>
}

export function LoginForm({ onSignIn, onSignInWithGoogle }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await onSignIn(email, password)
    if (err) setError(err)
    setLoading(false)
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    const err = await onSignInWithGoogle()
    if (err) setError(err)
    setGoogleLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-5 gap-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
          <span className="text-[rgb(var(--primary-foreground))] font-bold text-sm">B</span>
        </div>
        <span className="font-semibold">Brage Meeting Assistant</span>
      </div>

      <div className="w-full space-y-3">
        <button
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="w-full py-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[rgb(var(--muted))] disabled:opacity-50 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? 'Signing in…' : 'Sign in with Google'}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-[rgb(var(--border))]" />
          <span className="text-xs text-[rgb(var(--muted-foreground))]">or</span>
          <div className="flex-1 h-px bg-[rgb(var(--border))]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[rgb(var(--muted-foreground))] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-sm focus:outline-none focus:border-[rgb(var(--primary))]"
            />
          </div>
          <div>
            <label className="block text-xs text-[rgb(var(--muted-foreground))] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-sm focus:outline-none focus:border-[rgb(var(--primary))]"
            />
          </div>
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 rounded px-2 py-1">{error}</p>
        )}
      </div>
    </div>
  )
}
