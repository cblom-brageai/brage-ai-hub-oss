import { useState } from 'react'

interface Props {
  onSignIn: (email: string, password: string) => Promise<string | null>
}

export function LoginForm({ onSignIn }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await onSignIn(email, password)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-5 gap-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
          <span className="text-[rgb(var(--primary-foreground))] font-bold text-sm">B</span>
        </div>
        <span className="font-semibold">Brage Meeting Assistant</span>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-3">
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
        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 rounded px-2 py-1">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
