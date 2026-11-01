'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Loader2, Sparkles, Check, AlertCircle } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface EmployeeConfig {
  id: string
  name: string
  description: string
  strategy: string
  personality: string
  agentConfig: string
  skills: { name: string; content: string }[]
}

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Hi! I'll help you set up a new virtual employee for your AI Hub. I'll guide you through everything — role, strategy, personality, and skills.\n\nLet's start: what kind of role do you want to create? For example, Sales Manager, HR Coordinator, Finance Analyst, or something else specific to your business.",
}

function parseEmployeeConfig(text: string): EmployeeConfig | null {
  const match = text.match(/```employee-config\n([\s\S]*?)\n```/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

function stripEmployeeConfig(text: string): string {
  return text.replace(/```employee-config\n[\s\S]*?\n```/, '').trim()
}

export default function NewEmployeePage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingEmployee, setPendingEmployee] = useState<EmployeeConfig | null>(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, pendingEmployee])

  const send = async () => {
    const text = input.trim()
    if (!text || loading || created) return

    setInput('')
    setError('')
    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      const config = parseEmployeeConfig(data.response)
      if (config) setPendingEmployee(config)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error connecting to assistant. Please try again.' },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const createEmployee = async () => {
    if (!pendingEmployee) return
    setCreating(true)
    setError('')

    try {
      const res = await fetch('/api/employees/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingEmployee),
      })
      const data = await res.json()

      if (data.success) {
        setCreated(true)
        setTimeout(() => router.push(`/employees/${data.id}`), 2000)
      } else {
        setError(data.error || 'Failed to create employee.')
      }
    } catch {
      setError('Failed to create employee. Check server logs.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[rgb(var(--border))] px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg hover:bg-[rgb(var(--muted))] transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
            <Sparkles size={14} className="text-[rgb(var(--primary-foreground))]" />
          </div>
          <span className="font-semibold">New Employee Setup</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 gap-4 min-h-0">
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-[rgb(var(--primary))] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles size={12} className="text-[rgb(var(--primary-foreground))]" />
                </div>
              )}
              <div
                className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] rounded-tr-sm'
                    : 'bg-[rgb(var(--muted))] text-[rgb(var(--foreground))] rounded-tl-sm'
                }`}
              >
                {msg.role === 'assistant' ? stripEmployeeConfig(msg.content) : msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-[rgb(var(--primary))] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles size={12} className="text-[rgb(var(--primary-foreground))]" />
              </div>
              <div className="bg-[rgb(var(--muted))] px-4 py-3 rounded-2xl rounded-tl-sm">
                <Loader2 size={16} className="animate-spin text-[rgb(var(--primary))]" />
              </div>
            </div>
          )}

          {/* Employee config preview card */}
          {pendingEmployee && !created && (
            <div className="ml-9">
              <div className="rounded-xl border border-[rgb(var(--primary))] bg-[rgb(var(--card))] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-600 dark:bg-teal-400 flex items-center justify-center text-white dark:text-teal-950 font-bold text-sm flex-shrink-0">
                    {pendingEmployee.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{pendingEmployee.name}</div>
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">{pendingEmployee.id}</div>
                  </div>
                </div>

                <p className="text-xs text-[rgb(var(--muted-foreground))] leading-relaxed">
                  {pendingEmployee.description}
                </p>

                {pendingEmployee.skills?.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {pendingEmployee.skills.map((s) => (
                      <span
                        key={s.name}
                        className="px-2 py-0.5 text-xs rounded-full bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]"
                      >
                        {s.name.replace('.md', '')}
                      </span>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-xs text-red-500">
                    <AlertCircle size={12} />
                    {error}
                  </div>
                )}

                <button
                  onClick={createEmployee}
                  disabled={creating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {creating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  {creating ? 'Creating employee…' : 'Create Employee'}
                </button>
              </div>
            </div>
          )}

          {created && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-sm">
                <Check size={14} />
                Employee created! Redirecting to chat…
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Describe the role or answer the question…"
            className="flex-1 px-4 py-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] placeholder-[rgb(var(--muted-foreground))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors text-sm"
            disabled={loading || created}
            autoFocus
          />
          <button
            onClick={send}
            disabled={loading || !input.trim() || created}
            className="px-4 py-3 rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
